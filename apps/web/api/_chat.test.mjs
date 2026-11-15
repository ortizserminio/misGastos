import test from 'node:test';
import assert from 'node:assert/strict';
import chat, { conversation, answer, DAILY_LIMIT } from './chat.mjs';
import { resumenPeriodo, buscarMovimientos, compararMeses, saldosCuentas, runTool, context, range } from './_finance.mjs';

process.env.SUPABASE_URL = 'https://demo.supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-demo';
const AI = 'https://ai.invalid/v1';

const tx = (id, type, amountCents, merchant, category, date, extra = {}) => ({ id, type, amountCents, merchant, category, date, bank: 'N26', source: 'manual', ...extra });
const data = {
  categories: [{ name: 'Restauración' }, { name: 'Alimentación' }],
  accounts: ['N26'],
  assets: [{ id: 'n26', type: 'Cuenta', bank: 'N26', name: 'N26', color: '#000000', notes: 'secreto', iban: 'ES0000000000000000000000', valuations: [], openingBalance: { date: '2026-11-01', valueCents: 100000 } }],
  transactions: [
    tx('a', 'expense', 1250, 'Bar Pepe', 'Restauración', '2026-11-02'),
    tx('b', 'expense', 4000, 'MERCADONA', 'Alimentación', '2026-11-03'),
    tx('c', 'expense', 2000, 'Mercadona', 'Alimentación', '2026-11-10', { pending: true }),
    tx('d', 'income', 150000, 'Nómina Empresa', 'Otros', '2026-11-05'),
    tx('e', 'expense', 3000, 'Bar Pepe', 'Restauración', '2026-10-20'),
  ],
};
const today = '2026-11-15';

test('range defaults to the current month and accepts months or days', () => {
  assert.deepEqual(range({}, today), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(range({ desde: '2026-10', hasta: '2026-11' }, today), { start: '2026-10-01', end: '2026-11-30' });
  assert.deepEqual(range({ desde: '2026-11-20', hasta: '2026-11-01' }, today), { start: '2026-11-01', end: '2026-11-20' });
});

test('resumen_periodo totals the month and groups expenses by category', () => {
  const r = resumenPeriodo(data, {}, today);
  assert.equal(r.gastos, 72.5); assert.equal(r.ingresos, 1500); assert.equal(r.ahorro, 1427.5); assert.equal(r.pendientes_de_revisar, 1);
  assert.deepEqual(r.gastos_por_categoria[0], { categoria: 'Alimentación', importe: 60 });
});

test('buscar_movimientos ignores case and accents and never leaks IBAN or notes', () => {
  const r = buscarMovimientos(data, { texto: 'mercadona' }, today);
  assert.equal(r.encontrados, 2); assert.equal(r.total, 60);
  assert.equal(buscarMovimientos(data, { texto: 'nomina', tipo: 'ingreso' }, today).encontrados, 1);
  const all = JSON.stringify([r, saldosCuentas(data), resumenPeriodo(data, {}, today)]);
  assert.ok(!all.includes('ES0000') && !all.includes('secreto'));
  assert.equal(buscarMovimientos(data, { limite: 1, orden: 'importe' }, today).movimientos[0].comercio, 'Nómina Empresa');
});

test('comparar_meses and saldos_cuentas follow the app rules (pending does not move balances)', () => {
  const c = compararMeses(data, { meses: ['2026-10', '2026-11'] }, today);
  assert.deepEqual(c.meses.map(m => m.gastos), [30, 72.5]);
  assert.deepEqual(saldosCuentas(data).cuentas[0].saldo, 2447.5); // 1000 + 1500 - 12.50 - 40 (pending 20 not deducted)
});

test('saldos_cuentas values investments like Patrimonio: latest valuation plus contributions it does not include', () => {
  const fund = { id: 'fondo', type: 'Inversión', bank: 'MyInvestor', name: 'Fondo', color: '#000000', notes: '', valuations: [{ date: '2026-10-01', valueCents: 100000, includedInvestmentIds: ['old'] }] };
  const withFund = { ...data, assets: [...data.assets, fund], transactions: [...data.transactions,
    tx('old', 'transfer', 50000, 'Aportación', 'Transferencia', '2026-09-15', { investmentAssetId: 'fondo', toAccount: 'Fondo' }),
    tx('new', 'transfer', 20000, 'Aportación', 'Transferencia', '2026-11-04', { investmentAssetId: 'fondo', toAccount: 'Fondo' }),
    tx('skip', 'transfer', 9900, 'Aportación', 'Transferencia', '2026-11-06', { investmentAssetId: 'fondo', toAccount: 'Fondo', pending: true }),
  ] };
  const fondo = saldosCuentas(withFund).cuentas.find(c => c.nombre === 'Fondo');
  assert.equal(fondo.saldo, 1200); // 1000 valued + 200 new contribution; "old" already included, pending ignored
});

test('runTool rejects unknown tools and bad JSON without throwing', () => {
  assert.match(runTool('borrar_todo', '{}', data, today).error, /desconocida/);
  assert.match(runTool('resumen_periodo', '{no json', data, today).error, /JSON/);
  assert.equal(runTool('saldos_cuentas', '', data, today).cuentas.length, 1);
  assert.match(context(data, today), /Hoy es 2026-11-15\. Categorías: Restauración, Alimentación\. Cuentas: N26\./);
});

test('conversation validates roles, length and that the last turn is the user', () => {
  assert.equal(conversation({ messages: [{ role: 'user', content: ' hola ' }] })[0].content, 'hola');
  assert.throws(() => conversation({ messages: [] }));
  assert.throws(() => conversation({ messages: [{ role: 'system', content: 'x' }] }));
  assert.throws(() => conversation({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }));
  assert.throws(() => conversation({ messages: [{ role: 'user', content: 'x'.repeat(2001) }] }));
});

// Scripted fetch: Supabase routes by path, the AI endpoint by a queue of replies.
function mockFetch({ user = { id: 'u1' }, count = 1, aiReplies = [], authStatus = 200 } = {}) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ url, body, headers: options.headers });
    if (url.startsWith(AI)) { const next = aiReplies.shift(); if (next.throw) throw next.throw; return new Response(JSON.stringify(next.body ?? { choices: [{ message: next }] }), { status: next.status ?? 200 }); }
    const path = url.replace(process.env.SUPABASE_URL + '/', '');
    if (path === 'auth/v1/user') return new Response(JSON.stringify(authStatus === 200 ? user : { msg: 'bad jwt' }), { status: authStatus });
    if (path === 'rest/v1/rpc/bump_chat_usage') return new Response(JSON.stringify(count), { status: 200 });
    if (path.startsWith('rest/v1/user_data')) return new Response(JSON.stringify([{ data }]), { status: 200 });
    return new Response('{}', { status: 404 });
  };
  return calls;
}
function response() { const res = { statusCode: 0, body: null, headers: {} }; res.status = c => { res.statusCode = c; return res; }; res.setHeader = (k, v) => { res.headers[k] = v; return res; }; res.json = b => { res.body = b; return res; }; return res; }
const request = (body, token = 'a'.repeat(40)) => ({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body });

test('chat runs the tool loop, sends tool results back and returns the answer', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI; process.env.AI_MODEL = 'modelo-demo';
  const toolCall = { role: 'assistant', content: null, tool_calls: [{ id: 'call1', type: 'function', function: { name: 'buscar_movimientos', arguments: '{"texto":"mercadona"}' }, extra_content: { google: { thought_signature: 'sig' } } }] };
  const calls = mockFetch({ count: 3, aiReplies: [toolCall, { role: 'assistant', content: 'Has gastado **60,00 €** en Mercadona.' }] });
  const res = response();
  await chat(request({ messages: [{ role: 'user', content: '¿Cuánto en Mercadona?' }] }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { reply: 'Has gastado **60,00 €** en Mercadona.', remaining: DAILY_LIMIT - 3 });
  const ai = calls.filter(c => c.url.startsWith(AI));
  assert.equal(ai.length, 2); assert.equal(ai[0].body.model, 'modelo-demo'); assert.equal(ai[0].headers.Authorization, 'Bearer ai-key');
  const second = ai[1].body.messages;
  assert.deepEqual(second.at(-2), toolCall); // assistant turn replayed unchanged, thought signature included
  assert.equal(second.at(-1).role, 'tool'); assert.equal(JSON.parse(second.at(-1).content).encontrados, 2);
  assert.match(second[0].content, /Hoy es \d{4}-\d{2}-\d{2}\./);
  assert.equal(calls.find(c => c.url.endsWith('auth/v1/user')).headers.Authorization, `Bearer ${'a'.repeat(40)}`);
});

test('chat answers 401 without a valid session and 429 after the daily limit', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI;
  mockFetch(); let res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }, 'corto'), res); assert.equal(res.statusCode, 401);
  mockFetch({ authStatus: 401 }); res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }), res); assert.equal(res.statusCode, 401);
  const calls = mockFetch({ count: -1 }); res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }), res);
  assert.equal(res.statusCode, 429); assert.equal(res.body.error, 'daily_limit');
  assert.equal(calls.filter(c => c.url.startsWith(AI)).length, 0);
});

test('chat reports 503 when no AI key is configured and maps provider 429', async () => {
  delete process.env.AI_API_KEY; delete process.env.GEMINI_API_KEY;
  mockFetch(); let res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }), res);
  assert.equal(res.statusCode, 503); assert.equal(res.body.error, 'ai_not_configured');
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI;
  mockFetch({ aiReplies: [{ status: 429, body: { error: 'quota' } }] }); res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }), res);
  assert.equal(res.statusCode, 429); assert.equal(res.body.error, 'ai_rate_limited');
});

test('a busy free model (503) is retried once, then the fallback model answers', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI; process.env.AI_MODEL = 'principal'; process.env.AI_FALLBACK_MODEL = 'ligero';
  const busy = { status: 503, body: { error: { message: 'The model is overloaded.' } } };
  let calls = mockFetch({ aiReplies: [busy, { role: 'assistant', content: 'Bien.' }] });
  assert.equal(await answer([{ role: 'user', content: 'hola' }], data, today), 'Bien.');
  assert.deepEqual(calls.filter(c => c.url.startsWith(AI)).map(c => c.body.model), ['principal', 'principal']);
  calls = mockFetch({ aiReplies: [busy, busy, { role: 'assistant', content: 'Desde el ligero.' }] });
  assert.equal(await answer([{ role: 'user', content: 'hola' }], data, today), 'Desde el ligero.');
  assert.deepEqual(calls.filter(c => c.url.startsWith(AI)).map(c => c.body.model), ['principal', 'principal', 'ligero']);
  mockFetch({ aiReplies: [busy, busy, busy, busy] }); const res = response();
  await chat(request({ messages: [{ role: 'user', content: 'hola' }] }), res);
  assert.equal(res.statusCode, 503); assert.equal(res.body.error, 'ai_busy');
  delete process.env.AI_FALLBACK_MODEL; process.env.AI_MODEL = 'modelo-demo';
});

test('a model that hangs is not retried: the fallback answers', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI; process.env.AI_MODEL = 'principal'; process.env.AI_FALLBACK_MODEL = 'ligero';
  const hung = { throw: new DOMException('The operation was aborted due to timeout', 'TimeoutError') };
  const calls = mockFetch({ aiReplies: [hung, { role: 'assistant', content: 'Desde el ligero.' }] });
  assert.equal(await answer([{ role: 'user', content: 'hola' }], data, today), 'Desde el ligero.');
  assert.deepEqual(calls.filter(c => c.url.startsWith(AI)).map(c => c.body.model), ['principal', 'ligero']);
  delete process.env.AI_FALLBACK_MODEL; process.env.AI_MODEL = 'modelo-demo';
});

test('once a model answers, the rest of the tool loop stays on it (thought signatures are per model)', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI; process.env.AI_MODEL = 'principal'; process.env.AI_FALLBACK_MODEL = 'ligero';
  const toolCall = { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'saldos_cuentas', arguments: '{}' } }] };
  const calls = mockFetch({ aiReplies: [{ status: 404, body: { error: { message: 'not found' } } }, toolCall, { role: 'assistant', content: 'Listo.' }] });
  assert.equal(await answer([{ role: 'user', content: 'saldos' }], data, today), 'Listo.');
  assert.deepEqual(calls.filter(c => c.url.startsWith(AI)).map(c => c.body.model), ['principal', 'ligero', 'ligero']);
  delete process.env.AI_FALLBACK_MODEL; process.env.AI_MODEL = 'modelo-demo';
});

test('answer stops after too many tool rounds', async () => {
  process.env.AI_API_KEY = 'ai-key'; process.env.AI_BASE_URL = AI;
  const loop = { role: 'assistant', content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'saldos_cuentas', arguments: '{}' } }] };
  mockFetch({ aiReplies: Array.from({ length: 6 }, () => structuredClone(loop)) });
  assert.match(await answer([{ role: 'user', content: 'hola' }], data, today), /demasiados pasos/);
});
