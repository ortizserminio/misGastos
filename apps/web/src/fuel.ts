export const FUELS = [
 {label:'Gasolina 95',field:'Precio Gasolina 95 E5'},
 {label:'Gasolina 98',field:'Precio Gasolina 98 E5'},
 {label:'Diésel',field:'Precio Gasoleo A'},
 {label:'Diésel premium',field:'Precio Gasoleo Premium'},
 {label:'GLP',field:'Precio Gases licuados del petróleo'},
] as const;

export type Station={id:string;name:string;address:string;town:string;lat:number;lon:number;price:number};
export type Point={lat:number;lon:number};
const number=(value:unknown)=>typeof value==='string'&&value.trim()!==''?Number(value.replace(',','.')):NaN;
const title=(value:unknown)=>String(value??'').trim().toLocaleLowerCase('es-ES').replace(/(^|[\s/-])\p{L}/gu,s=>s.toLocaleUpperCase('es-ES'));
export function parseStations(json:unknown,field:string):Station[]{
 const rows=(json as {ListaEESSPrecio?:Record<string,unknown>[]})?.ListaEESSPrecio;
 if(!Array.isArray(rows))return [];
 return rows.flatMap(row=>{
  const price=number(row[field]),lat=number(row['Latitud']),lon=number(row['Longitud (WGS84)']);
  if(!Number.isFinite(price)||price<=0||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return [];
  return [{id:String(row.IDEESS??''),name:title(row['Rótulo']),address:String(row['Dirección']??''),town:title(row.Localidad),lat,lon,price}];
 });
}
export function distanceKm(a:Point,b:Point){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(h));
}
export function sortStations(list:Station[],mode:'price'|'near',here?:Point):Station[]{
 return [...list].sort((a,b)=>(mode==='near'&&here?distanceKm(a,here)-distanceKm(b,here):a.price-b.price)||a.name.localeCompare(b.name,'es'));
}
export function priceTier(price:number,prices:number[]):0|1|2{
 if(!prices.length)return 0;
 const sorted=[...prices].sort((a,b)=>a-b);
 const rank=sorted.findIndex(value=>value>=price);
 return Math.min(2,Math.floor((rank<0?sorted.length-1:rank)*3/sorted.length)) as 0|1|2;
}
