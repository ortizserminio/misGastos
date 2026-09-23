import {type ParsedStatement} from './common';
import {parseCsv} from './csv';
import {isTradeRepublic,parseTradeRepublic} from './traderepublic';
import {readPdf,type PdfPage} from './pdfText';
import {isN26,parseN26} from './n26';
import {isBbva,parseBbva} from './bbva';
export type Detected={kind:'statement';statement:ParsedStatement}|{kind:'csv';rows:string[][]};
export async function readStatement(file:File):Promise<Detected>{
 if(file.size>10*1024*1024)throw Error('El archivo supera 10 MB.');
 const buffer=await file.arrayBuffer();
 if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
  let pages:PdfPage[];try{pages=await readPdf(buffer);}catch{throw Error('No he podido abrir el PDF. Comprueba que no tenga contraseña.');}
  if(isN26(pages))return {kind:'statement',statement:parseN26(pages)};
  if(isBbva(pages))return {kind:'statement',statement:parseBbva(pages)};
  throw Error('No reconozco este PDF. Por ahora leo extractos de N26 y BBVA («Últimos movimientos»). De otros bancos, importa su CSV.');
 }
 let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('�'))text=new TextDecoder('windows-1252').decode(buffer);
 const rows=parseCsv(text);if(rows.length<2)throw Error('El CSV está vacío.');
 return isTradeRepublic(rows[0])?{kind:'statement',statement:parseTradeRepublic(rows)}:{kind:'csv',rows};
}
