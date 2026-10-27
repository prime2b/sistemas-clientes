import {Check,FileText,Smartphone} from 'lucide-react';
import {shortQuoteId,type ChatCardData} from '../lib/chat-cards';

const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const checked=(timestamp:number)=>new Date(timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

export default function ChatCard({card,onApprove}:{card:ChatCardData;onApprove?:()=>void}){
  if(card.type==='catalog')return <><div className="cc-chat-card cc-product-card" aria-label={`Produtos encontrados, parte ${card.part} de ${card.parts}`}>
    {card.items.map(item=><div className="cc-card-item" key={item.productId}>
      <span className="cc-card-product-icon"><Smartphone size={19}/></span>
      <span className="cc-card-product-info"><strong>{item.name}</strong><small>Cód. {item.productId} · {item.status==='available'?'Disponível':item.status==='unavailable'?'Indisponível no momento':'Consulta pendente'}</small></span>
      <strong className="cc-card-price">{item.status==='available'&&item.unitCents!==null?money(item.unitCents):'—'}</strong>
    </div>)}
    <div className="cc-card-freshness">{card.part} de {card.parts} · {card.total} {card.total===1?'produto encontrado':'produtos encontrados'} · consulta às {checked(card.checkedAt)}</div>
  </div>{card.closing&&<p>{card.closing}</p>}</>;
  if(card.type==='products')return <><div className="cc-chat-card cc-product-card" aria-label="Produtos consultados">
    {card.items.map(item=><div className="cc-card-item" key={item.productId}>
      <span className="cc-card-product-icon"><Smartphone size={19}/></span>
      <span className="cc-card-product-info"><strong>{item.name}</strong><small>Cód. {item.productId} · Disponível</small></span>
      <strong className="cc-card-price">{money(item.unitCents)}</strong>
    </div>)}
    <div className="cc-card-freshness">Preços e estoque conferidos às {checked(card.checkedAt)}. Sujeitos a nova confirmação.</div>
  </div>{card.closing&&<p>{card.closing}</p>}</>;
  return <><div className="cc-chat-card cc-quote-card" aria-label={'Orçamento '+shortQuoteId(card.id)}>
    <div className="cc-quote-card-head"><span className="cc-quote-icon"><FileText size={18}/></span><span><strong>Orçamento #{shortQuoteId(card.id)}</strong><small>Valores de lojista · {checked(card.checkedAt)}</small></span><span className={'cc-quote-status '+(card.status==='approved'?'approved':'')}>{card.status==='approved'?'Cliente confirmou':'Aguardando cliente'}</span></div>
    {card.items.map(item=><div className="cc-card-item" key={item.productId}>
      <span className="cc-card-product-icon"><Smartphone size={19}/></span>
      <span className="cc-card-product-info"><strong>{item.name}</strong><small>Cód. {item.productId} · {item.quantity} × {money(item.unitCents)}</small></span>
      <strong className="cc-card-price">{money(item.totalCents)}</strong>
    </div>)}
    <div className="cc-quote-card-total"><span>Total · {card.items.reduce((sum,item)=>sum+item.quantity,0)} {card.items.reduce((sum,item)=>sum+item.quantity,0)===1?'item':'itens'}</span><strong>{money(card.totalCents)}</strong></div>
    <div className="cc-card-freshness"><Check size={13}/> Consulta realizada às {checked(card.checkedAt)}. Orçamento não reserva estoque.</div>
    {onApprove&&card.status==='awaiting'&&<div className="cc-quote-card-actions"><button type="button" onClick={onApprove}>Marcar como aprovado</button></div>}
  </div>{card.closing&&<p>{card.closing}</p>}</>;
}
