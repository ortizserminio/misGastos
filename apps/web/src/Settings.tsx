import {useRef,useState} from 'react';
import {Camera,Pencil,Check,ChevronRight,Banknote,Landmark,LayoutGrid,Zap,UploadCloud,UserRound,Info,Download,Upload,Trash2,Mail,type LucideIcon} from 'lucide-react';
import {type Data,validateBackup,download,emptyData} from './domain';
import './settings.css';
type Props={data:Data;onChange:(d:Data,restore?:boolean)=>void;onShortcut:()=>void;onPatrimonio:()=>void;onCategories:()=>void;onImport:()=>void;account?:{email:string;onLogout:()=>void}};
function Row({icon:Icon,label,value,onClick,accent}:{icon:LucideIcon;label:string;value?:string;onClick?:()=>void;accent?:boolean}){const body=<><span className={`set-icon${accent?' accent':''}`}><Icon size={22}/></span><span className="set-label">{label}</span>{value&&<span className="set-value">{value}</span>}{onClick&&<ChevronRight className="set-chevron" size={20}/>}</>;return onClick?<button className="set-row" onClick={onClick}>{body}</button>:<div className="set-row">{body}</div>;}
function resizeImage(file:File):Promise<string>{return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),s=Math.min(img.width,img.height);c.width=c.height=256;c.getContext('2d')!.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',.85));};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se ha podido leer la imagen.'));};img.src=url;});}
export default function Settings({data,onChange,onShortcut,onPatrimonio,onCategories,onImport,account}:Props){
 const [editing,setEditing]=useState<''|'name'|'owner'>(''),[draft,setDraft]=useState(''),[error,setError]=useState(''),restore=useRef<HTMLInputElement>(null);
 const profile=data.profile,initials=(profile.displayName||'mis Gastos').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
 const saveProfile=(p:Partial<Data['profile']>)=>onChange({...data,profile:{...profile,...p}});
 const start=(field:'name'|'owner')=>{setDraft(field==='name'?profile.displayName:profile.ownerName);setEditing(field);setError('');};
 const commit=(e:React.FormEvent)=>{e.preventDefault();const v=draft.trim().replace(/\s+/g,' ');saveProfile(editing==='name'?{displayName:v.slice(0,100)}:{ownerName:v.slice(0,200)});setEditing('');};
 return <div className="settings">
  <section className="set-profile"><div className="set-avatar">{profile.avatar?<img src={profile.avatar} alt="Tu foto de perfil"/>:<span>{initials}</span>}<label className="set-camera" aria-label="Cambiar foto de perfil"><Camera size={18}/><input type="file" accept="image/*" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{saveProfile({avatar:await resizeImage(f)});}catch(err){setError((err as Error).message);}}}/></label></div>
   {editing==='name'?<form className="set-inline" onSubmit={commit}><input autoFocus aria-label="Tu nombre" value={draft} maxLength={100} onChange={e=>setDraft(e.target.value)}/><button className="icon-button" aria-label="Guardar nombre"><Check size={18}/></button></form>:<h1 className="set-name">{profile.displayName||'Tu nombre'}<button className="icon-button compact" aria-label="Editar nombre" onClick={()=>start('name')}><Pencil size={16}/></button></h1>}
   <p>Gestiona misGastos a tu manera</p></section>
  {error&&<p className="error" role="alert">{error}</p>}
  <section className="set-card"><Row icon={Banknote} label="Moneda" value="Euro (EUR)"/><Row icon={Landmark} label="Patrimonio y cuentas" onClick={onPatrimonio}/><Row icon={LayoutGrid} label="Categorías" value={`${data.categories.length} activas`} onClick={onCategories}/></section>
  <section className="set-card"><h2>Atajos</h2><Row icon={Zap} accent label="Atajo Apple Pay" onClick={onShortcut}/></section>
  <section className="set-card"><h2>Automatizaciones <span className="set-badge">NUEVO</span></h2><Row icon={UploadCloud} accent label="Importar movimientos" value="CSV o PDF" onClick={onImport}/></section>
  <section className="set-card">
   {account&&<Row icon={Mail} label="Cuenta" value={account.email}/>}
   {editing==='owner'?<form className="set-inline set-owner" onSubmit={commit}><label>Titular de las cuentas<input autoFocus value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)} placeholder="Nombre y apellidos como en el banco"/></label><button className="icon-button" aria-label="Guardar titular"><Check size={18}/></button></form>:<Row icon={UserRound} label="Titular de las cuentas" value={profile.ownerName||'Sin indicar'} onClick={()=>start('owner')}/>}
   <Row icon={Download} label="Exportar copia de seguridad" onClick={()=>download('misGastos-copia.json',data)}/>
   <Row icon={Upload} label="Restaurar copia JSON" onClick={()=>restore.current?.click()}/>
   <input ref={restore} hidden type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('La copia supera 10 MB.');const restored=validateBackup(await file.text());if(confirm(`¿Sustituir los datos locales por ${restored.transactions.length} movimientos de esta copia?`)){onChange(restored,true);setError('');}}catch(err){setError((err as Error).message);}}}/>
   <Row icon={Trash2} label={account?'Borrar todos mis datos':'Borrar datos locales'} onClick={()=>{if(confirm(account?'¿Borrar todos tus movimientos, cuentas y ajustes de tu cuenta? Exporta antes una copia.':'¿Borrar todos los datos de este navegador? Exporta antes una copia. El receptor de Atajos no se borra.'))onChange(emptyData(),true);}}/>
   <Row icon={Info} label="App info" value={account?'v0.3.0 · nube':'v0.2.0 · local'}/>
  </section>
  {account&&<button className="set-logout" onClick={account.onLogout}>Cerrar sesión</button>}
  <p className="hint set-note">{account?'Tus datos se guardan en tu cuenta y solo los ves tú.':'Tus datos se guardan en este dispositivo.'} El token del atajo no se exporta.</p>
 </div>;
}
