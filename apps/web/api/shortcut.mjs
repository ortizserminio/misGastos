<<<<<<< HEAD
import { createHash } from 'node:crypto';
import { json, ApiError, fail, supabase, sendError } from './_supabase.mjs';
=======
import { createHash, timingSafeEqual } from 'node:crypto';
>>>>>>> main

function text(value, label, max) {
  if (typeof value !== 'string' || value.trim().length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${label}: texto obligatorio.`);
  return value.trim();
}
// Wallet may send "12,50 €", "€12.50", "1.234,56 €" or a number; keep only the amount.
export function cents(value) {
  let raw = typeof value === 'number' ? String(value) : String(value ?? '').replace(/[^\d.,-]/g, '');
  raw = raw.replace(/^-/, '');
  const comma = raw.lastIndexOf(','), dot = raw.lastIndexOf('.');
  if (comma > dot) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (comma >= 0) raw = raw.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(raw)) fail(`Importe no válido: «${String(value ?? '').slice(0, 40)}».`);
  const amount = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99999999) fail('Importe fuera de rango.');
  return amount;
}
// Any usual date format is accepted; anything else falls back to today instead of rejecting the payment.
export function isoDate(value) {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof value !== 'string' || !value.trim()) return today;
  const s = value.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/), d = '';
  if (m) d = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const parsed = new Date(`${d}T12:00:00Z`);
  return d && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d ? d : today;
}
<<<<<<< HEAD
export const hashToken = token => createHash('sha256').update(token).digest('hex');
// Each user has a personal token; only its SHA-256 is stored in shortcut_tokens.
async function userFor(req) {
  const supplied = (req.headers.authorization ?? '').startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : '';
  if (supplied.length < 20 || supplied.length > 200) throw new ApiError(401, 'unauthorized', 'Token Bearer no válido.');
  const rows = await supabase(`rest/v1/shortcut_tokens?token_hash=eq.${hashToken(supplied)}&select=user_id`);
  if (!rows?.length) throw new ApiError(401, 'unauthorized', 'Token Bearer no válido.');
  return rows[0].user_id;
=======
const optional = (value, max) => typeof value === 'string' && value.trim() ? value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : null;
function auth(req) {
  const expected = (process.env.SHORTCUT_TOKEN ?? '').trim();
  const header = (req.headers.authorization ?? '').trim();
  const supplied = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, '').trim() : '';
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
>>>>>>> main
}
export function input(body) {
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { fail('El cuerpo debe ser JSON.'); } }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('JSON no válido.');
  const amountCents = cents(body.importe);
  const merchant = optional(body.comercio, 200) ?? 'Apple Pay';
  const bank = optional(body.banco, 100);
  const card = optional(body.tarjeta, 200);
  const date = isoDate(body.fecha);
  // Without idEvento, retries of the same payment in the same minute still collapse into one expense.
  const eventId = optional(body.idEvento, 128) ?? `auto-${createHash('sha256').update(`${amountCents}|${merchant}|${bank ?? card ?? ''}|${new Date().toISOString().slice(0, 16)}`).digest('hex').slice(0, 32)}`;
  return { amountCents, merchant, bank, card, eventId, date };
}
function transaction(row) {
  return { id: row.event_id, type: 'expense', amountCents: row.amount_cents, merchant: row.merchant, bank: row.bank ?? '', category: 'Otros', date: row.occurred_at.slice(0, 10), source: 'shortcut', externalId: row.event_id };
}

export default async function handler(req, res) {
  try {
    const userId = await userFor(req);
    const path = new URL(req.url, 'https://misgastos.invalid').pathname;
    if (req.method === 'GET' && path.endsWith('/health')) return json(res, 200, { ok: true, service: 'misGastos' });
    if (req.method === 'POST' && path.endsWith('/shortcut')) {
      const value = input(req.body);
      const existing = await supabase(`rest/v1/shortcut_events?event_id=eq.${encodeURIComponent(value.eventId)}&user_id=eq.${userId}&select=*`);
      if (existing.length) {
        const row = existing[0];
        if (row.amount_cents !== value.amountCents || row.merchant !== value.merchant) throw new ApiError(409, 'idempotency_conflict', 'Este idEvento ya se usó con otro pago. Usa un idEvento con segundos (por ejemplo la fecha con formato ISO 8601) o quítalo.');
        return json(res, 200, { ok: true, message: 'Este pago ya estaba registrado.', transaction: transaction(row), duplicate: true });
      }
<<<<<<< HEAD
      const bank = value.bank ?? value.card;
      const rows = await supabase('rest/v1/shortcut_events', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ event_id: value.eventId, user_id: userId, amount_cents: value.amountCents, merchant: value.merchant, bank, card: value.card, occurred_at: `${value.date}T12:00:00Z` }) });
      return json(res, 201, { transaction: transaction(rows[0]), duplicate: false });
=======
      const bank = value.bank ?? value.card ?? 'Apple Pay';
      const rows = await supabase('shortcut_events', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ event_id: value.eventId, amount_cents: value.amountCents, merchant: value.merchant, bank, card: value.card, occurred_at: `${value.date}T12:00:00Z` }) });
      return json(res, 201, { ok: true, message: `Gasto de ${(value.amountCents / 100).toFixed(2).replace('.', ',')} € en ${value.merchant} registrado.`, transaction: transaction(rows[0]), duplicate: false });
>>>>>>> main
    }
    throw new ApiError(404, 'not_found', 'Ruta no disponible.');
  } catch (error) {
    return sendError(res, error);
  }
}
