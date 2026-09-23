import {useState} from 'react';
import {Wallet} from 'lucide-react';
import type {SupabaseClient} from '@supabase/supabase-js';
import './login.css';
type Mode='login'|'signup'|'forgot'|'recovery';
const spanish=(message:string)=>/invalid login credentials/i.test(message)?'Email o contraseña incorrectos.':/rate limit|too many/i.test(message)?'Demasiados intentos. Espera un momento y vuelve a probar.':/fetch|network/i.test(message)?'No hay conexión. Comprueba tu internet.':message;
export default function Login({db,recovery=false,onRecovered}:{db:SupabaseClient;recovery?:boolean;onRecovered?:()=>void}){
 const [mode,setMode]=useState<Mode>(recovery?'recovery':'login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[info,setInfo]=useState(''),[busy,setBusy]=useState(false);
 const go=(m:Mode)=>{setMode(m);setError('');setInfo('');};
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setInfo('');try{await action();}catch(e){setError(spanish((e as Error).message||'Algo ha fallado.'));}finally{setBusy(false);}}
 const signIn=async()=>{const {error}=await db.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;};
 function submit(e:React.FormEvent){e.preventDefault();run(async()=>{
  if(mode==='login')return signIn();
  if(mode==='signup'){const r=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,code})});let body:{message?:string}={};try{body=await r.json();}catch{}if(!r.ok)throw Error(body.message||'No se ha podido crear la cuenta.');return signIn();}
  if(mode==='forgot'){const {error}=await db.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin});if(error)throw error;setInfo('Si existe una cuenta con ese email, te hemos enviado un enlace para cambiar la contraseña.');return;}
  if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres.');const {error}=await db.auth.updateUser({password});if(error)throw error;onRecovered?.();
 });}
 const title={login:'Entra en tu cuenta',signup:'Crea tu cuenta',forgot:'Recupera tu contraseña',recovery:'Elige una contraseña nueva'}[mode];
 const action={login:'Entrar',signup:'Crear cuenta',forgot:'Enviar enlace',recovery:'Guardar contraseña'}[mode];
 return <div className="login-page"><div className="login-brand"><span className="brand-symbol"><Wallet size={26}/></span><span>mis<span className="brand-accent">Gastos</span></span></div>
  <form className="login-card" onSubmit={submit}><h1>{title}</h1>
   {mode==='signup'&&<p>Necesitas el código de invitación que te ha dado quien gestiona la app.</p>}
   {mode!=='recovery'&&<label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com"/></label>}
   {mode!=='forgot'&&<label>{mode==='recovery'?'Nueva contraseña':'Contraseña'}<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:8} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'':'Mínimo 8 caracteres'}/></label>}
   {mode==='signup'&&<label>Código de invitación<input required autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value)} placeholder="AMIGOS-2026"/></label>}
   {error&&<p className="error" role="alert">{error}</p>}{info&&<p className="toast" role="status">{info}</p>}
   <button className="primary wide" disabled={busy}>{busy?'Un momento…':action}</button>
   {mode==='login'&&<><button type="button" className="text-button" onClick={()=>go('forgot')}>¿Has olvidado tu contraseña?</button><p className="login-switch">¿Aún no tienes cuenta? <button type="button" className="text-button" onClick={()=>go('signup')}>Crear cuenta</button></p></>}
   {(mode==='signup'||mode==='forgot')&&<p className="login-switch"><button type="button" className="text-button" onClick={()=>go('login')}>Volver a entrar</button></p>}
  </form></div>;
}
