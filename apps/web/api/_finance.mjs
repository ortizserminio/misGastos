// Read-only finance tools for the AI chat. They run on the server over the user's own data
// (user_data.data) and return only what the model asked for. No IBAN, notes or profile data
// ever leave this file.
const euros = cents => Math.round(cents) / 100;
const MAX_ROWS = 40;
const isMonth = v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const clean = (v, max = 80) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const norm = v => clean(v, 200).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
export function shiftMonth(month, delta) { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + delta, 1)); return d.toISOString().slice(0, 7); }
const monthEnd = month => { const [y, m] = month.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

// Accepts {desde, hasta} as YYYY-MM-DD or YYYY-MM; defaults to the current month of `today`.
export function range(args = {}, today) {
  // Without "desde", the period starts at the first of the month of "hasta" (or of today).
  const start = isMonth(args.desde) ? `${args.desde}-01` : isDate(args.desde) ? args.desde : `${(isMonth(args.hasta) || isDate(args.hasta) ? args.hasta : today).slice(0, 7)}-01`;
  const end = isMonth(args.hasta) ? monthEnd(args.hasta) : isDate(args.hasta) ? args.hasta : monthEnd(start.slice(0, 7));
  return start <= end ? { start, end } : { start: end, end: start };
}
const inRange = (t, r) => t.date >= r.start && t.date <= r.end;
const txs = data => Array.isArray(data?.transactions) ? data.transactions : [];
const row = t => ({ fecha: t.date, tipo: t.type === 'income' ? 'ingreso' : t.type === 'transfer' ? 'transferencia' : 'gasto', importe: euros(t.amountCents), comercio: clean(t.merchant), categoria: clean(t.category, 40), cuenta: clean(t.bank, 40), ...(t.toAccount ? { a_cuenta: clean(t.toAccount, 40) } : {}), ...(t.pending ? { pendiente_de_revisar: true } : {}) });
const byCategory = list => Object.entries(list.reduce((a, t) => { a[t.category] = (a[t.category] || 0) + t.amountCents; return a; }, Object.create(null))).sort((a, b) => b[1] - a[1]).map(([categoria, c]) => ({ categoria, importe: euros(c) }));
const sum = list => list.reduce((a, t) => a + t.amountCents, 0);

export function resumenPeriodo(data, args, today) {
  const r = range(args, today), list = txs(data).filter(t => inRange(t, r));
  const gastos = list.filter(t => t.type === 'expense'), ingresos = list.filter(t => t.type === 'income');
  return { desde: r.start, hasta: r.end, gastos: euros(sum(gastos)), ingresos: euros(sum(ingresos)), ahorro: euros(sum(ingresos) - sum(gastos)), movimientos: list.length, pendientes_de_revisar: list.filter(t => t.pending).length, gastos_por_categoria: byCategory(gastos).slice(0, 15) };
}

export function buscarMovimientos(data, args, today) {
  const r = range(args, today), texto = norm(args.texto), categoria = norm(args.categoria), cuenta = norm(args.cuenta);
  const tipo = { gasto: 'expense', ingreso: 'income', transferencia: 'transfer' }[args.tipo] ?? null;
  const min = Number.isFinite(args.importe_min) ? Math.round(args.importe_min * 100) : null, max = Number.isFinite(args.importe_max) ? Math.round(args.importe_max * 100) : null;
  const limite = Math.min(Math.max(Number.isInteger(args.limite) ? args.limite : 20, 1), MAX_ROWS);
  const found = txs(data).filter(t => inRange(t, r) && (!tipo || t.type === tipo) && (!texto || norm(t.merchant).includes(texto)) && (!categoria || norm(t.category) === categoria) && (!cuenta || norm(t.bank) === cuenta || norm(t.toAccount) === cuenta) && (min === null || t.amountCents >= min) && (max === null || t.amountCents <= max));
  const sorted = [...found].sort(args.orden === 'importe' ? (a, b) => b.amountCents - a.amountCents : (a, b) => b.date.localeCompare(a.date));
  return { desde: r.start, hasta: r.end, encontrados: found.length, total: euros(sum(found)), mostrados: Math.min(limite, found.length), movimientos: sorted.slice(0, limite).map(row) };
}

export function compararMeses(data, args, today) {
  const meses = (Array.isArray(args.meses) ? args.meses.filter(isMonth) : []).slice(0, 12);
  const list = meses.length ? [...new Set(meses)] : [shiftMonth(today.slice(0, 7), -1), today.slice(0, 7)];
  return { meses: list.sort().map(m => { const t = txs(data).filter(x => x.date.startsWith(m)), g = t.filter(x => x.type === 'expense'), i = t.filter(x => x.type === 'income'); return { mes: m, gastos: euros(sum(g)), ingresos: euros(sum(i)), ahorro: euros(sum(i) - sum(g)), top_categorias: byCategory(g).slice(0, 5) }; }) };
}

// Same rule as accountBalance() in src/assets.ts: pending or skipBalance movements do not change any balance.
function delta(name, t) { if (t.pending || t.skipBalance) return 0; if (t.type === 'transfer') return (t.toAccount === name ? t.amountCents : 0) - (t.bank === name ? t.amountCents : 0); if (t.bank !== name) return 0; return t.type === 'income' ? t.amountCents : -t.amountCents; }
const latestValuation = a => [...(a.valuations ?? [])].sort((x, y) => x.date.localeCompare(y.date)).at(-1);
// Same rule as the last point of assetSeries() in src/assets.ts: the latest valuation plus every
// linked contribution (transfer with investmentAssetId) that valuation does not already include.
function investmentValue(a, data) {
  const valuation = latestValuation(a), included = new Set(valuation?.includedInvestmentIds ?? []);
  const contributions = txs(data).filter(t => t.type === 'transfer' && t.investmentAssetId === a.id && !t.pending && !t.skipBalance && !included.has(t.id));
  return (valuation?.valueCents ?? 0) + sum(contributions);
}
export function saldosCuentas(data) {
  const assets = Array.isArray(data?.assets) ? data.assets : [];
  const cuentas = assets.map(a => { const o = a.openingBalance; const cents = a.type === 'Inversión' ? investmentValue(a, data) : o ? txs(data).reduce((n, t) => t.date >= o.date ? n + delta(a.name, t) : n, o.valueCents) : (latestValuation(a)?.valueCents ?? 0); return { nombre: clean(a.name, 60), tipo: a.type, banco: clean(a.bank, 40), saldo: euros(cents), ...(a.type === 'Inversión' ? { nota: 'última valoración más las aportaciones posteriores' } : {}) }; });
  return { cuentas, total: Math.round(cuentas.reduce((n, c) => n + c.saldo * 100, 0)) / 100 };
}

const period = { desde: { type: 'string', description: 'Inicio: YYYY-MM-DD o YYYY-MM. Por defecto, el mes actual.' }, hasta: { type: 'string', description: 'Fin: YYYY-MM-DD o YYYY-MM. Por defecto, el final del mes de "desde".' } };
export const tools = [
  { type: 'function', function: { name: 'resumen_periodo', description: 'Totales de gastos, ingresos y ahorro de un periodo, con el gasto por categoría.', parameters: { type: 'object', properties: period } } },
  { type: 'function', function: { name: 'buscar_movimientos', description: 'Busca movimientos concretos con filtros. Devuelve el total, el número encontrado y como mucho 40 filas.', parameters: { type: 'object', properties: { ...period, tipo: { type: 'string', enum: ['gasto', 'ingreso', 'transferencia'] }, texto: { type: 'string', description: 'Parte del nombre del comercio o del origen, sin distinguir mayúsculas ni tildes.' }, categoria: { type: 'string', description: 'Nombre exacto de una categoría.' }, cuenta: { type: 'string', description: 'Nombre exacto de una cuenta.' }, importe_min: { type: 'number' }, importe_max: { type: 'number' }, orden: { type: 'string', enum: ['fecha', 'importe'] }, limite: { type: 'integer', minimum: 1, maximum: 40 } } } } },
  { type: 'function', function: { name: 'comparar_meses', description: 'Compara gastos, ingresos, ahorro y principales categorías de varios meses.', parameters: { type: 'object', properties: { meses: { type: 'array', items: { type: 'string', description: 'YYYY-MM' }, maxItems: 12 } } } } },
  { type: 'function', function: { name: 'saldos_cuentas', description: 'Saldo actual de cada cuenta de Patrimonio y el total.', parameters: { type: 'object', properties: {} } } },
];
const handlers = { resumen_periodo: resumenPeriodo, buscar_movimientos: buscarMovimientos, comparar_meses: compararMeses, saldos_cuentas: saldosCuentas };
export function runTool(name, rawArgs, data, today) {
  const fn = handlers[name];
  if (!fn) return { error: `Herramienta desconocida: ${name}` };
  let args = {};
  try { args = typeof rawArgs === 'string' && rawArgs.trim() ? JSON.parse(rawArgs) : (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}); } catch { return { error: 'Argumentos no válidos (JSON).' }; }
  try { return fn(data, args ?? {}, today); } catch (e) { return { error: 'No se ha podido calcular.' }; }
}
// Context sent with every question: names for the tools, plus this month's and last month's summary
// so the common questions ("¿cómo voy?", "¿en qué gasto más?", "compara con el mes pasado") need no tool round.
export function context(data, today) {
  const cats = (Array.isArray(data?.categories) ? data.categories.map(c => clean(c?.name, 40)) : []).filter(Boolean);
  const accounts = [...new Set([...(Array.isArray(data?.assets) ? data.assets.map(a => clean(a?.name, 60)) : []), ...(Array.isArray(data?.accounts) ? data.accounts.map(a => clean(a, 60)) : [])])].filter(Boolean);
  const summary = { mes_actual: resumenPeriodo(data, {}, today), mes_anterior: resumenPeriodo(data, { desde: shiftMonth(today.slice(0, 7), -1) }, today) };
  return `Hoy es ${today}. Categorías: ${cats.join(', ') || 'ninguna'}. Cuentas: ${accounts.join(', ') || 'ninguna'}.\nResumen ya calculado (importes en euros): ${JSON.stringify(summary)}`;
}
