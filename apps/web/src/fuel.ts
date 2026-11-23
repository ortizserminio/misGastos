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
  if(!Number.isFinite(price)||price<=0||!(lat>=27&&lat<=44.5&&lon>=-18.5&&lon<=4.6))return []; // outside Spain (the API has stations at 0,0)
  return [{id:String(row.IDEESS??''),name:title(row['Rótulo']),address:String(row['Dirección']??''),town:title(row.Localidad),lat,lon,price}];
 });
}
export function distanceKm(a:Point,b:Point){
 const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(h));
}
// shortcut: nearest province capital, can pick the neighbour province near borders; switch to real province polygons if users complain
export const PROVINCE_CENTERS:Record<string,[number,number]>={
 '01':[42.85,-2.67],'02':[38.99,-1.86],'03':[38.35,-0.48],'04':[36.84,-2.46],
 '05':[40.66,-4.70],'06':[38.88,-6.97],'07':[39.57,2.65],'08':[41.39,2.17],
 '09':[42.34,-3.70],'10':[39.47,-6.37],'11':[36.53,-6.29],'12':[39.99,-0.05],
 '13':[38.99,-3.93],'14':[37.89,-4.78],'15':[43.36,-8.41],'16':[40.07,-2.13],
 '17':[41.98,2.82],'18':[37.18,-3.60],'19':[40.63,-3.17],'20':[43.32,-1.98],
 '21':[37.26,-6.94],'22':[42.14,-0.41],'23':[37.78,-3.79],'24':[42.60,-5.57],
 '25':[41.62,0.62],'26':[42.47,-2.45],'27':[43.01,-7.56],'28':[40.42,-3.70],
 '29':[36.72,-4.42],'30':[37.99,-1.13],'31':[42.81,-1.64],'32':[42.34,-7.86],
 '33':[43.36,-5.85],'34':[42.01,-4.53],'35':[28.12,-15.43],'36':[42.43,-8.64],
 '37':[40.97,-5.66],'38':[28.46,-16.25],'39':[43.46,-3.80],'40':[40.95,-4.12],
 '41':[37.39,-5.98],'42':[41.76,-2.46],'43':[41.12,1.25],'44':[40.34,-1.11],
 '45':[39.86,-4.02],'46':[39.47,-0.38],'47':[41.65,-4.72],'48':[43.26,-2.93],
 '49':[41.50,-5.75],'50':[41.65,-0.89],'51':[35.89,-5.32],'52':[35.29,-2.94],
};
export function nearestProvince(point:Point):string{
 return Object.entries(PROVINCE_CENTERS).reduce((best,[code,[lat,lon]])=>
  distanceKm(point,{lat,lon})<distanceKm(point,{lat:PROVINCE_CENTERS[best][0],lon:PROVINCE_CENTERS[best][1]})?code:best,'01');
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
