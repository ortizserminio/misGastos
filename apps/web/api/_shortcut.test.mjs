import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, isoDate, input } from './shortcut.mjs';

test('accepts amounts as the iPhone Wallet sends them', () => {
  for (const [raw, expected] of [['12,50 €', 1250], ['€12.50', 1250], ['1.234,56 €', 123456], [12.5, 1250], ['-9,00 €', 900], ['2,5', 250]]) assert.equal(cents(raw), expected);
  assert.throws(() => cents('abc'), /Importe no válido/);
});
test('accepts usual date formats and falls back to today', () => {
  assert.equal(isoDate('23/9/2026'), '2026-09-23');
  assert.equal(isoDate('2026-09-23T14:55:00+02:00'), '2026-09-23');
  assert.equal(isoDate('texto raro'), new Date().toISOString().slice(0, 10));
});
test('only the amount is required; the rest has safe defaults', () => {
  const value = input(JSON.stringify({ importe: '3,20 €' }));
  assert.equal(value.amountCents, 320);
  assert.equal(value.merchant, 'Apple Pay');
  assert.match(value.eventId, /^auto-/);
});
