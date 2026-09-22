// Isolated local browser fixture. Never used by the normal app launcher.
import {createServer as createVite} from '../apps/web/node_modules/vite/dist/node/index.js';
import {createApp} from '../apps/api/server.mjs';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const results=join(root,'test-results');mkdirSync(results,{recursive:true});
const dataDir=mkdtempSync(join(results,'browser-'));
// Known disposable credential, only valid for this synthetic loopback fixture.
writeFileSync(join(dataDir,'token.txt'),'1'.repeat(64));
const api=createApp({dataDir});
await new Promise((resolve,reject)=>{api.server.once('error',reject);api.server.listen(8790,'127.0.0.1',resolve);});
const vite=await createVite({root:join(root,'apps/web'),server:{host:'127.0.0.1',port:5175,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8790'}}}});
await vite.listen();console.log('misGastos: prueba sintética aislada http://127.0.0.1:5175');
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{await vite.close();await api.close();process.exit(0);});
