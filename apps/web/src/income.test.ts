import {describe,it,expect} from 'vitest';
import {incomeBreakdown} from './income';
import {summary,type Transaction} from './domain';

const item=(id:string,merchant:string,amountCents:number,extra:Partial<Transaction>={}):Transaction=>({id,type:'income',amountCents,merchant,bank:'N26',category:'Otros',date:'2026-11-10',source:'manual',...extra});

describe('incomeBreakdown',()=>{
 it('groups case, accents and spaces and shows the newest merchant name',()=>{
  const items=[item('old','NOMINA  EMPRESA SL',10000,{date:'2026-11-01'}),item('new','Nómina Empresa SL',20000,{date:'2026-11-12'})];
  expect(incomeBreakdown(items,'2026-11','origin').groups).toMatchObject([{label:'Nómina Empresa SL',totalCents:30000,count:2,share:100}]);
 });
 it('uses custom merchant names and groups empty names',()=>{
  const result=incomeBreakdown([item('a','Acme SA',100),item('b','',100)],'2026-11','origin',[{match:'acme',name:'Empresa',category:'Otros'}]);
  expect(result.groups.map(g=>g.label)).toEqual(['Empresa','Sin indicar']);
 });
 it('returns no groups for a month without income',()=>{
  expect(incomeBreakdown([item('a','A',100)],'2026-10','origin')).toEqual({groups:[],totalCents:0});
 });
 it('matches summary income and excludes expenses and transfers',()=>{
  const items=[item('a','A',101,{pending:true,skipBalance:true}),item('b','B',99),item('c','C',500,{type:'expense'}),item('d','D',600,{type:'transfer',toAccount:'BBVA'})];
  expect(incomeBreakdown(items,'2026-11','account').totalCents).toBe(summary(items,'2026-11').income);
  expect(incomeBreakdown(items,'2026-11','account').groups).toMatchObject([{label:'N26',count:2,totalCents:200}]);
 });
 it('makes integer shares total 100',()=>{
  const result=incomeBreakdown([item('a','A',1),item('b','B',1),item('c','C',1)],'2026-11','origin');
  expect(result.groups.reduce((sum,g)=>sum+g.share,0)).toBe(100);
 });
});
