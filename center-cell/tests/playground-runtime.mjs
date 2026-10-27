/** Runs the production core against an isolated SQLite D1 adapter and mocked HTTP services. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(specifier,context,next){
 if(specifier==='next/headers')return {url:'data:text/javascript,export const headers=async()=>new Headers();',shortCircuit:true};
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
 async all(){if(globalThis.__automaticReadFailure&&this.sql.includes('SELECT value FROM settings WHERE key >=')&&String(this.args[0]).startsWith('playground:autoEvidence:')&&sqlite.prepare('SELECT COUNT(*) AS n FROM settings WHERE key>=? AND key<?').get(this.args[0],this.args[1]).n>0){globalThis.__automaticReadFailure=false;throw new Error('D1_ERROR: fixture reporting failure');}return {results:sqlite.prepare(this.sql).all(...this.args)};}
 async first(){if(globalThis.__automaticReadFailure&&this.sql==='SELECT value FROM settings WHERE key=?'&&String(this.args[0]).startsWith('playground:meter:')&&sqlite.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'playground:autoEvidence:%'").get().n>0){globalThis.__automaticReadFailure=false;throw new Error('D1_ERROR: fixture reporting failure');}return sqlite.prepare(this.sql).get(...this.args)||null;}
 async run(){return {meta:{changes:Number(sqlite.prepare(this.sql).run(...this.args).changes)}};}
}
const DB={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.__ceciTestEnv={DB,OPENAI_API_KEY:'fixture-only',MERCADOPHONE_API_KEY:'fixture-only',UAZAPI_INSTANCE_TOKEN:'fixture-only'};
let outbound=0,modelFailure=false,clientTurn=0;
const products=[{id:1000,nome:'TELA IPHONE 12 INCELL',quantidade:40,valorVenda:100,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1},{id:1001,nome:'TELA IPHONE 12 OLED',quantidade:40,valorVenda:150,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1}];
const output=(value)=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50}});
globalThis.fetch=async(input,init)=>{const url=new URL(String(input));
 if(url.hostname==='api.openai.com'){
  const p=JSON.parse(init.body);
  if(modelFailure)return Response.json({error:{code:'insufficient_quota'}},{status:429});
  if(p.instructions.includes('na continuação com uma atendente humana')){const phase=JSON.parse(p.input).phase;return output({message:phase==='delivery'?'Vou retirar na loja.':phase==='payment'?'Prefiro Pix.':'Pode concluir assim, sim.'});}
 if(p.instructions.startsWith('Você representa')){clientTurn++;return output({message:clientTurn===1?'Quero duas unidades do código 1000.':'Pode fechar, quero comprar.',done:false,expectedProductId:clientTurn===1?1000:null,expectedQuantity:clientTurn===1?2:null});}
  if(p.instructions.startsWith('Você avalia')){const log=JSON.parse(p.input).messages;return output({result:'pass',summary:'Atendimento claro e contextual.',findings:[{criterion:'naturalidade',result:'pass',detail:'A resposta atende a solicitação.',messageIds:[log.filter(m=>m.role==='assistant').at(-1).id]}]});}
  const messages=p.input.filter(m=>m.role==='user');const last=JSON.parse(messages.at(-1).content);
  let name='responder_cliente',args={texto:'Separei as opções para você.',proximoPasso:'Qual você prefere?',contexto:{fatos:[],pendencia:'',proximaAcao:''}};
  const tools=p.input.filter(m=>m.type==='function_call');
  if(/duas unidades do código/.test(last.texto)&&!tools.some(t=>t.name==='consultar_e_orcar')){name='consultar_e_orcar';args={itens:[{productId:1000,quantity:2}]};}
  else if(/duas unidades do código/.test(last.texto)){args.texto='Aqui está seu orçamento.';args.proximoPasso='Quer prosseguir com a compra?';}
  else if(/Pode fechar/.test(last.texto)){const dev=JSON.parse(p.input[0].content.split('\n').at(-1));name='encaminhar_humano';args={motivo:'compra_confirmada',resumo:'Cliente quer comprar duas telas iPhone 12.',mensagem:'Vou chamar a equipe para concluir.',orcamentoId:dev.orcamentoVigente,mensagemId:last.mensagemId,contexto:{fatos:[],pendencia:'',proximaAcao:''}};}
  return Response.json({output:[{type:'function_call',name,call_id:crypto.randomUUID(),arguments:JSON.stringify(args)}],usage:{input_tokens:100,output_tokens:50}});
 }
 if(url.hostname==='platform.mercadophone.tech'){
  if(url.pathname.endsWith('/stores'))return Response.json({stores:[{system_unit_id:4046,name:'Fixture Store'}]});
  if(url.pathname.endsWith('/inventory')){const id=Number(url.searchParams.get('codigoProduto'));return Response.json({items:products.filter(p=>p.id===id),total:1,page:1,limit:100});}
 }
 if(url.hostname==='free.uazapi.com'){outbound++;throw new Error('PRODUCTION SEND FORBIDDEN');}
 throw new Error('Unexpected HTTP '+url.href);
};
const core=await import('../lib/server/core.ts');
const runner=await import('../lib/server/playground-automatic.ts');
await core.setting('config',{...core.defaults,enabled:false,instructions:'TOM CONFIGURADO DE TESTE'});
await core.setting('ceci:manualPause',true);
for(const p of products)await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',p.id,p.nome,p.nome.toLowerCase(),'Peças',JSON.stringify(p),Date.now());
const owner='fixture-admin',args=(scenarios)=>({id:crypto.randomUUID(),scenarios,maxTurns:12,maxMinutes:15,maxTokens:100000,inputRate:1,outputRate:2});
async function drain(id){for(let n=0;n<32;n++){if((await runner.automaticControl(id)).state!=='running')return;await runner.tickAutomatic(id,owner);}throw new Error('runner did not finish');}
// Reproduce the production symptom: preflight succeeds but the reporting read fails.
const recovery=await runner.startAutomatic(owner,args(['catalog']));globalThis.__automaticReadFailure=true;await runner.tickAutomatic(recovery.id,owner);const recovered=await runner.getAutomatic(recovery.id);assert.equal(recovered.phase,'client');assert.equal(recovered.reportingError,'AUTO_STORAGE_ERROR');assert.equal(await core.getSetting('playground:autoLease:'+recovery.id),null);const recoveredConversation=recovered.cases[0].conversationId;await runner.tickAutomatic(recovery.id,owner);assert.equal((await runner.getAutomatic(recovery.id)).cases[0].conversationId,recoveredConversation);await runner.controlAutomatic(recovery.id,owner,'stop');
console.log('PASS recovery: a reporting failure cannot erase the checkpoint, retain the lease or duplicate the conversation');
const first=await runner.startAutomatic(owner,args(['catalog']));
await assert.rejects(runner.startAutomatic(owner,args(['quote'])),/AUTO_BUSY/);
await runner.tickAutomatic(first.id,owner);
const restored=await runner.automaticDetail(first.id,owner);assert.ok(restored.cases[0].conversationId);assert.equal(restored.phase,'client');
await runner.controlAutomatic(first.id,owner,'pause');await runner.tickAutomatic(first.id,owner);assert.equal((await runner.getAutomatic(first.id)).cases[0].turns,0);
await runner.controlAutomatic(first.id,owner,'resume');await drain(first.id);
let detail=await runner.automaticDetail(first.id,owner);assert.equal(detail.state,'completed');assert.equal(detail.cases[0].result,'passed',JSON.stringify(detail.cases[0]));assert.equal(detail.usage.input,200);assert.ok(detail.estimatedCostUsd>0);
assert.equal(await runner.automaticDetail(first.id,'other-admin'),null);
const second=await runner.startAutomatic(owner,args(['quote']));clientTurn=0;await drain(second.id);detail=await runner.automaticDetail(second.id,owner);
assert.equal(detail.cases[0].result,'passed',JSON.stringify(detail.cases[0]));assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,0);assert.equal(outbound,0);assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
const exported=await runner.exportAutomatic(second.id,owner);assert.ok(exported.cases[0].messages.length);assert.ok(exported.cases[0].events.some(e=>e.kind==='prepare'));assert.equal(detail.messages.filter(m=>m.role==='user').length,6);assert.equal(detail.cases[0].sale.step,'completed');assert.ok(detail.messages.some(m=>m.role==='agent'));
// Sequential battery uses independent conversations and exports every transcript.
clientTurn=0;const battery=await runner.startAutomatic(owner,args(['catalog','quote']));await drain(battery.id);const batchExport=await runner.exportAutomatic(battery.id,owner);assert.equal(batchExport.state,'completed');assert.ok(batchExport.cases.every(c=>c.result==='passed'));assert.notEqual(batchExport.cases[0].conversationId,batchExport.cases[1].conversationId);assert.ok(batchExport.cases.every(c=>c.messages.length&&c.events.length));
// A concurrent request cannot advance a leased run.
const third=await runner.startAutomatic(owner,args(['catalog']));await core.setting('playground:autoLease:'+third.id,{token:'fixture',expires:Date.now()+10000});await runner.tickAutomatic(third.id,owner);assert.equal((await runner.getAutomatic(third.id)).phase,'setup');await core.run('DELETE FROM settings WHERE key=?','playground:autoLease:'+third.id);await runner.tickAutomatic(third.id,owner);await runner.controlAutomatic(third.id,owner,'takeover');assert.equal((await runner.automaticControl(third.id)).state,'takenOver');
// Configuration changes invalidate a run without activating production.
const fourth=await runner.startAutomatic(owner,args(['catalog']));await core.setting('config',{...await core.config(),instructions:'OUTRA CONFIGURAÇÃO'});await runner.tickAutomatic(fourth.id,owner);assert.equal((await runner.automaticControl(fourth.id)).state,'blocked');
// Billing failure stops a batch, rather than multiplying failing calls.
const fifth=await runner.startAutomatic(owner,args(['catalog','quote']));modelFailure=true;await drain(fifth.id);detail=await runner.automaticDetail(fifth.id,owner);assert.equal(detail.state,'blocked');assert.equal(detail.cases[0].result,'blocked');assert.equal(detail.cases[1].result,'pending');assert.equal(outbound,0);
console.log('PASS runner: real core with mocked services, catalog+quote+handoff, persistence, pause/resume, leases, isolation, takeover, config invalidation, quota classification, usage and full export');

await core.run("INSERT INTO app_users(id,role,username,email,display_name,password_hash,salt,created,updated) VALUES(?,'admin','fixture','fixture@example.test','Fixture','unused','unused',?,?)",owner,Date.now(),Date.now());
const auth=await import('../lib/server/app-auth.ts');const route=await import('../app/api/playground/route.ts');const token=await auth.createSession(owner);const headers={'Cookie':'__Host-cc_session='+token};
assert.equal((await route.GET(new Request('https://fixture.test/api/playground'))).status,403);
assert.equal((await route.GET(new Request('https://fixture.test/api/playground?id='+second.id,{headers}))).status,200);
assert.equal((await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',headers:{...headers,Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({action:'pause',id:second.id})}))).status,403);
assert.equal((await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'start',id:crypto.randomUUID(),scenarios:['bad-id']})}))).status,400);
const beforeArchive=await runner.exportAutomatic(second.id,owner);await core.addMessage(beforeArchive.cases[0].conversationId,'user','Mensagem manual posterior ao teste');const afterArchive=await runner.exportAutomatic(second.id,owner);assert.equal(beforeArchive.cases[0].messages.length,afterArchive.cases[0].messages.length);
console.log('PASS API: admin authentication, request origin, scenario validation, immutable completed transcripts');

// Exercise a complete first-contact conversation with Samsung, starting from a greeting only.
modelFailure=false;
const samsungProducts=[
 {id:2100,nome:'TELA SAMSUNG A14 4G',quantidade:40,valorVenda:180,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1},
 {id:2101,nome:'TELA SAMSUNG A14 5G',quantidade:40,valorVenda:220,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1},
 {id:2102,nome:'BATERIA SAMSUNG A15',quantidade:40,valorVenda:80,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1},
 {id:2103,nome:'CONECTOR DE CARGA MOTO G20',quantidade:40,valorVenda:25,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1},
 {id:2104,nome:'TAMPA TRASEIRA XIAOMI REDMI NOTE 12',quantidade:40,valorVenda:30,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1}
];
products.push(...samsungProducts);
for(const p of samsungProducts)await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',p.id,p.nome,p.nome.toLowerCase(),'Peças',JSON.stringify(p),Date.now());
const naturalRun=await runner.startAutomatic(owner,{...args(['first-contact']),productBrand:'Samsung',openingVariant:'oi'}),naturalScene=naturalRun.cases[0].scenarioSnapshot;let naturalProduct=naturalScene.productContext;
assert.equal(naturalProduct.brand,'Samsung');assert.equal(naturalScene.opening,'Oi');
const normalFetch=globalThis.fetch;let customerStep=0,firstAssistantSeen=false;
const naturalFetch=async(input,init)=>{
 const url=new URL(String(input));if(url.hostname!=='api.openai.com')return normalFetch(input,init);
 const p=JSON.parse(init.body);
 if(p.instructions.includes('na continuação com uma atendente humana')){const phase=JSON.parse(p.input).phase;return output({message:phase==='delivery'?'Vou retirar na loja.':phase==='payment'?'Prefiro Pix.':'Pode concluir assim, sim.'});}
 if(p.instructions.startsWith('Você representa')){
  customerStep++;
  assert.ok(p.input.includes(naturalProduct.model),'only the customer simulator knows the reserved objective');
  const parts=['Preciso de '+naturalProduct.part,naturalProduct.model,'Para minha assistência, sou lojista.','Quero duas unidades do código '+naturalProduct.exampleId+'.','Estou de acordo, pode finalizar a compra.'];
  assert.ok(parts[customerStep-1],'unexpected extra customer turn');
  return output({message:parts[customerStep-1],done:false,expectedProductId:customerStep===4?naturalProduct.exampleId:null,expectedQuantity:customerStep===4?2:null});
 }
 if(p.instructions.startsWith('Você avalia')){const log=JSON.parse(p.input).messages;return output({result:'pass',summary:'A Ceci acolheu, identificou a necessidade e conduziu ao orçamento e encaminhamento.',findings:['naturalidade','clareza','contexto','repeticao','conducao'].map(criterion=>({criterion,result:'pass',detail:'A sequência preserva as informações recebidas, com próximo passo claro.',messageIds:[log.filter(m=>m.role==='assistant').at(-1).id]}))});}
 const user=p.input.filter(m=>m.role==='user').map(m=>JSON.parse(m.content)),last=user.at(-1),calls=p.input.filter(m=>m.type==='function_call');
 let name='responder_cliente',a={texto:'Oi! Como posso te ajudar?',proximoPasso:'',contexto:{fatos:[],pendencia:'',proximaAcao:''}};
 if(last.texto==='Oi'){
  firstAssistantSeen=true;assert.equal(user.length,1);assert.ok(!p.input.some(m=>String(m.content).includes('CONTEXTO RESERVADO DO CLIENTE')));const memory=JSON.parse(p.input[0].content.split('\n').at(-1));assert.equal(memory.produtosConhecidos.length,0);
 }else if(last.texto==='Preciso de '+naturalProduct.part){a.texto='Para qual modelo você precisa?';}
 else if(last.texto===naturalProduct.model){a.texto='Você compra para sua assistência ou é para uso próprio?';}
 else if(last.texto.includes('minha assistência')){
  if(!calls.some(c=>c.name==='listar_todas_opcoes')){name='listar_todas_opcoes';a={busca:naturalProduct.query};}else{a.texto='Estas são as opções que encontrei.';a.proximoPasso='Qual delas você prefere?';}
 }else if(last.texto.startsWith('Quero duas unidades')){
  if(!calls.some(c=>c.name==='consultar_e_orcar')){name='consultar_e_orcar';a={itens:[{productId:naturalProduct.exampleId,quantity:2}]};}else{a.texto='Separei duas unidades no orçamento.';a.proximoPasso='Quer prosseguir com a compra?';}
 }else if(last.texto.startsWith('Estou de acordo')){
  assert.deepEqual(p.tools.map(t=>t.name),['encaminhar_humano']);
  // Even an invalid provider tool response cannot regenerate the accepted quote.
  if(!calls.some(c=>c.name==='consultar_e_orcar'))return Response.json({output:[{type:'function_call',name:'consultar_e_orcar',call_id:crypto.randomUUID(),arguments:JSON.stringify({itens:[{productId:naturalProduct.exampleId,quantity:2}]})}],usage:{input_tokens:100,output_tokens:50}});
  assert.equal(JSON.parse(p.input.filter(c=>c.type==='function_call_output').at(-1).output).orcamentoVigente,JSON.parse(p.input[0].content.split('\n').at(-1)).orcamentoVigente);
  const memory=JSON.parse(p.input[0].content.split('\n').at(-1));name='encaminhar_humano';a={motivo:'compra_confirmada',resumo:'Cliente lojista quer duas unidades do produto selecionado para sua assistência.',mensagem:'Vou chamar a equipe para concluir. O contexto já está organizado.',orcamentoId:memory.orcamentoVigente,mensagemId:last.mensagemId,contexto:{fatos:[],pendencia:'',proximaAcao:''}};}
 return Response.json({output:[{type:'function_call',name,call_id:crypto.randomUUID(),arguments:JSON.stringify(a)}],usage:{input_tokens:100,output_tokens:50}});
};
globalThis.fetch=naturalFetch;
await drain(naturalRun.id);const fullNatural=await runner.automaticDetail(naturalRun.id,owner);assert.equal(fullNatural.state,'completed');assert.equal(fullNatural.cases[0].result,'passed',JSON.stringify(fullNatural.cases[0]));assert.ok(firstAssistantSeen);assert.equal(fullNatural.messages.filter(m=>m.role==='user')[0].body,'Oi');assert.equal(fullNatural.cases[0].criteria.find(c=>c.id==='discovery').status,'pass');assert.equal(fullNatural.cases[0].criteria.find(c=>c.id==='opening').status,'pass');assert.equal(outbound,0);assert.equal(await core.getSetting('ceci:manualPause'),true);
assert.equal(fullNatural.messages.filter(m=>{try{return JSON.parse(m.card_data||'null')?.type==='quote';}catch{return false;}}).length,1,'acceptance must not create another quote');assert.equal(fullNatural.events.filter(e=>e.kind==='prepare').length,1);assert.equal(fullNatural.cases[0].criteria.find(c=>c.id==='quote-loop').status,'pass');
globalThis.fetch=normalFetch;
// A batch records diverse real-catalog requests without changing historical runs.
const mixed=await runner.startAutomatic(owner,args(['quote','catalog','edit','typos']));assert.ok(new Set(mixed.cases.map(c=>c.scenarioSnapshot.productContext.brand)).size>=3);assert.ok(new Set(mixed.cases.map(c=>c.scenarioSnapshot.productContext.part)).size>=2);await runner.controlAutomatic(mixed.id,owner,'stop');
const noBrand=await runner.startAutomatic(owner,{...args(['quote']),productBrand:'Realme'});await drain(noBrand.id);assert.equal((await runner.getAutomatic(noBrand.id)).cases[0].result,'unavailable');
console.log('PASS natural journey: greeting only, no hidden context leaked, Samsung discovery across separate messages, catalog, exact quote, purchase handoff, mixed-brand batch and absent-brand handling');

const {autoScenarios}=await import('../lib/playground-scenarios.ts');const allId=crypto.randomUUID();const allResponse=await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'start',id:allId,scenarios:autoScenarios.map(s=>s.id)})}));assert.equal(allResponse.status,200);assert.equal((await allResponse.json()).run.cases.length,12);await runner.controlAutomatic(allId,owner,'stop');
console.log('PASS API: all 12 scenarios accepted in one battery');
