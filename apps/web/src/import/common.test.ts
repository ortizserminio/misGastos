import {describe,it,expect} from 'vitest';
import {parseAmount,parseDate,withIds} from './common';
import {parseCsv} from './csv';
describe('import helpers',()=>{
 it('parses european, dotted and signed amounts to cents',()=>{expect(parseAmount('-1.351,99€')).toBe(-135199);expect(parseAmount('+4,00 €')).toBe(400);expect(parseAmount('-9.490000')).toBe(-949);expect(parseAmount('0.100000')).toBe(10);expect(parseAmount('1.000')).toBe(100000);expect(parseAmount('-1000,00 €')).toBe(-100000);expect(()=>parseAmount('abc')).toThrow();});
 it('parses common date formats',()=>{expect(parseDate('20/04/2026')).toBe('2026-04-20');expect(parseDate('07.09.2026')).toBe('2026-09-07');expect(parseDate('2025-11-01T03:40:59Z')).toBe('2025-11-01');expect(()=>parseDate('31/02/2026')).toThrow();});
 it('numbers identical rows so both survive deduplication',()=>{const r={date:'2026-09-07',amountCents:400,description:'Bizum',kind:'bizum' as const};const [a,b]=withIds('n26',[r,r]);expect(a.externalId).not.toBe(b.externalId);expect(withIds('n26',[r])[0].externalId).toBe(a.externalId);});
 it('reads quoted csv with semicolons and BOM',()=>{expect(parseCsv('﻿a;b\r\n"x;1";"di ""y"""\n')).toEqual([['a','b'],['x;1','di "y"']]);expect(parseCsv('"a","b"\n"1","2"')).toEqual([['a','b'],['1','2']]);});
});
