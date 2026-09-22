import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const MAX_BODY = 16 * 1024;

class ApiError extends Error {
  constructor(status, error, message) { super(message); this.status = status; this.error = error; }
}
function invalid(message) { throw new ApiError(422, 'validation_error', message); }
function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Se necesita un objeto JSON.');
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid('El objeto contiene campos desconocidos.');
}
function text(value, label, max, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) invalid(`${label}: texto obligatorio de ${min} a ${max} caracteres sin caracteres de control.`);
  return value.trim();
}

export function parseAmount(value) {
  if (!['string', 'number'].includes(typeof value)) invalid('Importe: número EUR positivo.');
  const raw = String(value);
  if (!/^(0|[1-9]\d{0,5})(?:[.,]\d{1,2})?$/.test(raw)) invalid('Importe: usa coma o punto decimal, sin separadores de miles ni más de dos decimales.');
  const [whole, fractional = ''] = raw.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
  if (cents <= 0 || cents > 99999999) invalid('Importe: debe estar entre 0,01 y 999999,99 EUR.');
  return cents;
}

function date(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) invalid('Fecha: usa YYYY-MM-DD.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid('Fecha no válida.');
  return value;
}
function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function normalizeShortcut(body) {
  object(body, ['importe', 'comercio', 'banco', 'tarjeta', 'fecha', 'idEvento']);
  const normalized = {
    amountCents: parseAmount(body.importe),
    merchant: text(body.comercio, 'Comercio', 200),
    bank: body.banco === undefined ? null : text(body.banco, 'Banco', 100),
    card: body.tarjeta === undefined ? null : text(body.tarjeta, 'Tarjeta', 200),
    date: body.fecha === undefined ? null : date(body.fecha),
    externalId: text(body.idEvento, 'idEvento', 128, 8),
  };
  if (!normalized.bank && !normalized.card) invalid('Indica un banco o una tarjeta asociada.');
  return normalized;
}
function mappings(body) {
  object(body, ['items']);
  if (!Array.isArray(body.items) || body.items.length > 100) invalid('items debe ser una lista de hasta 100 asociaciones.');
  const seen = new Set();
  return body.items.map(item => {
    object(item, ['tarjeta', 'banco']);
    const tarjeta = text(item.tarjeta, 'Tarjeta', 200);
    const banco = text(item.banco, 'Banco', 100);
    if (seen.has(tarjeta)) invalid('No repitas una tarjeta en las asociaciones.');
    seen.add(tarjeta);
    return { tarjeta, banco };
  });
}

function localHost(value) {
  return typeof value === 'string' && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(value);
}
function authorize(req, token, publicRoute) {
  if (!localHost(req.headers.host)) throw new ApiError(403, 'forbidden_host', 'El receptor solo admite acceso local.');
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new ApiError(403, 'forbidden_origin', 'Origen no autorizado.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || !localHost(parsed.host) || parsed.origin !== origin) throw new ApiError(403, 'forbidden_origin', 'Origen no autorizado.');
  }
  if (publicRoute) return;
  const authorization = req.headers.authorization ?? '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const suppliedBuffer = Buffer.from(supplied);
  if (suppliedBuffer.length !== token.length || !timingSafeEqual(suppliedBuffer, token)) throw new ApiError(401, 'unauthorized', 'Se necesita un token Bearer válido.');
}
async function jsonBody(req) {
  if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(415, 'unsupported_media_type', 'Usa Content-Type: application/json.');
  if (Number(req.headers['content-length']) > MAX_BODY) throw new ApiError(413, 'payload_too_large', 'El JSON no puede superar 16 KB.');
  let size = 0;
  const chunks = [];
  // Do not destroy the request on overflow: the client must receive the 413 JSON.
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY) { req.resume(); throw new ApiError(413, 'payload_too_large', 'El JSON no puede superar 16 KB.'); }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'invalid_json', 'El cuerpo no es JSON válido.'); }
}
function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}

export function createApp({ dataDir = DEFAULT_DATA_DIR } = {}) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const tokenPath = join(dataDir, 'token.txt');
  try { writeFileSync(tokenPath, `${randomBytes(32).toString('hex')}\n`, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const tokenText = readFileSync(tokenPath, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(tokenText)) throw new Error('El archivo token.txt no contiene un token válido de 32 bytes.');
  const token = Buffer.from(tokenText);
  const db = new DatabaseSync(join(dataDir, 'misgastos.sqlite'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS transactions (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      external_id TEXT NOT NULL UNIQUE,
      input_json TEXT NOT NULL,
      transaction_json TEXT NOT NULL,
      transaction_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS card_mappings (tarjeta TEXT PRIMARY KEY, banco TEXT NOT NULL);`);
  const getEvent = db.prepare('SELECT input_json, transaction_json FROM transactions WHERE external_id = ?');
  const getBank = db.prepare('SELECT banco FROM card_mappings WHERE tarjeta = ?');
  const insertEvent = db.prepare('INSERT INTO transactions (id, external_id, input_json, transaction_json, transaction_date) VALUES (?, ?, ?, ?, ?)');
  const listTransactions = db.prepare('SELECT transaction_json FROM transactions ORDER BY transaction_date DESC, sequence DESC');
  const listMappings = db.prepare('SELECT tarjeta, banco FROM card_mappings ORDER BY tarjeta');
  const insertMapping = db.prepare('INSERT INTO card_mappings (tarjeta, banco) VALUES (?, ?)');

  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
      authorize(req, token, req.method === 'GET' && pathname === '/api/health');
      if (req.method === 'GET' && pathname === '/api/health') return reply(res, 200, { ok: true, service: 'misGastos' });
      if (req.method === 'GET' && pathname === '/api/transactions') return reply(res, 200, { items: listTransactions.all().map(row => JSON.parse(row.transaction_json)) });
      if (req.method === 'GET' && pathname === '/api/card-mappings') return reply(res, 200, { items: listMappings.all() });
      if (req.method === 'PUT' && pathname === '/api/card-mappings') {
        const items = mappings(await jsonBody(req));
        db.exec('BEGIN IMMEDIATE');
        try {
          db.exec('DELETE FROM card_mappings');
          for (const item of items) insertMapping.run(item.tarjeta, item.banco);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return reply(res, 200, { items: listMappings.all() });
      }
      if (req.method === 'POST' && pathname === '/api/shortcut') {
        const input = normalizeShortcut(await jsonBody(req));
        const inputJson = JSON.stringify(input);
        db.exec('BEGIN IMMEDIATE');
        let transaction;
        let duplicate = false;
        try {
          const existing = getEvent.get(input.externalId);
          if (existing) {
            if (existing.input_json !== inputJson) throw new ApiError(409, 'idempotency_conflict', 'Este idEvento ya se utilizó con otros datos.');
            transaction = JSON.parse(existing.transaction_json);
            duplicate = true;
          } else {
            const bank = input.bank ?? getBank.get(input.card)?.banco;
            if (!bank) invalid('Tarjeta desconocida: asóciala a un banco o indica banco explícitamente.');
            transaction = { id: randomUUID(), type: 'expense', amountCents: input.amountCents, merchant: input.merchant, bank, category: 'Otros', date: input.date ?? today(), source: 'shortcut', externalId: input.externalId };
            insertEvent.run(transaction.id, input.externalId, inputJson, JSON.stringify(transaction), transaction.date);
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return reply(res, duplicate ? 200 : 201, { transaction, duplicate });
      }
      throw new ApiError(404, 'not_found', 'Ruta o método no disponible.');
    } catch (error) {
      // Never log request bodies, tokens or financial details.
      if (error instanceof ApiError) reply(res, error.status, { error: error.error, message: error.message });
      else reply(res, 500, { error: 'internal_error', message: 'No se pudo completar la operación local.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, close: () => new Promise((resolveClose, reject) => {
    server.close(error => { db.close(); if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error); else resolveClose(); });
    server.closeIdleConnections();
  }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.MISGASTOS_PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MISGASTOS_PORT debe ser un puerto entre 1 y 65535.');
  const app = createApp({ dataDir: process.env.MISGASTOS_DATA_DIR ? resolve(process.env.MISGASTOS_DATA_DIR) : DEFAULT_DATA_DIR });
  app.server.on('error', error => { console.error(`No se pudo iniciar el receptor (${error.code ?? 'error'}).`); process.exitCode = 1; });
  app.server.listen(port, '127.0.0.1', () => console.log(`misGastos: receptor local http://127.0.0.1:${port}. Token privado en el directorio de datos; no se muestra en logs.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { app.close().then(() => process.exit(0)); });
}
