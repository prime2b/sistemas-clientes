'use client';
import {useEffect,useRef,useState} from 'react';
import {Headphones,Inbox,Send,CheckCircle2,UserRound,Play,Clock,ShoppingBag} from 'lucide-react';
import ChatCard from '../chat-card';
import HandoffSummary from '../handoff-summary';
import {WhatsAppIcon} from '../whatsapp-icon';
import {parseChatCard} from '../../lib/chat-cards';
import {saleAttendant,saleQuestion,saleSteps,type SimulatedSale} from '../../lib/playground-sales';
type Row=Record<string,any>;
export default function AttendantPreview({sale,messages,busy,active,onAction}:{sale?:SimulatedSale;messages:Row[];busy:boolean;active:boolean;onAction:(operation:string,slot:number,revision:number,body?:string)=>Promise<void>}){
 const [slot,setSlot]=useState<number>(sale?.assignedSlot||1),[text,setText]=useState(''),[detailsOpen,setDetailsOpen]=useState(false);const stream=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(sale?.assignedSlot)setSlot(sale.assignedSlot);},[sale?.assignedSlot]);
 useEffect(()=>{if(stream.current)stream.current.scrollTop=stream.current.scrollHeight;},[messages]);
 useEffect(()=>{setText('');},[sale?.revision]);
 const team=sale?.team||[1,2,3].map(slot=>({slot,name:'Atendente '+slot,avatar:'',available:true,load:0}));
 const owned=!!sale&&sale.assignedSlot===slot,attendant=sale&&saleAttendant(sale),manual=sale?.mode==='manual';
 const canWrite=owned&&manual&&active&&!busy&&!sale?.pendingCustomer&&!['ready','completed','queued'].includes(sale!.step);
 const act=async(operation:string)=>{if(!sale)return;await onAction(operation,slot,sale.revision,operation==='reply'?text:undefined);};
 return <div className="ax-attendant-preview" aria-label="Painel da atendente simulado">
  <div className="ax-sale-disclaimer"><Headphones size={16}/><span>Simulação dos três painéis · sem envio ou venda real</span></div>
  <nav className="ax-team-tabs" aria-label="Selecionar painel da atendente">{team.map(person=><button key={person.slot} aria-pressed={person.slot===slot} onClick={()=>setSlot(person.slot)}>{person.avatar?<img src={person.avatar} alt=""/>:<UserRound size={16}/>}<span>{person.name}</span><b aria-label="Atendimentos recebidos">{sale?.assignedSlot===person.slot?1:0}</b></button>)}</nav>
  {!owned?<div className="ax-sale-empty"><Inbox size={30}/><h3>{sale?.step==='queued'?'Aguardando disponibilidade':'Nenhum atendimento nesta fila'}</h3><p>{sale?.step==='queued'?'As três atendentes estão indisponíveis neste cenário. A conversa aguarda na fila, sem anunciar que alguém assumiu.':sale?'Esta conversa está disponível somente no painel de '+attendant?.name+'.':'O atendimento aparecerá aqui quando a Ceci encaminhar o orçamento aceito.'}</p></div>:<div className="ax-attendant-grid">
   <div className="ax-attendant-chat"><header><div className="ax-sale-client-avatar"><UserRound size={20}/></div><div><strong>Cliente simulado</strong><small><WhatsAppIcon width={12} height={12}/> WhatsApp · mesmo número da Center Cell</small></div><button className="ax-sale-context-toggle" onClick={()=>setDetailsOpen(v=>!v)} aria-expanded={detailsOpen}>Dados da compra</button><span className={'ax-sale-badge '+(sale!.step==='completed'?'done':'')}>{sale!.step==='completed'?'Concluído':sale!.acceptedAt?'Em atendimento':'Novo atendimento'}</span></header>
    <HandoffSummary summary={sale!.summary}/>
    <div className="ax-attendant-log" role="log" aria-label="Histórico no painel da atendente" ref={stream}>{messages.filter(m=>m.role!=='note').map(m=>{const card=parseChatCard(m.card_data);return <article key={m.id} className={'ax-attendant-message '+m.role}><strong>{m.role==='user'?'Cliente':m.role==='agent'?attendant?.name:'Ceci'}</strong><p>{card?card.intro:m.body}</p>{card&&<ChatCard card={card}/>}<time>{new Date(m.created).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></article>;})}</div>
    <div className="ax-sale-compose">
     {sale!.step==='completed'?<p className="ax-sale-success"><CheckCircle2 size={17}/> Venda simulada concluída com confirmação do cliente.</p>:<>
      <div className="ax-sale-compose-head"><strong>{manual?'Você está no papel da atendente':'Atendente simulada · automática'}</strong><span>{saleSteps[sale!.step]}</span></div>
      {!manual?<button className="pg-button secondary" disabled={!active||busy||!!sale!.pendingCustomer} onClick={()=>void act('assume')}><UserRound size={15}/> Assumir como atendente</button>:<>
       <label htmlFor="ax-attendant-message">Resposta ao cliente</label><textarea id="ax-attendant-message" rows={3} value={text} disabled={!canWrite} onChange={e=>setText(e.target.value)} placeholder={sale!.step==='ready'?'Cliente confirmou. Conclua a venda simulada.':'Escreva como você responderia ao cliente…'}/>
       <div className="ax-sale-compose-actions"><button className="ax-text-button" disabled={!canWrite} onClick={()=>setText(saleQuestion(sale!))}>Usar sugestão</button>{sale!.step==='ready'?<button className="pg-button ax-sale-complete" disabled={!active||busy||!!sale!.pendingCustomer} onClick={()=>void act('complete')}><CheckCircle2 size={15}/> Concluir venda simulada</button>:<button className="pg-button ax-primary" disabled={!canWrite||!text.trim()} onClick={()=>void act('reply')}><Send size={15}/> Enviar</button>}</div>
       <button className="ax-text-button" disabled={!active||busy||!!sale!.pendingCustomer} onClick={()=>void act('automate')}><Play size={13}/> Continuar automaticamente</button>
      </>}
      {sale!.pendingCustomer&&<small role="status">Cliente simulado preparando a resposta…</small>}
     </>}
    </div>
   </div>
   <aside className={'ax-sale-context'+(detailsOpen?' is-open':'')}><h3><ShoppingBag size={16}/> Compra em andamento</h3><span className="ax-sale-badge">{saleSteps[sale!.step]}</span><dl><div><dt>Responsável</dt><dd>{attendant?.name}</dd></div><div><dt>Orçamento recebido</dt><dd>#{sale!.quote.id.slice(0,8).toUpperCase()}</dd></div><div><dt>Retirada ou entrega</dt><dd>{sale!.delivery==='retirada'?'Retirada na loja':sale!.delivery==='entrega'?'Entrega a combinar':'A combinar'}</dd></div><div><dt>Pagamento</dt><dd>{sale!.payment==='pix'?'Pix':sale!.payment==='cartao'?'Cartão':'A combinar'}</dd></div><div><dt>Confirmação final</dt><dd>{sale!.confirmationMessageId?'Recebida do cliente':'Aguardando'}</dd></div></dl><details><summary>Orçamento aceito pelo cliente</summary><ChatCard card={sale!.quote}/></details><p><Clock size={14}/> O histórico e o orçamento seguem com a conversa. Nenhuma nova cotação é gerada no encaminhamento.</p><small>Retirada/entrega e Pix/cartão são condições fictícias deste teste. Não há cobrança, reserva, prazo prometido ou registro de venda no ERP.</small></aside>
  </div>}
 </div>;
}
