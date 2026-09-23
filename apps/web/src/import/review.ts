import {type Data,type Transaction,TRANSFER} from '../domain';
import {type ParsedStatement,type ImportRow} from './common';
import {classify,EXTERNAL} from './classify';
export type Status='new'|'duplicate'|'own'|'maybe'|'paired';
export type ReviewRow={row:ImportRow;include:boolean;status:Status;type:Transaction['type'];category:string;other:string;merchant:string};
const prefix=(id?:string)=>id?.split(':')[0]??'';
export const ends=(r:ReviewRow,account:string)=>r.row.amountCents<0?{from:account,to:r.other}:{from:r.other,to:account};
export function findPair(list:Transaction[],c:{amountCents:number;from:string;to:string;date:string;externalId:string},used:Set<string>){return list.find(t=>t.type==='transfer'&&!used.has(t.id)&&!t.pairedExternalId&&prefix(t.externalId)!==prefix(c.externalId)&&t.amountCents===c.amountCents&&Math.abs(Date.parse(t.date)-Date.parse(c.date))<=3*864e5&&((t.bank===c.from&&(t.toAccount===c.to||t.toAccount===EXTERNAL))||(t.toAccount===c.to&&t.bank===EXTERNAL)));}
export function buildReview(st:ParsedStatement,account:string,data:Data):ReviewRow[]{
 const known=new Set(data.transactions.flatMap(t=>[t.externalId,t.pairedExternalId].filter((v):v is string=>!!v))),used=new Set<string>();
 return st.rows.map(row=>{
  const s=classify(row,{account,owner:data.profile.ownerName,assets:data.assets??[],categories:data.categories.map(c=>c.name)});
  const r:ReviewRow={row,include:true,status:'new',type:s.type,category:s.category||'Otros',other:s.other,merchant:row.description.slice(0,200)||'Movimiento importado'};
  if(known.has(row.externalId))return {...r,include:false,status:'duplicate'};
  if(s.type==='transfer'){const p=findPair(data.transactions,{...ends(r,account),amountCents:Math.abs(row.amountCents),date:row.date,externalId:row.externalId},used);if(p)used.add(p.id);return {...r,status:p?'paired':'own'};}
  return {...r,status:s.own==='maybe'?'maybe':'new'};
 });
}
export function applyReview(rows:ReviewRow[],data:Data,account:string){
 const used=new Set<string>(),created:Transaction[]=[];let transactions=[...data.transactions],paired=0;
 for(const r of rows){
  if(!r.include||r.status==='duplicate')continue;
  const amountCents=Math.abs(r.row.amountCents),{from,to}=ends(r,account);
  if(r.type==='transfer'){
   if(!r.other||from===to)throw Error(`Elige la otra cuenta de «${r.merchant}».`);
   const p=findPair(data.transactions,{amountCents,from,to,date:r.row.date,externalId:r.row.externalId},used);
   if(p){used.add(p.id);transactions=transactions.map(t=>t.id===p.id?{...t,bank:from,toAccount:to,pairedExternalId:r.row.externalId}:t);paired++;continue;}
  }
  created.push({id:crypto.randomUUID(),type:r.type,amountCents,merchant:r.merchant,bank:r.type==='transfer'?from:account,...(r.type==='transfer'?{toAccount:to}:{}),category:r.type==='transfer'?TRANSFER:r.category,date:r.row.date,source:'import',externalId:r.row.externalId});
 }
 const names=created.flatMap(t=>[t.bank,t.toAccount??'']).filter(Boolean);
 return {data:{...data,transactions:[...created,...transactions],accounts:Array.from(new Set([...data.accounts,...names]))},created:created.length,paired};
}
