import {currentUser} from '../../../lib/server/app-auth';
import {attendantFor} from '../../../lib/server/roles';
import * as core from '../../../lib/server/core';
import {quoteMessage} from '../../../lib/chat-cards';
import type {ChatCardData} from '../../../lib/chat-cards';
import {z} from 'zod';

export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const id=z.string().uuid();
const profile=z.enum(['lojista','consumidor_final','nao_identificado']);
const actions=z.discriminatedUnion('action',[
  z.object({action:z.literal('message'),id,body:z.string().trim().min(1).max(4000),role:z.enum(['agent','note']),quoteId:id.optional()}),
  z.object({action:z.literal('update'),id,name:z.string().trim().min(1).max(100),profile,notes:z.string().max(4000),status:z.enum(['human','closed'])}),
  z.object({action:z.literal('quote'),id,items:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(10000)})).min(1).max(30)}),
  z.object({action:z.literal('archiveConversation'),id,archive:z.boolean()}),
  z.object({action:z.literal('deleteMessage'),id,messageId:z.string().min(1).max(160)}),
  z.object({action:z.literal('approveQuote'),id,messageId:z.string().min(1).max(160)})
]);

async function access(request:Request){
  const user=await currentUser(request);
  if(!user)return {error:json({error:'Entre na sua conta para acessar o painel.'},401)};
  if(user.mustChangePassword)return {error:json({error:'Altere sua senha inicial antes de continuar.'},403)};
  const attendant=await attendantFor(user);
  if(!attendant)return {error:json({error:'Seu acesso de atendente não está liberado.'},403)};
  return {attendant};
}

async function owned(idValue:string,name:string){
  return core.one('SELECT * FROM conversations WHERE id=? AND assigned=?',idValue,name);
}

export async function GET(request:Request){
  try{
    const gate=await access(request);
    if(gate.error)return gate.error;
    const {attendant}=gate;
    const url=new URL(request.url);
    if(url.searchParams.has('messages')){
      const conversationId=id.parse(url.searchParams.get('messages'));
      if(!await owned(conversationId,attendant.name))return json({error:'Atendimento não encontrado.'},404);
      return json({messages:await core.all('SELECT * FROM messages WHERE conversation_id=? AND deleted_at=0 ORDER BY created,id',conversationId)});
    }
    if(url.searchParams.has('search')){
      const conversationId=id.parse(url.searchParams.get('conversation'));
      const conversation=await owned(conversationId,attendant.name);
      if(!conversation)return json({error:'Atendimento não encontrado.'},404);
      const query=(url.searchParams.get('search')||'').slice(0,160);
      return json(await core.searchProducts(query,profile.parse(conversation.profile)));
    }
    const conversations=await core.all("SELECT c.*,(SELECT body FROM messages WHERE conversation_id=c.id AND deleted_at=0 ORDER BY created DESC LIMIT 1) AS preview,(SELECT body FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role='note' AND body LIKE '%Encaminhamento%' ORDER BY created DESC LIMIT 1) AS handoffNote,(SELECT MAX(created) FROM messages m WHERE m.conversation_id=c.id AND m.role='agent' AND m.deleted_at=0) AS lastAgentAt FROM conversations c WHERE c.assigned=? ORDER BY c.updated DESC LIMIT 300",attendant.name);
    return json({attendant:{name:attendant.name,email:attendant.email},conversations});
  }catch(error){
    if(error instanceof z.ZodError)return json({error:'Parâmetros inválidos.'},400);
    return json({error:'Não foi possível carregar seus atendimentos.'},503);
  }
}

export async function POST(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  try{
    const gate=await access(request);
    if(gate.error)return gate.error;
    if(Number(request.headers.get('content-length')||0)>30000)return json({error:'Conteúdo muito extenso.'},413);
    const action=actions.parse(await request.json());
    const conversation=await owned(action.id,gate.attendant.name);
    if(!conversation)return json({error:'Atendimento não encontrado.'},404);
    if(action.action==='archiveConversation'){
      await core.run('UPDATE conversations SET archived_at=? WHERE id=? AND assigned=?',action.archive?Date.now():0,action.id,gate.attendant.name);
      return json({ok:true});
    }
    if(action.action==='deleteMessage'){
      const result=await core.run("UPDATE messages SET body='',deleted_at=? WHERE id=? AND conversation_id=? AND deleted_at=0",Date.now(),action.messageId,action.id);
      if(!result.meta.changes)return json({error:'Mensagem não encontrada neste atendimento.'},404);
      await core.forgetCeciMemory(action.id);
      return json({ok:true});
    }
    if(action.action==='approveQuote'){
      const result=await core.run("UPDATE messages SET card_data=json_set(card_data,'$.status','approved') WHERE id=? AND conversation_id=? AND role IN ('assistant','agent') AND CASE WHEN json_valid(card_data) THEN json_extract(card_data,'$.type') ELSE NULL END='quote'",action.messageId,action.id);
      if(!result.meta.changes)return json({error:'Orçamento não encontrado neste atendimento.'},404);
      await core.addMessage(action.id,'note','Orçamento marcado como aprovado pela atendente. Confirme os dados e prossiga com o pedido.');
      return json({ok:true});
    }
    if(action.action==='update'){
      await core.run('UPDATE conversations SET name=?,profile=?,notes=?,status=?,updated=? WHERE id=? AND assigned=?',action.name,action.profile,action.notes,action.status,Date.now(),action.id,gate.attendant.name);
      return json({ok:true});
    }
    if(conversation.status==='closed')return json({error:'Reabra o atendimento antes de continuar.'},409);
    if(action.action==='message'){
      let body=action.body,card:ChatCardData|undefined;
      if(action.quoteId){
        if(action.role!=='agent'||conversation.profile!=='lojista')return json({error:'Orçamento inválido para esta conversa.'},400);
        const saved=await core.one("SELECT data,created FROM quotes WHERE id=? AND conversation_id=? AND profile=? AND deleted_at=0 AND superseded_by=''",action.quoteId,action.id,conversation.profile);
        if(!saved||Date.now()-Number(saved.created)>15*60_000)return json({error:'O orçamento expirou. Consulte os itens novamente.'},409);
        const draft=JSON.parse(String(saved.data)) as {lines:{productId:number;quantity:number}[]};
        const refreshed=await core.quote(draft.lines.map(line=>({productId:line.productId,quantity:line.quantity})),conversation.profile,conversation.name,action.id);
        const formatted=quoteMessage(refreshed.id,refreshed);
        body=formatted.body;card=formatted.card;
      }
      if(action.role==='agent'&&['whatsapp','whatsapp_web'].includes(conversation.channel))await core.sendWhatsapp(conversation,body);
      await core.addMessage(action.id,action.role,body,action.role==='agent'&&['whatsapp','whatsapp_web'].includes(conversation.channel)?'accepted':'saved',undefined,card);
      return json({ok:true});
    }
    if(conversation.profile==='nao_identificado')return json({error:'Defina o perfil comercial do cliente antes de cotar.'},409);
    const draft=await core.quote(action.items,profile.parse(conversation.profile),conversation.name,action.id);
    return json({...draft,...(conversation.profile==='lojista'?{preparedBody:quoteMessage(draft.id,draft).body}:{})});
  }catch(error){
    if(error instanceof z.ZodError)return json({error:'Confira os campos preenchidos.'},400);
    const code=error instanceof Error?error.message:'';
    const errors:Record<string,string>={PRICE_UNAVAILABLE:'Preço indisponível para esse perfil.',CUSTOMER_PROFILE_REQUIRED:'Defina o perfil do cliente.',INSUFFICIENT_OR_UNAVAILABLE_STOCK:'Estoque insuficiente ou indisponível.',PRODUCT_CLASSIFICATION_REVIEW:'Produto precisa de revisão.',SECOND_PRICE_SCOPE_REVIEW:'Preço precisa de confirmação.',ERP_HTTP_ERROR:'A consulta de preços foi recusada.',ERP_NETWORK_ERROR:'O catálogo está indisponível. Tente novamente.',API_KEY_REQUIRED:'A conexão do catálogo ainda não foi configurada.'};
    return json({error:errors[code]||'Não foi possível concluir. Confira os dados e tente novamente.'},400);
  }
}
