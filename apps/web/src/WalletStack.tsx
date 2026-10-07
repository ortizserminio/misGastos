import type {CSSProperties} from 'react';
import {Check,CreditCard} from 'lucide-react';
import {money,type Transaction} from './domain';
import {type Asset,accountBalance} from './assets';
// Stacked, colour-coded account cards (Apple Wallet style); the selected card is drawn last, in front.
export default function WalletStack({choices,selectedId,onSelect,transactions,label}:{choices:Asset[];selectedId:string;onSelect:(id:string)=>void;transactions:Transaction[];label:string}){
 const ordered=[...choices.filter(a=>a.id!==selectedId),...choices.filter(a=>a.id===selectedId)];
 if(!ordered.length)return <p className="hint">Añade una cuenta en Patrimonio para elegirla aquí.</p>;
 return <div className="wallet-stack" role="group" aria-label={label} style={{height:126+44*(ordered.length-1)+8}}>{ordered.map((a,slot)=>{const chosen=a.id===selectedId;const rgb=a.color.slice(1).match(/.{2}/g)!.map(v=>parseInt(v,16)),darkText=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>165;const style={background:a.color,color:darkText?'#17202a':'#fff',top:slot*44,left:ordered.length>1?slot*32/(ordered.length-1):16,zIndex:slot+1} as CSSProperties;return <button type="button" key={a.id} className={`wallet-card${chosen?' is-selected':''}`} style={style} aria-label={`Seleccionar cuenta ${a.name}`} aria-pressed={chosen} onClick={()=>onSelect(a.id)}><span className="wallet-card-title">{a.name}</span><span className="wallet-card-icon" aria-hidden="true">{chosen?<Check size={19}/>:<CreditCard size={19}/>}</span><span className="wallet-card-bank">{a.bank||'Cuenta manual'}</span><span className={`wallet-card-balance${a.openingBalance||a.valuations.length?'':' unset'}`}>{a.openingBalance||a.valuations.length?money(accountBalance(a,transactions)):'Saldo sin registrar'}</span></button>;})}</div>;
}
