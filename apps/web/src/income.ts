import {byRecent,type MerchantRule,type Transaction} from './domain';
import {normalizeText,tidyMerchant} from './merchants';

export type IncomeGroup={key:string;label:string;totalCents:number;count:number;share:number;items:Transaction[]};

export function incomeBreakdown(transactions:Transaction[],month:string,by:'origin'|'account',rules:MerchantRule[]=[]):{groups:IncomeGroup[];totalCents:number}{
 const income=byRecent(transactions.filter(t=>t.type==='income'&&t.date.startsWith(month)));
 const groups=new Map<string,IncomeGroup>();
 for(const t of income){
  const raw=by==='origin'?t.merchant.trim():t.bank.trim();
  const key=normalizeText(raw);
  let group=groups.get(key);
  if(!group){
   const custom=by==='origin'&&raw?tidyMerchant(raw,rules):null;
   group={key,label:raw?(custom?.custom?custom.name:raw):'Sin indicar',totalCents:0,count:0,share:0,items:[]};
   groups.set(key,group);
  }
  group.totalCents+=t.amountCents;group.count++;group.items.push(t);
 }
 const totalCents=income.reduce((sum,t)=>sum+t.amountCents,0);
 const sorted=[...groups.values()].sort((a,b)=>b.totalCents-a.totalCents||a.label.localeCompare(b.label,'es'));
 if(totalCents){for(const group of sorted)group.share=Math.round(group.totalCents/totalCents*100);sorted[0].share+=100-sorted.reduce((sum,g)=>sum+g.share,0);}
 return {groups:sorted,totalCents};
}
