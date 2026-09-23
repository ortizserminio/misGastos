export type PdfItem={x:number;y:number;str:string};export type PdfPage=PdfItem[];
export async function readPdf(data:ArrayBuffer):Promise<PdfPage[]>{
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
 const doc=await pdfjs.getDocument({data:new Uint8Array(data)}).promise,pages:PdfPage[]=[];
 for(let n=1;n<=doc.numPages;n++){const content=await (await doc.getPage(n)).getTextContent();pages.push(content.items.flatMap(i=>'str' in i&&i.str.trim()?[{x:i.transform[4],y:i.transform[5],str:i.str.trim()}]:[]));}
 await doc.destroy();return pages;
}
export const pdfText=(pages:PdfPage[])=>pages.flat().map(i=>i.str).join(' ');
