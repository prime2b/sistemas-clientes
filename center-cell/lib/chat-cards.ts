import type {QuoteDraft} from './erp/quote';

export type ProductOption={productId:number;name:string;stock:number;unitCents:number};
export type ProductCard={type:'products';intro:string;closing?:string;checkedAt:number;items:ProductOption[]};
export type CatalogItem={productId:number;name:string;stock:number|null;unitCents:number|null;status:'available'|'unavailable'|'unconfirmed'};
export type CatalogCard={type:'catalog';intro:string;closing?:string;checkedAt:number;part:number;parts:number;total:number;items:CatalogItem[]};
export type QuoteCard={type:'quote';intro:string;closing?:string;id:string;checkedAt:number;status:'awaiting'|'approved';items:{productId:number;name:string;quantity:number;unitCents:number;totalCents:number}[];totalCents:number};
export type ChatCardData=ProductCard|QuoteCard|CatalogCard;
const brl=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const shortQuoteId=(id:string)=>id.slice(0,8).toUpperCase();

export function productMessage(intro:string,items:ProductOption[],checkedAt:number,closing?:string){
  if(!items.length||items.length>3||items.some(item=>!Number.isSafeInteger(item.unitCents)||item.unitCents<=0||!Number.isFinite(item.stock)||item.stock<=0))throw new Error('UNVERIFIED_PRODUCT_OPTIONS');
  const card:ProductCard={type:'products',intro,checkedAt,items,...(closing?{closing}:{})};
  const lines=items.map(item=>`${item.name}\nCód. ${item.productId} · ${item.stock} em estoque · ${brl(item.unitCents)} un.`);
  const body=[intro,...lines,'Valores e estoque consultados agora. A cotação não reserva produtos.',closing].filter(Boolean).join('\n\n');
  if(body.length>4000)throw new Error('MESSAGE_TOO_LONG');
  return {body,card};
}
/** List every matched SKU; chunk so each WhatsApp message stays below its text limit. */
export function catalogMessages(intro:string,items:CatalogItem[],checkedAt:number,closing=''){
  if(!items.length||items.some(item=>!Number.isSafeInteger(item.productId)||!item.name||
    (item.status==='available'&&(!Number.isSafeInteger(item.unitCents)||Number(item.unitCents)<=0||!Number.isFinite(item.stock)||Number(item.stock)<=0))))throw new Error('UNVERIFIED_CATALOG_OPTIONS');
  const chunks:CatalogItem[][]=[];
  for(let i=0;i<items.length;i+=8)chunks.push(items.slice(i,i+8));
  return chunks.map((chunk,index)=>{
    const heading=index===0?intro:`Mais opções encontradas (${index+1}/${chunks.length}):`;
    const tail=index===chunks.length-1?closing:'';
    const card:CatalogCard={type:'catalog',intro:heading,closing:tail||undefined,checkedAt,part:index+1,parts:chunks.length,total:items.length,items:chunk};
    const lines=chunk.map(item=>`${item.name}\nCód. ${item.productId} · ${item.status==='available'?`${item.stock} em estoque · ${brl(item.unitCents!)} un.`:item.status==='unavailable'?'Indisponível no momento':'Valor ou estoque não confirmado'}`);
    const body=[heading,...lines,index===chunks.length-1?`Encontrei ${items.length} ${items.length===1?'produto':'produtos'} no catálogo. Valores e estoque consultados agora para as opções confirmadas. A cotação não reserva produtos.`:'',tail].filter(Boolean).join('\n\n');
    if(body.length>4000)throw new Error('MESSAGE_TOO_LONG');
    return {body,card};
  });
}
export function quoteMessage(id:string,draft:QuoteDraft,profile:'lojista'|'consumidor_final'='lojista',introduction='',options?:{closing:string;contextual:boolean}){
  if(!draft.lines.length||(profile==='lojista'&&draft.priceField!=='valorVenda')||draft.lines.some(line=>!Number.isSafeInteger(line.unitCents)||line.unitCents<=0)||draft.lines.reduce((sum,line)=>sum+line.totalCents,0)!==draft.totalCents)throw new Error('UNVERIFIED_PRICE_SOURCE');
  const proposed=introduction.trim().replace(/\s+/g,' ').slice(0,options?.contextual?1600:160);
  const intro=options?.contextual?proposed:proposed&&!/\d|R\$|estoque|disponib|compatib|prazo|entrega|mercado\s*phone|\berp\b|\bapi\b|custo/i.test(proposed)
    ? proposed
    : profile==='lojista'?'Segue o orçamento com os valores de lojista conferidos agora:':'Segue o orçamento com os valores conferidos agora:';
  const card:QuoteCard={type:'quote',intro,id,checkedAt:draft.checkedAt,status:'awaiting',items:draft.lines.map(line=>({productId:line.productId,name:line.name,quantity:line.quantity,unitCents:line.unitCents,totalCents:line.totalCents})),totalCents:draft.totalCents,...(options?.closing?{closing:options.closing}:{})};
  const lines=draft.lines.map(line=>`${line.quantity} × ${line.name}\n${brl(line.unitCents)} un. · Subtotal ${brl(line.totalCents)}`);
  const body=[intro,`*Orçamento #${shortQuoteId(id)}*`,...lines,`*Total: ${brl(draft.totalCents)}*`,'Valores e disponibilidade confirmados agora. Este orçamento não reserva produtos.',options?.contextual?options.closing:'Quer ajustar algum item ou chamar uma atendente para concluir?'].filter(Boolean).join('\n\n');
  if(body.length>4000)throw new Error('MESSAGE_TOO_LONG');
  return {body,card};
}
export function parseChatCard(value:unknown):ChatCardData|null{
  if(typeof value!=='string'||!value)return null;
  try{
    const data=JSON.parse(value) as ChatCardData;
    if(!data||typeof data.intro!=='string'||(data.closing!==undefined&&typeof data.closing!=='string')||!Array.isArray(data.items)||!Number.isFinite(data.checkedAt))return null;
    if(data.type==='products'&&data.items.length>0&&data.items.length<=3&&data.items.every(item=>typeof item.name==='string'&&Number.isSafeInteger(item.unitCents)&&Number.isFinite(item.stock)))return data;
    if(data.type==='catalog'&&Number.isSafeInteger(data.total)&&Number.isSafeInteger(data.part)&&Number.isSafeInteger(data.parts)&&data.items.length>0&&data.items.length<=8&&data.items.every(item=>Number.isSafeInteger(item.productId)&&typeof item.name==='string'&&['available','unavailable','unconfirmed'].includes(item.status)&&
      (item.status!=='available'||Number.isSafeInteger(item.unitCents)&&Number.isFinite(item.stock))))return data;
    if(data.type==='quote'&&typeof data.id==='string'&&Number.isSafeInteger(data.totalCents)&&data.items.length>0&&data.items.every(item=>typeof item.name==='string'&&Number.isSafeInteger(item.totalCents)&&Number.isSafeInteger(item.unitCents)))return data;
  }catch{}
  return null;
}
