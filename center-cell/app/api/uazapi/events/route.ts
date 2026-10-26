import {waitUntil} from 'cloudflare:workers';
import * as core from '../../../../lib/server/core';
import {instanceToken,recordConnection} from '../../../../lib/server/uazapi';
import {activateCeciForInbound,processCeci} from '../../../../lib/server/ceci-inbound';
import {shouldRestartWithCeci} from '../../../../lib/server/ceci-policy';

export const dynamic='force-dynamic';

function equals(a:string,b:string){
  if(!b||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function messageId(value:string){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return 'uaz-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function contact(jid:string){
  const match=/^(\d{8,25})@(s\.whatsapp\.net|lid)$/.exec(jid);
  if(!match)return null;
  return match[2]==='lid'?'lid:'+match[1]:/^(\d{10,15})$/.test(match[1])?match[1]:null;
}

export async function POST(request:Request){
  if(Number(request.headers.get('content-length')||0)>150000)return new Response('Too large',{status:413});
  if(!equals(request.headers.get('x-center-relay')||'',core.runtime.UAZAPI_RELAY_SECRET||''))return new Response('Forbidden',{status:403});
  const raw=await request.text();
  if(raw.length>150000)return new Response('Too large',{status:413});
  let payload:Record<string,any>;
  try{payload=JSON.parse(raw);}
  catch{return new Response('Invalid JSON',{status:400});}
  if(!equals(String(payload.token||''),await instanceToken()))return new Response('Forbidden',{status:403});
  if(payload.EventType==='connection'){
    await recordConnection(String(payload.instance?.status||'offline'),String(payload.instance?.lastDisconnectReason||''));
    return new Response('OK');
  }
  if(payload.EventType!=='messages')return new Response('OK');
  const m=payload.message;
  if(!m||m.fromMe===true||m.isGroup===true||m.wasSentByApi===true)return new Response('OK');
  const phone=contact(String(m.chatid||''));
  const rawId=String(m.id||m.messageid||'');
  if(!phone||!rawId||rawId.length>250)return new Response('OK');
  const id=await messageId(rawId+':'+m.chatid);
  try{
    if(await core.one('SELECT id FROM messages WHERE id=?',id))return new Response('OK');
    const cfg=await core.config();
    await core.setting('check:whatsappWebReceived',{at:Date.now()});
    await activateCeciForInbound(cfg);
    let conversation=await core.one("SELECT * FROM conversations WHERE phone=? AND channel='whatsapp_web' ORDER BY updated DESC LIMIT 1",phone);
    if(!conversation){
      const conversationId=crypto.randomUUID();
      await core.run('INSERT INTO conversations (id,name,phone,channel,updated,status) VALUES (?,?,?,?,?,?)',conversationId,String(m.senderName||payload.chat?.name||phone).slice(0,100),phone,'whatsapp_web',Date.now(),cfg.enabled?'bot':'human');
      conversation=await core.one('SELECT * FROM conversations WHERE id=?',conversationId);
    }
    const conversationId=String(conversation!.id);
    const body=String(m.text||'').slice(0,4000);
    const agentHasReplied=conversation!.status==='human'&&!conversation!.assigned
      ? !!await core.one("SELECT id FROM messages WHERE conversation_id=? AND role='agent' AND deleted_at=0 LIMIT 1",conversationId)
      : false;
    const restart=shouldRestartWithCeci(conversation! as {status:string;assigned:string},cfg.enabled,!!body,agentHasReplied);
    await core.run("UPDATE conversations SET last_inbound=?,archived_at=0,status=?,assigned=? WHERE id=?",Date.now(),restart?'bot':conversation!.status,restart?'':conversation!.assigned,conversationId);
    if(restart&&conversation!.status==='closed')await core.resetCeciOrder(conversationId);
    await core.addMessage(conversationId,'user',body||'[Mídia recebida. Atendimento humano necessário.]','received',id);
    await core.setting('check:whatsappWebReceived',{at:Date.now()});
    if(!body)await core.run("UPDATE conversations SET status='human' WHERE id=?",conversationId);
    else if(cfg.enabled&&(conversation!.status==='bot'||restart)){
      waitUntil(processCeci(conversationId));
    }
    return new Response('OK');
  }catch{return new Response('Retry later',{status:500});}
}
