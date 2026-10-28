import {waitUntil} from 'cloudflare:workers';
import * as core from '../../../../lib/server/core';
import * as zapi from '../../../../lib/server/zapi';
import {recordZapiConnection} from '../../../../lib/server/whatsapp-connection';
import {activateCeciForInbound,processCeci} from '../../../../lib/server/ceci-inbound';
import {shouldRestartWithCeci} from '../../../../lib/server/ceci-policy';
export const dynamic='force-dynamic';
const ok=()=>new Response('OK',{headers:{'Cache-Control':'no-store'}});
function equals(a:string,b:string){if(!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export async function POST(request:Request){
 if(!equals(new URL(request.url).searchParams.get('key')||'',await core.secret('ZAPI_WEBHOOK_SECRET')))return new Response('Forbidden',{status:403});
 if(Number(request.headers.get('content-length')||0)>150000)return new Response('Too large',{status:413});
 const raw=await request.text();if(raw.length>150000)return new Response('Too large',{status:413});
 let p:Record<string,any>;try{p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))throw 0;}catch{return new Response('Invalid JSON',{status:400});}
 const instance=await zapi.instanceId();if(!equals(String(p.instanceId||''),instance))return new Response('Forbidden',{status:403});
 try{
  if(p.type==='ConnectedCallback'||p.connected===true){await recordZapiConnection('connected',instance);return ok();}
  if(p.type==='DisconnectedCallback'||p.disconnected===true){await recordZapiConnection('offline',instance,'A Z-API informou a desconexão do aparelho.');return ok();}
  if(p.type==='MessageStatusCallback'){if(!p.isGroup&&Array.isArray(p.ids))for(const id of p.ids.slice(0,100))await zapi.receipt(String(id),String(p.status||''));return ok();}
  if(p.type!=='ReceivedCallback'||p.fromMe===true||p.fromApi===true||p.isGroup===true||p.isNewsletter===true||p.isEdit===true||p.waitingMessage===true)return ok();
  const rawPhone=String(p.phone||p.chatLid||'').replace(/@s\.whatsapp\.net$/,''),rawId=String(p.messageId||'');if(!/^(?:\d{10,15}|\d{8,25}@lid)$/.test(rawPhone)||!rawId||rawId.length>250)return ok();
  const lid=/^\d{8,25}@lid$/.test(String(p.chatLid||''))?String(p.chatLid):rawPhone.endsWith('@lid')?rawPhone:'';
  const alias=lid?'lid:'+lid.slice(0,-4):'',mapKey='zapi:contact:'+instance+':'+lid;
  // Only associate a private ID with a number when the provider supplies both.
  const known=lid?await core.getSetting(mapKey):null,phone=rawPhone.endsWith('@lid')?known?.phone||alias:rawPhone;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(instance+':'+rawId));const id='zapi-'+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const lease='zapi:inbound:'+instance+':'+(alias||phone),leaseToken=crypto.randomUUID(),now=Date.now();
  const claimed=await core.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.expires') AS INTEGER)<?",lease,JSON.stringify({token:leaseToken,expires:now+30000}),now);
  if(!claimed.meta.changes)return new Response('Retry later',{status:503});
  try{
  if(lid&&!rawPhone.endsWith('@lid'))await core.setting(mapKey,{phone:rawPhone});
  const existing=await core.one('SELECT conversation_id FROM messages WHERE id=?',id);
  if(existing){const c=await core.one('SELECT status FROM conversations WHERE id=?',existing.conversation_id),cfg=await core.config();if(c?.status==='bot'&&await activateCeciForInbound(cfg))waitUntil(processCeci(String(existing.conversation_id)));return ok();}
  await core.setting('check:whatsappWebReceived',{provider:'zapi',instanceId:instance,at:Date.now()});
  await recordZapiConnection('connected',instance);const cfg=await core.config();const canRun=await activateCeciForInbound(cfg);
  let c=await core.one("SELECT * FROM conversations WHERE (phone=? OR phone=?) AND channel='whatsapp_web' ORDER BY updated DESC LIMIT 1",phone,alias||phone);
  if(c&&c.phone!==phone){await core.run('UPDATE conversations SET phone=? WHERE id=?',phone,c.id);c.phone=phone;}
  if(!c){const cid=crypto.randomUUID();await core.run('INSERT INTO conversations(id,name,phone,channel,status,updated) VALUES(?,?,?,?,?,?)',cid,String(p.senderName||p.chatName||phone).slice(0,100),phone,'whatsapp_web',canRun?'bot':'human',Date.now());c=await core.one('SELECT * FROM conversations WHERE id=?',cid);}
  const cid=String(c!.id),text=typeof p.text?.message==='string'?p.text.message.slice(0,4000):'';
  const replied=c!.status==='human'&&!c!.assigned?!!await core.one("SELECT id FROM messages WHERE conversation_id=? AND role='agent' AND deleted_at=0 LIMIT 1",cid):false;
  // Recover conversations created while the bot was unavailable, only if no
  // person/bot has ever taken part. Established human ownership still wins.
  const untouched=canRun&&!!text&&c!.status==='human'&&!c!.assigned&&!c!.assigned_user_id&&!c!.claimed_at&&!await core.one("SELECT id FROM messages WHERE conversation_id=? AND role IN ('assistant','agent','note') LIMIT 1",cid);
  const restart=untouched||shouldRestartWithCeci(c! as {status:string;assigned:string},cfg.enabled,!!text,replied,cfg.sharedInbox);
  await core.run('UPDATE conversations SET last_inbound=?,archived_at=0,status=?,assigned=? WHERE id=?',Date.now(),restart?'bot':c!.status==='closed'?'human':c!.status,restart?'':c!.assigned,cid);
  if(restart&&c!.status==='closed')await core.resetCeciOrder(cid);
  await core.addMessage(cid,'user',text||'[Mídia recebida. Atendimento humano necessário.]','received',id);
  const photo=String(p.senderPhoto||p.photo||'');try{const url=new URL(photo);if(url.protocol==='https:'&&/(^|\.)(whatsapp\.net|fbcdn\.net|z-api\.io)$/.test(url.hostname))await core.setting('chatAvatar:'+cid,{url:url.href,at:Date.now()});}catch{}
  if(!text)await core.run("UPDATE conversations SET status='human' WHERE id=?",cid);
  else if(canRun&&(c!.status==='bot'||restart))waitUntil(processCeci(cid));
  return ok();
  }finally{await core.run("DELETE FROM settings WHERE key=? AND json_extract(value,'$.token')=?",lease,leaseToken);}
 }catch{console.warn('zapi_webhook_processing_failed');return new Response('Retry later',{status:500});}
}
