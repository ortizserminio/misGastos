import {it,expect} from 'vitest';
import {cleanAccounts} from './accountsCleanup';
import {emptyData,type Transaction} from './domain';
import type {Asset} from './assets';
const n26:Asset={id:'n',type:'Cuenta',bank:'N26',name:'N26',color:'#174B47',notes:'',valuations:[],openingBalance:{date:'2026-09-01',valueCents:10000}};
const tx=(bank:string):Transaction=>({id:bank+Math.random(),type:'expense',amountCents:50,merchant:'x',bank,category:'Otros',date:'2026-09-23',source:'shortcut'});
it('joins case variants with the Patrimonio account and drops unused names',()=>{const d=cleanAccounts({...emptyData(),assets:[n26],accounts:['Efectivo','N26','n26','Banco de prueba','Otra usada'],transactions:[tx('n26'),tx('Otra usada')]})!;expect(d.transactions[0].bank).toBe('N26');expect(d.accounts).toEqual(['Efectivo','N26','Otra usada']);expect(cleanAccounts(d)).toBeNull();});
