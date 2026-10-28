import type {SimulatedSale} from './playground-sales';
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export const manualClosing=(body:string)=>!/\b(?:nao|talvez|se|caso|quando)\b/.test(fold(body))&&/\b(?:separei|separad[oa]s?|pode vir|pode buscar|te aguardo|ate (?:ja|mais)|pront[oa]s? para (?:retirar|buscar))\b/.test(fold(body));
export function manualOperatorHint(sale:SimulatedSale){
 if(sale.step==='quote')return 'Próximo passo: consulte e envie o orçamento para o cliente conferir.';
 if(sale.step==='quote_acceptance')return 'O orçamento foi enviado. Aguarde o aceite do cliente antes de concluir.';
 if(sale.step==='confirmation')return 'Orçamento aceito. Confirme a combinação de retirada/entrega e pagamento com o cliente.';
 if(sale.step==='ready')return 'Cliente confirmou. Clique em Concluir venda simulada para finalizar o teste.';
 if(sale.step==='selection'&&sale.selectionIssue==='stock')return 'A quantidade escolhida não foi confirmada. Combine outra opção ou quantidade com o cliente.';
 if(sale.step==='selection')return 'Próximo passo: confirme a opção e a quantidade escolhidas.';
 return '';
}
/** Commercial state constrains completion; the actual operator message controls the reply. */
export function manualCustomerContext(sale:SimulatedSale,lastAgent:string){
 const text=fold(lastAgent),hasQuote=!!sale.quoteMessageId&&sale.quote?.type==='quote',accepted=hasQuote&&!!sale.consentMessageId&&sale.quote.status==='approved';
 const question=/\?|\b(?:qual|quantas|quantos|prefere|conseguiu escolher)\b/.test(text);
 const focus=manualClosing(lastAgent)?'closing':question&&/\b(?:pix|cartao|pagar|pagamento)\b/.test(text)?'payment':question&&/\b(?:retirar|retirada|entrega|receber|buscar)\b/.test(text)?'delivery':question&&/escolh|codigo|quantas|quantos/.test(text)&&!sale.selection?.length&&!hasQuote?'selection':hasQuote&&sale.step==='quote_acceptance'?'quote_acceptance':sale.step==='confirmation'&&question?'confirmation':'conversation';
 const missing=!sale.selection?.length&&!hasQuote?'selection':!hasQuote?'quote':!accepted?'quote_acceptance':!sale.delivery?'delivery':!sale.payment?'payment':!sale.confirmationMessageId?'confirmation':'complete';
 const fallback=missing==='quote'||missing==='selection'?'Perfeito. Antes de ir, pode me enviar o orçamento para eu conferir?':missing==='quote_acceptance'?'Estou de acordo com o orçamento, pode seguir com a compra.':missing==='delivery'?'Vou retirar na loja.':missing==='payment'?'Prefiro pagar por Pix.':'Combinado, vou buscar na loja. Obrigada!';
 return {focus,missing,hasQuote,accepted,delivery:sale.delivery,payment:sale.payment,selection:sale.selection||[],fallback,
  instruction:`Você conversa com uma atendente operada MANUALMENTE. Reaja à ÚLTIMA MENSAGEM dela, não a um roteiro fixo. Foco da mensagem: ${focus}. Pendência comercial real: ${missing}. Não repita código, quantidade, retirada ou Pix já informados. Se ela disser que separou ou que pode buscar, agradeça naturalmente; se ainda faltar orçamento, peça para recebê-lo antes de ir. Dizer que separou não prova reserva, pagamento ou compra concluída. Se houver orçamento sem aceite, confira-o e confirme se concorda. Depois do aceite e das condições combinadas, uma fala de encerramento permite responder naturalmente, por exemplo “Combinado, vou buscar na loja. Obrigada!”. Responda apenas à preferência perguntada; informação fora do assunto pede esclarecimento curto. Escolha código/quantidade SOMENTE se a última fala pedir uma escolha e ela ainda estiver pendente. Não aceite orçamento inexistente, nem invente valores, reserva, cobrança ou pedido.`};
}
/** Avoid the screenshot's cosmetic rewrites of the same SKU/quantity after a closing statement. */
export function repeatsManualChoice(body:string,previous:string,focus:string){
 if(fold(body)===fold(previous))return true;
 if(!['closing','conversation','quote_acceptance','confirmation'].includes(focus))return false;
 const ids=[...fold(body).matchAll(/\bc(?:odigo|od[.]?)\s*[:#]?\s*(\d+)\b/g)].map(m=>m[1]);
 return ids.some(id=>new RegExp('\\b'+id+'\\b').test(previous))&&/\b(?:codigo|cod\.?|unidades?|pecas?)\b/.test(fold(body));
}
