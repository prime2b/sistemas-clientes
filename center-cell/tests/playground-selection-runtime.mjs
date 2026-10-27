/** Regression for the repeated selection shown in the 27/10 screenshot. No live services. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__selectionFixture',shortCircuit:true};if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);if(!/\.[a-z]+$/i.test(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',c);}return next(s,c);}});
const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
class Statement{constructor(q,args=[]){this.q=q;this.args=args;}bind(...args){return new Statement(this.q,args);}async all(){return {results:sql.prepare(this.q).all(...this.args)}}async first(){return sql.prepare(this.q).get(...this.args)||null}async run(){return {meta:{changes:Number(sql.prepare(this.q).run(...this.args).changes)}}}}
const DB={prepare:q=>new Statement(q),batch:async ss=>{sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
globalThis.__selectionFixture={DB,MERCADOPHONE_API_KEY:'fixture-only'};
const core=await import('../lib/server/core.ts'),sales=await import('../lib/server/playground-sales-runner.ts'),cards=await import('../lib/chat-cards.ts');
const {readAutomaticEvidence}=await import('../lib/server/playground-evidence.ts');
await core.setting('config',{...core.defaults,enabled:false});await core.setting('ceci:manualPause',true);
let items=[],reads=0,calls=0;
globalThis.fetch=async(input)=>{const u=new URL(String(input));if(u.hostname==='platform.mercadophone.tech'&&u.pathname.endsWith('/stores'))return Response.json({stores:[{system_unit_id:4046,name:'Fixture'}]});if(u.hostname==='platform.mercadophone.tech'&&u.pathname.endsWith('/inventory')){reads++;return Response.json({items:items.filter(p=>p.id===Number(u.searchParams.get('codigoProduto'))),total:1,page:1,limit:100});}throw new Error('Fixture blocked external request: '+u.hostname);};
const history=id=>core.all('SELECT rowid AS seq,* FROM messages WHERE conversation_id=? ORDER BY rowid',id);
async function fixture(name,stock=5,otherStock=5){
 items=[{id:4404997,nome:name+' PREMIUM',quantidade:stock},{id:4213707,nome:name+' ORIGINAL',quantidade:otherStock},{id:4213708,nome:name+' INCELL',quantidade:otherStock}].map(p=>({...p,valorVenda:58,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1}));
 const id=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,'Selection fixture','','test','lojista','human',?)",id,Date.now());
 await core.setting('playground:autoFor:'+id,{runId:'fixture-only',caseIndex:0});
 await core.addMessage(id,'user','Oi');await core.addMessage(id,'assistant','Oi! Qual peça e para qual modelo?');await core.addMessage(id,'user','Preciso de '+name+'.');
 const catalog=items.map(p=>({productId:p.id,name:p.nome,stock:p.quantidade,unitCents:5800,status:'available'}));
 for(const part of cards.catalogMessages('Encontrei as opções.',catalog,Date.now()))await core.addMessage(id,'assistant',part.body,'saved',undefined,part.card);
 await core.addMessage(id,'note','Encaminhamento automático: Produtos listados\nResponsável: a equipe\nResumo: '+name,'handoff-'+id);
 const current={conversationId:id,scenarioSnapshot:{shortFlow:true,kind:'natural',id:'first-contact'}};
 await sales.receiveSimulatedSale({index:0,snapshot:{team:['Ana','Bia','Carla']}},current,await history(id));return current;
}
async function tick(current,mode='exact'){
 return sales.tickSimulatedSale({},current,await history(current.conversationId),async(instructions,input)=>{
  calls++;const data=JSON.parse(input),step=data.phase;
  if(step==='selection')return {message:mode==='words'?'Escolho o código 4404997, dois desse. Prefiro retirar na loja e pagar por Pix.':'Escolho o código 4404997, duas unidades. Prefiro retirar na loja e pagar por Pix.',expectedProductId:4404997,expectedQuantity:2};
  if(step==='quote_acceptance')return {message:'Pode seguir com a compra.'};
  if(step==='delivery')return {message:'Quero retirar na loja e pagar por Pix.'};
  if(step==='payment')return {message:'Pix, por favor.'};
  if(step==='confirmation')return {message:'Pode concluir assim, sim.'};
  throw new Error('Unexpected simulated customer phase: '+step);
 });
}
async function finish(current,mode){for(let n=0;n<20;n++){if(await tick(current,mode))return;assert.equal(current.result,undefined);}throw new Error('Simulation did not complete');}
// A product can be available but cannot fulfill two units; the old executor repeated its question.
const low=await fixture('TELA REDMI 9A/9C/POCO C40',1,5);await finish(low);
let log=await history(low.conversationId);assert.equal(low.sale.step,'completed');assert.equal(low.sale.quoteVersions,1);assert.notEqual(low.sale.selection[0].productId,4404997);assert.equal(low.sale.selection[0].quantity,2);assert.equal(log.filter(m=>m.body==='Qual código você escolhe e quantas unidades precisa?').length,1);assert.ok((await readAutomaticEvidence(low.conversationId)).some(e=>e.kind==='simulated-client-repair'));
assert.ok(log.find(m=>m.role==='assistant'&&cards.parseChatCard(m.card_data)?.items.some(p=>p.productId===4404997)),'Ceci still lists every available product');
console.log('PASS screenshot loop: available item with insufficient quantity cannot trap the fictional client; one selection question, one quote, explicit consent and completed sale');
for(const [name,mode] of [['TELA SAMSUNG A14 4G','exact'],['BATERIA MOTOROLA G54','words']]){
 const c=await fixture(name);await finish(c,mode);const messages=await history(c.conversationId);
 assert.equal(c.sale.step,'completed');assert.equal(c.sale.quoteVersions,1);assert.equal(c.sale.delivery,'retirada');assert.equal(c.sale.payment,'pix');assert.ok(c.sale.consentMessageId);assert.ok(c.sale.confirmationMessageId);assert.notEqual(c.sale.consentMessageId,c.sale.confirmationMessageId);assert.equal(messages.filter(m=>m.role==='agent'&&/prefere retirar|prefere pagar/i.test(m.body)).length,0,'volunteered pickup/Pix must not be asked again');assert.ok(messages.every(m=>m.body.trim()));
}
console.log('PASS exact dialogue and number words: Samsung/Motorola selections preserve early pickup/Pix, still require quote acceptance and final confirmation, and finish without repeated questions');
const recovery=await fixture('TELA XIAOMI REDMI NOTE 12');await tick(recovery);await tick(recovery);const pending=recovery.sale.pendingCustomer;
await core.addMessage(recovery.conversationId,'user','Escolho o código 4404997, duas unidades. Prefiro retirar na loja e pagar por Pix.','saved','sale-client-'+recovery.conversationId+'-'+pending);
await core.addMessage(recovery.conversationId,'agent','Qual código você escolhe e quantas unidades precisa?','saved','legacy-repeat-'+recovery.conversationId);
const beforeCalls=calls,beforeCount=(await history(recovery.conversationId)).length;
await tick(recovery);assert.equal(recovery.sale.step,'quote');assert.equal(calls,beforeCalls,'saved choice recovers without a second model call');assert.equal((await history(recovery.conversationId)).length,beforeCount);await finish(recovery);assert.equal(recovery.sale.step,'completed');assert.equal(recovery.sale.quoteVersions,1);
console.log('PASS saved execution: selection persisted before a failed checkpoint advances without replaying the customer, resending a question or spending another model call');
const noStock=await fixture('TELA SAMSUNG A05',1,1),startCalls=calls;await finish(noStock);assert.equal(noStock.result,'unavailable');assert.notEqual(noStock.sale.step,'completed');assert.equal(noStock.sale.quoteVersions,0);assert.equal(calls,startCalls);
assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,0,'simulation must not create production quotes');assert.ok(reads>0);
console.log('PASS honest unavailability and isolation: no fabricated completion when quantity is impossible, no live WhatsApp, production quote, sale, or configuration changes');
sql.close();
