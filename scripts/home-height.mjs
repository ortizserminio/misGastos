import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../apps/web/src/home-compact.css',import.meta.url),'utf8');
const base=readFileSync(new URL('../apps/web/src/styles.css',import.meta.url),'utf8');
const declaration=(source,pattern,name)=>{const match=source.match(pattern);if(!match)throw new Error(`Falta la medida CSS: ${name}`);return Number(match[1]);};
const fixedExpression=css.match(/--home-fixed:calc\(([^)]+)\)/)?.[1];
if(!fixedExpression)throw new Error('Falta --home-fixed');
const fixedParts=[...fixedExpression.matchAll(/(\d+)px/g)].map(m=>Number(m[1]));
const fixed=fixedParts.reduce((sum,value)=>sum+value,0);
const row=declaration(css,/\.income-card,\s*\n\s*\.home-month-selector ~ \.overview-grid \.feature-card \{ height:(\d+)px/,'altura de filas');
if(fixedParts.filter(value=>value===row).length!==3)throw new Error('Las tres filas deben formar parte de --home-fixed');
const navBorder=declaration(base,/\.bottom-nav\{[^}]*?border:(\d+)px solid/,'borde del menú');
const navPadding=declaration(base,/\.bottom-nav\{bottom:0;[^}]*?padding:(\d+)px/,'padding del menú');
const navItem=declaration(base,/\.nav-item\{[^}]*?min-height:(\d+)px/,'alto de elemento del menú');
const navSafe=declaration(base,/\.bottom-nav\{bottom:0;[^}]*?max\((\d+)px,env\(safe-area-inset-bottom\)\)/,'reserva segura del menú');
const nav=navBorder+navPadding+navItem+navSafe;
const declaredNav=css.match(/--home-nav:calc\(([^)]+)\)/)?.[1];
if(!declaredNav||[...declaredNav.matchAll(/(\d+)px/g)].reduce((sum,m)=>sum+Number(m[1]),0)!==nav)throw new Error('--home-nav no coincide con styles.css');
if(!css.includes('100vh - var(--home-fixed) - var(--home-nav) - 12px')||!css.includes('100dvh - var(--home-fixed) - var(--home-nav) - 12px'))throw new Error('La fórmula del donut no usa las alturas CSS');
for(const viewport of [844,750]){
  const ideal=viewport-fixed-nav-12;
  const donut=Math.max(190,Math.min(300,ideal));
  const gap=viewport-fixed-nav-donut;
  console.log(`390×${viewport}: fijo ${fixed}px; donut ${donut}px; menú ${nav}px; aire ${gap}px`);
  if(ideal>=190&&(gap<4||gap>24))throw new Error(`Patrimonio queda a ${gap}px del menú en 390×${viewport}`);
  if(ideal<190&&gap>24)throw new Error(`Queda demasiado aire con el donut mínimo en 390×${viewport}`);
}
