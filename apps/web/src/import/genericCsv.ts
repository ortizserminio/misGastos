import {type ParsedStatement,type ImportRow,parseAmount,parseDate,withIds} from './common';
export type CsvMapping={date:number;description:number;amount:number};
const norm=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const find=(h:string[],re:RegExp)=>h.findIndex(c=>re.test(norm(c)));
export const guessMapping=(header:string[]):CsvMapping=>({date:find(header,/fecha|date/),description:find(header,/concepto|descripcion|description|comercio|detalle|name/),amount:find(header,/importe|amount|cantidad|valor/)});
export function parseGenericCsv(rows:string[][],m:CsvMapping,bankName:string):ParsedStatement{
 if([m.date,m.amount,m.description].some(i=>i<0))throw Error('Elige las columnas de fecha, importe y concepto.');
 const raw:Omit<ImportRow,'externalId'>[]=[];
 rows.slice(1).forEach((r,i)=>{try{const amountCents=parseAmount(r[m.amount]??'');if(amountCents)raw.push({date:parseDate(r[m.date]??''),amountCents,kind:'other',description:((r[m.description]??'').trim()||'Movimiento importado').slice(0,200)});}catch(e){throw Error(`Fila ${i+2}: ${(e as Error).message}`);}});
 if(!raw.length)throw Error('No hay movimientos en este CSV.');
 return {format:'csv',bankName,rows:withIds(`csv-${norm(bankName).replace(/ /g,'-')||'banco'}`,raw)};
}
