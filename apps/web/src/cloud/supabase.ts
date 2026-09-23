import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {type Data,type Transaction,timeInSpain} from '../domain';
import type {Remote} from './sync';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined,anon=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const client:SupabaseClient|null=url&&anon?createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const check=<T,>(r:{data:T;error:unknown}):NonNullable<T>=>{if(r.error)throw r.error;return r.data as NonNullable<T>;};
export function remoteFor(db:SupabaseClient,uid:string):Remote{return {
 load:async()=>{const r=await db.from("user_data").select("data,version").eq("user_id",uid).maybeSingle();if(r.error)throw r.error;return r.data;},
 create:async(data:Data)=>check(await db.from('user_data').insert({user_id:uid,data,version:1}).select('version').single()).version,
 update:async(data:Data,version:number)=>{const rows=check(await db.from('user_data').update({data,version:version+1,updated_at:new Date().toISOString()}).eq('user_id',uid).eq('version',version).select('version'));return rows.length?rows[0].version:null;},
};}
const hex=(buf:ArrayBuffer)=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
// A new personal token replaces the previous one; only its SHA-256 leaves the device.
export async function createShortcutToken(db:SupabaseClient,uid:string){
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const token_hash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
 check(await db.from('shortcut_tokens').delete().eq('user_id',uid));check(await db.from('shortcut_tokens').insert({token_hash,user_id:uid}));return token;
}
export async function hasShortcutToken(db:SupabaseClient){return check(await db.from('shortcut_tokens').select('created_at').limit(1)).length>0;}
export async function fetchShortcutEvents(db:SupabaseClient):Promise<Transaction[]>{
 const rows=check(await db.from('shortcut_events').select('event_id,amount_cents,merchant,bank,occurred_at,created_at').order('occurred_at',{ascending:false}));
 return rows.map(r=>({id:r.event_id,type:'expense',amountCents:r.amount_cents,merchant:r.merchant,bank:r.bank||'Efectivo',category:'Otros',date:String(r.occurred_at).slice(0,10),...(r.created_at&&timeInSpain(r.created_at)?{time:timeInSpain(r.created_at)}:{}),source:'shortcut',externalId:r.event_id}));
}
