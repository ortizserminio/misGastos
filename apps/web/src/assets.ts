export const assetTypes = ['Cuenta','Efectivo','Ahorro','Inversión','Otro'] as const;
export type Asset = {id:string;type:typeof assetTypes[number];bank:string;name:string;color:string;notes:string;valuations:{date:string;valueCents:number}[]};
// Editable display presets, not official bank branding or a banking connection.
export const banks = [{name:'N26',color:'#174B47'},{name:'BBVA',color:'#123D82'},{name:'Santander',color:'#B91C35'},{name:'CaixaBank',color:'#126887'},{name:'Trade Republic',color:'#252525'},{name:'ING',color:'#A64B08'},{name:'Revolut',color:'#5042A8'},{name:'Otro banco',color:'#1E293B'}];
export function parseAssetValue(raw:string){const value=raw.trim();if(!/^-?\d{1,9}([.,]\d{1,2})?$/.test(value))throw Error('Escribe un valor en euros con hasta dos decimales, sin separadores de miles.');const [a,b='']=value.replace('-','').replace(',','.').split('.');return (value.startsWith('-')?-1:1)*(Number(a)*100+Number(b.padEnd(2,'0')));}
export function assetValue(asset:Asset){return [...asset.valuations].sort((a,b)=>b.date.localeCompare(a.date))[0]?.valueCents??0;}
export function portfolioHistory(assets:Asset[]){const dates=[...new Set(assets.flatMap(a=>a.valuations.map(v=>v.date)))].sort();return dates.map(date=>({date,valueCents:assets.reduce((sum,a)=>sum+([...a.valuations].filter(v=>v.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.valueCents??0),0)}));}
export function validateAssets(value:unknown):Asset[]{
 if(value===undefined)return [];
 const txt=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
 if(!Array.isArray(value)||value.some(a=>!a||!txt(a.id,200)||!a.id||!assetTypes.includes(a.type)||!txt(a.name,100)||!a.name.trim()||!txt(a.bank,100)||!txt(a.notes,2000)||typeof a.color!=='string'||!/^#[0-9a-f]{6}$/i.test(a.color)||!Array.isArray(a.valuations)||!a.valuations.length||a.valuations.some((v:any)=>!v||typeof v.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(Date.parse(v.date))||new Date(v.date).toISOString().slice(0,10)!==v.date||!Number.isSafeInteger(v.valueCents)||Math.abs(v.valueCents)>99999999999)||new Set(a.valuations.map((v:any)=>v.date)).size!==a.valuations.length)||new Set(value.map(a=>a.id)).size!==value.length)throw Error('Patrimonio no válido en la copia.');
 return value.map(a=>({id:a.id,type:a.type,bank:a.bank,name:a.name,color:a.color,notes:a.notes,valuations:a.valuations.map((v:any)=>({date:v.date,valueCents:v.valueCents}))}));
}
