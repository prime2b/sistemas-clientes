/** Conversation facts are evidence-backed; commercial data is always rechecked. */
export type RequestedItem={productId:number;quantity:number};
export type KnownProduct={id:number;name:string};
export type MemoryFact={key:string;value:string;messageId:string};
export type CeciMemory={
  version:1;facts:MemoryFact[];pending:string;nextAction:string;
  products:KnownProduct[];lastOptions:number[];cart:RequestedItem[];
  currentQuoteId:string;introduced:boolean;updatedAt:number;
};
export const emptyCeciMemory=():CeciMemory=>({version:1,facts:[],pending:'',nextAction:'',products:[],lastOptions:[],cart:[],currentQuoteId:'',introduced:false,updatedAt:0});
export function readCeciMemory(raw:unknown):CeciMemory{
  if(!raw||typeof raw!=='object'||(raw as CeciMemory).version!==1)return emptyCeciMemory();
  const value=raw as CeciMemory;
  return {...emptyCeciMemory(),...value,facts:Array.isArray(value.facts)?value.facts.slice(-24):[],products:Array.isArray(value.products)?value.products.slice(-200):[],lastOptions:Array.isArray(value.lastOptions)?value.lastOptions.slice(0,200):[],cart:Array.isArray(value.cart)?value.cart.slice(0,30):[]};
}
export function mergeProducts(memory:CeciMemory,products:KnownProduct[]){
  const map=new Map(memory.products.map(p=>[p.id,p]));
  for(const p of products)if(Number.isSafeInteger(p.id)&&p.id>0&&p.name){map.delete(p.id);map.set(p.id,{id:p.id,name:p.name.slice(0,300)});}
  memory.products=[...map.values()].slice(-200);
}
/** Absolute quantities: changing one line cannot discard the other lines. Zero removes. */
export function patchOrder(current:RequestedItem[],changes:RequestedItem[],knownIds:Set<number>){
  if(!Array.isArray(changes)||!changes.length||changes.length>30)throw new Error('INVALID_QUOTE_ITEMS');
  const next=new Map(current.map(item=>[item.productId,{...item}]));
  const seen=new Set<number>();
  for(const item of changes){
    if(!Number.isSafeInteger(item.productId)||!Number.isSafeInteger(item.quantity)||item.quantity<0||item.quantity>10000||seen.has(item.productId))throw new Error('INVALID_QUANTITY_OR_ID');
    if(!knownIds.has(item.productId)&&!next.has(item.productId))throw new Error('PRODUCT_NOT_PRESENTED');
    seen.add(item.productId);
    if(item.quantity===0)next.delete(item.productId);else next.set(item.productId,{productId:item.productId,quantity:item.quantity});
  }
  if(next.size>30)throw new Error('INVALID_QUOTE_ITEMS');
  return [...next.values()];
}
export function applyContext(memory:CeciMemory,context:unknown,evidence:Set<string>){
  if(!context||typeof context!=='object')return;
  const c=context as Record<string,unknown>;
  const facts=new Map(memory.facts.map(f=>[f.key,f]));
  if(Array.isArray(c.fatos))for(const value of c.fatos.slice(0,24)){
    if(!value||typeof value!=='object')continue;
    const f=value as Record<string,unknown>;
    const key=String(f.chave||'').trim().slice(0,80),text=String(f.valor||'').trim().slice(0,300),messageId=String(f.mensagemId||'');
    if(!key||!evidence.has(messageId))continue;
    facts.delete(key);
    if(text)facts.set(key,{key,value:text,messageId});
  }
  memory.facts=[...facts.values()].slice(-24);
  memory.pending=String(c.pendencia||'').slice(0,300);
  memory.nextAction=String(c.proximaAcao||'').slice(0,300);
}
export function replyViolation(text:string,hasCurrentConsultation:boolean){
  if(!text.trim()||text.length>1600)return 'Escreva uma resposta breve e útil, com até 1600 caracteres.';
  if(/mercado\s*phone|\berp\b|\bapi\b|banco de dados|sistema de gestão|integraç(?:ão|oes|ões)|prompt interno/i.test(text))return 'Remova nomes de fontes e tecnologias internas.';
  const amount='(?:\\d+(?:[.,]\\d+)?|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|cem|mil)';
  if(new RegExp('\\b'+amount+'\\s*(?:(?:pe[cç]as?|unidades?|itens)\\s*)?(?:(?:em|no|de)\\s+estoque|dispon[ií]ve(?:l|is)|restantes?)\\b|\\bestoque\\s*(?:(?:total|atual|dispon[ií]vel|[eé]|de|:|=)\\s*){0,3}'+amount+'\\b|\\btemos\\s+(?:somente\\s+|apenas\\s+)?'+amount+'\\s+(?:pe[cç]as?|unidades?)\\b','i').test(text))return 'O saldo numérico do estoque é interno. Informe apenas disponibilidade, sem revelar quantidades em estoque.';
  if(/R\$|\d+(?:[,.]\d{2})?\s*reais?|\b\d+[,.]\d{2}\b|\d+\s*(?:unidades?\s+(?:em|no)\s+estoque)/i.test(text))return 'Os valores são exibidos pelos cards do servidor. Não revele o saldo numérico do estoque. Remova esses dados da redação.';
  if(/(?:é|está|esta|são)\s+compatível|compatibilidade\s+confirmada|(?:serve|funciona)\s+(?:no|na|para)/i.test(text))return 'Não afirme compatibilidade técnica; use a descrição oficial e esclareça a dúvida ou encaminhe.';
  if(/(?:brilho|toque|durabilidade)\s+(?:melhor|superior)|(?:original|incell)\s+(?:é|tem|oferece)\s+(?:melhor|mais|superior)/i.test(text))return 'Não atribua desempenho ou superioridade sem ficha técnica comprovada.';
  if(!hasCurrentConsultation&&/(?:em|no)\s+estoque|(?:temos|estão|está)\s+disponíve(?:l|is)|disponibilidade\s+confirmada/i.test(text))return 'Consulte a disponibilidade atual antes de confirmá-la.';
  return '';
}
