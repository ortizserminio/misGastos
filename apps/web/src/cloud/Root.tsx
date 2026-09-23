import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Session,SupabaseClient,User} from '@supabase/supabase-js';
import App from '../App';
import Login from '../auth/Login';
import '../auth/login.css';
import {type Data} from '../domain';
import {client,remoteFor,createShortcutToken,hasShortcutToken,fetchShortcutEvents} from './supabase';
import {start,save,upload,readLegacy,retireLegacy,OFFLINE,type Cache} from './sync';

export default function Root(){
 if(!client)return <div className="cloud-center"><div className="login-card"><h1>Falta configuración</h1><p>Añade <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en Vercel y vuelve a desplegar.</p></div></div>;
 return <Auth db={client}/>;
}
function Auth({db}:{db:SupabaseClient}){
 const [session,setSession]=useState<Session|null|undefined>(undefined),[recovery,setRecovery]=useState(false);
 useEffect(()=>{db.auth.getSession().then(({data})=>setSession(data.session));const {data}=db.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')setRecovery(true);});return()=>data.subscription.unsubscribe();},[db]);
 if(session===undefined)return <div className="cloud-center"><p>Cargando…</p></div>;
 if(!session||recovery)return <Login db={db} recovery={recovery} onRecovered={()=>setRecovery(false)}/>;
 return <Account key={session.user.id} db={db} user={session.user}/>;
}
type State={kind:'loading'}|{kind:'ask';local:Data}|{kind:'ready'}|{kind:'error';message:string};
function Account({db,user}:{db:SupabaseClient;user:User}){
 const remote=useMemo(()=>remoteFor(db,user.id),[db,user.id]);
 const [state,setState]=useState<State>({kind:'loading'}),[notice,setNotice]=useState(''),[appKey,setAppKey]=useState(0);
 const cache=useRef<Cache|null>(null),queue=useRef(Promise.resolve());
 const ready=(c:Cache,message='')=>{cache.current=c;setNotice(message);setState({kind:'ready'});};
 const begin=useCallback(async()=>{setState({kind:'loading'});try{const s=await start(user.id,remote,readLegacy());if(s.kind==='askUpload')setState({kind:'ask',local:s.local});else ready(s.cache,s.notice);}catch(e){setState({kind:'error',message:(e as Error).message});}},[remote,user.id]);
 useEffect(()=>{begin();},[begin]);
 // Saves run one after another so each uses the version returned by the previous one.
 const persist=useCallback((next:Data)=>{queue.current=queue.current.then(async()=>{if(!cache.current)return;const r=await save(user.id,remote,cache.current,next);cache.current=r.cache;setNotice(r.notice??'');if(r.reloaded)setAppKey(k=>k+1);});},[remote,user.id]);
 useEffect(()=>{const retry=()=>{if(cache.current?.pending)persist(cache.current.data);};window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[persist]);
 async function logout(){if(cache.current?.pending&&!confirm('Hay cambios sin subir a tu cuenta. Si cierras sesión se perderán. ¿Cerrar sesión igualmente?'))return;try{localStorage.removeItem(`misgastos.user.${user.id}`);}catch{}await db.auth.signOut();}
 if(state.kind==='loading')return <div className="cloud-center"><p>Cargando tus datos…</p></div>;
 if(state.kind==='error')return <div className="cloud-center"><div className="login-card"><h1>No se han podido cargar tus datos</h1><p>{state.message}</p><button className="primary wide" onClick={begin}>Reintentar</button><button className="text-button" onClick={logout}>Cerrar sesión</button></div></div>;
 if(state.kind==='ask'){const n=state.local.transactions.length;return <div className="cloud-center"><div className="login-card"><h1>¿Subir los datos de este dispositivo?</h1><p>Hemos encontrado {n} movimientos{(state.local.assets??[]).length?' y tus cuentas de patrimonio':''} guardados solo en este navegador. Puedes subirlos a tu cuenta para verlos en todos tus dispositivos.</p><button className="primary wide" onClick={async()=>{try{ready(await upload(user.id,remote,state.local));}catch(e){setState({kind:'error',message:(e as Error).message});}}}>Subir a mi cuenta</button><button className="text-button" onClick={async()=>{if(!confirm('Tu cuenta empezará vacía. Los datos de este navegador se conservarán como copia local. ¿Continuar?'))return;try{retireLegacy();ready(await upload(user.id,remote,null));}catch(e){setState({kind:'error',message:(e as Error).message});}}}>Empezar con la cuenta vacía</button></div></div>;}
 return <>{notice&&<div className="cloud-banner" role="status"><span>{notice}</span>{notice!==OFFLINE&&<button onClick={()=>setNotice('')} aria-label="Cerrar aviso">×</button>}</div>}
  <App key={appKey} cloud={{email:user.email??'',initial:cache.current!.data,save:persist,logout,createToken:()=>createShortcutToken(db,user.id),hasToken:()=>hasShortcutToken(db),fetchShortcut:()=>fetchShortcutEvents(db)}}/></>;
}
