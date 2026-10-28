/** Runs the production core against an isolated SQLite D1 adapter and mocked HTTP services. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(specifier,context,next){
 if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__ceciTestEnv;',shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){
  const u=new URL(specifier,context.parentURL);
  if(!/\.[a-z]+$/i.test(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',context);
 }
 return next(specifier,context);
}});
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
class Statement{
 constructor(sql,args=[]){this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.sql,args);}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
 async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
 async run(){return {meta:{changes:Number(sqlite.prepare(this.sql).run(...this.args).changes)}};}
}
const DB={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.__ceciTestEnv={DB,OPENAI_API_KEY:'fixture-only',MERCADOPHONE_API_KEY:'fixture-only',ZAPI_INSTANCE_ID:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',ZAPI_INSTANCE_TOKEN:'fixture-only',ZAPI_CLIENT_TOKEN:'fixture-client-token',ZAPI_WEBHOOK_SECRET:'fixture-webhook-secret',ZAPI_WEBHOOK_URL:'https://fixture.test/api/z-api/events'};
let script=[],sent=[],liveReads=[],modelStatus=0,modelCode="";
const raw=id=>({id,nome:id>=1000&&id<1100?'TELA IPHONE 12 QUALIDADE '+(id-999):id===2000?'TELA IPHONE 12 PRO':id===2001?'TELA IPHONE 13':id>=200?'BATERIA IPHONE '+(id-200):id===101?'FRONTAL IPHONE 15 PRO MAX SEM ARO':'CONECTOR IPHONE 15 PRO MAX',quantidade:id===1011?0:40,valorVenda:id===1012?null:id===101?199.9:35.5,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1});
globalThis.fetch=async (input,init)=>{
 const url=new URL(String(input));
 if(url.hostname==='api.openai.com'){
  if(modelStatus)return Response.json({error:{code:modelCode}},{status:modelStatus});
  const payload=JSON.parse(init.body);const source=JSON.parse(payload.input.filter(m=>m.role==='user').at(-1).content);const channel=sqlite.prepare('SELECT c.channel FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?').get(source.mensagemId)?.channel;assert.equal(payload.model,channel==='test'?'gpt-5.6-luna':'gpt-5.6-terra');assert.equal(payload.tool_choice,'required');assert.equal(payload.parallel_tool_calls,false);assert.match(payload.instructions,/TOM CONFIGURADO DE TESTE/);
  const next=script.shift();assert.ok(next,'unexpected model call');const call=typeof next==='function'?await next(payload):next;
  return Response.json({output:[{type:'function_call',name:call[0],call_id:crypto.randomUUID(),arguments:JSON.stringify(call[1])}],usage:{input_tokens:100,output_tokens:50}});
 }
 if(url.hostname==='platform.mercadophone.tech'){
  if(url.pathname.endsWith('/stores'))return Response.json({stores:[{system_unit_id:4046,name:'Fixture Store'}]});
  if(url.pathname.endsWith('/inventory')){const id=Number(url.searchParams.get('codigoProduto'));liveReads.push(id);return Response.json({items:[raw(id)],total:1,page:1,limit:100});}
 }
 if(url.hostname==='api.z-api.io'&&url.pathname.includes('/update-webhook-'))return Response.json({value:true});
 if(url.hostname==='api.z-api.io'&&url.pathname.endsWith('/send-text')){sent.push(JSON.parse(init.body));return Response.json({id:crypto.randomUUID()});}
 throw new Error('Unexpected request: '+url.origin+url.pathname);
};
const core=await import('../lib/server/core.ts');
await core.setting('config',{...core.defaults,flowMode:'quote',sharedInbox:false,enabled:true,greeting:'FIXED_GREETING_MUST_NOT_BE_SENT',instructions:'TOM CONFIGURADO DE TESTE'});
const id=crypto.randomUUID();
await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated,customer_status,customer_name) VALUES(?,?,?,'whatsapp_web','lojista','bot',?,'verified',?)",id,'Fixture','5511999999999',Date.now(),'Cliente');
for(const n of [101,102])await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',n,raw(n).nome,raw(n).nome.toLowerCase(),'Peças',JSON.stringify(raw(n)),Date.now());
const context={fatos:[],pendencia:'',proximaAcao:''};
const finish=(text='Aqui estão as opções.',next='')=>['responder_cliente',{texto:text,proximoPasso:next,contexto:context}];
async function turn(text,build){const source=await core.addMessage(id,'user',text);script=build(source);const reply=await core.chatReply(id);assert.ok(reply);await core.publishCeciReply(id,reply);assert.equal(script.length,0);return reply;}
await turn('Frontal 15 Pro Max',()=>[['buscar_catalogo',{busca:'frontal 15 Pro Max'}],['consultar_opcoes',{productIds:[101],exibirCards:true}],finish('Encontrei esta opção.','Quantas você precisa?')]);
assert.equal(sent.length,1);assert.doesNotMatch(sent[0].message,/FIXED_GREETING/);
assert.match(sent[0].message,/Quantas você precisa\?$/);
const first=await turn('Duas telas e um conector',()=>[['buscar_catalogo',{busca:'conector 15 Pro Max'}],['consultar_e_orcar',{itens:[{productId:101,quantity:2},{productId:102,quantity:1}]}],finish('Incluí as telas e o conector.')]);
assert.equal(first.card.totalCents,43530);assert.equal(first.card.items.length,2);
assert.equal((await core.one('SELECT total FROM quotes WHERE id=?',first.quoteId)).total,43530);
const second=await turn('Muda para três telas',()=>[['consultar_e_orcar',{itens:[{productId:101,quantity:3}]}],finish('Atualizei as telas e mantive o conector.')]);
assert.equal(second.card.totalCents,63520);assert.equal((await core.one('SELECT superseded_by FROM quotes WHERE id=?',first.quoteId)).superseded_by,second.quoteId);
assert.deepEqual(liveReads.slice(-2),[101,102]);
// Lookup uses escaped LIKE correctly and only this conversation.
await turn('Sobre o conector...',()=>[['consultar_historico',{busca:'conector'}],finish('Você quer alterar o conector?')]);
// Stale generated answers have no message, memory, quote or outgoing side effects.
await core.addMessage(id,'user','Preciso de quatro telas');script=[['consultar_e_orcar',{itens:[{productId:101,quantity:4}]}],finish()];
const stale=await core.chatReply(id);const before=await core.getSetting('ceci:memory:'+id);const count=sent.length;
await core.addMessage(id,'user','Na verdade cinco');
await assert.rejects(core.publishCeciReply(id,stale),/CECI_SUPERSEDED/);
assert.equal(sent.length,count);assert.deepEqual(await core.getSetting('ceci:memory:'+id),before);assert.equal(await core.one('SELECT id FROM quotes WHERE id=?',stale.quoteId),null);
script=[['consultar_e_orcar',{itens:[{productId:101,quantity:5}]}],finish('Ajustei para cinco telas.')];
const current=await core.chatReply(id);await core.publishCeciReply(id,current);
// Reported second confirmation approves the SAME quote; even a wrong model tool
// cannot issue a new quote, repeat the consent question or consult inventory again.
const quotesBeforePurchase=(await core.one('SELECT COUNT(*) AS n FROM quotes')).n,readsBeforePurchase=liveReads.length;
await turn('Confirmo, desejo finalizar a compra.',source=>[
 ['consultar_e_orcar',{itens:[{productId:101,quantity:5}]}],
 payload=>{const guard=JSON.parse(payload.input.at(-1).output);assert.equal(guard.orcamentoVigente,current.quoteId);assert.equal(guard.mensagemId,source);assert.deepEqual(payload.tools.map(t=>t.name),['encaminhar_humano']);return ['encaminhar_humano',{motivo:'compra_confirmada',resumo:'Concluir as telas e o conector.',mensagem:'Vou chamar a equipe para concluir esse pedido.',orcamentoId:current.quoteId,mensagemId:source,contexto:context}];}
]);
assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,quotesBeforePurchase);assert.equal(liveReads.length,readsBeforePurchase);
assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',id)).status,'human');
const approved=await core.one("SELECT card_data FROM messages WHERE conversation_id=? AND json_valid(card_data) AND json_extract(card_data,'$.id')=?",id,current.quoteId);
assert.equal(JSON.parse(approved.card_data).status,'approved');
assert.ok(await core.one("SELECT id FROM messages WHERE conversation_id=? AND role='note' AND body LIKE '%Compra confirmada%'",id));
assert.ok((await core.getSetting('ceci:answered:'+id)).seq>0);
await core.forgetCeciMemory(id);assert.equal(await core.getSetting('ceci:memory:'+id),null);
// Exact reported dialogue: discover all three models before the first model round.
const inbound=await import('../lib/server/ceci-inbound.ts');
// Internal tests remain available while production is paused and WhatsApp is absent.
await core.setting('config',{...await core.config(),enabled:false});
await core.setting('ceci:manualPause',true);
await core.setting('check:ceciReply',{state:'production-sentinel'});
delete globalThis.__ceciTestEnv.ZAPI_INSTANCE_TOKEN;
const testId=crypto.randomUUID();
await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated,customer_status,customer_name) VALUES(?,?,?,'test','lojista','bot',?,'verified',?)",testId,'Validation','',''+Date.now(),'Cliente');
for(const n of [212,213,215])await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',n,raw(n).nome,raw(n).nome.toLowerCase(),'Peças',JSON.stringify(raw(n)),Date.now());
for(const body of ['oi','eu quero peças para minha loja','baterias para iphones','iphone 12, 13 e 15'])await core.addMessage(testId,'user',body);
const outgoing=sent.length;
script=[async payload=>{
  const candidates=payload.input.find(m=>m.role==='developer'&&m.content.startsWith('CANDIDATOS JÁ'));
  assert.ok(candidates);for(const n of [212,213,215])assert.ok(candidates.content.includes('"id":'+n));
  // A response slower than the former ~20s generation budget must still complete.
  await new Promise(resolve=>setTimeout(resolve,24_000));
  return ['consultar_opcoes',{productIds:[212,213,215],exibirCards:true}];
},finish('Encontrei estas baterias.','Quantas de cada modelo você precisa?')];
assert.equal(await inbound.processCeci(testId,{foreground:true}),true);
assert.equal(script.length,0);assert.equal(sent.length,outgoing);
assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',testId)).status,'bot');
const batteryReply=await core.one("SELECT card_data FROM messages WHERE conversation_id=? AND role='assistant' ORDER BY rowid DESC LIMIT 1",testId);
assert.equal(JSON.parse(batteryReply.card_data).items.length,3);
// Interrupted after live consultation: retain progress and resume without losing the order.
await core.addMessage(testId,'user','Duas baterias do 12');
script=[['consultar_e_orcar',{itens:[{productId:212,quantity:2}]}],()=>{throw new Error('CECI_MODEL_TEMPORARY');}];
assert.equal(await inbound.processCeci(testId,{foreground:true}),false);
assert.equal(await inbound.canResumeCeciValidation(testId),true);
assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',testId)).status,'bot');
const progress=await core.getSetting('ceci:progress:'+testId);assert.equal(progress.value.draft.lines[0].quantity,2);
progress.value.checkedAt=Date.now()-60_000;await core.setting('ceci:progress:'+testId,progress);
const readsBefore=liveReads.length;
script=[payload=>{assert.ok(payload.input.some(m=>m.type==='function_call_output'));return finish('Separei as duas baterias no orçamento.');}];
assert.equal(await inbound.resumeCeciValidation(testId),true);
assert.equal(liveReads.length,readsBefore+1);assert.equal(liveReads.at(-1),212);
assert.equal(await core.getSetting('ceci:progress:'+testId),null);assert.equal(await core.getSetting('ceci:retry:'+testId),null);
assert.equal(sent.length,outgoing);
// A broad price inquiry lists every exact-model SKU, not the first three or a nearby Pro model.
const catalogId=crypto.randomUUID();
await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated,customer_status,customer_name) VALUES(?,?,?,'test','lojista','bot',?,'verified',?)",catalogId,'Catalog','',''+Date.now(),'Cliente');
for(const n of [...Array.from({length:13},(_,i)=>1000+i),2000,2001])await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',n,raw(n).nome,raw(n).nome.toLowerCase(),'Peças',JSON.stringify(raw(n)),Date.now());
await core.addMessage(catalogId,'user','Sou lojista. Quero saber os valores de todas as telas para iPhone 12');
script=[payload=>{
 assert.ok(payload.input.some(message=>message.role==='developer'&&message.content.startsWith('LISTA COMPLETA CONSULTADA')));
 return finish('Encontrei as telas deste modelo.','Qual versão e quantidade você quer incluir?');
}];
const allOptions=await core.chatReply(catalogId);assert.equal(allOptions.parts.length,2);
assert.deepEqual(allOptions.parts.map(part=>part.card.items.length),[8,5]);
assert.equal(allOptions.parts.flatMap(part=>part.card.items).length,13);
assert.ok(allOptions.parts.every(part=>part.body.length<4000));
assert.ok(allOptions.parts.flatMap(part=>part.card.items).every(item=>item.productId<2000));
assert.deepEqual(allOptions.parts.flatMap(part=>part.card.items).filter(item=>item.status!=='available').map(item=>item.status).sort(),['unavailable','unconfirmed']);
assert.equal(liveReads.filter(n=>n>=1000&&n<1100).length,13);
await core.publishCeciReply(catalogId,allOptions);
assert.equal((await core.all("SELECT id FROM messages WHERE conversation_id=? AND role='assistant'",catalogId)).length,2);
assert.equal((await core.getSetting('ceci:memory:'+catalogId)).lastOptions.length,13);
assert.equal(sent.length,outgoing);
// Screenshot regression: the customer supplied model, piece and shop profile in separate turns.
const fragmentedId=crypto.randomUUID();
await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated,customer_status,customer_name) VALUES(?,?,?,'test','nao_identificado','bot',?,'not_found','')",fragmentedId,'Fragmented','',Date.now());
let shopEvidence='';
for(const [role,body] of [['user','iPhone 12'],['assistant','Qual peça você precisa para o iPhone 12?'],['user','tela'],['assistant','A compra da tela é para loja/assistência ou para uso próprio?'],['user','loja']])shopEvidence=await core.addMessage(fragmentedId,role,body);
script=[['definir_perfil',{perfil:'lojista',mensagemId:shopEvidence}],payload=>{
 assert.equal(JSON.parse(payload.input.at(-1).output).profile,'lojista');
 assert.ok(payload.input.some(message=>message.role==='developer'&&message.content.startsWith('LISTA COMPLETA CONSULTADA')));
 assert.match(payload.instructions,/perfil comercial: lojista/);
 return finish('Encontrei as telas para o iPhone 12.','Qual opção você prefere?');
}];
const fragmentedReply=await core.chatReply(fragmentedId);
assert.equal(fragmentedReply.parts.flatMap(part=>part.card.items).length,13);
await core.publishCeciReply(fragmentedId,fragmentedReply);
assert.equal((await core.one('SELECT profile,status FROM conversations WHERE id=?',fragmentedId)).profile,'lojista');
assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',fragmentedId)).status,'bot');
// Legacy technical handoff can resume; a commercial handoff or agent response cannot.
await core.run("UPDATE conversations SET status='human' WHERE id=?",testId);
await core.addMessage(testId,'note','A Ceci não concluiu a resposta automática. timeout');
assert.equal(await inbound.canResumeCeciValidation(testId),true);
await core.addMessage(testId,'agent','Estou cuidando deste atendimento.');
assert.equal(await inbound.canResumeCeciValidation(testId),false);
assert.equal(await inbound.canResumeCeciValidation(id),false);
// Failed generation reports quota accurately and preserves isolation.
const quotaId=crypto.randomUUID();
await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,?,?,'test','nao_identificado','bot',?)",quotaId,'Quota','',Date.now());
await core.addMessage(quotaId,'user','Olá');modelStatus=429;modelCode='insufficient_quota';
assert.equal(await inbound.processCeci(quotaId,{foreground:true}),false);
assert.equal((await core.getSetting('ceci:retry:'+quotaId)).reason,'CECI_MODEL_QUOTA');
assert.equal((await core.getSetting('check:ceciReply')).state,'production-sentinel');
assert.equal((await core.config()).enabled,false);
assert.equal(await core.getSetting('ceci:manualPause'),true);
assert.equal(sent.length,outgoing);
modelStatus=0;globalThis.__ceciTestEnv.ZAPI_INSTANCE_TOKEN='fixture-only';
// Automatic activation respects explicit pauses and live prerequisites.
const {signature}=await import('../lib/server/integrations.ts');
const zapi=await import('../lib/server/zapi.ts');await zapi.setup();
const cfg=await core.config();cfg.enabled=false;
await core.setting('config',cfg);
await core.setting('check:whatsappWeb',{provider:'zapi',instanceId:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',connected:true});
await core.setting('ceci:manualPause',true);
assert.equal(await inbound.activateCeciForInbound(cfg),false);
await core.setting('ceci:manualPause',false);
assert.equal(await inbound.activateCeciForInbound(cfg),true,'first-message and old test badges cannot block a configured connected agent');
await core.setting('erpCheck',{at:Date.now()});
await core.setting('sync',{complete:true});
await core.setting('check:whatsappWebReceived',{provider:'zapi',instanceId:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',at:Date.now()});
for(const service of ['openai','internal'])await core.setting('check:'+service,{ok:true,fingerprint:await signature(service,cfg)});
assert.equal(await inbound.activateCeciForInbound(cfg),true);
assert.equal((await core.config()).enabled,true);
sqlite.close();
console.log('PASS: production core, exact prices, memory, quotes, handoff, 24s model response, three-model discovery, resumable failure, refreshed pricing and no real sends in validation');
