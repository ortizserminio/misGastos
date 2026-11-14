// POST /api/chat · AI chat over the user's own finances.
// The client sends its Supabase access token and the conversation (text only). The server loads the
// user's data, lets the model call read-only tools over it and returns the final answer.
import { json, ApiError, fail, supabase, sendError } from './_supabase.mjs';
import { complete } from './_ai.mjs';
import { tools, runTool, context } from './_finance.mjs';

export const DAILY_LIMIT = 30;
const MAX_ROUNDS = 6;
export const SYSTEM = [
  'Eres el asistente de misGastos, una app personal de gastos en España. Respondes en español, con frases cortas y claras.',
  'Para cualquier cifra (gastos, ingresos, saldos, comercios, categorías) usa siempre las herramientas: nunca inventes ni estimes importes.',
  'Si una herramienta no devuelve datos, dilo con naturalidad. Si la pregunta es ambigua sobre el periodo, usa el mes actual y dilo.',
  'Escribe los importes en euros con formato español (1.234,56 €). Usa como mucho una lista corta cuando ayude.',
  'Los movimientos "pendientes de revisar" aún no cuentan en los saldos de las cuentas.',
  'Puedes dar consejos generales de ahorro basados en sus datos, pero no recomiendes productos financieros concretos ni inversiones.',
  'Si te preguntan algo que no tiene que ver con sus finanzas personales, dilo en una frase y vuelve al tema.',
].join('\n');

export const madridDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export function conversation(body) {
  const list = body?.messages;
  if (!Array.isArray(list) || !list.length || list.length > 20) fail('La conversación no es válida.');
  const messages = list.map(m => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') fail('La conversación no es válida.');
    const content = m.content.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!content || content.length > 2000) fail('Cada mensaje debe tener entre 1 y 2000 caracteres.');
    return { role: m.role, content };
  });
  if (messages.at(-1).role !== 'user') fail('El último mensaje debe ser tuyo.');
  return messages;
}

async function userFor(req) {
  const header = (req.headers.authorization ?? '').trim();
  const token = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : '';
  if (token.length < 20 || token.length > 4000) throw new ApiError(401, 'unauthorized', 'Inicia sesión para usar el chat.');
  try {
    const user = await supabase('auth/v1/user', { headers: { Authorization: `Bearer ${token}` } });
    if (!user?.id) throw new ApiError(401, 'unauthorized', 'Inicia sesión para usar el chat.');
    return user.id;
  } catch (e) {
    if (e instanceof ApiError && (e.upstream === 401 || e.upstream === 403)) throw new ApiError(401, 'unauthorized', 'Tu sesión ha caducado. Vuelve a entrar.');
    throw e;
  }
}

// Atomic per-user daily counter in Postgres; returns the new count, or -1 if the limit was already reached.
async function bump(userId, day) {
  const count = await supabase('rest/v1/rpc/bump_chat_usage', { method: 'POST', body: JSON.stringify({ p_user: userId, p_day: day, p_limit: DAILY_LIMIT }) });
  if (typeof count !== 'number') throw new ApiError(500, 'database_error', 'No se ha podido comprobar el límite diario.');
  if (count < 0) throw new ApiError(429, 'daily_limit', `Has llegado al límite de ${DAILY_LIMIT} preguntas por hoy. Mañana podrás seguir.`);
  return count;
}

export async function answer(history, data, today) {
  const messages = [{ role: 'system', content: `${SYSTEM}\n\n${context(data, today)}` }, ...history];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const message = await complete({ messages, tools });
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return typeof message.content === 'string' && message.content.trim() ? message.content.trim() : 'No he sabido responder a eso. ¿Puedes preguntarlo de otra forma?';
    messages.push(message);
    for (const call of calls) messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(runTool(call.function?.name, call.function?.arguments, data, today)) });
  }
  return 'La pregunta necesita demasiados pasos. Prueba a hacerla más concreta.';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new ApiError(405, 'method_not_allowed', 'Usa POST.'); }
    const history = conversation(req.body);
    const userId = await userFor(req);
    const today = madridDate();
    const used = await bump(userId, today);
    const rows = await supabase(`rest/v1/user_data?user_id=eq.${encodeURIComponent(userId)}&select=data`);
    const data = rows?.[0]?.data ?? { transactions: [], assets: [], categories: [], accounts: [] };
    const reply = await answer(history, data, today);
    return json(res, 200, { reply, remaining: Math.max(DAILY_LIMIT - used, 0) });
  } catch (error) { return sendError(res, error); }
}
