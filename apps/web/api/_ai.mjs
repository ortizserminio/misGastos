// Chat model through an OpenAI-compatible endpoint. By default Google Gemini (free tier);
// change provider with AI_BASE_URL + AI_MODEL + AI_API_KEY in Vercel without touching code.
import { ApiError } from './_supabase.mjs';

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai';
export function aiConfig() {
  const key = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new ApiError(503, 'ai_not_configured', 'El chat con IA no está configurado todavía.');
  const base = (process.env.AI_BASE_URL || GEMINI).replace(/\/$/, '');
  // Flash-Lite answers simple questions in seconds; the bigger Flash is the fallback when it is busy or out of quota.
  const model = process.env.AI_MODEL || 'gemini-3.5-flash-lite';
  const fallback = process.env.AI_FALLBACK_MODEL ?? (base === GEMINI ? 'gemini-3.8-flash' : '');
  return { key, base, models: [...new Set([model, fallback].filter(Boolean))] };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const TIMEOUT = 25_000; // a hung free-tier call must not leave the user on "Pensando…" for minutes
// Gemini 3 Flash thinks at "high" by default, far too slow for these questions. Lowest level each model accepts.
const EFFORT = { 'gemini-3.5-flash-lite': 'minimal', 'gemini-3.8-flash': 'low' };
async function call({ key, base }, model, messages, tools) {
  try {
    return await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', reasoning_effort: EFFORT[model] }), signal: AbortSignal.timeout(TIMEOUT) });
  } catch (e) { return { ok: false, status: 0, timedOut: e?.name === 'TimeoutError', error: `${e?.name}: ${e?.cause?.code ?? e?.message}` }; }
}

// One chat-completions call. `model` pins the model already used in this conversation turn, because
// Gemini's thought signatures (extra_content on tool_calls) are only valid for the model that wrote them.
// Returns the assistant message exactly as received, plus the model that answered.
export async function complete({ messages, tools, model }) {
  const config = aiConfig(), models = model ? [model] : config.models;
  let last = null;
  for (const candidate of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call(config, candidate, messages, tools);
      if (response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.choices?.[0]?.message;
        if (!message) throw new ApiError(502, 'ai_error', 'La IA no devolvió ninguna respuesta.');
        return { message, model: candidate };
      }
      last = response.status;
      const detail = response.error ?? await response.text().then(t => { try { return JSON.parse(t)?.error?.message ?? t; } catch { return t; } }).catch(() => '');
      console.error(`chat: ${candidate} respondió HTTP ${last}: ${String(detail).replace(/\s+/g, ' ').slice(0, 200)}`);
      if (response.timedOut) break; // retrying a model that just hung would double the wait: go to the next one
      if (last === 0 || last === 500 || last === 503) { if (attempt === 0) { await wait(800); continue; } break; }
      if (last === 404 || last === 429) break; // unknown model or its quota is spent: try the next one
      throw new ApiError(502, 'ai_error', `La IA respondió con un error (HTTP ${last}).`);
    }
  }
  if (last === 429) throw new ApiError(429, 'ai_rate_limited', 'La IA gratuita ha llegado a su límite por ahora. Prueba dentro de un rato.');
  if (last === 0) throw new ApiError(502, 'ai_unreachable', 'No se ha podido contactar con la IA. Inténtalo en un momento.');
  if (last === 404) throw new ApiError(502, 'ai_error', 'El modelo de IA configurado no está disponible.');
  throw new ApiError(503, 'ai_busy', 'La IA gratuita está saturada ahora mismo. Prueba de nuevo en unos segundos.');
}
