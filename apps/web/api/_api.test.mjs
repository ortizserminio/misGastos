import test from 'node:test';
import assert from 'node:assert/strict';
import signup from './signup.mjs';
import shortcut, { hashToken } from './shortcut.mjs';

process.env.SUPABASE_URL = 'https://demo.supabase.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-demo';

// Minimal Vercel-like response and a scripted fetch that records calls.
function response() { const res = { statusCode: 0, body: null, headers: {} }; res.status = c => { res.statusCode = c; return res; }; res.setHeader = (k, v) => { res.headers[k] = v; return res; }; res.json = b => { res.body = b; return res; }; return res; }
function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = url.replace(process.env.SUPABASE_URL + '/', '');
    calls.push({ path, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : undefined });
    const route = routes.find(([match]) => path.startsWith(match));
    const [status, body] = route ? route[1](path, options) : [404, { message: 'no route' }];
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return calls;
}
const valid = { email: 'Amiga@Ejemplo.com ', password: 'secreta123', code: 'AMIGOS-2026' };

test('signup consumes the invite and creates a confirmed user', async () => {
  const calls = mockFetch([['rest/v1/rpc/consume_invite', () => [200, true]], ['auth/v1/admin/users', () => [200, { id: 'u1' }]]]);
  const res = response(); await signup({ method: 'POST', body: valid }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(calls.map(c => c.path), ['rest/v1/rpc/consume_invite', 'auth/v1/admin/users']);
  assert.deepEqual(calls[1].body, { email: 'amiga@ejemplo.com', password: 'secreta123', email_confirm: true });
});

test('signup rejects a used or unknown code without creating a user', async () => {
  const calls = mockFetch([['rest/v1/rpc/consume_invite', () => [200, null]]]);
  const res = response(); await signup({ method: 'POST', body: valid }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('signup refunds the code when the email already exists', async () => {
  const calls = mockFetch([['rest/v1/rpc/consume_invite', () => [200, true]], ['auth/v1/admin/users', () => [422, { code: 'email_exists' }]], ['rest/v1/rpc/refund_invite', () => [204, undefined]]]);
  const res = response(); await signup({ method: 'POST', body: valid }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(calls.at(-1).path, 'rest/v1/rpc/refund_invite');
});

test('signup validates email and password before touching Supabase', async () => {
  const calls = mockFetch([]);
  for (const body of [{ ...valid, email: 'no-es-email' }, { ...valid, password: 'corta' }, { ...valid, code: '' }]) {
    const res = response(); await signup({ method: 'POST', body }, res);
    assert.equal(res.statusCode, 422);
  }
  assert.equal(calls.length, 0);
});

const token = 'token-personal-de-prueba-123456';
const event = { importe: '12,34', comercio: 'Comercio de prueba', banco: 'Banco sintético', fecha: '2026-09-22', idEvento: 'evento-1' };
const shortcutRequest = (auth, body = event) => ({ method: 'POST', url: '/api/shortcut', headers: { authorization: auth }, body });

test('shortcut rejects unknown tokens', async () => {
  mockFetch([['rest/v1/shortcut_tokens', () => [200, []]]]);
  const res = response(); await shortcut(shortcutRequest(`Bearer ${token}`), res);
  assert.equal(res.statusCode, 401);
});

test('shortcut stores the event for the token owner', async () => {
  const calls = mockFetch([
    ['rest/v1/shortcut_tokens', path => { assert.ok(path.includes(hashToken(token))); return [200, [{ user_id: 'u1' }]]; }],
    ['rest/v1/shortcut_events?', () => [200, []]],
    ['rest/v1/shortcut_events', (_p, o) => [201, [{ ...JSON.parse(o.body) }]]],
  ]);
  const res = response(); await shortcut(shortcutRequest(`Bearer ${token}`), res);
  assert.equal(res.statusCode, 201);
  assert.ok(calls[1].path.includes('user_id=eq.u1'));
  assert.equal(calls[2].body.user_id, 'u1');
  assert.equal(res.body.transaction.amountCents, 1234);
});

test('shortcut does not duplicate a repeated event of the same user', async () => {
  mockFetch([['rest/v1/shortcut_tokens', () => [200, [{ user_id: 'u1' }]]], ['rest/v1/shortcut_events?', () => [200, [{ event_id: 'evento-1', amount_cents: 1234, merchant: 'Comercio de prueba', bank: 'Banco sintético', occurred_at: '2026-09-22T12:00:00Z' }]]]]);
  const res = response(); await shortcut(shortcutRequest(`Bearer ${token}`), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.duplicate, true);
});
