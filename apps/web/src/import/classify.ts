import type {Asset} from '../assets';
import type {ImportRow} from './common';
export const EXTERNAL='Cuenta externa mía';
const CASH=['Cuenta','Efectivo','Ahorro'];
export const normalizeName=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function ownerMatch(name:string|undefined,owner:string):'yes'|'maybe'|'no'{
 if(!name||!owner.trim())return 'no';const a=normalizeName(name),b=normalizeName(owner);if(!a)return 'no';if(a===b)return 'yes';
 const at=a.split(' '),bt=b.split(' ');if(at.length<2||at.length>bt.length||at[0]!==bt[0])return 'no';
 return at.every((t,i)=>bt[i].startsWith(t))&&(at.length<bt.length||at.some((t,i)=>t!==bt[i]))?'maybe':'no';
}
const ENTITIES:Record<string,string>={'0182':'BBVA','1563':'N26','1586':'Trade Republic','0049':'Santander','2100':'CaixaBank','1465':'ING','0081':'Sabadell','0128':'Bankinter','2085':'Ibercaja','0073':'Openbank'};
export const bankFromIban=(iban?:string)=>iban&&/^ES\d{22}$/.test(iban)?ENTITIES[iban.slice(4,8)]:undefined;
const MCC:[string,number[]][]=[['Alimentación',[5411,5412,5422,5441,5451,5462,5499]],['Transporte',[4111,4121,4131,4784,4789,5172,5541,5542,7523]],['Restauración',[5812,5813,5814]],['Salud',[5122,5912,8011,8021,8062,8099]],['Suscripciones',[4899,5815,5816,5817,5818]],['Ocio',[7832,7922,7941,7991,7996,7997]],['Hogar',[4900,5200,5251,5712,5719,5722]],['Compras',[5310,5311,5331,5621,5651,5661,5691,5699,5732,5941,5942,5945,5999]]];
const WORDS:[string,RegExp][]=[['Suscripciones',/\b(netflix|spotify|disney|hbo|prime video|amazon prime|icloud|apple com|youtube)\b/],['Alimentación',/\b(mercadona|lidl|carrefour|aldi|dia|consum|eroski|alcampo|hipercor|supermercado|masymas|comida|alimentacion)\b/],['Transporte',/\b(plenergy|repsol|cepsa|galp|shell|ballenoil|petroprix|renfe|alsa|metro|uber|cabify|bolt|gasolinera|parking|peaje|transporte)\b/],['Restauración',/\b(restaurante|restaurantes|bares|bar|cafe|cafeteria|burger|mcdonalds|kfc|telepizza|glovo)\b/],['Salud',/\b(farmacia|clinica|dental|hospital|optica|salud)\b/],['Ocio',/\b(cine|cines|teatro|steam|playstation|nintendo|ocio)\b/],['Hogar',/\b(ikea|leroy|iberdrola|endesa|naturgy|comunidad|alquiler|hogar)\b/],['Compras',/\b(amazon|zara|primark|decathlon|north face|corte ingles|shein|aliexpress|compras)\b/]];
export function guessCategory(row:ImportRow){const m=Number(row.mcc);for(const [c,codes] of MCC)if(codes.includes(m))return c;const t=normalizeName(`${row.description} ${row.bankCategory??''}`);for(const [c,re] of WORDS)if(re.test(t))return c;return 'Otros';}
export type Suggestion={type:'expense'|'income'|'transfer';category:string;other:string;own:'yes'|'maybe'|'no'};
export type Context={account:string;owner:string;assets:Asset[];categories:string[]};
export function classify(row:ImportRow,ctx:Context):Suggestion{
 const cash=ctx.assets.filter(a=>CASH.includes(a.type)&&a.name!==ctx.account);
 if(row.kind==='trade')return {type:'transfer',category:'',other:ctx.assets.find(a=>a.type==='Inversión'&&a.name===row.instrument)?.name??row.instrument??'Inversión',own:'yes'};
 if(row.kind==='cash')return {type:'transfer',category:'',other:ctx.assets.find(a=>a.type==='Efectivo')?.name??'Efectivo',own:'yes'};
 const exact=row.counterpartyIban?cash.find(a=>a.iban===row.counterpartyIban)?.name:undefined;
 const byName=ownerMatch(row.counterpartyName,ctx.owner),inText=!row.counterpartyName&&normalizeName(ctx.owner).split(' ').length>1&&` ${normalizeName(row.description)} `.includes(` ${normalizeName(ctx.owner)} `);
 const own=row.kind==='card'?'no':exact||inText?'yes':byName;
 if(own==='yes'){const bank=bankFromIban(row.counterpartyIban);return {type:'transfer',category:'',other:exact??(bank?cash.find(a=>a.bank===bank)?.name:undefined)??EXTERNAL,own};}
 if(row.amountCents>0)return {type:'income',category:row.kind==='salary'?'Nómina':row.kind==='interest'?'Intereses':'Otros',other:'',own};
 const guess=guessCategory(row);return {type:'expense',category:ctx.categories.includes(guess)?guess:'Otros',other:'',own};
}
