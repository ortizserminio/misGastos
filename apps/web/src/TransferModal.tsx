import {useEffect,useRef,useState} from 'react';
import {X,ArrowLeftRight} from 'lucide-react';
import {type Transaction,parseMoney,today,validDate,money,nowTime,TRANSFER} from './domain';
import {type Asset,accountBalance,cashTypes} from './assets';
import DateField from './DateField';
import WalletStack from './WalletStack';
import './transaction-modal.css';

// Moves money between two of the user's own accounts: the origin balance goes down, the destination goes up,
// and it never counts as an expense or an income.
export default function TransferModal({assets,transactions,onClose,onSave}:{assets:Asset[];transactions:Transaction[];onClose:()=>void;onSave:(t:Transaction)=>void}){
 const accounts=assets.filter(a=>cashTypes.includes(a.type));
 const [amount,setAmount]=useState(''),[date,setDate]=useState(today()),[concept,setConcept]=useState(''),[fromId,setFromId]=useState(accounts[0]?.id??''),[toId,setToId]=useState(accounts[1]?.id??''),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),saved=useRef(false);
 const from=accounts.find(a=>a.id===fromId),destinations=accounts.filter(a=>a.id!==fromId),to=destinations.find(a=>a.id===toId);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.showModal();return()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 const close=()=>{if((amount||concept)&&!confirm('¿Descartar esta transferencia sin guardar?'))return;onClose();};
 function chooseFrom(id:string){setFromId(id);if(id===toId)setToId(accounts.find(a=>a.id!==id)?.id??'');setError('');}
 function save(){try{if(saved.current)return;if(!from)throw Error('Elige la cuenta de origen.');if(!to)throw Error('Elige la cuenta de destino.');if(!validDate(date))throw Error('Selecciona una fecha válida.');const amountCents=parseMoney(amount);
  const known=from.openingBalance||from.valuations.length,balance=accountBalance(from,transactions);if(known&&amountCents>balance&&!confirm(`${from.name} tiene ${money(balance)}. Tras la transferencia quedará en negativo. ¿Continuar?`))return;
  saved.current=true;onSave({id:crypto.randomUUID(),type:'transfer',amountCents,merchant:concept.trim()||`Transferencia a ${to.name}`,bank:from.name,toAccount:to.name,category:TRANSFER,date,...(date===today()?{time:nowTime()}:{}),source:'manual'});}catch(e){saved.current=false;setError((e as Error).message);}}
 return <dialog ref={dialog} className="modal transaction-modal" onCancel={e=>{e.preventDefault();close();}} aria-labelledby="transfer-title"><div className="transaction-layout">
  <header className="transaction-header"><div className="modal-top"><span className="round-icon"><ArrowLeftRight size={20}/></span><h2 id="transfer-title" className="transfer-title">Transferir entre cuentas</h2><button className="icon-button" aria-label="Cerrar transferencia" onClick={close}><X/></button></div></header>
  <div className="modal-body">{accounts.length<2?<p className="hint">Necesitas al menos dos cuentas en Patrimonio para hacer una transferencia.</p>:<>
   <p className="hint">El dinero sale de una cuenta y entra en la otra. No cuenta como gasto ni como ingreso.</p>
   <label className="amount-label">Importe a traspasar<input inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} aria-label="Importe a traspasar"/></label>
   <fieldset className="account-picker"><legend>Desde</legend><WalletStack choices={accounts} selectedId={fromId} onSelect={chooseFrom} transactions={transactions} label="Cuenta de origen"/></fieldset>
   <fieldset className="account-picker"><legend>Hacia</legend><WalletStack choices={destinations} selectedId={toId} onSelect={setToId} transactions={transactions} label="Cuenta de destino"/></fieldset>
   <DateField label="Fecha" value={date} onChange={setDate}/>
   <label>Concepto (opcional)<input value={concept} maxLength={200} onChange={e=>setConcept(e.target.value)} placeholder="p. ej. Ahorro del mes"/></label>
  </>}{error&&<p role="alert" className="error">{error}</p>}</div>
  <footer className="transaction-footer"><button className="primary wide" disabled={accounts.length<2||!from||!to} onClick={save}>Guardar transferencia</button></footer>
 </div></dialog>;
}
