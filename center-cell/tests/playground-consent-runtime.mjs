/** Regression for natural compound purchase consent from the 28/10 screenshot. No live services. */
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

const variants=[
 ['BATERIA IPHONE 8 PLUS','Está tudo certo. Pode seguir com a compra; vou retirar na loja e pagar por Pix.','Sim, está tudo certo. Pode seguir com a compra; vou retirar na loja e pagar por Pix.'],
 ['TELA SAMSUNG A14 4G','Perfeito, está tudo certinho com o orçamento. Pode prosseguir com a compra. Vou retirar na loja e vou pagar no Pix.','Tudo combinado, pode concluir assim, sim.'],
 ['CONECTOR MOTOROLA G54','Por mim está tudo certo; pode finalizar o pedido. Quero receber por entrega e pagar no cartão.','Sim, pode concluir com a entrega e o pagamento no cartão.']
];
async function runTick(current,accept,final){return sales.tickSimulatedSale({},current,await history(current.conversationId),async(_,input)=>{
 calls++;const d=JSON.parse(input);
 if(d.phase==='selection')return {message:'Escolho o código 4404997, duas unidades.'};
 if(d.phase==='quote_acceptance')return {message:accept};
 if(d.phase==='delivery')return {message:'Vou retirar na loja.'};
 if(d.phase==='payment')return {message:'Prefiro Pix.'};
 if(d.phase==='confirmation')return {message:final};
 throw new Error('Unexpected phase '+d.phase);
});}
for(const [name,accept,final] of variants){
 const c=await fixture(name);let finished=false;const phases=[];
 for(let i=0;i<22;i++){phases.push(c.sale.step);if(await runTick(c,accept,final)){finished=true;break;}}
 assert.ok(finished,'valid natural consent must complete '+name);assert.equal(c.sale.step,'completed');assert.equal(c.sale.quoteVersions,1);
 assert.ok(c.sale.consentMessageId);assert.ok(c.sale.confirmationMessageId);assert.notEqual(c.sale.consentMessageId,c.sale.confirmationMessageId);
 const log=await history(c.conversationId);assert.equal(log.filter(m=>cards.parseChatCard(m.card_data)?.type==='quote').length,1);assert.equal(log.filter(m=>m.role==='user'&&m.body===accept).length,1);assert.equal(log.filter(m=>m.role==='agent'&&m.body.includes('Ficou tudo certo com este orçamento?')).length,0,'quote bubble already asked acceptance');assert.equal(log.filter(m=>m.id.startsWith('sale-complete-agent-')).length,1);assert.ok(log.every(m=>m.body.trim()));
 assert.notEqual(c.sale.payment,'');assert.notEqual(c.sale.delivery,'');
}
console.log('PASS screenshot consent: exact natural acceptance and final confirmation complete Apple/Samsung/Motorola with one quote and one final closing');
const recovered=await fixture('BATERIA IPHONE 8 PLUS');
for(let i=0;i<12&&recovered.sale.step!=='quote_acceptance';i++)await runTick(recovered,variants[0][1],variants[0][2]);
assert.equal(recovered.sale.step,'quote_acceptance');
const quoteId=recovered.sale.quoteMessageId,key='sale-client-'+recovered.conversationId+'-'+recovered.sale.pendingCustomer;
await core.addMessage(recovered.conversationId,'user',variants[0][1],'saved',key);
const before=calls,count=(await history(recovered.conversationId)).length;
await runTick(recovered,variants[0][1],variants[0][2]);assert.equal(recovered.sale.step,'confirmation');assert.equal(recovered.sale.consentMessageId,key);assert.equal(calls,before);assert.equal((await history(recovered.conversationId)).length,count);assert.equal(recovered.sale.quoteMessageId,quoteId);
for(let i=0;i<8&&recovered.sale.step!=='completed';i++)await runTick(recovered,variants[0][1],variants[0][2]);assert.equal(recovered.sale.step,'completed');assert.equal(recovered.sale.quoteVersions,1);
const closedCount=(await history(recovered.conversationId)).length;await runTick(recovered,variants[0][1],variants[0][2]);assert.equal((await history(recovered.conversationId)).length,closedCount);
console.log('PASS recovery: persisted consent advances without another paid call/duplicate; completed run is idempotent');
for(const refusal of ['Não, ainda vou pensar.','Está tudo certo se tiver desconto.','Pode seguir com a compra de três unidades.','Pode seguir com a compra do código 9999999.']){
 const c=await fixture('TELA SAMSUNG A05');let error;
 try{for(let i=0;i<22;i++)if(await runTick(c,refusal,'Pode concluir assim, sim.'))break;}catch(e){error=e;}
 assert.equal(error?.message,'AUTO_SALE_CUSTOMER_AMBIGUOUS');assert.equal(c.sale.step,'quote_acceptance');assert.equal(c.sale.consentMessageId,'');assert.equal(c.sale.quote.status,'awaiting');assert.equal(c.sale.completedAt,0);assert.equal(c.sale.quoteVersions,1);
 const log=await history(c.conversationId);assert.equal(log.filter(m=>m.role==='agent'&&m.body==='Você aprova este orçamento ou quer ajustar algum item antes de seguir?').length,1,'at most one distinct clarification, never a question loop');
}
console.log('PASS ambiguity: refusal, conditions, changed quantity/SKU never become consent and cannot trigger repeated operator questions or endless model spend');
assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,0);
sql.close();
