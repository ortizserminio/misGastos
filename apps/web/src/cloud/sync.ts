import {type Data,emptyData,validateBackup} from '../domain';
// Remote storage of one user's document. update() returns null when the stored version changed (conflict).
export type Remote={load():Promise<{data:unknown;version:number}|null>;create(data:Data):Promise<number>;update(data:Data,version:number):Promise<number|null>};
export type Cache={data:Data;version:number;pending:boolean};
export type Start={kind:'ready';cache:Cache;notice?:string;offline?:boolean}|{kind:'askUpload';local:Data};
export const LEGACY_KEY='misgastos.local.v1',LEGACY_BACKUP='misgastos.local.v1.backup';
export const CONFLICT='Tus datos cambiaron desde otro dispositivo. Se ha cargado la versión más reciente; tu último cambio no se ha guardado.';
export const OFFLINE='Sin conexión: tus cambios se guardan en este dispositivo y se subirán al volver la conexión.';
const key=(uid:string)=>`misgastos.user.${uid}`;
const parse=(value:unknown)=>validateBackup(JSON.stringify(value));
export function readCache(uid:string):Cache|null{try{const raw=localStorage.getItem(key(uid));if(!raw)return null;const c=JSON.parse(raw);return {data:parse(c.data),version:Number(c.version)||0,pending:!!c.pending};}catch{return null;}}
export function writeCache(uid:string,c:Cache){try{localStorage.setItem(key(uid),JSON.stringify(c));}catch{}}
export function readLegacy():Data|null{try{const raw=localStorage.getItem(LEGACY_KEY);if(!raw)return null;const d=validateBackup(raw);return d.transactions.length||(d.assets??[]).length?d:null;}catch{return null;}}
// The local-only data is offered once; afterwards it is kept aside as a backup so other accounts on this browser are not asked.
export function retireLegacy(){try{const raw=localStorage.getItem(LEGACY_KEY);if(raw){localStorage.setItem(LEGACY_BACKUP,raw);localStorage.removeItem(LEGACY_KEY);}}catch{}}
async function fromRemote(uid:string,row:{data:unknown;version:number},notice?:string):Promise<Start>{const cache={data:parse(row.data),version:row.version,pending:false};writeCache(uid,cache);return {kind:'ready',cache,...(notice?{notice}:{})};}
export async function start(uid:string,remote:Remote,legacy:Data|null):Promise<Start>{
 const cache=readCache(uid);let row;
 try{row=await remote.load();}catch(e){if(cache)return {kind:'ready',cache,notice:OFFLINE,offline:true};const detail=(e as {message?:string})?.message;throw Error(`No se han podido cargar tus datos. Comprueba la conexión y vuelve a intentarlo.${detail?` Detalle: ${detail}`:''}`);}
 if(!row){if(legacy&&!cache)return {kind:'askUpload',local:legacy};const data=cache?.data??emptyData();const version=await remote.create(data);const next={data,version,pending:false};writeCache(uid,next);return {kind:'ready',cache:next};}
 if(cache?.pending){if(cache.version!==row.version)return fromRemote(uid,row,CONFLICT);const version=await remote.update(cache.data,row.version);if(version===null){const fresh=await remote.load();return fromRemote(uid,fresh??row,CONFLICT);}const next={data:cache.data,version,pending:false};writeCache(uid,next);return {kind:'ready',cache:next};}
 return fromRemote(uid,row);
}
export async function upload(uid:string,remote:Remote,data:Data|null):Promise<Cache>{const value=data??emptyData(),version=await remote.create(value),cache={data:value,version,pending:false};writeCache(uid,cache);retireLegacy();return cache;}
export type Saved={cache:Cache;notice?:string;reloaded?:boolean;offline?:boolean};
export async function save(uid:string,remote:Remote,current:Cache,next:Data):Promise<Saved>{
 const pending={data:next,version:current.version,pending:true};writeCache(uid,pending);
 try{const version=await remote.update(next,current.version);
  if(version===null){const row=await remote.load();if(!row)return {cache:pending,notice:CONFLICT};const s=await fromRemote(uid,row,CONFLICT);return {cache:(s as {cache:Cache}).cache,notice:CONFLICT,reloaded:true};}
  const done={data:next,version,pending:false};writeCache(uid,done);return {cache:done};
 }catch{return {cache:pending,notice:OFFLINE,offline:true};}
}
