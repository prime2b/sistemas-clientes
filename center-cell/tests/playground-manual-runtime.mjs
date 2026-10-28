/** Manual operator replies must drive the fictional customer through the real commercial gates. */
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
 items=[{id:6039915,nome:name+' PREMIUM',quantidade:stock},{id:4213707,nome:name+' ORIGINAL',quantidade:otherStock},{id:4213708,nome:name+' INCELL',quantidade:otherStock}].map(p=>({...p,valorVenda:58,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1}));
 const id=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,'Selection fixture','','test','lojista','human',?)",id,Date.now());
 await core.setting('playground:autoFor:'+id,{runId:'fixture-only',caseIndex:0});
 await core.addMessage(id,'user','Oi');await core.addMessage(id,'assistant','Oi! Qual peça e para qual modelo?');await core.addMessage(id,'user','Preciso de '+name+'.');
 const catalog=items.map(p=>({productId:p.id,name:p.nome,stock:p.quantidade,unitCents:5800,status:'available'}));
 for(const part of cards.catalogMessages('Encontrei as opções.',catalog,Date.now()))await core.addMessage(id,'assistant',part.body,'saved',undefined,part.card);
 await core.addMessage(id,'note','Encaminhamento automático: Produtos listados\nResponsável: a equipe\nResumo: '+name,'handoff-'+id);
 const current={conversationId:id,scenarioSnapshot:{shortFlow:true,kind:'natural',id:'first-contact'}};
 await sales.receiveSimulatedSale({index:0,snapshot:{team:['Ana','Bia','Carla']}},current,await history(id));return current;
}

const current=await fixture('TELA IPHONE 14 PRO MAX');current.sale.mode='manual';
const action=async(operation,body)=>sales.actAsSimulatedAttendant(current,{operation,slot:1,revision:current.sale.revision,body});
let customerCalls=0,injectRepeat=false,unrelated=false;
async function customer(instructions,input){
 customerCalls++;const data=JSON.parse(input);assert.ok(data.lastAgentMessage,'actual operator text is explicit');assert.ok(data.manualContext,'manual context replaces fixed-step orders');assert.match(instructions,/MANUALMENTE/);
 const context=data.manualContext;
 if(context.focus==='selection')return {message:'Escolho o código 6039915, duas unidades. Prefiro retirar na loja e pagar por Pix.'};
 if(injectRepeat)return {message:'Confirmo o código 6039915, duas unidades. Prefiro retirar na loja e pagar por Pix.'};
 if(unrelated)return {message:'Não entendi essa parte. Podemos conferir o orçamento antes de eu ir?'};
 return {message:context.missing==='quote'?'Perfeito! Pode me mandar o orçamento para conferir antes de ir?':context.missing==='quote_acceptance'?'Estou de acordo, pode finalizar a compra.':'Combinado, vou buscar na loja. Obrigada!'};
}
const tick=()=>sales.tickSimulatedSale({},current,historySync(),customer);
function historySync(){return sql.prepare('SELECT rowid AS seq,* FROM messages WHERE conversation_id=? ORDER BY rowid').all(current.conversationId);}
await action('assume');await action('reply','cpnseguiu escolher qual deseja?');await tick();assert.equal(current.sale.step,'quote');assert.equal(current.sale.delivery,'retirada');assert.equal(current.sale.payment,'pix');
await assert.rejects(action('complete'),/CONFIRMATION_REQUIRED/);
// Recover a v84-or-earlier selection checkpoint while preserving the latest manual reply.
current.sale.step='selection';injectRepeat=true;
await action('reply','perfeito, já vou deixar separado aqui para vc vir buscar..');await tick();
assert.equal(current.sale.step,'quote');assert.equal(current.sale.pendingCustomer,'');let log=await history(current.conversationId);assert.match(log.at(-1).body,/orçamento/);assert.doesNotMatch(log.at(-1).body,/6039915|duas unidades/);assert.equal(log.filter(m=>cards.parseChatCard(m.card_data)?.type==='quote').length,0,'manual separation cannot silently generate an unrequested quote');
console.log('PASS screenshot: manual separation gets a contextual acknowledgment/request for the missing quote, no repeated SKU and no false sale');
injectRepeat=false;unrelated=true;await action('reply','E aquela conversa sobre o jogo de ontem?');await tick();assert.equal(current.sale.step,'quote');assert.match((await history(current.conversationId)).at(-1).body,/Não entendi/);unrelated=false;
await action('quote');await tick();assert.equal(current.sale.step,'confirmation');assert.ok(current.sale.consentMessageId);assert.equal(current.sale.quote.status,'approved');assert.equal(current.sale.quoteVersions,1);
injectRepeat=true;await action('reply','perfeito, entendido, já separei as 2 unidades do produto escolhido, pode vir buscar');await tick();assert.equal(current.sale.step,'ready');assert.ok(current.sale.confirmationMessageId);assert.notEqual(current.sale.confirmationMessageId,current.sale.consentMessageId);log=await history(current.conversationId);assert.match(log.at(-1).body,/Combinado/);assert.doesNotMatch(log.at(-1).body,/6039915|duas unidades/);
await action('complete');assert.equal(current.sale.step,'completed');assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',current.conversationId)).status,'closed');assert.equal(current.sale.quoteVersions,1);assert.equal(log.filter(m=>m.role==='user'&&/6039915/.test(m.body)).length,1);
console.log('PASS manual sale: actual operator reply → choice → missing-quote guidance → quote acceptance → natural pickup/thanks → explicit operator completion');
const other=await fixture('TELA SAMSUNG A14');other.sale.mode='manual';
await sales.actAsSimulatedAttendant(other,{operation:'assume',slot:1,revision:other.sale.revision});
await sales.actAsSimulatedAttendant(other,{operation:'reply',slot:1,revision:other.sale.revision,body:'Já separei, pode vir buscar.'});
await sales.tickSimulatedSale({},other,await history(other.conversationId),async(_,input)=>{assert.equal(JSON.parse(input).manualContext.focus,'closing');return {message:'Pode enviar o orçamento para eu conferir antes de ir?'};});assert.equal(other.sale.step,'selection');assert.equal(other.sale.consentMessageId,'');await assert.rejects(sales.actAsSimulatedAttendant(other,{operation:'complete',slot:1,revision:other.sale.revision}),/CONFIRMATION_REQUIRED/);
assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,0);
console.log('PASS manual guards: courtesy/separation before choosing or quoting cannot approve a sale, and no production setting/order/WhatsApp send is changed');
sql.close();
