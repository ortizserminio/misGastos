import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=readdirSync(new URL('./dist/assets/',import.meta.url)).map(file=>`/assets/${file}`);
const version=createHash('sha256').update(assets.join('|')).digest('hex').slice(0,12);
const source=readFileSync(new URL('./public/sw.js',import.meta.url),'utf8')
 .replace("const CACHE='misgastos-v1';",`const CACHE='misgastos-${version}';`)
 .replace("const PRECACHE=['/','/icon.svg','/manifest.webmanifest'];",`const PRECACHE=${JSON.stringify(['/','/icon.svg','/manifest.webmanifest',...assets])};`);
writeFileSync(new URL('./dist/sw.js',import.meta.url),source);
console.log(`PWA: ${assets.length} recursos compilados incluidos en caché offline.`);
