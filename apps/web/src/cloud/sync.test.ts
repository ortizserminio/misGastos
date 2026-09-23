// @vitest-environment jsdom
import {beforeEach,describe,it,expect} from 'vitest';
import {start,save,upload,readCache,LEGACY_KEY,LEGACY_BACKUP,CONFLICT,OFFLINE,readLegacy,type Remote} from './sync';
import {emptyData,type Data} from '../domain';

const tx={id:'t1',type:'expense' as const,amountCents:500,merchant:'Café',bank:'Efectivo',category:'Otros',date:'2026-09-20',source:'manual' as const};
const withTx=(id='t1'):Data=>({...emptyData(),transactions:[{...tx,id}]});
// In-memory remote with optimistic versioning, like the user_data table.
function fakeRemote(initial?:{data:Data;version:number}){let row=initial?{...initial}:null;let offline=false;const r={
 load:async()=>{if(offline)throw Error('offline');return row&&{data:JSON.parse(JSON.stringify(row.data)),version:row.version};},
 create:async(data:Data)=>{if(offline)throw Error('offline');row={data,version:1};return 1;},
 update:async(data:Data,version:number)=>{if(offline)throw Error('offline');if(!row||row.version!==version)return null;row={data,version:version+1};return row.version;},
 get row(){return row;},set offline(v:boolean){offline=v;},setRow(v:{data:Data;version:number}){row=v;}};return r as Remote&{row:typeof row;offline:boolean;setRow:(v:{data:Data;version:number})=>void};}

beforeEach(()=>localStorage.clear());
describe('cloud sync',()=>{
 it('creates an empty document for a brand new account',async()=>{const remote=fakeRemote();const s=await start('u1',remote,null);expect(s.kind).toBe('ready');expect(remote.row?.version).toBe(1);expect(readCache('u1')?.pending).toBe(false);});
 it('offers to upload local data when the account is empty and retires it afterwards',async()=>{localStorage.setItem(LEGACY_KEY,JSON.stringify(withTx()));const remote=fakeRemote();const s=await start('u1',remote,readLegacy());expect(s.kind).toBe('askUpload');const c=await upload('u1',remote,(s as {local:Data}).local);expect(c.data.transactions).toHaveLength(1);expect(localStorage.getItem(LEGACY_KEY)).toBeNull();expect(localStorage.getItem(LEGACY_BACKUP)).not.toBeNull();});
 it('loads the remote document and saves with increasing versions',async()=>{const remote=fakeRemote({data:withTx(),version:3});const s=await start('u1',remote,null);if(s.kind!=='ready')throw Error();expect(s.cache.data.transactions[0].id).toBe('t1');const r=await save('u1',remote,s.cache,withTx('t2'));expect(r.cache.version).toBe(4);expect(remote.row?.data.transactions[0].id).toBe('t2');});
 it('reloads the newer remote version instead of overwriting it',async()=>{const remote=fakeRemote({data:withTx(),version:1});const s=await start('u1',remote,null);if(s.kind!=='ready')throw Error();remote.setRow({data:withTx('otro'),version:2});const r=await save('u1',remote,s.cache,withTx('mio'));expect(r.notice).toBe(CONFLICT);expect(r.reloaded).toBe(true);expect(r.cache.data.transactions[0].id).toBe('otro');expect(remote.row?.data.transactions[0].id).toBe('otro');});
 it('keeps changes pending offline and uploads them on the next start',async()=>{const remote=fakeRemote({data:withTx(),version:1});const s=await start('u1',remote,null);if(s.kind!=='ready')throw Error();remote.offline=true;const r=await save('u1',remote,s.cache,withTx('sin-red'));expect(r.offline).toBe(true);expect(r.notice).toBe(OFFLINE);const offlineStart=await start('u1',remote,null);expect(offlineStart.kind==='ready'&&offlineStart.offline).toBe(true);remote.offline=false;const again=await start('u1',remote,null);if(again.kind!=='ready')throw Error();expect(again.cache.pending).toBe(false);expect(remote.row?.data.transactions[0].id).toBe('sin-red');});
 it('drops pending local changes when another device saved meanwhile',async()=>{const remote=fakeRemote({data:withTx(),version:1});const s=await start('u1',remote,null);if(s.kind!=='ready')throw Error();remote.offline=true;await save('u1',remote,s.cache,withTx('local'));remote.offline=false;remote.setRow({data:withTx('remoto'),version:2});const again=await start('u1',remote,null);if(again.kind!=='ready')throw Error();expect(again.notice).toBe(CONFLICT);expect(again.cache.data.transactions[0].id).toBe('remoto');});
 it('fails clearly when there is no connection and no cached copy',async()=>{const remote=fakeRemote();remote.offline=true;await expect(start('u1',remote,null)).rejects.toThrow(/conexión/);});
});
