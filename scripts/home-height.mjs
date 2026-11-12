import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../apps/web/src/home-compact.css',import.meta.url),'utf8');
const expected=['height:64px','margin-bottom:8px','height:44px','width:180px','height:180px','min-height:72px','min-height:64px','gap:8px'];
for(const declaration of expected){
  if(!css.includes(declaration))throw new Error(`Falta la medida CSS: ${declaration}`);
}

const parts={
  cabecera:64,
  margenCabecera:8,
  selectorMes:44,
  margenSelector:10,
  donutTarjeta:12+28+8+180+8+1+16+12,
  margenDonut:10,
  entradas:72,
  huecosTarjetas:16,
  presupuestos:64,
  patrimonio:64,
};
const used=Object.values(parts).reduce((sum,value)=>sum+value,0);
const viewport=844;
const bottomNav=76;
const safeMargins=20;
const available=viewport-bottomNav-safeMargins;
for(const [name,height] of Object.entries(parts))console.log(`${name}: ${height}px`);
console.log(`Total: ${used}px / disponible: ${available}px (844 - ${bottomNav} barra - ${safeMargins} márgenes seguros)`);
console.log(`Con Gastos por revisar: ${used+72}px / ${available}px`);
if(used>available || used+72>available)process.exitCode=1;
