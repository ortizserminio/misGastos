import { randomUUID, timingSafeEqual } from 'node:crypto';

const json = (res, status, body) => {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
};

class ApiError extends Error {
  constructor(status, error, message) { super(message); this.status = status; this.error = error; }
}

function fail(message) { throw new ApiError(422, 'validation_error', message); }
function text(value, label, max) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label}: texto obligatorio.`);
  return value.trim();
}
function cents(value) {
  const raw = String(value ?? '');
  if (!/^(0|[1-9]\d{0,5})(?:[.,]\d{1,2})?$/.test(raw)) fail('Importe no válido.');
  const [whole, fraction = ''] = raw.replace(',', '.').split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99999999) fail('Importe fuera de rango.');
  return amount;
}
function isoDate(value) {
  if (value === undefined) return new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Fecha no válida.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Fecha no válida.');
  return value;
}
function auth(req) {
  const expected = process.env.SHORTCUT_TOKEN ?? '';
  const supplied = (req.headers.authorization ?? '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'unauthorized', 'Token Bearer no válido.');
}
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ApiError(500, 'configuration_error', 'Faltan variables de Supabase en Vercel.');
  return { url: url.replace(/\/$/, ''), key };
}
async function supabase(path, options = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new ApiError(502, 'database_error', `Supabase respondió HTTP ${response.status}: ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}
function input(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('JSON no válido.');
  const amountCents = cents(body.importe);
  const merchant = text(body.comercio, 'Comercio', 200);
  const bank = body.banco === undefined ? null : text(body.banco, 'Banco', 100);
  const card = body.tarjeta === undefined ? null : text(body.tarjeta, 'Tarjeta', 200);
  const eventId = text(body.idEvento, 'idEvento', 128);
  if (!bank && !card) fail('Indica banco o tarjeta.');
  return { amountCents, merchant, bank, card, eventId, date: isoDate(body.fecha) };
}
function transaction(row) {
  return { id: row.event_id, type: 'expense', amountCents: row.amount_cents, merchant: row.merchant, bank: row.bank ?? '', category: 'Otros', date: row.occurred_at.slice(0, 10), source: 'shortcut', externalId: row.event_id };
}

export default async function handler(req, res) {
  try {
    auth(req);
    const path = new URL(req.url, 'https://misgastos.invalid').pathname;
    if (req.method === 'GET' && path.endsWith('/health')) return json(res, 200, { ok: true, service: 'misGastos' });
    if (req.method === 'GET' && path.endsWith('/transactions')) {
      const rows = await supabase('shortcut_events?select=*&order=occurred_at.desc,created_at.desc');
      return json(res, 200, { items: rows.map(transaction) });
    }
    if (req.method === 'GET' && path.endsWith('/card-mappings')) return json(res, 200, { items: [] });
    if (req.method === 'POST' && path.endsWith('/shortcut')) {
      const value = input(req.body);
      const existing = await supabase(`shortcut_events?event_id=eq.${encodeURIComponent(value.eventId)}&select=*`);
      if (existing.length) {
        const row = existing[0];
        if (row.amount_cents !== value.amountCents || row.merchant !== value.merchant) throw new ApiError(409, 'idempotency_conflict', 'Este idEvento ya se utilizó con otros datos.');
        return json(res, 200, { transaction: transaction(row), duplicate: true });
      }
      const bank = value.bank ?? value.card;
      const rows = await supabase('shortcut_events', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ event_id: value.eventId, amount_cents: value.amountCents, merchant: value.merchant, bank, card: value.card, occurred_at: `${value.date}T12:00:00Z` }) });
      return json(res, 201, { transaction: transaction(rows[0]), duplicate: false });
    }
    throw new ApiError(404, 'not_found', 'Ruta no disponible.');
  } catch (error) {
    return json(res, error instanceof ApiError ? error.status : 500, { error: error.error ?? 'internal_error', message: error.message ?? 'Error interno.' });
  }
}
