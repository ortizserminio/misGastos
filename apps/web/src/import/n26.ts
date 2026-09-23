import {type ParsedStatement,type RowKind,type ImportRow,parseAmount,parseDate,withIds} from './common';
import {type PdfPage,pdfText} from './pdfText';
const DATE=/^\d{2}\.\d{2}\.\d{4}$/,MONEY=/^[+-][\d.]+,\d{2}\s*€$/;
export const isN26=(pages:PdfPage[])=>/NTSBESM1XXX/.test(pdfText(pages))||(/Extracto/.test(pdfText(pages))&&pages.some(p=>p.some(i=>i.str==='Fecha de reserva')));
function kindOf(type:string):RowKind{if(/^Mastercard/i.test(type))return 'card';if(/^Bizum/i.test(type))return 'bizum';if(/^(Ingresos|Transferencias)/i.test(type))return 'transfer';return 'other';}
export function parseN26(pages:PdfPage[]):ParsedStatement{
 const all=pdfText(pages),ownIban=all.match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})\s*•\s*BIC:\s*NTSBESM1XXX/)?.[1],period=all.match(/(\d{2}\.\d{2}\.\d{4})\s+hasta/)?.[1];
 const raw:Omit<ImportRow,'externalId'>[]=[];let opening:ParsedStatement['opening'];
 for(const page of pages){
  const prev=page.find(i=>i.str==='Saldo previo');
  if(prev&&period&&!opening){const v=page.find(i=>MONEY.test(i.str)&&Math.abs(i.y-prev.y)<=4);if(v)opening={date:parseDate(period),valueCents:parseAmount(v.str)};}
  const reserva=page.find(i=>i.str==='Fecha de reserva'),desc=page.find(i=>i.str==='Descripción');if(!reserva||!desc)continue;
  const footer=page.find(i=>i.str==='Emitido en')?.y??60;
  const amounts=page.filter(i=>MONEY.test(i.str)&&i.x>reserva.x+80&&i.y<reserva.y).sort((a,b)=>b.y-a.y);
  amounts.forEach((amount,k)=>{
   const date=page.find(i=>DATE.test(i.str)&&i.x>=reserva.x-10&&i.x<reserva.x+80&&Math.abs(i.y-amount.y)<=6);if(!date)return;
   const bottom=Math.max(amounts[k+1]?.y??-Infinity,footer)+6;
   const lines=page.filter(i=>i.x<reserva.x-20&&i.y<=amount.y+8&&i.y>bottom&&i.y<desc.y-5).sort((a,b)=>b.y-a.y).map(i=>i.str).filter(s=>!/^Fecha de valor/i.test(s));
   const [name='',type='',...rest]=lines,kind=kindOf(type),iban=rest.join(' ').match(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]{10,30})/)?.[1];
   const concept=rest.filter(s=>!/^IBAN:/.test(s)&&!/^Enviada desde N26$/i.test(s)&&!/^\+?\d{9,}$/.test(s.replace(/\s/g,''))&&!/^sin concepto$/i.test(s)).join(' ');
   raw.push({date:parseDate(date.str),amountCents:parseAmount(amount.str),kind,description:([name,concept].filter(Boolean).join(' · ')||type||'Movimiento N26').slice(0,200),...(kind!=='card'&&name?{counterpartyName:name}:{}),...(iban?{counterpartyIban:iban}:{}),...(kind==='card'&&type.includes('•')?{bankCategory:type.split('•')[1].trim()}:{})});
  });
 }
 if(!raw.length)throw Error('No he encontrado movimientos en este PDF de N26.');
 return {format:'n26',bankName:'N26',...(ownIban?{ownIban}:{}),...(opening?{opening}:{}),rows:withIds(`n26${ownIban?'-'+ownIban.slice(-4):''}`,raw)};
}
