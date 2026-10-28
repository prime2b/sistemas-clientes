/** Status evidence reconciliation with isolated D1 and no live providers. */
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
globalThis.__zapiTasks=[];globalThis.__zapiFixture={DB,ZAPI_INSTANCE_ID:instance,ZAPI_INSTANCE_TOKEN:'fixture-instance-token',ZAPI_CLIENT_TOKEN:'fixture-client-token',ZAPI_WEBHOOK_SECRET:'fixture-callback-secret',ZAPI_WEBHOOK_URL:'https://fixture.test/api/z-api/events',OPENAI_API_KEY:'fixture-ai-key',MERCADOPHONE_API_KEY:'fixture-erp-key'};

const core=await import('../lib/server/core.ts'),zapi=await import('../lib/server/zapi.ts'),integrations=await import('../lib/server/integrations.ts'),validation=await import('../lib/server/playground-validation.ts');
const {ceciAvailability}=await import('../lib/ceci-availability.ts'),{integrationView}=await import('../lib/integrations-view.ts');
let requests=0;globalThis.fetch=async(input)=>{requests++;const u=new URL(String(input));assert.equal(u.hostname,'api.z-api.io');assert.match(u.pathname,/update-webhook-/);return Response.json({value:true});};
const cfg={...await core.config(),enabled:false,whatsappMode:'web'};await core.setting('config',cfg);await core.setting('ceci:manualPause',true);
await core.setting('erpCheck',{at:Date.now()});await core.setting('sync',{complete:true});await core.run("INSERT INTO products(id,name,search,category,data,synced) VALUES(1,'TELA FIXTURE','tela fixture','Peças','{}',?)",Date.now());
await zapi.setup();await core.setting('check:whatsappWeb',{provider:'zapi',instanceId:instance,connected:true,at:Date.now()});
const baseline=requests;
async function session(model,mode,{answered=true,role='ceci',snapshotFingerprint,at=Date.now()}={}){
 const id=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,'Status fixture','','test','lojista','human',?)",id,at);
 await core.addMessage(id,'user','Oi');if(answered)await core.addMessage(id,'assistant','Oi! Qual peça você precisa?');
 await core.setting('playground:config:'+id,{model,mode,fingerprint:snapshotFingerprint||await integrations.signature('internal',cfg),at});await core.setting('playground:policy:'+id,{mode,models:{ceci:model,client:'gpt-5.6-luna',reviewer:'gpt-5.6-luna'}});
 await core.setting('playground:meter:'+id,{entries:[{conversationId:id,role,model,state:'completed',at,input:10,output:10,known:true}]});if(answered)await core.setting('ceci:answered:'+id,{seq:1});return id;
}
await session('gpt-5.6-luna','economic',{answered:false});await session('gpt-5.6-luna','economic',{role:'client'});await session('gpt-5.6-luna','economic',{snapshotFingerprint:'stale'});
let state=await integrations.integrationStatus(cfg);assert.equal(state.agent.validated,false);assert.equal(state.connections.openai.connected,false,'credentials/client-only calls are not Ceci response evidence');
const economic=await session('gpt-5.6-luna','economic');await validation.reconcilePlaygroundValidation(cfg,economic);state=await integrations.integrationStatus(cfg);
assert.equal(state.agent.validated,true);assert.equal(state.agent.productionValidated,false);assert.equal(state.agent.mode,'economic');assert.equal(state.connections.openai.connected,true);assert.equal(state.checks.openai?.ok||false,false,'Luna does not prove access to the production model');assert.equal(state.ready,false);
const data={config:cfg,ceciPaused:true,secrets:{OPENAI_API_KEY:true},activation:state,catalog:{count:1,synced:1}};assert.equal(ceciAvailability(data).label,'Validada');assert.equal(integrationView(data).connections.label,'3/3');assert.equal(integrationView(data).connections.pending,0);assert.equal(requests,baseline,'backfill must not call any provider or consume tokens');
console.log('PASS historical evidence: matching response + completed Ceci API call repairs validation without retesting; stale, absent and client-only evidence cannot validate');
const production=await session(cfg.model,'production',{at:Date.now()+10});await validation.reconcilePlaygroundValidation(cfg,production);state=await integrations.integrationStatus(cfg);assert.equal(state.agent.productionValidated,true);assert.equal(state.checks.openai.ok,true);assert.equal(state.checks.internal.ok,true);assert.equal(state.ready,false,'real receiving is still pending');
await core.setting('check:whatsappWebReceived',{provider:'zapi',instanceId:instance,at:Date.now()});state=await integrations.integrationStatus(cfg);assert.equal(state.ready,true);assert.equal(ceciAvailability({...data,activation:state}).label,'Validada','explicit manual pause is preserved');assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
console.log('PASS production evidence: actual production-model response and receiving unlock readiness without toggling production or overriding manual pause');
const changed={...cfg,instructions:cfg.instructions+' Nova orientação.'};state=await integrations.integrationStatus(changed);assert.equal(state.agent.validated,false);assert.equal(integrationView({...data,config:changed,activation:state}).connections.label,'3/3','prompt edits do not disconnect services');assert.equal(ceciAvailability({...data,activation:state}).label,'Validar');
const newerFailure={ok:false,at:Date.now()+1000,fingerprint:await integrations.signature('openai',cfg),message:'Fixture current failure'};await core.setting('check:openai',newerFailure);await validation.reconcilePlaygroundValidation(cfg,production);assert.deepEqual(await core.getSetting('check:openai'),newerFailure,'old evidence cannot overwrite a newer connection failure');
delete globalThis.__zapiFixture.OPENAI_API_KEY;state=await integrations.integrationStatus(cfg);assert.equal(state.connections.openai.connected,false);assert.equal(state.agent.validated,false);assert.equal(requests,baseline);
console.log('PASS truthful invalidation: instruction changes require new agent validation, credential changes invalidate access, latest failures win and no network/spend/production data change occurs');
sql.close();
