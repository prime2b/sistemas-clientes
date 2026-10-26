import assert from 'node:assert/strict';
import {TEST_MODEL,testModels,compactAgentHistory,compactClientContext,compactTestMessage} from '../lib/playground-economy.ts';
assert.deepEqual(testModels('economic','gpt-5.6-terra'),{ceci:TEST_MODEL,client:TEST_MODEL,reviewer:TEST_MODEL});
assert.deepEqual(testModels('production','gpt-5.6-terra'),{ceci:'gpt-5.6-terra',client:TEST_MODEL,reviewer:TEST_MODEL});
const products=Array.from({length:8},(_,i)=>({productId:100+i,name:'TELA SAMSUNG A14 QUALIDADE '+i,stock:30,unitCents:10000+i,status:'available'}));
const card={type:'catalog',intro:'Estas são as opções.',closing:'Qual você prefere?',checkedAt:Date.now(),items:products,part:1,parts:1,total:8};
const longBody=card.intro+'\n'+products.map(p=>`${p.name}\nCódigo ${p.productId} · Disponibilidade: ${p.stock} unidades em estoque. Valor unitário: R$ ${(p.unitCents/100).toFixed(2)}. Dados comerciais consultados agora, sem reserva de produto.`).join('\n\n')+'\n'+card.closing;
const history=[{id:'u0',role:'user',body:'Quero telas Samsung A14 para minha assistência',created:1},{id:'list',role:'assistant',body:longBody,card_data:JSON.stringify(card),created:2},...Array.from({length:12},(_,i)=>({id:'turn-'+i,role:i%2?'assistant':'user',body:i%2?'Qual é sua preferência?':'Quero escolher com calma',created:3+i}))];
const before=JSON.stringify(history.map(m=>({id:m.id,role:m.role,body:m.body,created:m.created}))).length,client=compactClientContext(history),agent=compactAgentHistory(history);
assert.ok(JSON.stringify(client).length<before*.7);assert.ok(JSON.stringify(agent.messages.map(m=>({body:m.body}))).length<before*.7);
for(const p of products){assert.ok(JSON.stringify(client).includes(String(p.productId)));assert.ok(agent.represented.includes(p.productId));}
assert.ok(JSON.stringify(client).includes('Quero telas Samsung A14'));assert.ok(client.messages.find(m=>m.id==='list').body.includes('[2,101,'),'positions and exact IDs retained');
assert.ok(compactTestMessage(history[1],false).length<longBody.length/4);
console.log('PASS economy context: exact product IDs, order, availability, customer facts and >30% fewer characters on the large-list fixture');
// Reuse the isolated D1 adapter and already verified full agent journey.
await import('./playground-runtime.mjs');
const core=await import('../lib/server/core.ts'),{createTestPolicy,requestTestModel,testUsage,summarizeTestUsage}=await import('../lib/server/playground-meter.ts');
const productionBefore=await core.config(),pauseBefore=await core.getSetting('ceci:manualPause');
let calls=[];
globalThis.fetch=async(_url,init)=>{const p=JSON.parse(init.body);calls.push(p);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'{"message":"ok","done":false}'}]}],usage:{input_tokens:2200,output_tokens:300,input_tokens_details:{cached_tokens:100}}});};
async function conversation(mode='economic',options={}){const id=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,channel,profile,updated) VALUES(?,'Economy fixture','test','lojista',?)",id,Date.now());await core.setting('playground:policy:'+id,createTestPolicy('gpt-5.6-terra',mode,options));return id;}
const limited=await conversation('economic',{caseTokens:5000,maxTokens:5000});
const ask=(id,input,role='ceci')=>requestTestModel({id,role,key:'fixture',payload:{model:'untrusted-model',input,store:false}});
await ask(limited,'first');await ask(limited,'first');assert.equal(calls.length,1,'a completed retry is free and reuses the stored response');
await ask(limited,'second');await assert.rejects(ask(limited,'third'),/TEST_TOKEN_BUDGET/);assert.equal(calls.length,2,'budget blocks before the provider request');
const usage=await testUsage(limited);assert.equal(usage.total,5000);assert.equal(usage.cachedInput,200);assert.equal(usage.byRole.ceci.calls,2);assert.equal(usage.warning,true);assert.equal(usage.costUsd,null);
const recovery=await conversation(),beforeRecovery=calls.length,originalPrepare=core.runtime.DB.prepare;let failMetric=true;
core.runtime.DB.prepare=sql=>{const s=originalPrepare(sql),bind=s.bind;s.bind=(...values)=>{const bound=bind.call(s,...values);if(failMetric&&String(values[0]).startsWith('playground:meter:')&&String(values[1]).includes('completed'))bound.run=async()=>{failMetric=false;throw new Error('fixture metric failure');};return bound;};return s;};
try{await assert.rejects(ask(recovery,'recover'),/fixture metric failure/);await ask(recovery,'recover');assert.equal(calls.length,beforeRecovery+1);assert.equal((await testUsage(recovery)).total,2500);}finally{core.runtime.DB.prepare=originalPrepare;}
const homologation=await conversation('production');for(const role of ['ceci','client','reviewer'])await ask(homologation,role,role);
assert.deepEqual(calls.slice(-3).map(p=>p.model),['gpt-5.6-terra',TEST_MODEL,TEST_MODEL]);assert.deepEqual(calls.slice(-3).map(p=>p.max_output_tokens),[1400,320,1100]);
const legacyId=crypto.randomUUID(),legacyRun=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,channel,profile,updated) VALUES(?,'Legacy fixture','test','lojista',?)",legacyId,Date.now());await core.setting('playground:autoFor:'+legacyId,{runId:legacyRun});await core.setting('playground:auto:'+legacyRun,{id:legacyRun,snapshot:{model:'gpt-5.6-terra'},usage:{input:2200,output:300,unknown:0},limits:{maxTokens:6000},rates:{input:0,output:0}});await ask(legacyId,'continue original');assert.equal(calls.at(-1).model,'gpt-5.6-terra');assert.equal((await testUsage(legacyId)).total,5000);await assert.rejects(ask(legacyId,'would exceed'),/TEST_TOKEN_BUDGET/);
// Case and batch limits are independent and shared across participants/cases.
const batchId=crypto.randomUUID(),a=await conversation('economic',{batchId,caseTokens:10000,maxTokens:4000}),b=await conversation('economic',{batchId,caseTokens:10000,maxTokens:4000});await ask(a,'one','client');await assert.rejects(ask(b,'two','ceci'),/TEST_TOKEN_BUDGET/);
const stats=summarizeTestUsage([{role:'ceci',model:'terra',input:1000,output:100,known:true},{role:'client',model:'luna',input:1000,output:100,known:true}],createTestPolicy('terra','production',{rates:{terra:{input:2,output:8},luna:{input:1,output:4}}}));assert.ok(Math.abs(stats.costUsd-.0042)<1e-10);
const real=crypto.randomUUID();await core.run("INSERT INTO conversations(id,name,channel,profile,updated) VALUES(?,'Production fixture','whatsapp_web','lojista',?)",real,Date.now());await assert.rejects(ask(real,'not allowed'),/AUTO_TEST_CHANNEL_REQUIRED/);
let failures=0;globalThis.fetch=async()=>{failures++;return Response.json({error:{code:'model_not_found'}},{status:404});};const inaccessible=await conversation();await assert.rejects(ask(inaccessible,'blocked'),/CECI_MODEL_ACCESS/);assert.equal(failures,1,'no expensive-model fallback');
assert.deepEqual(await core.config(),productionBefore);assert.equal(await core.getSetting('ceci:manualPause'),pauseBefore);
console.log('PASS economy runtime: Luna default, Terra homologation, per-role usage and rates, cached resume, per-call case/batch budgets, 80% alert, production isolation and no model fallback');
// Manual playground creation and tool validation use the same separation, through the real API.
const auth=await import('../lib/server/app-auth.ts'),manage=await import('../app/api/manage/route.ts'),runner=await import('../lib/server/playground-automatic.ts');
await core.run("UPDATE app_users SET must_change_password=0 WHERE id='fixture-admin'");
const token=await auth.createSession('fixture-admin'),headers={Cookie:'__Host-cc_session='+token,'Content-Type':'application/json'};
const post=async body=>{const res=await manage.POST(new Request('https://fixture.test/api/manage',{method:'POST',headers,body:JSON.stringify(body)}));const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;};
const manual=await post({action:'createConversation',name:'Economia manual',profile:'lojista'}),manualPolicy=await core.getSetting('playground:policy:'+manual.id);assert.equal(manualPolicy.models.ceci,TEST_MODEL);
const productionCheck=await core.getSetting('check:openai');let probedModel;
globalThis.fetch=async(_url,init)=>{const p=JSON.parse(init.body);probedModel=p.model;assert.equal(p.tool_choice,'required');return Response.json({output:[{type:'function_call',name:'confirmar_teste',arguments:'{}'}],usage:{input_tokens:30,output_tokens:10}});};
assert.equal((await post({action:'playgroundProbe',testMode:'economic'})).ok,true);assert.equal(probedModel,TEST_MODEL);assert.deepEqual(await core.getSetting('check:openai'),productionCheck);
assert.equal((await post({action:'playgroundProbe',testMode:'production'})).ok,true);assert.equal(probedModel,productionBefore.model);
const list=(await runner.automaticList('fixture-admin')).find(j=>j.scenarioIds.includes('first-contact')&&j.state==='completed');assert.ok(list);const original=await runner.getAutomatic(list.id),retry=await runner.startAutomatic('fixture-admin',{id:crypto.randomUUID(),scenarios:['first-contact'],maxTurns:12,maxMinutes:15,maxTokens:100000,inputRate:0,outputRate:0,repeatOf:original.id,testMode:'production'});
assert.deepEqual(retry.cases[0].scenarioSnapshot,original.cases.find(c=>c.scenario==='first-contact').scenarioSnapshot);assert.equal(retry.models.ceci,productionBefore.model);assert.equal(retry.models.client,TEST_MODEL);await runner.controlAutomatic(retry.id,'fixture-admin','stop');
assert.deepEqual(await core.config(),productionBefore);assert.equal(await core.getSetting('ceci:manualPause'),pauseBefore);
console.log('PASS manual API and retry: economic default, tool-capability probe, unchanged production checks and original product/context reused for homologation');
