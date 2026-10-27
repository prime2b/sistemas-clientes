/** Real routes/engine, isolated D1, and fixture-only provider HTTP. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){
 if(s==='next/headers')return {url:'data:text/javascript,export const headers=async()=>new Headers()',shortCircuit:true};
 if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__zapiFixture;export const waitUntil=p=>globalThis.__zapiTasks.push(p)',shortCircuit:true};
 if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);if(!/\.[a-z]+$/i.test(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',c);}return next(s,c);
}});
const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
class Statement{constructor(q,args=[]){this.q=q;this.args=args;}bind(...args){return new Statement(this.q,args);}async all(){return {results:sql.prepare(this.q).all(...this.args)}}async first(){return sql.prepare(this.q).get(...this.args)||null}async run(){return {meta:{changes:Number(sql.prepare(this.q).run(...this.args).changes)}}}}
const DB={prepare:q=>new Statement(q),batch:async ss=>{sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const instance='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',phone='5517999990000';
globalThis.__zapiTasks=[];globalThis.__zapiFixture={DB,ZAPI_INSTANCE_ID:instance,ZAPI_INSTANCE_TOKEN:'fixture-instance-token',ZAPI_CLIENT_TOKEN:'fixture-client-token',ZAPI_WEBHOOK_SECRET:'fixture-callback-secret',ZAPI_WEBHOOK_URL:'https://fixture.test/api/z-api/events',OPENAI_API_KEY:'fixture-ai-key'};
const core=await import('../lib/server/core.ts'),zapi=await import('../lib/server/zapi.ts'),hooks=await import('../app/api/z-api/events/route.ts'),pair=await import('../app/api/whatsapp-web/route.ts'),auth=await import('../lib/server/app-auth.ts');
let connected=false,calls=[],sends=[],modelCalls=0;
globalThis.fetch=async(input,init={})=>{
 const u=new URL(String(input));
 if(u.hostname==='api.z-api.io'){
  assert.equal(init.headers['Client-Token'],'fixture-client-token');assert.equal(init.redirect,'manual');
  assert.ok(u.pathname.startsWith('/instances/'+instance+'/token/fixture-instance-token/'));
  const path=u.pathname.split('/token/fixture-instance-token')[1];calls.push({path,method:init.method});
  if(path.startsWith('/update-webhook-')){assert.equal(init.method,'PUT');const value=new URL(JSON.parse(init.body).value);assert.equal(value.origin,'https://fixture.test');assert.equal(value.pathname,'/api/z-api/events');assert.equal(value.searchParams.get('key'),'fixture-callback-secret');return Response.json({value:true});}
  if(path==='/status')return Response.json({connected,smartphoneConnected:connected});
  if(path==='/qr-code/image')return Response.json({value:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'});
  if(path==='/disconnect'){connected=false;return Response.json({value:true});}
  if(path==='/profile-picture')return Response.json([{link:'https://pps.whatsapp.net/fixture.jpg'}]);
  if(path==='/send-text'){sends.push(JSON.parse(init.body));return Response.json({messageId:'fixture-out-'+sends.length});}
 }
 if(u.hostname==='api.openai.com'){
  modelCalls++;const payload=JSON.parse(init.body);assert.equal(payload.model,'gpt-5.6-terra');
  return Response.json({output:[{type:'function_call',name:'responder_cliente',call_id:crypto.randomUUID(),arguments:JSON.stringify({texto:'Oi! Qual peça você precisa e para qual modelo?',proximoPasso:'',contexto:{fatos:[],pendencia:'Peça e modelo',proximaAcao:'Consultar catálogo'}})}],usage:{input_tokens:100,output_tokens:30}});
 }
 throw new Error('Fixture blocked network escape: '+u.hostname);
};
await core.setting('config',{...core.defaults,whatsappMode:'web',enabled:true,sharedInbox:true,flowMode:'catalog_handoff'});await core.setting('ceci:manualPause',false);
await core.run('DELETE FROM app_sessions');await core.run('DELETE FROM app_users');
await core.run("INSERT INTO app_users(id,role,username,email,display_name,password_hash,salt,created,updated,must_change_password) VALUES('fixture-owner','admin','fixture','fixture@example.test','Fixture','unused','unused',?,?,0)",Date.now(),Date.now());
const token=await auth.createSession('fixture-owner');
// Resolve the actual cookie constant without reimplementing auth.
const cookieName=readFileSync(new URL('../lib/server/app-auth.ts',import.meta.url),'utf8').match(/const COOKIE\s*=\s*['"]([^'"]+)/)[1];
const adminHeaders={cookie:cookieName+'='+token,'Content-Type':'application/json',origin:'https://fixture.test'};
assert.equal((await pair.GET(new Request('https://fixture.test/api/whatsapp-web'))).status,403);
assert.equal((await pair.POST(new Request('https://fixture.test/api/whatsapp-web',{method:'POST',headers:{...adminHeaders,origin:'https://evil.test'},body:'{"action":"connect"}'}))).status,403);
delete globalThis.__zapiFixture.ZAPI_CLIENT_TOKEN;const pending=await pair.GET(new Request('https://fixture.test/api/whatsapp-web',{headers:adminHeaders}));assert.equal((await pending.json()).state,'unconfigured');assert.equal(calls.length,0);globalThis.__zapiFixture.ZAPI_CLIENT_TOKEN='fixture-client-token';
await core.setting('check:whatsappWeb',{connected:true,at:Date.now()});assert.equal(await zapi.connection(),null,'old provider cannot validate new connection');
const qr=await zapi.connect();assert.equal(qr.state,'qr');assert.ok(qr.expiresAt>Date.now()+19000);assert.equal(calls.filter(c=>c.path.startsWith('/update-webhook-')).length,4);assert.equal(await zapi.webhookConfigured(),true);
assert.equal(zapi.qrView({challenge:'fixture'}).state,'challenge');assert.throws(()=>zapi.qrView({value:'https://evil.test/qr.png'}),/QR Code válido/);
connected=true;const before=calls.filter(c=>c.path==='/qr-code/image').length;assert.equal((await zapi.connect()).state,'connected');assert.equal(calls.filter(c=>c.path==='/qr-code/image').length,before,'connected number must not regenerate QR');
assert.equal(await zapi.avatar(phone),'https://pps.whatsapp.net/fixture.jpg');
console.log('PASS pairing: auth, CSRF, required Client-Token, four authenticated webhooks, real QR lifecycle, challenge, connected shortcut and profile picture');
const received=(extra={})=>({type:'ReceivedCallback',instanceId:instance,messageId:crypto.randomUUID(),phone,fromMe:false,fromApi:false,isGroup:false,senderName:'Cliente fixture',text:{message:'Oi'},senderPhoto:'https://pps.whatsapp.net/fixture.jpg',...extra});
const event=(p,key='fixture-callback-secret')=>hooks.POST(new Request('https://fixture.test/api/z-api/events?key='+key,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}));
assert.equal((await event(received(),'wrong')).status,403);assert.equal((await event(received({instanceId:'wrong'}))).status,403);
for(const field of ['fromMe','fromApi','isGroup','isNewsletter','isEdit','waitingMessage'])assert.equal((await event(received({[field]:true}))).status,200);
assert.equal((await core.one('SELECT COUNT(*) AS n FROM messages')).n,0);
const first=received();assert.equal((await event(first)).status,200);await Promise.all(globalThis.__zapiTasks.splice(0));
assert.equal(sends.length,1);assert.equal(sends[0].phone,phone);assert.match(sends[0].message,/Qual peça/);assert.equal(modelCalls,1);
const c=await core.one("SELECT * FROM conversations WHERE phone=? AND channel='whatsapp_web'",phone);assert.ok(c);assert.equal((await core.getSetting('chatAvatar:'+c.id)).url,'https://pps.whatsapp.net/fixture.jpg');
assert.equal((await event(first)).status,200);await Promise.all(globalThis.__zapiTasks.splice(0));assert.equal(sends.length,1,'retried inbound must not send a second answer');assert.equal((await core.one("SELECT COUNT(*) AS n FROM messages WHERE role='user'")).n,1);
const held='zapi:inbound:'+instance+':'+phone;await core.setting(held,{token:'other',expires:Date.now()+30000});const delayed=received();assert.equal((await event(delayed)).status,503);await core.run('DELETE FROM settings WHERE key=?',held);assert.equal((await event(delayed)).status,200);await Promise.all(globalThis.__zapiTasks.splice(0));assert.equal((await core.one('SELECT COUNT(*) AS n FROM conversations WHERE phone=?',phone)).n,1);
await core.run("UPDATE conversations SET status='human',assigned='fixture-owner' WHERE id=?",c.id);const sentBefore=sends.length;assert.equal((await event(received())).status,200);assert.equal(globalThis.__zapiTasks.length,0);assert.equal(sends.length,sentBefore);
await core.setting('ceci:manualPause',true);assert.equal((await event(received({phone:'5517999990001'}))).status,200);assert.equal((await core.one('SELECT status FROM conversations WHERE phone=?','5517999990001')).status,'human');assert.equal(globalThis.__zapiTasks.length,0);
await core.setting('ceci:manualPause',false);assert.equal((await event(received({phone:'5517999990002',text:undefined,image:{imageUrl:'https://fixture.test/image'}}))).status,200);assert.equal((await core.one('SELECT status FROM conversations WHERE phone=?','5517999990002')).status,'human');
console.log('PASS inbound: authenticated instance, echo/group/edit filtering, inbound → Ceci → Z-API response, duplicate retry, phone lease, human ownership, explicit pause and media fallback');
const manage=await import('../app/api/manage/route.ts'),humanBefore=sends.length;
assert.equal((await manage.POST(new Request('https://fixture.test/api/manage',{method:'POST',headers:adminHeaders,body:JSON.stringify({action:'claimConversation',id:c.id})}))).status,200);
const humanResponse=await manage.POST(new Request('https://fixture.test/api/manage',{method:'POST',headers:adminHeaders,body:JSON.stringify({action:'message',id:c.id,role:'agent',body:'Vou concluir a compra com você.'})}));
assert.equal(humanResponse.status,200,await humanResponse.text());assert.equal(sends.length,humanBefore+1);assert.equal(sends.at(-1).message,'Vou concluir a compra com você.');
console.log('PASS actual operator route: authenticated shared-inbox response goes through Z-API after human assignment');
await core.setting('ceci:manualPause',true);
const privateLid='999999999999999@lid',sharedLid='888888888888888@lid';
assert.equal((await event(received({phone:privateLid,chatLid:privateLid}))).status,200);assert.ok(await core.one('SELECT id FROM conversations WHERE phone=?','lid:999999999999999'));
assert.equal((await event(received({phone:'5517999990003',chatLid:sharedLid}))).status,200);assert.equal((await event(received({phone:sharedLid,chatLid:sharedLid}))).status,200);assert.equal((await core.one('SELECT COUNT(*) AS n FROM conversations WHERE phone=?','5517999990003')).n,1);
const lidSent=await zapi.send('lid:999999999999999','Resposta ao contato privado.');assert.ok(lidSent);assert.equal(sends.at(-1).phone,privateLid);
console.log('PASS contact privacy: private LID is supported and observed number/LID association preserves the existing conversation');
const outId=await core.addMessage(c.id,'agent','Confirmado.','accepted');await zapi.receipt('early','READ');await zapi.linkMessage('early',outId);assert.equal((await core.one('SELECT status FROM messages WHERE id=?',outId)).status,'read');await zapi.receipt('early','SENT');assert.equal((await core.one('SELECT status FROM messages WHERE id=?',outId)).status,'read');
const nextId=await core.addMessage(c.id,'agent','Enviado.','accepted');await zapi.linkMessage('later',nextId);
for(const status of ['SENT','RECEIVED','READ_BY_ME'])await event({type:'MessageStatusCallback',instanceId:instance,ids:['later'],status,phone});assert.equal((await core.one('SELECT status FROM messages WHERE id=?',nextId)).status,'delivered');await event({type:'MessageStatusCallback',instanceId:instance,ids:['later'],status:'READ',phone});assert.equal((await core.one('SELECT status FROM messages WHERE id=?',nextId)).status,'read');
await event({type:'DisconnectedCallback',instanceId:instance,disconnected:true});assert.equal((await core.getSetting('whatsapp:disconnectAlert')).provider,'zapi');await event({type:'ConnectedCallback',instanceId:instance,connected:true});assert.equal(await core.getSetting('whatsapp:disconnectAlert'),null);await zapi.disconnect();assert.equal(await core.getSetting('whatsapp:disconnectAlert'),null);
for(const route of ['../app/api/uazapi/events/route.ts','../app/api/whatsapp-web/events/route.ts'])assert.equal((await (await import(route)).POST()).status,410);
const statusText=await (await pair.GET(new Request('https://fixture.test/api/whatsapp-web',{headers:adminHeaders}))).text();for(const secret of ['fixture-instance-token','fixture-client-token','fixture-callback-secret'])assert.ok(!statusText.includes(secret));
console.log('PASS delivery: early receipts, monotonic read status, READ_BY_ME ignored, disconnect alert/reconnect, intentional logout, retired endpoints and no credentials in browser status');
sql.close();
