import {useState} from 'react';
import {ArrowLeft,ChevronDown,Wallet} from 'lucide-react';
import {type Data,type Transaction,money,today} from './domain';
import {incomeBreakdown,incomeComparison} from './income';
import {MonthSelector,MovementList} from './components';
import './income.css';

export default function IncomePage({data,month,onMonth,onBack,onEdit,onDelete,onAdd}:{data:Data;month:string;onMonth:(month:string)=>void;onBack:()=>void;onEdit:(t:Transaction)=>void;onDelete:(id:string)=>void;onAdd:()=>void}){
 const [by,setBy]=useState<'origin'|'account'>('origin');
 const [expanded,setExpanded]=useState<string|null>(null);
 const {groups,totalCents}=incomeBreakdown(data.transactions,month,by,data.merchantRules);
 const currentMonth=today().slice(0,7);
 const [year,number]=month.split('-').map(Number);
 const monthName=new Intl.DateTimeFormat('es-ES',{month:'long'}).format(new Date(year,number-1,1));
 const emptyText=month===currentMonth?'Este mes todavía no ha entrado dinero.':`En ${monthName}${year===Number(currentMonth.slice(0,4))?'':` de ${year}`} no entró dinero.`;
 return <div className="income-page">
  <button type="button" className="back" onClick={onBack}><ArrowLeft size={20}/> Volver</button>
  <div className="income-heading"><h1>Entradas</h1><MonthSelector month={month} onChange={next=>{setExpanded(null);onMonth(next);}}/></div>
  {groups.length?<>
   <section className="card income-summary"><span>Total del mes</span><strong>+{money(totalCents)}</strong><small>{incomeComparison(data.transactions,month)}</small></section>
   <div className="segmented income-tabs" role="group" aria-label="Agrupar entradas"><button type="button" className={by==='origin'?'selected':''} aria-pressed={by==='origin'} onClick={()=>{setBy('origin');setExpanded(null);}}>Por origen</button><button type="button" className={by==='account'?'selected':''} aria-pressed={by==='account'} onClick={()=>{setBy('account');setExpanded(null);}}>Por cuenta</button></div>
   <div className="card income-groups">{groups.map((group,index)=>{const panelId=`income-group-${by}-${index}`;return <div className="income-group" key={group.key}>
    <button type="button" className="income-group-button" aria-expanded={expanded===group.key} aria-controls={panelId} onClick={()=>setExpanded(expanded===group.key?null:group.key)}><span className="income-group-name"><strong>{group.label}</strong><small>{group.count} {group.count===1?'entrada':'entradas'} · {group.share} %</small></span><strong className="income-group-amount">+{money(group.totalCents)}</strong><ChevronDown size={19}/></button>
    {groups.length>1&&<div className="income-bar" aria-hidden="true"><span style={{width:`${group.share}%`}}/></div>}
    <div id={panelId} hidden={expanded!==group.key}>{expanded===group.key&&<MovementList items={group.items} onEdit={onEdit} onDelete={onDelete} hideMerchant={by==='origin'}/>}</div>
   </div>;})}</div>
  </>:<div className="card income-empty empty-state"><span className="empty-icon"><Wallet size={32}/></span><h3>{emptyText}</h3><button type="button" className="primary" onClick={onAdd}>Añadir ingreso</button></div>}
 </div>;
}
