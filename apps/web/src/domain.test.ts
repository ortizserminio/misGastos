import {describe,it,expect} from 'vitest';
import {parseMoney, summary, validateBackup, mergeTransactions, emptyData} from './domain';
const tx={id:'one',type:'expense' as const,amountCents:1050,merchant:'Tienda demo',bank:'Efectivo',category:'Otros',date:'2026-09-22',source:'manual' as const};
describe('money and data integrity',()=>{
 it('groups imported category names without prototype collisions',()=>{const result=summary([{...tx,category:'constructor'}], '2026-09');expect(result.grouped).toEqual([['constructor',1050]]);});
 it('parses exact cents and rejects ambiguous amounts',()=>{expect(parseMoney('10,50')).toBe(1050); for(const bad of ['1.234,50','0','-1','1.001','abc']) expect(()=>parseMoney(bad)).toThrow();});
 it('keeps income separate and handles zero comparison base',()=>{const result=summary([tx,{...tx,id:'two',type:'income',amountCents:5000}], '2026-09');expect(result.expense).toBe(1050);expect(result.income).toBe(5000);expect(result.change).toBe(null);});
 it('restores valid backup and rejects impossible dates and fractional cents',()=>{const data={...emptyData(),transactions:[tx]};expect(validateBackup(JSON.stringify(data))).toEqual(data);expect(()=>validateBackup(JSON.stringify({...data,transactions:[{...tx,date:'2026-02-30'}]}))).toThrow();expect(()=>validateBackup(JSON.stringify({...data,transactions:[{...tx,amountCents:1.5}]}))).toThrow();});
 it('merges shortcuts idempotently without dropping manual expenses',()=>{const remote={...tx,id:'remote',source:'shortcut' as const,externalId:'event-123'};expect(mergeTransactions([tx,remote],[{...remote,id:'another'}])).toHaveLength(2);expect(mergeTransactions([tx],[remote,remote])).toHaveLength(2);});
});
