import {type ImportRow,type ParsedStatement,type RowKind,parseAmount,parseDate} from './common';
export const isTradeRepublic=(header:string[])=>['transaction_id','counterparty_iban','asset_class'].every(h=>header.includes(h));
function kindOf(type:string):RowKind{if(type.startsWith('CARD_TRANSACTION'))return 'card';if(type.startsWith('TRANSFER'))return 'transfer';if(type==='INTEREST_PAYMENT')return 'interest';if(type==='BUY'||type==='SELL')return 'trade';return 'other';}
export function parseTradeRepublic(rows:string[][]):ParsedStatement{
 const [header,...body]=rows,col=(r:string[],n:string)=>(r[header.indexOf(n)]??'').trim(),out:ImportRow[]=[];
 for(const r of body){
  const id=col(r,'transaction_id');if(!id)continue;
  const amountCents=['amount','fee','tax'].reduce((n,c)=>n+(col(r,c)?parseAmount(col(r,c)):0),0);if(!amountCents)continue;
  const kind=kindOf(col(r,'type')),description=col(r,'description'),name=col(r,'name');
  const m=description.match(/^(?:Incoming transfer from|Outgoing transfer for)\s+(.+?)\s*(?:\(([A-Z]{2}\d{2}[A-Z0-9]{10,30})\))?\s*$/);
  const counterpartyName=col(r,'counterparty_name')||m?.[1],counterpartyIban=col(r,'counterparty_iban')||m?.[2];
  const label=kind==='card'||kind==='trade'?name:kind==='interest'?'Intereses Trade Republic':counterpartyName;
  out.push({date:parseDate(col(r,'date')||col(r,'datetime')),amountCents,kind,description:(label||description.replace(/null$/,'')||col(r,'type')).slice(0,200),...(kind!=='card'&&counterpartyName?{counterpartyName}:{}),...(counterpartyIban?{counterpartyIban}:{}),...(col(r,'mcc_code')?{mcc:col(r,'mcc_code')}:{}),...(kind==='trade'?{instrument:name||col(r,'symbol')}:{}),externalId:`tr:${id}`});
 }
 if(!out.length)throw Error('No hay movimientos en este CSV de Trade Republic.');
 return {format:'traderepublic',bankName:'Trade Republic',rows:out};
}
