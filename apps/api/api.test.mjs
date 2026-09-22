import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';

const api = await import('./server.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const payload = { importe: '12,34', comercio: 'Comercio de prueba', banco: 'Banco sintético', fecha: '2026-09-22', idEvento: 'evento-sintetico-001' };

async function fixture(t) {
  assert.equal(typeof api.createApp, 'function', 'El receptor debe exponer createApp');
  const dir = await mkdtemp(join(tmpdir(), 'misgastos-test-'));
  let app = api.createApp({ dataDir: dir });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const token = (await readFile(join(dir, 'token.txt'), 'utf8')).trim();
  const call = (path, { method = 'GET', body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: app.server.address().port, path, method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers } }, res => {
      let text = ''; res.on('data', chunk => text += chunk); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  return { dir, token, call, restart: async () => { await app.close(); app = api.createApp({ dataDir: dir }); await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); } };
}

test('importe uses exact positive EUR cents and rejects ambiguous inputs', () => {
  assert.equal(typeof api.parseAmount, 'function', 'Se necesita validación exacta del importe');
  for (const [value, expected] of [['12,34', 1234], ['0.01', 1], [1.1, 110], ['999999.99', 99999999], ['12', 1200]]) assert.equal(api.parseAmount(value), expected);
  for (const value of [0, -1, Infinity, NaN, null, true, '', '1.234', '1,234.00', '1e2', '1 000', '1000000', '0.001', 1.234, ' 12 ', '01.00']) assert.throws(() => api.parseAmount(value));
});

test('health is public; data requires bearer and safe host/origin', async t => {
  const { call, token } = await fixture(t);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.deepEqual((await call('/api/health', { headers: { Authorization: '' } })).body, { ok: true, service: 'misGastos' });
  for (const headers of [{ Authorization: '' }, { Authorization: 'Bearer wrong' }, { Authorization: `Bearer ${token}x` }]) assert.equal((await call('/api/transactions', { headers })).status, 401);
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { Origin: 'http://localhost.evil.example' }, { Host: 'evil.example' }]) assert.equal((await call('/api/transactions', { headers })).status, 403);
  const safe = await call('/api/transactions', { headers: { Origin: 'http://127.0.0.1:5173' } });
  assert.equal(safe.status, 200); assert.deepEqual(safe.body, { items: [] }); assert.equal(safe.headers['access-control-allow-origin'], undefined);
});

test('creates real transactions, canonical duplicate retry, conflict and restart persistence', async t => {
  const { call, restart, dir, token } = await fixture(t);
  const first = await call('/api/shortcut', { method: 'POST', body: payload });
  assert.equal(first.status, 201); assert.equal(first.body.duplicate, false);
  assert.deepEqual({ ...first.body.transaction, id: 'id' }, { id: 'id', type: 'expense', amountCents: 1234, merchant: 'Comercio de prueba', bank: 'Banco sintético', category: 'Otros', date: '2026-09-22', source: 'shortcut', externalId: 'evento-sintetico-001' });
  const duplicate = await call('/api/shortcut', { method: 'POST', body: { ...payload, importe: 12.34 } });
  assert.equal(duplicate.status, 200); assert.equal(duplicate.body.duplicate, true); assert.equal(duplicate.body.transaction.id, first.body.transaction.id);
  assert.equal((await call('/api/shortcut', { method: 'POST', body: { ...payload, comercio: 'Otro comercio' } })).status, 409);
  await restart(); assert.equal((await readFile(join(dir, 'token.txt'), 'utf8')).trim(), token);
  assert.equal((await call('/api/shortcut', { method: 'POST', body: payload })).status, 200);
  assert.deepEqual((await call('/api/transactions')).body.items, [first.body.transaction]);
});

test('exact card mapping resolves bank; explicit bank wins; updates are atomic and persistent', async t => {
  const { call, restart } = await fixture(t);
  const put = items => call('/api/card-mappings', { method: 'PUT', body: { items } });
  assert.equal((await put([{ tarjeta: 'Tarjeta prueba', banco: 'Banco A' }])).status, 200);
  const mapped = { ...payload, banco: undefined, tarjeta: 'Tarjeta prueba' };
  assert.equal((await call('/api/shortcut', { method: 'POST', body: mapped })).body.transaction.bank, 'Banco A');
  assert.equal((await call('/api/shortcut', { method: 'POST', body: { ...mapped, tarjeta: 'Visa', idEvento: 'unknown-event' } })).status, 422);
  const explicit = await call('/api/shortcut', { method: 'POST', body: { ...mapped, banco: 'Banco explícito', idEvento: 'explicit-event' } });
  assert.equal(explicit.body.transaction.bank, 'Banco explícito');
  assert.equal((await put([{ tarjeta: 'Tarjeta prueba', banco: 'Banco cambiado' }, { tarjeta: 'incompleta' }])).status, 422);
  assert.equal((await put([{ tarjeta: 'dup', banco: 'A' }, { tarjeta: 'dup', banco: 'B' }])).status, 422);
  assert.equal((await put(Array.from({ length: 101 }, (_, i) => ({ tarjeta: `T${i}`, banco: 'B' })))).status, 422);
  await restart(); assert.deepEqual((await call('/api/card-mappings')).body.items, [{ tarjeta: 'Tarjeta prueba', banco: 'Banco A' }]);
  await put([{ tarjeta: 'Tarjeta prueba', banco: 'Banco nuevo' }]);
  const retry = await call('/api/shortcut', { method: 'POST', body: mapped });
  assert.equal(retry.status, 200); assert.equal(retry.body.transaction.bank, 'Banco A');
});

test('rejects invalid dates, malformed bodies and fields without writing data', async t => {
  const { call } = await fixture(t);
  for (const patch of [{ fecha: '2026-02-29' }, { fecha: '2026-13-01' }, { fecha: '2026-1-01' }, { fecha: '0000-01-01' }, { comercio: ' ' }, { comercio: 'x'.repeat(201) }, { banco: '' }, { idEvento: 'short' }, { idEvento: 'x'.repeat(129) }, { importe: '1.234' }, { tarjeta: {} }, { importe: null }, { unknown: 'unexpected' }]) {
    const result = await call('/api/shortcut', { method: 'POST', body: { ...payload, ...patch } });
    assert.equal(result.status, 422, JSON.stringify(patch)); assert.equal(typeof result.body.error, 'string');
  }
  for (const body of [[], null, 'broken-json']) assert.equal((await call('/api/shortcut', { method: 'POST', body })).status, body === 'broken-json' ? 400 : 422);
  assert.equal((await call('/api/shortcut', { method: 'POST', body: { ...payload, comercio: 'x'.repeat(17000) } })).status, 413);
  assert.equal((await call('/api/shortcut', { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await call('/api/shortcut', { method: 'POST', body: { ...payload, fecha: '2024-02-29' } })).status, 201);
  assert.equal((await call('/api/transactions')).body.items.length, 1);
});

test('simultaneous replays create one row and list sorts dates descending', async t => {
  const { call } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 5 }, () => call('/api/shortcut', { method: 'POST', body: payload })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 200, 200, 201]);
  await call('/api/shortcut', { method: 'POST', body: { ...payload, idEvento: 'older-event', fecha: '2026-01-01' } });
  await call('/api/shortcut', { method: 'POST', body: { ...payload, idEvento: 'newer-event', fecha: '2026-12-01' } });
  assert.deepEqual((await call('/api/transactions')).body.items.map(row => row.date), ['2026-12-01', '2026-09-22', '2026-01-01']);
});

test('an omitted date is resolved once even when a retry occurs the next day', async t => {
  const { call, restart } = await fixture(t);
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-22T12:00:00Z') });
  const undated = { ...payload, fecha: undefined };
  const first = await call('/api/shortcut', { method: 'POST', body: undated });
  assert.equal(first.status, 201); assert.equal(first.body.transaction.date, '2026-09-22');
  t.mock.timers.tick(86400000);
  await restart();
  const retry = await call('/api/shortcut', { method: 'POST', body: undated });
  assert.equal(retry.status, 200); assert.deepEqual(retry.body.transaction, first.body.transaction);
});

test('unknown routes stay private and errors never contain token or database paths', async t => {
  const { call, token, dir } = await fixture(t);
  assert.equal((await call('/api/missing', { headers: { Authorization: '' } })).status, 401);
  const missing = await call('/api/missing');
  assert.equal(missing.status, 404); assert.equal(typeof missing.body.message, 'string');
  const unknown = await call('/api/shortcut', { method: 'POST', body: { ...payload, banco: undefined, tarjeta: 'No configurada' } });
  assert.equal(unknown.status, 422);
  const serialized = JSON.stringify([missing.body, unknown.body, (await call('/api/transactions')).body]);
  assert.equal(serialized.includes(token), false); assert.equal(serialized.includes(dir), false);
});
