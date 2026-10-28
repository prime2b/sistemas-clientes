import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
registerHooks({resolve(s,c,next){if(s==='next/headers')return {url:'data:text/javascript,export const headers=async()=>new Headers()',shortCircuit:true};if(s==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__centralFixture',shortCircuit:true};if(s.startsWith('.')&&c.parentURL?.startsWith('file:')){const u=new URL(s,c.parentURL);if(!/\.[a-z]+$/i.test(u.pathname)&&existsSync(fileURLToPath(u)+'.ts'))return next(u.href+'.ts',c);}return next(s,c);}});
const sql=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
class Statement{constructor(q,args=[]){this.q=q;this.args=args;}bind(...args){return new Statement(this.q,args);}async all(){return {results:sql.prepare(this.q).all(...this.args)}}async first(){return sql.prepare(this.q).get(...this.args)||null}async run(){return {meta:{changes:Number(sql.prepare(this.q).run(...this.args).changes)}}}}
const DB={prepare:q=>new Statement(q),batch:async ss=>{sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
globalThis.__centralFixture={DB,OPENAI_API_KEY:'fixture-only',MERCADOPHONE_API_KEY:'fixture-only',ZAPI_INSTANCE_ID:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',ZAPI_INSTANCE_TOKEN:'fixture-only',ZAPI_CLIENT_TOKEN:'fixture-client-token',ZAPI_WEBHOOK_SECRET:'fixture-webhook-secret',ZAPI_WEBHOOK_URL:'https://fixture.test/api/z-api/events'};
const core=await import('../lib/server/core.ts'),runner=await import('../lib/server/playground-automatic.ts'),auth=await import('../lib/server/app-auth.ts'),api=await import('../app/api/manage/route.ts');
await core.setting('config',{...core.defaults,enabled:false,flowMode:'catalog_handoff',sharedInbox:true,catalogPricing:'lojista',handoffAssignment:'manual',instructions:'Use linguagem simples, sem emojis.'});await core.setting('ceci:manualPause',true);
const products=Array.from({length:12},(_,i)=>({id:1000+i,nome:'TELA IPHONE 12 '+['INCELL','OLED','PRETA','SEM ARO'][i%4]+' OPCAO '+i,quantidade:i===11?0:20,valorVenda:100+i,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1}));products.push({id:2000,nome:'TELA IPHONE 12 PRO OLED',quantidade:20,valorVenda:180,excluido:0,snExibirCatalogo:1,snPeca:1,produtoDisponibilidadeId:1});
for(const p of products)await core.run('INSERT INTO products(id,name,search,category,data,synced) VALUES(?,?,?,?,?,?)',p.id,p.nome,p.nome.toLowerCase(),'Peças',JSON.stringify(p),Date.now());
let naturalProduct,clientMainCalls=0,forbidModel=false,failedInventory=false,sendAttempts=0,failSecondPart=false,compoundConsent=false;
const output=v=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(v)}]}],usage:{input_tokens:100,output_tokens:50}});
globalThis.fetch=async(input,init)=>{const url=new URL(String(input));
 if(url.hostname==='platform.mercadophone.tech'){
  if(url.pathname.endsWith('/stores'))return Response.json({stores:[{system_unit_id:4046,name:'Fixture'}]});
  if(url.pathname.endsWith('/inventory')){if(failedInventory)return Response.json({error:'fixture unavailable'},{status:503});const id=Number(url.searchParams.get('codigoProduto'));return Response.json({items:products.filter(p=>p.id===id),total:1,page:1,limit:100});}
 }
 if(url.hostname==='api.z-api.io'&&url.pathname.endsWith('/send-text')){sendAttempts++;if(failSecondPart&&sendAttempts===2)return Response.json({error:'fixture send failure'},{status:503});return Response.json({id:'fixture-sent-'+sendAttempts});}
 if(url.hostname==='api.openai.com'){
  if(forbidModel)throw new Error('CECI MUST NOT RESTART AFTER HANDOFF');
  const p=JSON.parse(init.body);
  if(p.instructions.startsWith('Você avalia')){const log=JSON.parse(p.input).messages;return output({result:'pass',summary:'Consulta curta e atendimento concluído pela equipe.',findings:['naturalidade','clareza','contexto','repeticao','conducao'].map(criterion=>({criterion,result:'pass',detail:'Fluxo curto e contexto preservado.',messageIds:[log.at(-1).id]}))});}
  if(p.instructions.includes('na continuação com uma atendente humana')){
   const input=JSON.parse(p.input),phase=input.phase;let message,expectedProductId=null,expectedQuantity=null;
   if(input.manualContext&&input.manualContext.focus!=='selection'){
    const c=input.manualContext;
    if(c.focus==='closing'){const id=c.selection[0]?.productId;return output({message:id?'Confirmo o código '+id+', duas unidades. Prefiro retirar na loja e pagar por Pix.':'Certo.'});}
    return output({message:c.missing==='quote'?'Pode me enviar o orçamento para conferir?':c.missing==='quote_acceptance'?'Estou de acordo, pode finalizar a compra.':'Combinado, vou buscar na loja. Obrigada!'});
   }
   if(phase==='selection'){const list=input.messages.findLast(m=>m.body.includes('OPÇÕES '));assert.ok(list,'human customer must see catalog options');const row=JSON.parse(list.body.split(': ').at(-1)).find(r=>r[4]);expectedProductId=row[1];expectedQuantity=2;message='Quero 2 unidades do código '+row[1]+'.'+(input.manualContext?' Prefiro retirar na loja e pagar por Pix.':'');}
   else if(phase==='quote_acceptance'&&p.instructions.includes('Agora peça a alteração')){const qty=p.instructions.includes('Agora peça a alteração para 3')?3:2;const q=input.messages.findLast(m=>m.body.includes('ORÇAMENTO '));expectedProductId=JSON.parse(q.body.split('ORÇAMENTO ')[1]).items[0][0];expectedQuantity=qty;message='Pode alterar para '+qty+' unidades do código '+expectedProductId+'.';}
   else if(phase==='quote_acceptance'){const q=input.messages.findLast(m=>m.body.includes('ORÇAMENTO ')),id=JSON.parse(q.body.split('ORÇAMENTO ')[1]).items[0][0];message=compoundConsent?'Código '+id+', duas unidades. Pode finalizar a compra; prefiro retirar na loja e pagar por Pix.':'Pode finalizar a compra das 2 unidades.';}
   else if(phase==='model_query')message='Agora preciso de '+p.instructions.match(/segundo modelo (.*?), sem aceitar/)[1]+'.';
   else message=phase==='delivery'?'Vou retirar na loja.':phase==='payment'?'Prefiro Pix.':'Pode concluir assim, sim.';
   return output({message,expectedProductId,expectedQuantity});
  }
  if(p.instructions.startsWith('Você representa')){clientMainCalls++;const data=JSON.parse(p.input),last=data.messages.at(-1).body;return output({message:/modelo/i.test(last)&&!/peça/i.test(last)?'É para '+naturalProduct.model+'.':'Preciso de '+naturalProduct.part+'.',done:false});}
  const user=p.input.filter(m=>m.role==='user').map(m=>JSON.parse(m.content)).at(-1);
  assert.ok(!p.tools.some(t=>['consultar_e_orcar','definir_perfil','recuperar_orcamento'].includes(t.name)),'Ceci cannot ask commercial details or quote in short flow');
  const visible=p.input.filter(m=>m.role==='user').map(m=>JSON.parse(m.content).texto).join(' ');
  if(/defeito|garantia|ZZQ987/i.test(user.texto)){
   const missing=/ZZQ987/i.test(user.texto),calls=p.input.filter(m=>m.type==='function_call');
   if(missing&&!calls.some(t=>t.name==='buscar_catalogos'))return Response.json({output:[{type:'function_call',name:'buscar_catalogos',call_id:crypto.randomUUID(),arguments:JSON.stringify({buscas:['tela ZZQ987','display ZZQ987']})}],usage:{input_tokens:100,output_tokens:50}});
   return Response.json({output:[{type:'function_call',name:'encaminhar_humano',call_id:crypto.randomUUID(),arguments:JSON.stringify({motivo:missing?'informacao_nao_confirmada':'garantia',resumo:missing?'Modelo não localizado após buscas.':'Cliente relata defeito e solicita garantia.',mensagem:'Vou passar para a equipe continuar com você.',orcamentoId:null,mensagemId:user.mensagemId,contexto:{fatos:[],pendencia:'Equipe verificar',proximaAcao:'Atendimento humano'}})}],usage:{input_tokens:100,output_tokens:50}});
  }
  if(/iphne\s*12/i.test(user.texto))return Response.json({output:[{type:'function_call',name:'listar_todas_opcoes',call_id:crypto.randomUUID(),arguments:JSON.stringify({busca:'tela iPhone 12'+(/pro/i.test(user.texto)?' Pro':'')})}],usage:{input_tokens:100,output_tokens:50}});
  const text=/\b(?:tela|frontal|bateria)\b/i.test(visible)?'Qual é o modelo do aparelho?':'Oi! Qual peça você precisa e para qual modelo?';
  return Response.json({output:[{type:'function_call',name:'responder_cliente',call_id:crypto.randomUUID(),arguments:JSON.stringify({texto:text,proximoPasso:'',contexto:{fatos:[],pendencia:'Peça e modelo',proximaAcao:'Consultar catálogo'}})}],usage:{input_tokens:100,output_tokens:50}});
 }
 throw new Error('Network escape forbidden: '+url.hostname);
};
const owner='central-admin',args=(scenario,manual=false)=>({id:crypto.randomUUID(),scenarios:[scenario],maxTurns:12,maxMinutes:15,maxTokens:100000,caseTokens:60000,inputRate:0,outputRate:0,productBrand:'Apple',openingVariant:'oi',attendantMode:manual?'manual':'automatic'});
async function until(id,predicate){for(let i=0;i<55;i++){const j=await runner.getAutomatic(id);if(predicate(j))return j;await runner.tickAutomatic(id,owner);}throw new Error('Shared simulation stalled');}
const natural=await runner.startAutomatic(owner,args('first-contact'));naturalProduct=natural.cases[0].scenarioSnapshot.productContext;
await until(natural.id,j=>j.cases[0].result!=='pending');let detail=await runner.automaticDetail(natural.id,owner);
assert.equal(detail.cases[0].result,'passed',JSON.stringify(detail.cases[0]));assert.equal(detail.cases[0].sale.step,'completed');assert.equal(detail.messages.filter(m=>m.role==='user')[0].body,'Oi');
const receipt=detail.messages.findIndex(m=>m.role==='note'&&m.body.startsWith('Encaminhamento automático: Produtos listados'));
assert.ok(receipt>0);assert.ok(!detail.messages.slice(0,receipt).some(m=>{try{return JSON.parse(m.card_data).type==='quote'}catch{return false}}));assert.ok(detail.messages.slice(receipt+1).filter(m=>m.card_data).every(m=>m.role==='agent'));assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,0);assert.equal(clientMainCalls,2);
console.log('PASS shared natural: greeting → piece/model → all options → shared queue → claim → choice/quantity → human quote → consent → delivery/payment → final confirmation → simulated sale');
assert.equal((await core.getSetting('check:playgroundInternal')).ok,true);assert.equal((await core.getSetting('check:playgroundInternal')).source,'playground');assert.equal((await core.getSetting('check:playgroundModel:gpt-5.6-luna')).responseValidated,true);assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
console.log('PASS completed automatic run records current Ceci/OpenAI validation from its batch meter without changing production activation');
for(const scenario of ['edit','models','catalog','handoff-wait','quote','fragments','selection','typos','natural','complaint','missing']){const j=await runner.startAutomatic(owner,args(scenario));naturalProduct=j.cases[0].scenarioSnapshot.productContext;await until(j.id,j=>j.cases[0].result!=='pending');const d=await runner.automaticDetail(j.id,owner);assert.equal(d.cases[0].result,'passed',JSON.stringify(d.cases[0]));if(scenario==='edit')assert.equal(d.cases[0].sale.quoteVersions,3);}
console.log('PASS focused routines: edit 2→3→2, second model, complete catalog and unavailable-team queue');
compoundConsent=true;const compoundRun=await runner.startAutomatic(owner,args('first-contact'));naturalProduct=compoundRun.cases[0].scenarioSnapshot.productContext;await until(compoundRun.id,j=>j.cases[0].result!=='pending');const compoundDetail=await runner.automaticDetail(compoundRun.id,owner);assert.equal(compoundDetail.cases[0].result,'passed',JSON.stringify(compoundDetail.cases[0]));assert.equal(compoundDetail.cases[0].sale.step,'completed');assert.ok(compoundDetail.messages.every(m=>m.body.trim()),'no empty messages may be persisted');assert.equal(compoundDetail.messages.filter(m=>m.body.startsWith('Código ')).length,1,'compound purchase consent is sent once');assert.equal(compoundDetail.cases[0].sale.quoteVersions,1);compoundConsent=false;
console.log('PASS screenshot regression: SKU + two units + consent + pickup/Pix advances once to final confirmation and completes with one quote and no empty replies');
const recoveryId=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,'Recovery fixture','','test','lojista','human',?)",recoveryId,Date.now());
const recoverySale={...structuredClone(compoundDetail.cases[0].sale),step:'quote_acceptance',consentMessageId:'',confirmationMessageId:'',delivery:'',payment:'',quoteMessageId:'recovery-quote',pendingCustomer:'recovery-empty',lastCustomerStep:undefined};
recoverySale.quote.status='awaiting';const compoundBody=compoundDetail.messages.find(m=>m.body.startsWith('Código ')).body;
await core.addMessage(recoveryId,'agent','Aqui está o orçamento. Posso seguir com a compra?','saved','recovery-quote',recoverySale.quote);await core.addMessage(recoveryId,'user',compoundBody,'saved','sale-client-recovery-prior');await core.addMessage(recoveryId,'agent','','saved','recovery-empty');
const recoveredCurrent={conversationId:recoveryId,sale:recoverySale};const recoveredLog=await core.all('SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid',recoveryId);const salesRunner=await import('../lib/server/playground-sales-runner.ts');
await salesRunner.tickSimulatedSale({},recoveredCurrent,recoveredLog,async()=>{throw new Error('Recovery must not spend another model call')});assert.equal(recoverySale.step,'confirmation');assert.equal(recoverySale.consentMessageId,'sale-client-recovery-prior');assert.equal((await core.one('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=?',recoveryId)).n,3,'recovery advances existing consent without resending it');
recoverySale.step='selection';recoverySale.pendingCustomer='recovery-empty';recoverySale.lastCustomerStep='selection';await assert.rejects(salesRunner.tickSimulatedSale({},recoveredCurrent,recoveredLog,async()=>({message:compoundBody})),/AUTO_SALE_REPEATED_REPLY/);assert.equal((await core.one('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=?',recoveryId)).n,3,'unchanged repeated reply is rejected before any extra bubble');
console.log('PASS recovery: existing consent resumes without another model call or duplicate; same-step repeated customer reply is rejected before persistence');


const manual=await runner.startAutomatic(owner,args('quote',true));await until(manual.id,j=>!!j.cases[0].sale);let j=await runner.getAutomatic(manual.id),sale=j.cases[0].sale;assert.equal(sale.step,'claim');assert.equal(sale.assignedSlot,null);
await runner.tickAutomatic(manual.id,owner);assert.equal((await runner.getAutomatic(manual.id)).cases[0].sale.revision,sale.revision);
await runner.automaticAttendantAction(manual.id,owner,{operation:'assume',slot:2,revision:sale.revision});j=await runner.getAutomatic(manual.id);assert.equal(j.cases[0].sale.assignedSlot,2);await assert.rejects(runner.automaticAttendantAction(manual.id,owner,{operation:'assume',slot:1,revision:sale.revision}),/STALE|WRONG/);await runner.controlAutomatic(manual.id,owner,'stop');
console.log('PASS manual central: operator chooses an identity, claims one shared conversation, waits without spend and rejects a second claimant');
// Production operation access tests use an internal fixture channel; no WhatsApp/provider send is allowed.
await core.run('DELETE FROM app_sessions');await core.run('DELETE FROM app_users');const users=[];
for(let i=0;i<4;i++){const id=i===0?owner:'central-attendant-'+i;await core.run('INSERT INTO app_users(id,role,slot,username,email,display_name,password_hash,salt,created,updated,must_change_password) VALUES(?,?,?,?,?,?,?,?,?,?,0)',id,i===0?'admin':'attendant',i||null,'central-'+i,'central-'+i+'@example.test',i?'Pessoa '+i:'Admin','unused','unused',Date.now(),Date.now());users.push({id,token:await auth.createSession(id)});}
const conversationId=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated) VALUES(?,'Cliente fixture','','internal_fixture','lojista','human',?)",conversationId,Date.now());
await core.addMessage(conversationId,'user','Primeira mensagem','saved','fixture-inbound-1');await core.addMessage(conversationId,'user','Segunda mensagem','saved','fixture-inbound-2');
async function post(i,body,origin='https://fixture.test'){return api.POST(new Request('https://fixture.test/api/manage',{method:'POST',headers:{Cookie:'__Host-cc_session='+users[i].token,'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));}
async function get(i,query=''){const r=await api.GET(new Request('https://fixture.test/api/manage'+query,{headers:{Cookie:'__Host-cc_session='+users[i].token}}));return {status:r.status,data:await r.json()};}
let visible=await get(1);assert.equal(visible.status,200);assert.equal(visible.data.conversations[0].unreadCount,2);assert.ok(!('secrets' in visible.data));assert.ok(!('instructions' in visible.data.config));assert.equal((await get(1,'?playground=1')).status,403);
assert.equal((await post(1,{action:'config',config:{}})).status,403);assert.equal((await post(1,{action:'claimConversation',id:conversationId},'https://attacker.test')).status,403);
const claims=await Promise.all([post(1,{action:'claimConversation',id:conversationId}),post(2,{action:'claimConversation',id:conversationId})]);assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);const winner=claims[0].status===200?1:2,other=winner===1?2:1;
assert.equal((await post(other,{action:'message',id:conversationId,role:'agent',body:'Não pode enviar'})).status,409);assert.equal((await post(winner,{action:'message',id:conversationId,role:'agent',body:'Olá, já estou com o contexto.'})).status,200);
await post(winner,{action:'readConversation',id:conversationId,unread:false,messageId:'fixture-inbound-1'});assert.equal((await get(winner)).data.conversations[0].unreadCount,1);assert.equal((await get(other)).data.conversations[0].unreadCount,2);
await post(winner,{action:'readConversation',id:conversationId,unread:false,messageId:'fixture-inbound-2'});await core.addMessage(conversationId,'user','Chegou depois da leitura','saved','fixture-inbound-3');assert.equal((await get(winner)).data.conversations[0].unreadCount,1);
await post(winner,{action:'readConversation',id:conversationId,unread:true});assert.equal((await get(winner)).data.conversations[0].forcedUnread,1);
assert.equal((await post(other,{action:'quote',conversationId,profile:'lojista',items:[{productId:1000,quantity:2}]})).status,409);
const qr=await post(winner,{action:'quote',conversationId,profile:'lojista',items:[{productId:1000,quantity:2}]});assert.equal(qr.status,200);const q=await qr.json();assert.equal((await post(winner,{action:'sendQuote',conversationId,quoteId:q.id})).status,200);assert.equal((await post(winner,{action:'sendQuote',conversationId,quoteId:q.id})).status,409);
await post(winner,{action:'assignConversation',id:conversationId,assigned:'Atendente 3'});assert.equal((await post(winner,{action:'message',id:conversationId,role:'agent',body:'Não sou mais responsável'})).status,409);assert.equal((await get(3)).data.conversations[0].isMine,true);
const {shouldRestartWithCeci}=await import('../lib/server/ceci-policy.ts');assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,false,true),false);assert.equal(shouldRestartWithCeci({status:'closed',assigned:''},true,true,false,true),false);
assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
console.log('PASS central operations: individual login, shared visibility, admin isolation, origin, atomic claim, ownership, per-user read cursors, late messages, mark unread, human quote/send, duplicate guard, transfer and no bot restart');

// A multi-part list is not handed off if a part fails; a retry does not resend saved parts.
const multipart=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,phone,channel,profile,status,updated,customer_status,customer_checked_at) VALUES(?,'Cliente multipart','5517999990000','whatsapp_web','lojista','bot',?,'not_found',?)",multipart,Date.now(),Date.now());await core.addMessage(multipart,'user','Preciso de tela iPhone 12.');
const reply=await core.chatReply(multipart);assert.ok(reply.parts.length>=2);failSecondPart=true;await assert.rejects(core.publishCeciReply(multipart,reply),/Z-API/);assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',multipart)).status,'bot');assert.equal((await core.one("SELECT COUNT(*) AS n FROM messages WHERE conversation_id=? AND role='note' AND body LIKE 'Encaminhamento%'",multipart)).n,0);
await core.publishCeciReply(multipart,reply);assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',multipart)).status,'human');assert.equal((await core.one('SELECT assigned_user_id FROM conversations WHERE id=?',multipart)).assigned_user_id,'');assert.equal(sendAttempts,reply.parts.length+1);forbidModel=true;assert.equal(await core.chatReply(multipart),undefined);forbidModel=false;
console.log('PASS multipart handoff: every card is persisted/sent before transfer, failed part retains bot state, saved parts are not resent, queue stays unassigned and Ceci stays stopped');
if(process.env.CENTRAL_COMPILED==='1'){
 compoundConsent=true;
 const files=readdirSync(new URL('../dist/server/_next/static/',import.meta.url)),name=files.find(f=>f.endsWith('.js')&&readFileSync(new URL('../dist/server/_next/static/'+f,import.meta.url),'utf8').includes('A etapa foi interrompida. O progresso salvo será retomado.'));
 assert.ok(name);assert.ok(readFileSync(new URL('../dist/server/_next/static/'+name,import.meta.url),'utf8').includes('AUTO_SALE_REPEATED_REPLY'),'compiled handler must contain the current loop protection');const route=await import(new URL('../dist/server/_next/static/'+name,import.meta.url));
 async function compiledPost(body){const r=await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',headers:{Cookie:'__Host-cc_session='+users[0].token,'Content-Type':'application/json',Origin:'https://fixture.test'},body:JSON.stringify(body)}));const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d;}
 const id=crypto.randomUUID(),start=await compiledPost({action:'start',...args('first-contact'),id});naturalProduct=start.run.cases[0].scenarioSnapshot.productContext;
 let done;for(let n=0;n<55;n++){const d=await compiledPost({action:'tick',id});if(d.run.state==='completed'){done=d.run;break;}}
 assert.ok(done);assert.equal(done.cases[0].result,'passed',JSON.stringify(done.cases[0]));assert.equal(done.cases[0].sale.step,'completed');assert.ok(done.cases[0].sale.shared);assert.ok(done.cases[0].criteria.filter(c=>c.critical).every(c=>['pass','na'].includes(c.status)));
 console.log('PASS compiled production handler: shared natural conversation from greeting through catalog, shared claim, human quote, consent and completed sale');
 const manualId=crypto.randomUUID(),manualStart=await compiledPost({action:'start',...args('quote',true),id:manualId});naturalProduct=manualStart.run.cases[0].scenarioSnapshot.productContext;
 let manualRun=manualStart.run;for(let n=0;n<30&&!manualRun.cases[0].sale;n++)manualRun=(await compiledPost({action:'tick',id:manualId})).run;assert.ok(manualRun.cases[0].sale);
 async function manualAction(operation,body){manualRun=(await compiledPost({action:'attendant',id:manualId,operation,slot:1,revision:manualRun.cases[0].sale.revision,...(body?{body}:{})})).run;}
 async function manualTick(){manualRun=(await compiledPost({action:'tick',id:manualId})).run;}
 await manualAction('assume');await manualAction('reply','conseguiu escolher qual deseja?');await manualTick();assert.equal(manualRun.cases[0].sale.step,'quote');
 await manualAction('reply','perfeito, já vou deixar separado aqui para vc vir buscar..');await manualTick();assert.equal(manualRun.cases[0].sale.step,'quote');assert.match(manualRun.messages.at(-1).body,/orçamento/);
 await manualAction('quote');await manualTick();assert.equal(manualRun.cases[0].sale.step,'confirmation');
 await manualAction('reply','perfeito, entendido, já separei as 2 unidades do produto escolhido, pode vir buscar');await manualTick();assert.equal(manualRun.cases[0].sale.step,'ready');
 await manualAction('complete');await manualTick();assert.equal(manualRun.state,'completed');assert.equal(manualRun.cases[0].result,'passed',JSON.stringify(manualRun.cases[0]));assert.equal(manualRun.cases[0].sale.quoteVersions,1);assert.equal(manualRun.cases[0].sale.step,'completed');
 console.log('PASS compiled manual handler: custom operator messages from the screenshots, contextual customer, required quote, natural thanks and explicit sale completion');
}
