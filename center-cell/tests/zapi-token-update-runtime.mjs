/** Scoped Client-Token update against the actual management route, isolated D1 and fixture-only HTTP. */
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
const configWrites=[];
class Statement{constructor(q,args=[]){this.q=q;this.args=args;}bind(...args){return new Statement(this.q,args);}async all(){return {results:sql.prepare(this.q).all(...this.args)}}async first(){return sql.prepare(this.q).get(...this.args)||null}async run(){const changes=Number(sql.prepare(this.q).run(...this.args).changes);if(this.args[0]==='config')configWrites.push(JSON.parse(this.args[1]).enabled);return {meta:{changes}}}}
const DB={prepare:q=>new Statement(q),batch:async ss=>{sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const instance='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
globalThis.__zapiTasks=[];globalThis.__zapiFixture={DB,CONFIG_ENCRYPTION_KEY:btoa(String.fromCharCode(...new Uint8Array(32).fill(7))),ZAPI_INSTANCE_ID:instance,ZAPI_INSTANCE_TOKEN:'fixture-instance-token',ZAPI_CLIENT_TOKEN:'fixture-old-client',ZAPI_WEBHOOK_SECRET:'fixture-callback-secret',ZAPI_WEBHOOK_URL:'https://fixture.test/api/z-api/events',OPENAI_API_KEY:'fixture-ai-key',MERCADOPHONE_API_KEY:'fixture-erp-key'};

const core=await import('../lib/server/core.ts'),zapi=await import('../lib/server/zapi.ts'),auth=await import('../lib/server/app-auth.ts');
const compiled=process.env.TOKEN_COMPILED==='1';
const routePath=compiled?readdirSync(new URL('../dist/server/_next/static/',import.meta.url)).find(name=>name.endsWith('.js')&&readFileSync(new URL('../dist/server/_next/static/'+name,import.meta.url),'utf8').includes('Entre na sua conta para acessar a central.')):null;
const manage=compiled?await import(new URL('../dist/server/_next/static/'+routePath,import.meta.url)):await import('../app/api/manage/route.ts');
let providerConnected=true,mode='valid',webhookFailure=false,calls=[],expectedStored,requestClient='',ready=false;
globalThis.fetch=async(input,init={})=>{
 const u=new URL(String(input));assert.equal(u.hostname,'api.z-api.io','no WhatsApp messages, AI calls or other live services');assert.equal(init.redirect,'manual');
 assert.ok(u.pathname.startsWith('/instances/'+instance+'/token/fixture-instance-token/'));
 const path=u.pathname.split('/token/fixture-instance-token')[1];calls.push({path,auth:init.headers['Client-Token']});
 if(path==='/status'){
  assert.equal(init.headers['Client-Token'],requestClient);
  if(expectedStored!==undefined)assert.equal(await core.secret('ZAPI_CLIENT_TOKEN'),expectedStored,'candidate validation must occur before replacing the stored secret');
  if(mode==='network')throw new Error('Transport leaked '+requestClient);
  if(mode==='rejected')return Response.json({error:'Invalid Client-Token'},{status:401});
  if(mode==='api-error')return Response.json({error:'Invalid Client-Token'},{status:200});
  if(mode==='malformed')return Response.json({connected:'true'});
  return Response.json({connected:providerConnected,error:providerConnected?'You are already connected.':'You are not connected.'});
 }
 assert.ok(path.startsWith('/update-webhook-'),'rotation must not request QR, disconnect or send messages');
 assert.equal(init.headers['Client-Token'],await core.secret('ZAPI_CLIENT_TOKEN'),'recovery uses the newly encrypted credential');
 const url=new URL(JSON.parse(init.body).value);assert.equal(url.searchParams.get('key'),'fixture-callback-secret');return Response.json(webhookFailure?{}:{value:true});
};
await core.run('DELETE FROM app_sessions');await core.run('DELETE FROM app_users');
await core.run("INSERT INTO app_users(id,role,username,email,display_name,password_hash,salt,created,updated,must_change_password) VALUES('fixture-owner','admin','owner','owner@example.test','Owner','unused','unused',?,?,0)",Date.now(),Date.now());
const session=await auth.createSession('fixture-owner'),headers={cookie:'__Host-cc_session='+session,'Content-Type':'application/json',origin:'https://fixture.test'};
const post=(value,extra={})=>manage.POST(new Request('https://fixture.test/api/manage',{method:'POST',headers:{...headers,...extra},body:JSON.stringify({action:'secret',key:'ZAPI_CLIENT_TOKEN',value})}));
await core.run("INSERT INTO products(id,name,search,category,data,synced) VALUES(1,'BATERIA FIXTURE','bateria fixture','Peças','{}',?)",Date.now());
await core.setting('config',{...core.defaults,enabled:true,whatsappMode:'web'});await core.setting('ceci:manualPause',false);await core.setting('zapi:startOnConnect',{instanceId:instance,pending:false});
await core.setting('check:whatsappWeb',{provider:'zapi',instanceId:instance,connected:true,state:'connected',at:Date.now()});
const received={provider:'zapi',instanceId:instance,at:Date.now()-30000};await core.setting('check:whatsappWebReceived',received);
const beforeConfig=await core.config(),beforeConnection=await zapi.connection();
for(const failure of ['rejected','api-error','malformed','network']){
 mode=failure;expectedStored=await core.secret('ZAPI_CLIENT_TOKEN');requestClient='fixture-invalid-client';const oldSecret=await core.getSetting('secret:ZAPI_CLIENT_TOKEN'),count=calls.length;
 const response=await post(requestClient),text=await response.text();assert.equal(response.status,400);assert.match(text,/preservada/);assert.ok(!text.includes(requestClient));assert.equal(calls.length,count+1);assert.equal(await core.secret('ZAPI_CLIENT_TOKEN'),expectedStored);assert.deepEqual(await core.getSetting('secret:ZAPI_CLIENT_TOKEN'),oldSecret);assert.deepEqual(await core.config(),beforeConfig);assert.deepEqual(await zapi.connection(),beforeConnection);assert.deepEqual(await zapi.received(),received);assert.equal(await core.getSetting('zapi:clientTokenUpdate'),null);
}
mode='valid';expectedStored='fixture-old-client';requestClient='fixture-new-client';
const startWrites=configWrites.length,result=await post(requestClient),response=await result.json();assert.ok(configWrites.slice(startWrites).every(enabled=>enabled!==false),'Ceci may not be switched off even temporarily during credential rotation');assert.equal(result.status,200);assert.equal(response.validated,true);assert.equal(response.ceciActive,true);assert.equal(response.warning,undefined);assert.equal(await core.secret('ZAPI_CLIENT_TOKEN'),requestClient);assert.deepEqual(await core.config(),beforeConfig);assert.equal(await core.getSetting('ceci:manualPause'),false);assert.deepEqual(await zapi.received(),received);assert.equal(await zapi.webhookConfigured(),true);assert.equal((await zapi.connection()).connected,true);
const encrypted=await core.getSetting('secret:ZAPI_CLIENT_TOKEN');assert.ok(encrypted.iv&&encrypted.data);assert.ok(!JSON.stringify(encrypted).includes(requestClient));assert.ok(!JSON.stringify(response).includes(requestClient));assert.equal(globalThis.__zapiFixture.ZAPI_CLIENT_TOKEN,'fixture-old-client','runtime fallback is not overwritten or exposed');
console.log('PASS rotation: rejected/API/network/malformed candidates leave secret, Ceci, connection and receiving unchanged; valid token is encrypted and channel resumes without QR, disconnect, AI or outgoing messages');
// An existing validation pause may resume, but an explicit operator pause wins.
await core.setting('config',{...await core.config(),enabled:false});expectedStored=requestClient;requestClient='fixture-auto-resume';assert.equal((await (await post(requestClient)).json()).ceciActive,true);assert.equal((await core.config()).enabled,true);
await core.setting('config',{...await core.config(),enabled:false});await core.setting('ceci:manualPause',true);await core.setting('zapi:startOnConnect',null);expectedStored=requestClient;requestClient='fixture-paused-client';
const paused=await (await post(requestClient)).json();assert.equal(paused.ceciActive,false);assert.match(paused.message,/pausa manual/);assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
expectedStored=undefined;await zapi.status();assert.equal(await core.getSetting('ceci:manualPause'),true,'a later status poll must not undo the preserved manual pause');assert.equal((await core.config()).enabled,false);
console.log('PASS automation intent: validation pause resumes automatically, explicit pause survives the update and subsequent connection polling');
await core.setting('zapi:startOnConnect',null);webhookFailure=true;expectedStored=await core.secret('ZAPI_CLIENT_TOKEN');requestClient='fixture-paused-repair';const pausedPartial=await (await post(requestClient)).json();assert.equal(pausedPartial.validated,true);assert.ok(pausedPartial.warning);assert.equal(await core.getSetting('ceci:manualPause'),true);webhookFailure=false;expectedStored=undefined;await zapi.status();assert.equal(await core.getSetting('ceci:manualPause'),true);assert.equal((await core.config()).enabled,false,'repair recovery must preserve the original manual pause too');

await core.setting('ceci:manualPause',false);await core.setting('config',{...await core.config(),enabled:true});webhookFailure=true;expectedStored=await core.secret('ZAPI_CLIENT_TOKEN');requestClient='fixture-repair-pending';
const partial=await (await post(requestClient)).json();assert.equal(partial.validated,true);assert.equal(partial.ceciActive,false);assert.match(partial.warning,/recebimento/);assert.equal(await core.secret('ZAPI_CLIENT_TOKEN'),requestClient);assert.equal((await core.config()).enabled,true,'callback repair failure cannot switch off Ceci');assert.deepEqual(await zapi.received(),received);
webhookFailure=false;expectedStored=undefined;await zapi.status();assert.equal(await zapi.webhookConfigured(),true);assert.equal(await core.getSetting('zapi:startupError'),null);assert.equal((await core.config()).enabled,true);
providerConnected=false;expectedStored=await core.secret('ZAPI_CLIENT_TOKEN');requestClient='fixture-offline-client';const offline=await (await post(requestClient)).json();assert.equal(offline.validated,true);assert.equal(offline.connected,false);assert.equal(offline.ceciActive,false);assert.match(offline.warning,/aparelho está desconectado/);assert.equal((await core.config()).enabled,true);assert.deepEqual(await zapi.received(),received);
console.log('PASS truthful recovery: failed callback preparation is reported and retries with the new token; a genuinely disconnected device stays offline without fabricated activation');
// Credential mutations keep the actual app permission/origin gates and serialize concurrent rotations.
const count=calls.length;assert.equal((await post('fixture-not-authorized',{cookie:''})).status,401);assert.equal((await post('fixture-bad-origin',{origin:'https://evil.test'})).status,403);assert.equal(calls.length,count);
await core.setting('zapi:clientTokenUpdate',{owner:'other',expires:Date.now()+60000});const locked=await post('fixture-same-time');assert.equal(locked.status,409);assert.equal(calls.length,count);assert.equal((await core.getSetting('zapi:clientTokenUpdate')).owner,'other');await core.setting('zapi:clientTokenUpdate',null);
console.log('PASS protection: owner authentication, same-origin mutation, concurrent-update lease and no plaintext token in browser response');
const protectedSecret=await core.getSetting('secret:ZAPI_CLIENT_TOKEN'),encryptionKey=globalThis.__zapiFixture.CONFIG_ENCRYPTION_KEY;expectedStored=undefined;providerConnected=true;requestClient='fixture-encryption-failure';delete globalThis.__zapiFixture.CONFIG_ENCRYPTION_KEY;const saveFailed=await post(requestClient);assert.equal(saveFailed.status,503);assert.deepEqual(await core.getSetting('secret:ZAPI_CLIENT_TOKEN'),protectedSecret);assert.equal((await core.config()).enabled,true);assert.equal(await core.getSetting('zapi:clientTokenUpdate'),null);globalThis.__zapiFixture.CONFIG_ENCRYPTION_KEY=encryptionKey;
console.log('PASS secure persistence: encryption failure cannot replace the existing credential, change Ceci activation or retain the update lock');

sql.close();
