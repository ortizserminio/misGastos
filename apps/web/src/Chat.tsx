import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowUp,MessageCircle,SquarePen} from 'lucide-react';
import './chat.css';

export type ChatMessage={role:'user'|'assistant';content:string};
const suggestions=['¿Cómo voy este mes?','¿En qué gasto más este mes?','¿Cuánto llevo en restaurantes este año?','Compara este mes con el anterior'];
// The model may answer with light Markdown; show it as plain text.
export const plain=(text:string)=>text.replace(/\*\*(.+?)\*\*/g,'$1').replace(/^\s*[*-]\s+/gm,'• ').replace(/^#+\s*/gm,'').trim();

export async function askChat(token:string,messages:ChatMessage[],fetcher:typeof fetch=fetch):Promise<{reply:string;remaining?:number}>{
 const response=await fetcher('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({messages})});
 const body=await response.json().catch(()=>null) as {reply?:string;remaining?:number;error?:string;message?:string}|null;
 if(!response.ok||!body?.reply){const error=new Error(body?.message||'No se ha podido obtener respuesta.') as Error&{code?:string};error.code=body?.error;throw error;}
 return {reply:body.reply,remaining:body.remaining};
}

// AI chat. Without a cloud session, or while the server has no AI key, the local rule-based assistant (fallback) is shown instead.
export default function Chat({getToken,fallback,fetcher}:{getToken?:()=>Promise<string|null>;fallback:ReactNode;fetcher?:typeof fetch}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState<number|null>(null),[unavailable,setUnavailable]=useState(false),[open,setOpen]=useState(false);
 const log=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,busy]);
 if(!getToken||unavailable)return <>{unavailable&&<p className="notice chat-unavailable" role="status">El chat con IA aún no está activado. Mientras tanto, aquí tienes el asistente básico.</p>}{fallback}</>;
 async function send(text:string){
  const question=text.trim();if(!question||busy)return;
  const next=[...messages,{role:'user' as const,content:question}].slice(-20);
  setMessages(next);setDraft('');setError('');setBusy(true);
  try{
   const token=await getToken!();if(!token)throw new Error('Inicia sesión para usar el chat.');
   const {reply,remaining}=await askChat(token,next,fetcher);
   setMessages(current=>[...current,{role:'assistant',content:plain(reply)}]);if(typeof remaining==='number')setRemaining(remaining);
  }catch(e){const err=e as Error&{code?:string};if(err.code==='ai_not_configured')setUnavailable(true);else setError(err.message);}
  finally{setBusy(false);}
 }
 return <div className="chat-page">
  {messages.length>0&&<div className="chat-top"><button type="button" className="chat-new" aria-label="Nueva conversación" onClick={()=>{setMessages([]);setError('');}} disabled={busy}><SquarePen size={20}/></button></div>}
  <div ref={log} className="chat-content" aria-label="Conversación">
   {!messages.length&&<div className="chat-empty"><span className="chat-mark"><MessageCircle size={28}/></span><h2>¿Qué quieres saber?</h2><div className="chat-suggestions">{suggestions.map(s=><button key={s} type="button" onClick={()=>send(s)} disabled={busy}>{s}</button>)}</div></div>}
   {messages.length>0&&<div className="chat-log" aria-live="polite">{messages.map((m,i)=><p key={i} className={`chat-bubble ${m.role}`}><span className="sr-only">{m.role==='user'?'Tú: ':'misGastos: '}</span>{m.content}</p>)}{busy&&<p className="chat-bubble assistant chat-thinking" role="status">Pensando…</p>}</div>}
   {error&&<p className="error" role="alert">{error}</p>}
  </div>
  {/* Collapsed pill; while focused or with text it opens into a taller box, like the iOS Claude app. */}
  <form className={open||draft?'chat-form open':'chat-form'} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}} onSubmit={e=>{e.preventDefault();send(draft);}}>
   <label className="sr-only" htmlFor="chat-input">Tu pregunta</label>
   <textarea id="chat-input" rows={1} maxLength={2000} value={draft} placeholder="Pregunta sobre tus gastos" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(draft);}}}/>
   <button type="submit" className="chat-send" aria-label="Enviar pregunta" disabled={busy||!draft.trim()}><ArrowUp size={20}/></button>
  </form>
  <small className="chat-meta">{remaining!==null?(remaining===1?'Te queda 1 pregunta hoy.':`Te quedan ${remaining} preguntas hoy.`):'Responde la IA gratuita de Google, que puede usar lo que le envías para mejorar sus productos.'}</small>
 </div>;
}
