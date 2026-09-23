import {useState} from 'react';
import {ArrowLeft,Plus,Trash2,Tag} from 'lucide-react';
import {type Data,colors,TRANSFER} from './domain';
import './settings.css';
const palette=[...colors,'#ef4444','#f97316','#14b8a6','#0f172a'];
export default function Categories({data,onChange,onBack}:{data:Data;onChange:(d:Data)=>void;onBack:()=>void}){
 const [name,setName]=useState(''),[picking,setPicking]=useState(''),[error,setError]=useState('');
 function add(e:React.FormEvent){e.preventDefault();const v=name.trim().replace(/\s+/g,' ');if(!v)return;if(v.length>40)return setError('Máximo 40 caracteres.');if(v.toLowerCase()===TRANSFER.toLowerCase()||data.categories.some(c=>c.name.toLowerCase()===v.toLowerCase()))return setError('Esa categoría ya existe.');onChange({...data,categories:[...data.categories,{name:v,color:palette[data.categories.length%palette.length]}]});setName('');setError('');}
 function remove(n:string){const used=data.transactions.filter(t=>t.category===n).length;if(!confirm(used?`¿Borrar «${n}»? Sus ${used} movimientos pasarán a «Otros».`:`¿Borrar «${n}»?`))return;const rest=data.categories.filter(c=>c.name!==n);onChange({...data,categories:rest.some(c=>c.name==='Otros')?rest:[...rest,{name:'Otros',color:'#9ca3af'}],transactions:data.transactions.map(t=>t.category===n?{...t,category:'Otros'}:t)});}
 return <div className="settings"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Categorías</h1></header>
  <form className="set-add" onSubmit={add}><input aria-label="Nueva categoría" placeholder="Nueva categoría" value={name} maxLength={40} onChange={e=>setName(e.target.value)}/><button className="primary" aria-label="Añadir categoría" disabled={!name.trim()}><Plus/></button></form>
  <p className="hint">Toca el icono de una categoría para cambiar su color.</p>{error&&<p className="error" role="alert">{error}</p>}
  <section className="set-card">{data.categories.map(c=><div key={c.name}><div className="set-row"><button className="set-icon" style={{background:c.color+'22',color:c.color}} aria-label={`Cambiar color de ${c.name}`} onClick={()=>setPicking(picking===c.name?'':c.name)}><Tag size={20}/></button><span className="set-label">{c.name}</span>{c.name!=='Otros'&&<button className="icon-button compact danger" aria-label={`Borrar ${c.name}`} onClick={()=>remove(c.name)}><Trash2 size={18}/></button>}</div>{picking===c.name&&<div className="set-colors">{palette.map(p=><button key={p} aria-label={`Color ${p}`} aria-pressed={p===c.color} style={{background:p}} onClick={()=>{onChange({...data,categories:data.categories.map(x=>x.name===c.name?{...x,color:p}:x)});setPicking('');}}/>)}</div>}</div>)}</section></div>;
}
