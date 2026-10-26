import {waitUntil} from 'cloudflare:workers';
import {processCeci} from '../../../../lib/server/ceci-inbound';
import * as core from '../../../../lib/server/core';
import {verifyBridgeEvent} from '../../../../lib/server/whatsapp-web-protocol';

export const dynamic='force-dynamic';

export async function POST(request:Request){
  const raw=await request.text();
  if(raw.length>12000)return new Response('Too large',{status:413});
  const token=await core.secret('WHATSAPP_WEB_BRIDGE_TOKEN');
  if(!await verifyBridgeEvent(raw,request.headers.get('x-bridge-timestamp')||'',request.headers.get('x-bridge-signature')||'',token))return new Response('Forbidden',{status:403});
  try{
    const event=JSON.parse(raw);
    if(event.kind!=='message'||typeof event.id!=='string'||!/^[-\w]{5,120}$/.test(event.id)||typeof event.phone!=='string'||!(/^(?:\d{10,15}|lid:\d{8,25})$/.test(event.phone))||!['text','media'].includes(event.type)||typeof event.body!=='string'||event.body.length>4000)return new Response('Invalid event',{status:400});
    if(await core.one('SELECT id FROM messages WHERE id=?',event.id))return new Response('OK');
    const cfg=await core.config();
    let conversation=await core.one("SELECT * FROM conversations WHERE phone=? AND channel='whatsapp_web' ORDER BY updated DESC LIMIT 1",event.phone);
    if(!conversation){
      const id=crypto.randomUUID();
      await core.run('INSERT INTO conversations (id,name,phone,channel,updated,status) VALUES (?,?,?,?,?,?)',id,String(event.name||event.phone).slice(0,100),event.phone,'whatsapp_web',Date.now(),cfg.enabled?'bot':'human');
      conversation=await core.one('SELECT * FROM conversations WHERE id=?',id);
    }
    const id=conversation!.id;
    await core.run("UPDATE conversations SET last_inbound=?,archived_at=0,status=CASE WHEN status='closed' THEN 'human' ELSE status END WHERE id=?",Date.now(),id);
    await core.addMessage(id,'user',event.type==='text'?event.body:'[Mídia recebida. Atendimento humano necessário.]','received',event.id);
    await core.setting('check:whatsappWebReceived',{at:Date.now()});
    if(event.type==='media')await core.run("UPDATE conversations SET status='human' WHERE id=?",id);
    else if(cfg.enabled&&conversation!.status==='bot'){
      waitUntil(processCeci(id));
    }
    return new Response('OK');
  }catch{return new Response('Retry later',{status:500});}
}
