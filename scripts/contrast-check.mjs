import fs from 'node:fs';
const css=fs.readFileSync('apps/web/src/tokens.css','utf8');
const luminance=hex=>{const rgb=hex.slice(1).match(/.{2}/g).slice(0,3).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
let failed=0;
for(const name of ['violeta','cobalto','menta']){const block=css.match(new RegExp(`\\[data-theme="${name}"\\]\\{([^}]+)\\}`))?.[1];if(!block)throw Error(`Falta el tema ${name}`);const tokens=Object.fromEntries([...block.matchAll(/--([\w-]+):(#(?:[\da-f]{6}|[\da-f]{8}))/gi)].map(m=>[m[1],m[2]]));for(const [fg,bg,min] of [['ink','surface',4.5],['ink-2','surface',4.5],['muted','surface',4.5],['primary','surface',4.5],['positive','surface',4.5],['negative','surface',4.5],['ink','bg',4.5],['border-control','surface',3],['primary','primary-soft',3]]){const a=tokens[`color-${fg}`],b=tokens[`color-${bg}`];if(!a||!b)throw Error(`${name}: falta ${fg} o ${bg}`);const value=ratio(a,b);if(value<min){console.error(`${name}: ${fg}/${bg} ${value.toFixed(2)} < ${min}`);failed++;}}console.log(`${name}: contrastes comprobados`);}
if(failed)process.exitCode=1;
