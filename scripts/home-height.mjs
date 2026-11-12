import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../apps/web/src/home-compact.css',import.meta.url),'utf8');
const expected=['height:72px','height:48px','min-height:84px','min-height:72px','gap:10px','clamp(180px, calc(100vh - 561px','clamp(180px, calc(100dvh - 561px','width:var(--home-donut)','height:var(--home-donut)'];
for(const declaration of expected){
  if(!css.includes(declaration))throw new Error(`Falta la medida CSS: ${declaration}`);
}

const parts={
  cabecera:72,
  margenCabecera:8,
  selectorMes:48,
  margenSelector:10,
  donutTarjetaSinDonut:14+22+20+1+20+16,
  margenDonut:10,
  entradas:84,
  huecosTarjetas:20,
  presupuestos:72,
  patrimonio:72,
};
const fixed=Object.values(parts).reduce((sum,value)=>sum+value,0);
if(fixed!==489)throw new Error(`El desglose fijo cambió: ${fixed}px`);
for(const viewport of [844,750]){
  const safeTop=0;
  const safeBottom=0;
  const nav=1+10+49+Math.max(12,safeBottom);
  const donut=Math.max(180,Math.min(280,viewport-561-Math.max(12,safeBottom)-safeTop));
  const gap=viewport-nav-safeTop-fixed-donut;
  console.log(`390×${viewport}: ${Object.entries(parts).map(([name,value])=>`${name} ${value}`).join(' + ')} = ${fixed}px; donut ${donut}px; menú ${nav}px; aire ${gap}px`);
  if(donut>180 && (gap<4 || gap>24))throw new Error(`Patrimonio queda a ${gap}px del menú en 390×${viewport}`);
  if(donut===180 && gap>24)throw new Error(`Queda demasiado aire con el donut mínimo en 390×${viewport}`);
}
