import {it,expect} from 'vitest';
import {tidyMerchant,tidyTransaction,tidyData} from './merchants';
import {emptyData,type Transaction} from './domain';
const cats=emptyData().categories.map(c=>c.name);
const tx=(merchant:string,category='Otros'):Transaction=>({id:merchant,type:'expense',amountCents:80,merchant,bank:'N26',category,date:'2026-09-23',source:'shortcut'});
it('turns bank descriptors into readable merchants',()=>{
 for(const [raw,name,category] of [['MNE* 95018521Moneynet_S','Máquina expendedora','Restauración'],['DIA ORIHUELA 1488','Dia','Alimentación'],['MERCADONA AGUAS NUEVAS','Mercadona','Alimentación'],['LIDL ELCHE-BOLERA','Lidl','Alimentación'],['PLENERGY US 131 ORIHUELA','Plenergy','Transporte'],['15562 BK ORIHUELA','Burger King','Restauración'],['VENTA BILLETES RENFE','Renfe','Transporte'],['GOOGLE *YouTube Music','YouTube','Suscripciones'],['Amazon Prime*NM2S50X94','Amazon Prime','Suscripciones'],['UNIVERSIDAD MIGUEL HER','Universidad Miguel Hernández','Otros']])expect(tidyMerchant(raw)).toEqual({name,category});
 expect(tidyMerchant('Tatiana O.S. · Coche')).toEqual({name:'Tatiana O.S. · Coche'});
 expect(tidyMerchant('Diario de viaje').name).toBe('Diario de viaje');
});
it('keeps categories chosen by the user and is idempotent',()=>{
 expect(tidyTransaction(tx('MNE* 95018521Moneynet_S'),cats)).toMatchObject({merchant:'Máquina expendedora',category:'Restauración'});
 expect(tidyTransaction(tx('MERCADONA X','Hogar'),cats)).toMatchObject({merchant:'Mercadona',category:'Hogar'});
 const once=tidyData({...emptyData(),transactions:[tx('LIDL ELCHE')]})!;expect(once.transactions[0].merchant).toBe('Lidl');expect(tidyData(once)).toBeNull();
});
it('applies the user rules before the built-in list and renames existing expenses',()=>{
 const rules=[{match:'inturfood',name:'Cafetería campus',category:'Restauración'},{match:'mercadona',name:'Súper de siempre',category:'Hogar'}];
 expect(tidyMerchant('INTURFOOD ALTABIX',rules)).toMatchObject({name:'Cafetería campus',category:'Restauración',custom:true});
 expect(tidyMerchant('MERCADONA AGUAS NUEVAS',rules).name).toBe('Súper de siempre');
 const d=tidyData({...emptyData(),merchantRules:rules,transactions:[tx('INTURFOOD ALTABIX'),tx('Mercadona','Alimentación')]})!;
 expect(d.transactions.map(t=>[t.merchant,t.category])).toEqual([['Cafetería campus','Restauración'],['Súper de siempre','Hogar']]);
 expect(tidyData(d)).toBeNull();
});
