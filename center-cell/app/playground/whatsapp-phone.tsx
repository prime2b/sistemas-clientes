'use client';
import {useEffect,useRef} from 'react';
import {ArrowLeft,BatteryFull,Check,CheckCheck,Camera,Mic,MoreVertical,Paperclip,Phone,Send,Signal,Smile,Video,Wifi} from 'lucide-react';
import {whatsappPreviewMessages,type PreviewMessage} from '../../lib/whatsapp-preview';

type Props={messages:PreviewMessage[];text:string;onText:(text:string)=>void;onSend:()=>void;onBack:()=>void;disabled:boolean;typing:boolean;typingSide?:'customer'|'business';typingLabel?:string;clock:number;handoff:boolean};
function formatted(text:string){
 return text.split(/(```[\s\S]*?```|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g).map((part,i)=>{
  if(part.startsWith('```')&&part.endsWith('```'))return <code key={i}>{part.slice(3,-3)}</code>;
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
  if(part.startsWith('*')&&part.endsWith('*'))return <strong key={i}>{part.slice(1,-1)}</strong>;
  if(part.startsWith('_')&&part.endsWith('_'))return <em key={i}>{part.slice(1,-1)}</em>;
  if(part.startsWith('~')&&part.endsWith('~'))return <s key={i}>{part.slice(1,-1)}</s>;
  return part;
 });
}
export default function WhatsAppPhone({messages,text,onText,onSend,onBack,disabled,typing,typingSide='business',typingLabel='Ceci está preparando a resposta',clock,handoff}:Props){
 const log=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
 const visible=whatsappPreviewMessages(messages);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[messages,typing]);
 useEffect(()=>{if(input.current){input.current.style.height='auto';input.current.style.height=Math.min(input.current.scrollHeight,112)+'px';}},[text]);
 const day=(timestamp:number)=>new Date(timestamp).toLocaleDateString('pt-BR');
 const today=day(clock);
 return <div className="wa-preview-stage">
  <div className="wa-preview-label"><span className="wa-preview-dot"/> Visão do cliente <small>Android · tema claro</small></div>
  <div className="wa-device"><span className="wa-device-power" aria-hidden="true"/><span className="wa-device-volume" aria-hidden="true"/>
   <div className="wa-screen">
    <div className="wa-status-bar" aria-hidden="true"><span>{new Date(clock).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><i className="wa-camera-lens"/><span><Signal size={13}/><Wifi size={14}/><BatteryFull size={19}/></span></div>
    <header className="wa-chat-header"><button type="button" aria-label="Voltar à visão técnica" onClick={onBack}><ArrowLeft size={22}/></button><img src="/brand/logo-mark-96.png" alt="Center Cell" width={38} height={38}/><div><strong>Center Cell</strong><small>{typing&&typingSide==='business'?'digitando…':'Conta comercial'}</small></div><span aria-hidden="true" className="wa-header-icons"><Video size={21}/><Phone size={19}/><MoreVertical size={20}/></span></header>
    <div className="wa-chat-wallpaper">
     <div className="wa-phone-messages" ref={log} role="log" aria-live="polite" aria-label="Prévia da conversa no WhatsApp">
      {!visible.length&&<div className="wa-phone-empty"><img src="/brand/logo-mark-96.png" width={42} height={42} alt=""/><strong>Center Cell</strong><span>Envie sua primeira mensagem para iniciar o teste.</span></div>}
      {visible.map((message,index)=>{
       const outgoing=message.role==='user',date=day(message.created),previous=visible[index-1],groupStart=!previous||previous.role!==message.role||day(previous.created)!==date;
       return <div key={message.id} className="wa-message-group">
        {(!previous||day(previous.created)!==date)&&<div className="wa-day"><span>{date===today?'Hoje':date}</span></div>}
        <div className={'wa-bubble '+(outgoing?'outgoing':'incoming')+(groupStart?' first':'')}><div className="wa-text">{formatted(message.body)}</div><span className="wa-message-meta"><time>{new Date(message.created).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>{outgoing&&(message.pending?<Check size={13} aria-label="Envio em andamento"/>:<CheckCheck size={15} aria-hidden="true"/>)}</span></div>
       </div>;
      })}
      {typing&&<div className={"wa-bubble wa-typing "+(typingSide==='customer'?'outgoing':'incoming')} role="status" aria-label={typingLabel}><i/><i/><i/></div>}
     </div>
     <form className="wa-composer" onSubmit={event=>{event.preventDefault();if(text.trim()&&!disabled)onSend();}}><div className="wa-input-pill"><Smile size={23} aria-hidden="true"/><label htmlFor="wa-client-message" className="sr-only">Mensagem do cliente no WhatsApp simulado</label><textarea id="wa-client-message" ref={input} rows={1} value={text} onChange={event=>onText(event.target.value)} disabled={disabled} placeholder={handoff?'Atendimento encaminhado':'Mensagem'} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(text.trim()&&!disabled)onSend();}}}/><Paperclip size={22} aria-hidden="true"/>{!text&&<Camera size={22} aria-hidden="true"/>}</div><button className="wa-send" disabled={disabled||!text.trim()} aria-label={text.trim()?'Enviar mensagem do cliente':'Áudio indisponível nesta simulação'}>{text.trim()?<Send size={21}/>:<Mic size={23}/>}</button></form>
    </div>
    <div className="wa-system-nav" aria-hidden="true"><i/></div>
   </div>
  </div>
  <p className="wa-preview-caption">Prévia das mensagens do canal atual. Notas internas e cards administrativos aparecem apenas na visão técnica.</p>
 </div>;
}
