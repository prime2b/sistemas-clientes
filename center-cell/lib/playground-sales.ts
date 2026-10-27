import {parseChatCard} from './chat-cards.ts';
import {confirmsPurchase} from './ceci-purchase.ts';
import {selectAttendantIndex} from './attendant-routing.ts';
type Row=Record<string,any>;
export type SimulatedAttendant={slot:number;name:string;avatar:string;available:boolean;load:number};
export type SaleStep='delivery'|'payment'|'confirmation'|'ready'|'completed'|'queued';
export type SimulatedSale={revision:number;mode:'automatic'|'manual';step:SaleStep;team:SimulatedAttendant[];assignedSlot:number|null;receivedAt:number;acceptedAt:number;completedAt:number;quote:any;quoteMessageId:string;consentMessageId:string;handoffMessageId:string;summary:string;delivery:string;payment:string;confirmationMessageId:string;pendingCustomer:string;turns:number;deliveryChoice:'retirada'|'entrega';paymentChoice:'pix'|'cartao';lastAgentMessageId?:string};
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const saleSteps:Record<SaleStep,string>={delivery:'Combinar retirada ou entrega',payment:'Combinar forma de pagamento',confirmation:'Confirmar a combinação',ready:'Pronto para concluir',completed:'Venda simulada concluída',queued:'Aguardando atendente disponível'};

function validQuote(quote:ReturnType<typeof parseChatCard>|undefined){
 return !!quote&&quote.type==='quote'&&quote.checkedAt>0&&quote.items.every(p=>Number.isSafeInteger(p.productId)&&p.productId>0&&Number.isSafeInteger(p.quantity)&&p.quantity>0&&p.unitCents>0&&p.totalCents===p.unitCents*p.quantity)&&quote.totalCents===quote.items.reduce((n,p)=>n+p.totalCents,0);
}
/** Only the simulated customer can use this recovery; it still goes through the real Ceci handoff. */
export function pendingPurchaseConfirmation(log:Row[],expectations:Row[]=[],seed=0){
 const last=log.findLast(m=>m.role!=='note'),quote=last?.role==='assistant'?parseChatCard(last.card_data):null;
 if(!validQuote(quote)||quote?.type!=='quote'||quote.status!=='awaiting'||quote.items.reduce((n,p)=>n+p.quantity,0)!==2)return null;
 const expected=expectations.at(-1);
 if(expected&&!quote.items.some(p=>p.productId===expected.productId&&p.quantity===expected.quantity))return null;
 const choices=['Pode fechar, quero comprar.','Estou de acordo, pode finalizar a compra.','Tudo certo, podemos concluir a compra.'];
 return {quoteId:quote.id,message:choices[seed%choices.length]};
}

export function createSimulatedSale(log:Row[],team:SimulatedAttendant[],cursor=-1):SimulatedSale|null{
 const handoff=log.findLast(m=>m.role==='note'&&m.body.startsWith('Encaminhamento automático: Compra confirmada após cotação'));
 if(!handoff)return null;
 const before=log.slice(0,log.indexOf(handoff));
 const consent=before.findLast(m=>m.role==='user');
 if(!consent)return null;
 const preceding=before.slice(0,before.indexOf(consent));
 const lastAssistant=preceding.findLast(m=>m.role==='assistant');
 const quoteMessage=preceding.findLast(m=>parseChatCard(m.card_data)?.type==='quote');
 const quote=quoteMessage&&parseChatCard(quoteMessage.card_data);
 if(!quoteMessage||!validQuote(quote)||quote?.type!=='quote'||quote.status!=='approved'||!confirmsPurchase(consent.body,lastAssistant?.body||'',quote.items))return null;
 const loads=Object.fromEntries(team.map(t=>[t.name,t.load]));
 const index=selectAttendantIndex(team.map(t=>t.name),team.flatMap((t,i)=>t.available?[i]:[]),loads,cursor);
 return {revision:0,mode:'automatic',step:index===null?'queued':'delivery',team:structuredClone(team),assignedSlot:index===null?null:team[index].slot,receivedAt:Date.now(),acceptedAt:0,completedAt:0,quote:structuredClone(quote),quoteMessageId:quoteMessage.id,consentMessageId:consent.id,handoffMessageId:handoff.id,summary:handoff.body,delivery:'',payment:'',confirmationMessageId:'',pendingCustomer:'',turns:0,deliveryChoice:cursor%2?'entrega':'retirada',paymentChoice:cursor%2?'cartao':'pix'};
}
export const saleAttendant=(sale:SimulatedSale)=>sale.team.find(t=>t.slot===sale.assignedSlot);
export function saleQuestion(sale:SimulatedSale){
 const first=saleAttendant(sale)?.name.split(' ')[0]||'a atendente';
 if(sale.step==='delivery')return `${sale.acceptedAt?'':'Oi! Aqui é '+first+'. Já estou com seu orçamento. '}Você prefere retirar ou receber por entrega?`;
 if(sale.step==='payment')return sale.delivery==='retirada'?'Certo, retirada na loja. Você prefere pagar no Pix ou no cartão?':'Certo, vamos combinar a entrega. Você prefere pagar no Pix ou no cartão?';
 if(sale.step==='confirmation')return `Combinado: ${sale.delivery==='retirada'?'retirada na loja':'entrega a combinar'} e pagamento ${sale.payment==='pix'?'por Pix':'no cartão'}. Posso concluir assim?`;
 return '';
}
export function applySaleCustomer(sale:SimulatedSale,message:Row,previousAgent:string){
 const text=fold(String(message.body||''));
 // A question or refusal is never completion, and a changed order requires review.
 if(/[?]|\b(?:nao|talvez|depois|pensar|antes|mas|troca\w*|alter\w*|adicion\w*|acrescent\w*|desist\w*|cancel\w*)\b/.test(text))return false;
 if(sale.step==='delivery'){
  const pickup=/\bretir\w*\b|buscar na loja/.test(text),delivery=/\bentrega\b|receber em casa/.test(text);
  if(pickup===delivery)return false;sale.delivery=pickup?'retirada':'entrega';sale.step='payment';return true;
 }
 if(sale.step==='payment'){
  const pix=/\bpix\b/.test(text),card=/\bcartao\b/.test(text);
  if(pix===card)return false;sale.payment=pix?'pix':'cartao';sale.step='confirmation';return true;
 }
 const invitation=/(?:posso|podemos|confirma|confirmar).{0,60}(?:concluir|fechar|finalizar|combinad)/.test(fold(previousAgent));
 const acknowledgment=/^(?:(?:sim|isso|ok|certo|ta certo|tudo certo|combinado|confirmo)[,.!\s]*)+$/.test(text);
 if(sale.step==='confirmation'&&(confirmsPurchase(String(message.body).replace(/\bassim\b/gi,''),previousAgent,sale.quote.items)||invitation&&acknowledgment)){
  sale.confirmationMessageId=message.id;sale.step='ready';return true;
 }
 return false;
}
export function canCompleteSale(sale:SimulatedSale){return sale.step==='ready'&&!!sale.acceptedAt&&!!sale.assignedSlot&&!!sale.delivery&&!!sale.payment&&!!sale.confirmationMessageId;}
export const simulatedClosing=(sale:SimulatedSale)=>`Tudo certo! Combinamos ${sale.delivery==='retirada'?'retirada na loja':'a entrega'} e pagamento ${sale.payment==='pix'?'por Pix':'no cartão'}. Obrigada pela compra!`;
export function saleCriteria(sale:SimulatedSale|null|undefined,log:Row[],expectQueue=false){
 const check=(id:string,label:string,ok:boolean,detail:string,ids:string[]=[])=>({id,label,status:ok?'pass' as const:'fail' as const,critical:true,detail,messageIds:ids});
 if(!sale)return [check('sale-received','Atendimento chegou ao painel da atendente',false,'O orçamento aceito não chegou ao painel simulado.'),...(expectQueue?[]:[check('sale-accepted','Atendente assumiu a conversa',false,'A atendente ainda não recebeu nem assumiu este atendimento.'),check('sale-complete','Venda simulada concluída após confirmação',false,'Faltam o atendimento humano simulado e a confirmação final do cliente.')])];
 const at=log.findIndex(m=>m.id===sale.handoffMessageId),after=log.slice(at+1),agents=after.filter(m=>m.role==='agent');
 const controls=[check('sale-routing','Distribuição e isolamento dos três painéis',expectQueue?!sale.assignedSlot:sale.team.some(t=>t.slot===sale.assignedSlot&&t.available),expectQueue?'Nenhuma atendente disponível: conversa mantida na fila simulada.':'Responsável escolhido pela mesma regra de disponibilidade e carga da operação.',[sale.handoffMessageId]),check('sale-ceci-stopped','Ceci encerrou sua participação após transferir',!after.some(m=>m.role==='assistant'),'Após a transferência, respostas comerciais pertencem à atendente.',after.filter(m=>m.role==='assistant').map(m=>m.id))];
 if(expectQueue)return [...controls,check('sale-queue','Aguardar sem anunciar atendimento assumido',sale.step==='queued'&&!sale.acceptedAt&&!agents.length&&!sale.completedAt,'Fila aguardando disponibilidade, sem falsa aceitação ou venda concluída.')];
 return [...controls,check('sale-received','Orçamento e contexto recebidos pela atendente',!!sale.receivedAt&&!!sale.summary&&!!sale.quote?.items?.length,'Mesmo orçamento aceito, resumo e histórico disponíveis no painel.',[sale.quoteMessageId,sale.consentMessageId]),check('sale-accepted','Atendente assumiu a conversa',!!sale.acceptedAt&&agents.length>0,'Recebimento e primeira resposta registrados.',agents.slice(0,1).map(m=>m.id)),check('sale-complete','Venda simulada concluída após confirmação',sale.step==='completed'&&!!sale.completedAt&&!!sale.delivery&&!!sale.payment&&after.some(m=>m.id===sale.confirmationMessageId&&m.role==='user'),'Conclusão exige retirada/entrega, pagamento combinado e confirmação posterior do cliente.',[sale.confirmationMessageId,...agents.slice(-1).map(m=>m.id)].filter(Boolean)),check('sale-no-requote','Transferência preservou o orçamento aceito',!after.some(m=>parseChatCard(m.card_data)?.type==='quote'),'Nenhum orçamento novo ou cobrança foi criado durante o encaminhamento.')];
}
