import type {Data} from './domain';
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// Joins account names that only differ in case/accents with the matching Patrimonio account ("n26" → "N26")
// and drops account names that are not accounts in Patrimonio and no movement uses any more.
export function cleanAccounts(data:Data):Data|null{
 const assets=data.assets??[],canon=new Map(assets.map(a=>[norm(a.name),a.name]));
 const fix=(name:string)=>canon.get(norm(name))??name;
 let changed=false;
 const transactions=data.transactions.map(t=>{const bank=fix(t.bank),to=t.toAccount===undefined?undefined:fix(t.toAccount);if((bank===t.bank&&to===t.toAccount)||(to!==undefined&&bank===to))return t;changed=true;return {...t,bank,...(to!==undefined?{toAccount:to}:{})};});
 const used=new Set(transactions.flatMap(t=>[t.bank,t.toAccount??'']));
 const accounts=Array.from(new Set(data.accounts.map(fix))).filter(a=>a==='Efectivo'||assets.some(x=>x.name===a)||used.has(a));
 if(accounts.length!==data.accounts.length||accounts.some((a,i)=>a!==data.accounts[i]))changed=true;
 return changed?{...data,transactions,accounts:accounts.length?accounts:['Efectivo']}:null;
}
