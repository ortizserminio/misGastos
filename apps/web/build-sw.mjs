import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=readdirSync(new URL('./dist/assets/',import.meta.url)).map(file=>`/assets/${file}`);
const icons=['/icon.svg','/icon-maskable.svg','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/icon-maskable-512.png'];
const version=createHash('sha256').update(assets.join('|')+'|'+icons.map(icon=>createHash('sha256').update(readFileSync(new URL(`./public${icon}`,import.meta.url))).digest('hex')).join('|')).digest('hex').slice(0,12);
const source=readFileSync(new URL('./public/sw.js',import.meta.url),'utf8')
 .replace("const CACHE='misgastos-v2';",`const CACHE='misgastos-${version}';`)
 .replace("const PRECACHE=['/','/icon.svg','/icon-maskable.svg','/apple-touch-icon.png','/icon-192.png','/icon-512.png','/icon-maskable-512.png','/manifest.webmanifest'];",`const PRECACHE=${JSON.stringify(['/','/manifest.webmanifest',...icons,...assets])};`);
writeFileSync(new URL('./dist/sw.js',import.meta.url),source);
console.log(`PWA: ${assets.length} recursos compilados incluidos en caché offline.`);
