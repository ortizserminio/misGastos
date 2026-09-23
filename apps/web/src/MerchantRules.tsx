import {useState} from 'react';
import {ArrowLeft,Plus,Trash2,Store,Sparkles} from 'lucide-react';
import {type Data,type MerchantRule} from './domain';
import {builtInMerchants,tidyData,unknownMerchants,normalizeText} from './merchants';
import './settings.css';
export default function MerchantRules({data,onChange,onBack}:{data:Data;onChange:(d:Data)=>void;onBack:()=>void}){
 const rules=data.merchantRules??[],categories=data.categories.map(c=>c.name);
 const [match,setMatch]=useState(''),[name,setName]=useState(''),[category,setCategory]=useState(categories[0]??'Otros'),[error,setError]=useState(''),[info,setInfo]=useState('');
 // Saving rules also renames the expenses that already exist.
 function save(next:MerchantRule[],message:string){const updated={...data,merchantRules:next},tidied=tidyData(updated);onChange(tidied??updated);const renamed=tidied?tidied.transactions.filter((t,i)=>t!==updated.transactions[i]).length:0;setInfo(`${message}${renamed?` · ${renamed} gastos actualizados`:''}`);}
 function add(e:React.FormEvent){e.preventDefault();const m=match.trim(),n=name.trim().replace(/\s+/g,' ');if(!m||!n)return setError('Escribe el texto que contiene el comercio y el nombre que quieres ver.');if(m.length>60||n.length>100)return setError('Texto demasiado largo.');if(rules.some(r=>normalizeText(r.match)===normalizeText(m)))return setError('Ya tienes una regla para ese texto.');setError('');save([{match:m,name:n,category},...rules],`Regla guardada: «${m}» → ${n}`);setMatch('');setName('');}
 const suggestions=unknownMerchants(data);
 return <div className="settings"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Nombres de comercios</h1></header>
  <p className="hint">Cambia los nombres raros del banco por otros que entiendas. Tus reglas se aplican a los gastos del atajo, a los extractos que importes y a los que ya tienes.</p>
  <form className="set-card import-pad" onSubmit={add}><h2>Nueva regla</h2>
   <label>Si el comercio contiene<input aria-label="Si el comercio contiene" value={match} maxLength={60} onChange={e=>setMatch(e.target.value)} placeholder="p. ej. moneynet"/></label>
   <label>Mostrar como<input aria-label="Mostrar como" value={name} maxLength={100} onChange={e=>setName(e.target.value)} placeholder="p. ej. Máquina expendedora"/></label>
   <label>Categoría<select aria-label="Categoría de la regla" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
   {error&&<p className="error" role="alert">{error}</p>}
   <button className="primary wide"><Plus size={18}/> Guardar regla</button></form>
  {info&&<p className="toast" role="status">{info}</p>}
  {suggestions.length>0&&<section className="set-card"><h2><span><Sparkles size={18}/> Sin reconocer</span></h2>{suggestions.map(s=><button key={s.merchant} className="set-row" onClick={()=>{setMatch(s.merchant.slice(0,60));setName(s.merchant.slice(0,100));setError('');if(!/jsdom/i.test(navigator.userAgent))window.scrollTo({top:0,behavior:'smooth'});}}><span className="set-icon"><Store size={20}/></span><span className="set-label">{s.merchant}</span><span className="set-value">{s.times} {s.times===1?'gasto':'gastos'} · Crear regla</span></button>)}</section>}
  <section className="set-card"><h2>Tus reglas</h2>{rules.length?rules.map(r=><div className="set-row" key={r.match}><span className="set-icon accent"><Store size={20}/></span><span className="set-label">{r.name}<small className="rule-detail">contiene «{r.match}» · {r.category}</small></span><button className="icon-button compact danger" aria-label={`Borrar regla ${r.match}`} onClick={()=>save(rules.filter(x=>x!==r),'Regla borrada')}><Trash2 size={18}/></button></div>):<p className="hint import-pad">Todavía no has creado ninguna regla.</p>}</section>
  <details className="set-card rule-builtin"><summary>Incluidos de serie ({builtInMerchants.length})</summary>{builtInMerchants.map(b=><div className="set-row" key={b.name+b.pattern}><span className="set-label">{b.name}<small className="rule-detail">{b.category}</small></span></div>)}</details>
 </div>;
}
