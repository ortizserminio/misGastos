import {useState} from 'react';
import {ChevronLeft,ChevronDown} from 'lucide-react';
import {type Data,type Transaction,money} from './domain';
import {incomeBreakdown} from './income';
import {MonthSelector,MovementList} from './components';
import './income.css';

export default function IncomePage({data,month,onMonth,onBack,onEdit,onDelete,onAdd}:{data:Data;month:string;onMonth:(month:string)=>void;onBack:()=>void;onEdit:(t:Transaction)=>void;onDelete:(id:string)=>void;onAdd:()=>void}){
 const [by,setBy]=useState<'origin'|'account'>('origin');
 const [expanded,setExpanded]=useState<string|null>(null);
 const {groups,totalCents}=incomeBreakdown(data.transactions,month,by,data.merchantRules);
 return <div className="income-page">
  <button type="button" className="back" onClick={onBack}><ChevronLeft size={19}/> Volver</button>
  <div className="income-heading"><h1>Entradas</h1><MonthSelector month={month} onChange={onMonth}/></div>
  <section className="card income-summary"><span>Total del mes</span><strong>+{money(totalCents)}</strong></section>
  <div className="income-segments" role="group" aria-label="Agrupar entradas"><button type="button" className={by==='origin'?'selected':''} aria-pressed={by==='origin'} onClick={()=>{setBy('origin');setExpanded(null);}}>Por origen</button><button type="button" className={by==='account'?'selected':''} aria-pressed={by==='account'} onClick={()=>{setBy('account');setExpanded(null);}}>Por cuenta</button></div>
  {groups.length?<div className="card income-groups">{groups.map(group=><div className="income-group" key={group.key}>
   <button type="button" className="income-group-button" aria-expanded={expanded===group.key} onClick={()=>setExpanded(expanded===group.key?null:group.key)}><span className="income-group-name"><strong>{group.label}</strong><small>{group.count} {group.count===1?'entrada':'entradas'}</small></span><strong className="income-group-amount">+{money(group.totalCents)}</strong><ChevronDown size={19}/></button>
   <div className="income-bar" aria-label={`${group.share}% del total`}><span style={{width:`${group.share}%`}}/></div>
   {expanded===group.key&&<MovementList items={group.items} onEdit={onEdit} onDelete={onDelete}/>}
  </div>)}</div>:<div className="card income-empty"><p>Este mes todavía no ha entrado dinero.</p><button type="button" className="primary" onClick={onAdd}>Añadir ingreso</button></div>}
 </div>;
}
