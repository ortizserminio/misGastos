import {useState} from 'react';
import {Check,Trash2} from 'lucide-react';
import {money,type Transaction} from './domain';
import './review.css';
type Props={items:Transaction[];accounts:string[];categories:string[];onConfirm:(t:Transaction)=>void;onDelete:(id:string)=>void};
// Shortcut expenses arrive "pending": the shortcut cannot know which card paid, so the user picks the account here.
function Item({t,accounts,categories,onConfirm,onDelete}:{t:Transaction}&Omit<Props,'items'>){
 const [merchant,setMerchant]=useState(t.merchant),[category,setCategory]=useState(t.category),[bank,setBank]=useState(accounts.includes(t.bank)?t.bank:accounts[0]??t.bank),[deduct,setDeduct]=useState(true);
 function confirm(){const {pending:_p,skipBalance:_s,...rest}=t;onConfirm({...rest,merchant:merchant.trim()||t.merchant,category,bank,...(deduct?{}:{skipBalance:true})});}
 return <li className="review-item">
  <div className="review-head"><input aria-label={`Comercio de ${t.merchant}`} value={merchant} maxLength={200} onChange={e=>setMerchant(e.target.value)}/><strong>−{money(t.amountCents)}</strong></div>
  <small>{new Date(t.date+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}{t.time?` · ${t.time}`:''} · Atajo</small>
  <div className="review-fields"><label>Cuenta<select aria-label={`Cuenta de ${t.merchant}`} value={bank} onChange={e=>setBank(e.target.value)}>{Array.from(new Set([...accounts,bank])).map(a=><option key={a}>{a}</option>)}</select></label>
   <label>Categoría<select aria-label={`Categoría de ${t.merchant}`} value={category} onChange={e=>setCategory(e.target.value)}>{Array.from(new Set([...categories,category])).map(c=><option key={c}>{c}</option>)}</select></label></div>
  <label className="review-check"><input type="checkbox" checked={deduct} onChange={e=>setDeduct(e.target.checked)}/> Descontar del saldo de {bank}</label>
  <div className="review-actions"><button className="icon-button compact danger" aria-label={`Borrar ${t.merchant}`} onClick={()=>onDelete(t.id)}><Trash2 size={18}/></button><button className="primary" onClick={confirm}><Check size={18}/> Confirmar</button></div>
 </li>;
}
export default function PendingReview({items,...rest}:Props){
 if(!items.length)return null;
 return <section className="card review-card" aria-label="Gastos por revisar"><div className="section-title"><h2>Gastos por revisar</h2><span className="small-pill">{items.length}</span></div><p className="hint">Llegaron del atajo. Elige con qué cuenta pagaste y confírmalos.</p><ul className="review-list">{items.map(t=><Item key={t.id} t={t} {...rest}/>)}</ul></section>;
}
