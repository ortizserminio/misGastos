import {type ParsedStatement,type RowKind,type ImportRow,parseAmount,parseDate,withIds} from './common';
import {type PdfItem,type PdfPage,pdfText} from './pdfText';
const DATE=/^\d{2}\/\d{2}\/\d{4}$/,MONEY=/^-?[\d.]+,\d{2}\s*€$/;
export const isBbva=(pages:PdfPage[])=>/Últimos\s+movimientos/i.test(pdfText(pages))&&pages.some(p=>['Concepto','Importe','Saldo'].every(h=>p.some(i=>i.str===h)));
function lines(items:PdfItem[]){const out:PdfItem[][]=[];for(const it of [...items].sort((a,b)=>b.y-a.y||a.x-b.x)){const line=out.find(l=>Math.abs(l[0].y-it.y)<=3);if(line)line.push(it);else out.push([it]);}return out.map(l=>l.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' '));}
function kindOf(concept:string):RowKind{const c=concept.toUpperCase();if(c.includes('RETIRADA DE EFECTIVO'))return 'cash';if(c.includes('TRANSFERENCIA'))return 'transfer';if(c.includes('BIZUM'))return 'bizum';if(/N[ÓO]MINA/.test(c))return 'salary';if(c.includes('IMPUESTO'))return 'tax';if(/TARJETA|COMPRA/.test(c))return 'card';return 'other';}
export function parseBbva(pages:PdfPage[]):ParsedStatement{
 const raw:Omit<ImportRow,'externalId'>[]=[];let last:{date:string;amount:number;balance:number}|undefined;
 for(const page of pages){
  const h=(s:string)=>page.find(i=>i.str===s),fecha=h('Fecha'),concepto=h('Concepto'),importe=h('Importe'),saldo=h('Saldo');
  if(!fecha||!concepto||!importe||!saldo)continue;
  const starts=page.filter(i=>DATE.test(i.str)&&Math.abs(i.x-fecha.x)<6&&i.y<fecha.y).sort((a,b)=>b.y-a.y);
  starts.forEach((start,k)=>{
   const bottom=Math.max(starts[k+1]?.y??-Infinity,start.y-22),own=page.filter(i=>i.y<=start.y+4&&i.y>bottom+4);
   const amount=own.find(i=>MONEY.test(i.str)&&i.x>=importe.x-40&&i.x<saldo.x-5&&Math.abs(i.y-start.y)<=5);if(!amount)return;
   const balance=own.find(i=>MONEY.test(i.str)&&i.x>=saldo.x-10&&Math.abs(i.y-start.y)<=5);
   const [concept='',...rest]=lines(own.filter(i=>i.x>=concepto.x-2&&i.x<importe.x-40)),detail=rest.join(' ').trim();
   const to=concept.toUpperCase().includes('TRANSFERENCIA REALIZADA')?detail.match(/^PARA\s+(.+)$/i)?.[1]:undefined;
   const row={date:parseDate(start.str),amountCents:parseAmount(amount.str),kind:kindOf(concept),description:[concept,detail].filter(Boolean).join(' · ').slice(0,200),...(to?{counterpartyName:to}:{})};
   if(!row.amountCents)return;raw.push(row);if(balance)last={date:row.date,amount:row.amountCents,balance:parseAmount(balance.str)};
  });
 }
 if(!raw.length)throw Error('No he encontrado movimientos en este PDF de BBVA.');
 return {format:'bbva',bankName:'BBVA',rows:withIds('bbva',raw),...(last?{opening:{date:last.date,valueCents:last.balance-last.amount}}:{})};
}
