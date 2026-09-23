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
describe('data v2',()=>{
 it('migrates v1 backups adding default categories and empty profile',()=>{const v1={version:1,transactions:[tx],accounts:['Efectivo'],budgets:{}};const d=validateBackup(JSON.stringify(v1));expect(d.version).toBe(2);expect(d.categories.map(c=>c.name)).toContain('Alimentación');expect(d.profile).toEqual({displayName:'',ownerName:''});});
 it('accepts transfers between different accounts and excludes them from totals',()=>{const t={...tx,id:'tr',type:'transfer' as const,bank:'TR',toAccount:'N26',category:'Transferencia',source:'import' as const,externalId:'tr:1'};const d={...emptyData(),transactions:[tx,t]};expect(validateBackup(JSON.stringify(d)).transactions).toHaveLength(2);expect(()=>validateBackup(JSON.stringify({...d,transactions:[{...t,toAccount:'TR'}]}))).toThrow();const s=summary([tx,t],'2026-09');expect(s.expense).toBe(1050);expect(s.income).toBe(0);});
 it('rejects duplicated category names',()=>{expect(()=>validateBackup(JSON.stringify({...emptyData(),categories:[{name:'Ocio',color:'#7c3aed'},{name:'ocio',color:'#7c3aed'}]}))).toThrow();});
});
