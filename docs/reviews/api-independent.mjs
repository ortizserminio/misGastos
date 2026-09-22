import {createApp} from '../../apps/api/server.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'misgastos-independent-'));
const app=createApp({dataDir:dir});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const token=(await readFile(join(dir,'token.txt'),'utf8')).trim();
const call=async(path,method,body)=>{const r=await fetch(`http://127.0.0.1:${app.server.address().port}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
try {
 await call('/api/card-mappings','PUT',{items:[{tarjeta:'Tarjeta sintética',banco:'Banco sintético'}]});
 const p={importe:'0,01',comercio:'Comercio sintético',tarjeta:'Tarjeta sintética',idEvento:'independent-event-001'};
 const first=await call('/api/shortcut','POST',p);assert.equal(first.status,201);
 await call('/api/card-mappings','PUT',{items:[]});
 const retry=await call('/api/shortcut','POST',p);assert.equal(retry.status,200);assert.deepEqual(retry.body.transaction,first.body.transaction);
 assert.equal((await call('/api/shortcut','POST',{...p,idEvento:'independent-event-002'})).status,422);
 assert.equal((await call('/api/shortcut','POST',{...p,importe:'0,02'})).status,409);
 const listed=await call('/api/transactions','GET');assert.equal(listed.body.items.length,1);assert.ok(!JSON.stringify(listed).includes(token));
 console.log('Independent API: omitted date retry, removed mapping retry, unknown card, conflict, no token leak: PASS');
} finally {await app.close();await rm(dir,{recursive:true,force:true});}
