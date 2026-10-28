import * as core from './core';
import type {AppUser} from './app-auth';
import {z} from 'zod';
import {quoteMessage} from '../chat-cards';
import {prepareQuote,centerCellPolicy} from '../erp/quote';
import * as zapi from './zapi';
type Row=Record<string,any>;
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const uuid=z.string().uuid(),profile=z.enum(['lojista','consumidor_final','nao_identificado']);
const items=z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(10000)})).min(1).max(30);
export const sharedActions=new Set(['claimConversation','readConversation','assignConversation','conversation','archiveConversation','deleteConversation','deleteMessage','quote','sendQuote','message']);
export async function listSharedConversations(user:AppUser):Promise<Row[]>{
 const rows=await core.all(`SELECT c.*,
 (SELECT body FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role!='note' ORDER BY rowid DESC LIMIT 1) AS preview,
 (SELECT id FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role='user' ORDER BY rowid DESC LIMIT 1) AS lastUserId,
 (SELECT role FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role!='note' ORDER BY rowid DESC LIMIT 1) AS lastMessageRole,
 (SELECT MAX(created) FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role='agent') AS lastAgentAt,
 (SELECT body FROM messages WHERE conversation_id=c.id AND deleted_at=0 AND role='note' AND body LIKE '%Encaminhamento%' ORDER BY rowid DESC LIMIT 1) AS handoffNote,
 (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id AND m.role='user' AND m.deleted_at=0 AND m.rowid>COALESCE(r.last_read_seq,0)) AS unreadCount,
 COALESCE(r.forced_unread,0) AS forcedUnread
 FROM conversations c LEFT JOIN conversation_reads r ON r.conversation_id=c.id AND r.user_id=? WHERE c.channel!='test' ORDER BY c.updated DESC LIMIT 500`,user.id);
 const cfg=await core.config(),name=user.role==='attendant'?cfg.team[(user.slot||1)-1]:user.displayName;
 return rows.map(c=>({...c,isMine:c.assigned_user_id?c.assigned_user_id===user.id:!!c.assigned&&c.assigned===name,canRespond:c.assigned_user_id?c.assigned_user_id===user.id:!!c.assigned&&c.assigned===name}));
}
export async function sharedGet(request:Request,user:AppUser){
 const u=new URL(request.url),cfg=await core.config();
 if(!cfg.sharedInbox||user.role!=='attendant'||!user.slot)return json({error:'Acesso não liberado.'},403);
 if(u.searchParams.has('messages')){
  const id=uuid.parse(u.searchParams.get('messages')),c=await core.one("SELECT id,status,channel,profile FROM conversations WHERE id=? AND channel!='test'",id);
  if(!c)return json({error:'Atendimento não encontrado.'},404);
  return json({conversation:c,messages:await core.all('SELECT * FROM messages WHERE conversation_id=? AND deleted_at=0 ORDER BY rowid',id)});
 }
 if(u.searchParams.has('search')){
  const id=uuid.parse(u.searchParams.get('conversation')),c=await core.one("SELECT profile FROM conversations WHERE id=? AND channel!='test'",id);
  if(!c)return json({error:'Atendimento não encontrado.'},404);
  return json(await core.searchProducts((u.searchParams.get('search')||'').slice(0,160),c.profile));
 }
 if([...u.searchParams.keys()].length)return json({error:'Área restrita à administração.'},403);
 const conversations=await listSharedConversations(user),team=await core.all("SELECT id,display_name AS name,avatar,slot,presence FROM app_users WHERE active=1 AND role='attendant' ORDER BY slot");
 return json({config:{name:cfg.name,team:cfg.team,enabled:cfg.enabled,sharedInbox:true,flowMode:cfg.flowMode,whatsappMode:cfg.whatsappMode},viewer:{id:user.id,name:user.displayName},conversations,quotes:[],catalog:{count:0},categories:[],navigation:{teamAvailable:team,conversationsWaiting:conversations.filter(c=>c.status==='human'&&!c.archived_at).length},whatsappReady:!!(await zapi.credentialsReady()&&(await zapi.connection())?.connected)});
}
export async function sharedPost(request:Request,user:AppUser,raw:Row):Promise<Response|null>{
 if(!sharedActions.has(raw.action))return null;
 const cfg=await core.config();if(!cfg.sharedInbox)return null;
 if(raw.action==='quote'&&!raw.conversationId)return user.role==='admin'?null:json({error:'Vincule o orçamento a um atendimento.'},400);
 const conversationId=uuid.parse(raw.action==='sendQuote'?raw.conversationId:raw.action==='quote'?raw.conversationId:raw.id);
 let c=await core.one('SELECT * FROM conversations WHERE id=?',conversationId);
 if(!c)return json({error:'Atendimento não encontrado.'},404);
 if(c.channel==='test')return user.role==='admin'?null:json({error:'Acesso não permitido.'},403);
 if(!['admin','attendant'].includes(user.role)||user.role==='attendant'&&!user.slot)return json({error:'Acesso não liberado.'},403);
 if(raw.action==='readConversation'){
  const unread=z.boolean().parse(raw.unread),messageId=z.string().max(160).optional().parse(raw.messageId);
  let seq=0;
  if(!unread&&messageId){const m=await core.one("SELECT rowid AS seq FROM messages WHERE id=? AND conversation_id=? AND role='user' AND deleted_at=0",messageId,conversationId);if(!m)return json({error:'Mensagem não encontrada.'},409);seq=Number(m.seq);}
  await core.run('INSERT INTO conversation_reads(user_id,conversation_id,last_read_seq,forced_unread) VALUES(?,?,?,?) ON CONFLICT(user_id,conversation_id) DO UPDATE SET last_read_seq=MAX(conversation_reads.last_read_seq,excluded.last_read_seq),forced_unread=excluded.forced_unread',user.id,conversationId,seq,unread?1:0);
  return json({ok:true});
 }
 const lease='inbox:lease:'+conversationId,token=crypto.randomUUID(),now=Date.now();
 const lock=await core.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.expires') AS INTEGER)<?",lease,JSON.stringify({token,expires:now+120000}),now);
 if(!lock.meta.changes)return json({error:'Há uma ação em andamento nesta conversa. Aguarde a conclusão.'},409);
 try{
  c=(await core.one('SELECT * FROM conversations WHERE id=?',conversationId))!;
  const ownName=user.role==='attendant'?cfg.team[(user.slot||1)-1]:user.displayName;
  const mine=c.assigned_user_id?c.assigned_user_id===user.id:!!c.assigned&&c.assigned===ownName;
  if(raw.action==='claimConversation'){
   if(mine)return json({ok:true,assigned:c.assigned});
   if(c.status==='closed')return json({error:'Reabra o atendimento antes de assumir.'},409);
   if((c.assigned||c.assigned_user_id)&&user.role!=='admin')return json({error:'Outra pessoa já assumiu esta conversa.'},409);
   const result=await core.run("UPDATE conversations SET status='human',assigned=?,assigned_user_id=?,claimed_at=?,updated=? WHERE id=? AND status!='closed' AND (assigned_user_id=? OR (assigned_user_id='' AND assigned='') OR ?='admin')",ownName,user.id,now,now,conversationId,user.id,user.role);
   if(!result.meta.changes)return json({error:'A conversa foi assumida por outra pessoa. Atualize a fila.'},409);
   await core.addMessage(conversationId,'note',user.displayName+' assumiu o atendimento.');return json({ok:true,assigned:ownName});
  }
  if(raw.action==='deleteConversation'&&user.role!=='admin')return json({error:'Somente o administrador pode excluir uma conversa definitivamente.'},403);
  if(!mine&&user.role!=='admin')return json({error:'Assuma a conversa antes de realizar esta ação.'},409);
  if(['message','quote','sendQuote'].includes(raw.action)&&!mine)return json({error:'Assuma o atendimento para responder ou montar o orçamento.'},409);
  if(raw.action==='assignConversation'||raw.action==='conversation'&&typeof raw.assigned==='string'&&raw.assigned!==c.assigned){
   const name=z.string().max(60).parse(raw.assigned);const slot=cfg.team.indexOf(name)+1;
   if(!name&&raw.status==='bot'){}else if(!name){await core.run("UPDATE conversations SET assigned='',assigned_user_id='',status='human',claimed_at=0,updated=? WHERE id=?",now,conversationId);await core.addMessage(conversationId,'note',user.displayName+' devolveu o atendimento à fila compartilhada.');return json({ok:true});}else{
    const target=slot>0?await core.one("SELECT id FROM app_users WHERE slot=? AND role='attendant' AND active=1",slot):null;
    if(!target)return json({error:'Atendente não está com acesso ativo.'},409);
    await core.run("UPDATE conversations SET assigned=?,assigned_user_id=?,status='human',claimed_at=?,updated=? WHERE id=?",name,target.id,now,now,conversationId);
    await core.addMessage(conversationId,'note',user.displayName+' transferiu o atendimento para '+name+'.');return json({ok:true,assigned:name});
   }
  }
  if(raw.action==='conversation'){
   const status=z.enum(['bot','human','closed']).parse(raw.status),p=profile.parse(raw.profile),notes=z.string().max(4000).parse(raw.notes);
   const realWhatsApp=['whatsapp_web','whatsapp'].includes(c.channel);
   const inbound=status==='bot'&&realWhatsApp?await core.latestCeciInbound(conversationId):null;
   const pending=!!inbound&&!await core.one("SELECT id FROM messages WHERE conversation_id=? AND rowid>? AND role IN ('agent','assistant') AND deleted_at=0 LIMIT 1",conversationId,inbound.seq);
   const {activateCeciForInbound,processCeci}=await import('./ceci-inbound');
   if(status==='bot'&&realWhatsApp&&!await activateCeciForInbound(await core.config()))return json({error:'A Ceci está pausada ou há uma conexão pendente. Ative a Ceci em Integrações antes de devolver o atendimento.'},409);
   await core.run("UPDATE conversations SET status=?,profile=?,notes=?,assigned=CASE WHEN ?='bot' THEN '' ELSE assigned END,assigned_user_id=CASE WHEN ?='bot' THEN '' ELSE assigned_user_id END,claimed_at=CASE WHEN ?='bot' THEN 0 ELSE claimed_at END,updated=? WHERE id=?",status,p,notes,status,status,status,now,conversationId);
   if(status!==c.status)await core.addMessage(conversationId,'note',user.displayName+(status==='closed'?' finalizou o atendimento.':status==='bot'?' devolveu explicitamente o atendimento à Ceci.':' reabriu o atendimento.'));
   if(pending){const {waitUntil}=await import('cloudflare:workers');waitUntil(processCeci(conversationId));}
   return json({ok:true,ceciScheduled:pending});
  }
  if(raw.action==='archiveConversation'){await core.run('UPDATE conversations SET archived_at=? WHERE id=?',z.boolean().parse(raw.archive)?now:0,conversationId);return json({ok:true});}
  if(raw.action==='deleteConversation'){
   await core.db().batch([core.db().prepare('DELETE FROM messages WHERE conversation_id=?').bind(conversationId),core.db().prepare('DELETE FROM quotes WHERE conversation_id=?').bind(conversationId),core.db().prepare('DELETE FROM conversation_reads WHERE conversation_id=?').bind(conversationId),core.db().prepare('DELETE FROM conversations WHERE id=?').bind(conversationId)]);await core.forgetCeciMemory(conversationId);return json({ok:true});
  }
  if(raw.action==='deleteMessage'){await core.run("UPDATE messages SET body='',deleted_at=? WHERE conversation_id=? AND id=?",now,conversationId,z.string().max(160).parse(raw.messageId));await core.forgetCeciMemory(conversationId);return json({ok:true});}
  if(c.status==='closed')return json({error:'Reabra a conversa para continuar.'},409);
  if(raw.action==='quote'){
   const p=profile.parse(raw.profile);if(p!==c.profile)return json({error:'Confirme o perfil comercial no atendimento antes de cotar.'},409);
   return json(await core.quote(items.parse(raw.items),p,c.name,conversationId));
  }
  if(raw.action==='sendQuote'){
   const quoteId=uuid.parse(raw.quoteId),saved=await core.one("SELECT * FROM quotes WHERE id=? AND conversation_id=? AND deleted_at=0 AND superseded_by=''",quoteId,conversationId);
   if(!saved||saved.profile!==c.profile)return json({error:'Orçamento indisponível para esta conversa.'},409);
   if(await core.one("SELECT id FROM messages WHERE conversation_id=? AND json_valid(card_data) AND json_extract(card_data,'$.id')=?",conversationId,quoteId))return json({error:'Este orçamento já foi enviado.'},409);
   const original=JSON.parse(saved.data),fresh=await prepareQuote(await core.erp(),original.lines.map((p:Row)=>({productId:p.productId,quantity:p.quantity})),centerCellPolicy(c.profile));
   if(fresh.totalCents!==original.totalCents||fresh.lines.some((p,i)=>p.unitCents!==original.lines[i]?.unitCents))return json({error:'Os valores mudaram. Gere o orçamento novamente antes de enviar.'},409);
   const formatted=quoteMessage(quoteId,fresh,c.profile);const providerMessageId=['whatsapp','whatsapp_web'].includes(c.channel)?await core.sendWhatsapp(c,formatted.body):undefined;
   await core.addMessage(conversationId,'agent',formatted.body,'accepted',undefined,formatted.card,{id:user.id,name:user.displayName},providerMessageId);return json({ok:true});
  }
  if(raw.action==='message'){
   const role=z.enum(['agent','note']).parse(raw.role),body=z.string().trim().min(1).max(4000).parse(raw.body);
   const providerMessageId=role==='agent'&&['whatsapp','whatsapp_web'].includes(c.channel)?await core.sendWhatsapp(c,body):undefined;
   await core.addMessage(conversationId,role,body,role==='agent'?'accepted':'saved',undefined,undefined,{id:user.id,name:user.displayName},providerMessageId);return json({ok:true});
  }
  return json({error:'Ação indisponível.'},400);
 }finally{await core.run("DELETE FROM settings WHERE key=? AND json_extract(value,'$.token')=?",lease,token);}
}
