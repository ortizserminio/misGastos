import {useState} from 'react';
import {ArrowLeft,Check,ChevronDown,ChevronRight,Trash2} from 'lucide-react';
import {money,type Transaction} from './domain';
import './review.css';
type Props={items:Transaction[];accounts:string[];categories:string[];onConfirm:(t:Transaction)=>void;onDelete:(id:string)=>void;onBack:()=>void};
const when=(t:Transaction)=>`${new Date(t.date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})}${t.time?` · ${t.time}`:''}`;
// Shortcut expenses arrive "pending": the shortcut cannot know which card paid, so the user picks the account here.
function Editor({t,accounts,categories,onConfirm,onDelete}:{t:Transaction}&Omit<Props,'items'|'onBack'>){
 const [merchant,setMerchant]=useState(t.merchant),[category,setCategory]=useState(t.category),[bank,setBank]=useState(accounts.includes(t.bank)?t.bank:accounts[0]??t.bank),[deduct,setDeduct]=useState(true);
 function confirm(){const {pending:_p,skipBalance:_s,...rest}=t;onConfirm({...rest,merchant:merchant.trim()||t.merchant,category,bank,...(deduct?{}:{skipBalance:true})});}
 return <div className="review-editor">
  <label>Comercio<input aria-label={`Comercio de ${t.merchant}`} value={merchant} maxLength={200} onChange={e=>setMerchant(e.target.value)}/></label>
  <div className="review-fields"><label>Cuenta<select aria-label={`Cuenta de ${t.merchant}`} value={bank} onChange={e=>setBank(e.target.value)}>{Array.from(new Set([...accounts,bank])).map(a=><option key={a}>{a}</option>)}</select></label>
   <label>Categoría<select aria-label={`Categoría de ${t.merchant}`} value={category} onChange={e=>setCategory(e.target.value)}>{Array.from(new Set([...categories,category])).map(c=><option key={c}>{c}</option>)}</select></label></div>
  <label className="review-check"><input type="checkbox" checked={deduct} onChange={e=>setDeduct(e.target.checked)}/> Descontar del saldo de {bank}</label>
  <div className="review-actions"><button className="icon-button compact danger" aria-label={`Borrar ${t.merchant}`} onClick={()=>onDelete(t.id)}><Trash2 size={18}/></button><button className="primary" onClick={confirm}><Check size={18}/> Confirmar</button></div>
 </div>;
}
// Compact list: one line per payment; tapping a line opens its editor.
export default function PendingReview({items,onBack,...rest}:Props){
 const [open,setOpen]=useState<string|null>(items.length===1?items[0].id:null);
 return <div className="review-page" aria-label="Gastos por revisar"><header className="set-page-head"><button className="icon-button" aria-label="Volver" onClick={onBack}><ArrowLeft/></button><h1>Gastos por revisar</h1></header>
  {items.length?<><p className="hint">Llegaron del atajo. Toca un pago, elige con qué cuenta pagaste y confírmalo.</p>
   <ul className="review-list card">{items.map(t=>{const isOpen=open===t.id;return <li key={t.id} className={`review-item${isOpen?' open':''}`}>
    <button className="review-row" aria-expanded={isOpen} onClick={()=>setOpen(isOpen?null:t.id)}><span className="review-row-main"><strong>{t.merchant}</strong><small>{when(t)}</small></span><strong className="review-amount">−{money(t.amountCents)}</strong>{isOpen?<ChevronDown size={20}/>:<ChevronRight size={20}/>}</button>
    {isOpen&&<Editor t={t} {...rest}/>}
   </li>;})}</ul></>
  :<section className="card review-empty"><Check size={28}/><h2>Todo revisado</h2><p>No hay pagos del atajo pendientes.</p><button className="primary" onClick={onBack}>Volver a Gastos</button></section>}
 </div>;
}
