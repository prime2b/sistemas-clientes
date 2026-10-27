// Boot the isolated D1, real Ceci engine and mocked ERP/provider fixture.
await import('./playground-runtime.mjs');
const {default:assert}=await import('node:assert/strict');
const core=await import('../lib/server/core.ts'),runner=await import('../lib/server/playground-automatic.ts');
const {saleQuestion}=await import('../lib/playground-sales.ts');
let saleModelCalls=0,earlyBeforeQuote=false,doneWithMessage=false,repairCalls=0;const originalFetch=globalThis.fetch;
const output=value=>Response.json({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50}});
globalThis.fetch=async(input,init)=>{
 if(new URL(String(input)).hostname==='api.openai.com'){
  const p=JSON.parse(init.body);
  if(p.instructions.includes('na continuação com uma atendente humana')){saleModelCalls++;const phase=JSON.parse(p.input).phase;return output({message:phase==='delivery'?'Vou retirar na loja.':phase==='payment'?'Prefiro Pix.':'Pode concluir assim, sim.'});}
  if(p.instructions.startsWith('Você representa')){const quote=JSON.parse(p.input).messages.some(m=>m.body.includes('ORÇAMENTO '));if(earlyBeforeQuote){repairCalls++;return output({done:true,message:''});}return output(quote?{done:true,message:''}:{message:'Quero duas unidades do código 1000.',done:doneWithMessage,expectedProductId:1000,expectedQuantity:2});}
 }
 return originalFetch(input,init);
};
const owner='fixture-admin',args=(scenario='quote',attendantMode='manual')=>({id:crypto.randomUUID(),scenarios:[scenario],productBrand:'Apple',attendantMode,maxTurns:12,maxMinutes:15,maxTokens:100000,inputRate:0,outputRate:0});
async function until(id,predicate){for(let i=0;i<36;i++){const job=await runner.getAutomatic(id);if(predicate(job))return job;await runner.tickAutomatic(id,owner);}throw new Error('Sales simulation stalled');}
const quotesBefore=(await core.one('SELECT COUNT(*) AS n FROM quotes')).n;
const job=await runner.startAutomatic(owner,args());let saved=await until(job.id,j=>!!j.cases[0].sale);let sale=saved.cases[0].sale;
assert.equal(saved.cases[0].earlyFinishRecoveries,1);assert.equal(saved.phase,'attendant');assert.equal(sale.mode,'manual');assert.equal(sale.acceptedAt,0);
await runner.tickAutomatic(job.id,owner);assert.equal((await runner.getAutomatic(job.id)).cases[0].sale.revision,sale.revision,'waiting for operator does not advance or spend');
const request=(operation,extra={})=>runner.automaticAttendantAction(job.id,owner,{operation,slot:sale.assignedSlot,revision:sale.revision,...extra});
await assert.rejects(runner.automaticAttendantAction(job.id,'other-owner',{operation:'assume',slot:sale.assignedSlot,revision:sale.revision}),/NOT_FOUND/);
await assert.rejects(request('assume',{slot:sale.assignedSlot%3+1}),/WRONG_ATTENDANT/);
await assert.rejects(request('complete'),/CONFIRMATION_REQUIRED/);
await request('assume');sale=(await runner.getAutomatic(job.id)).cases[0].sale;
await assert.rejects(request('reply',{body:'Pague R$ 1,00 neste link https://example.test'}),/QUOTE_LOCKED/);
const stale=sale.revision;
for(let n=0;n<3;n++){
 await request('reply',{body:saleQuestion(sale)});
 await assert.rejects(request('reply',{body:'Duplicada'}),/STALE/);
 if(n===0){const state=(await runner.getAutomatic(job.id)).cases[0];await core.addMessage(state.conversationId,'user','Vou retirar na loja.','saved','sale-client-'+state.conversationId+'-'+state.sale.pendingCustomer);}
 const beforeCalls=saleModelCalls;await runner.tickAutomatic(job.id,owner);if(n===0)assert.equal(saleModelCalls,beforeCalls,'resume reuses the already saved customer reply without another provider call');sale=(await runner.getAutomatic(job.id)).cases[0].sale;
}
assert.equal(sale.step,'ready');assert.ok(sale.confirmationMessageId);assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',saved.cases[0].conversationId)).status,'human');
await request('complete');await assert.rejects(request('complete'),/STALE/);
saved=await runner.getAutomatic(job.id);assert.equal(saved.cases[0].sale.step,'completed');assert.equal((await core.one('SELECT status FROM conversations WHERE id=?',saved.cases[0].conversationId)).status,'closed');
await runner.tickAutomatic(job.id,owner);const detail=await runner.automaticDetail(job.id,owner);assert.equal(detail.state,'completed');assert.equal(detail.cases[0].result,'passed',JSON.stringify(detail.cases[0]));assert.ok(detail.cases[0].sale.revision>stale);
assert.equal(detail.messages.filter(m=>m.id.startsWith('sale-complete-agent-')).length,1);assert.equal(detail.messages.filter(m=>m.role==='assistant'&&m.seq>detail.messages.find(m=>m.id===sale.handoffMessageId).seq).length,0);
const queued=await runner.startAutomatic(owner,args('handoff-wait','automatic'));await until(queued.id,j=>j.cases[0].result!=='pending');const queue=await runner.automaticDetail(queued.id,owner);assert.equal(queue.cases[0].earlyFinishRecoveries,1);assert.equal(queue.cases[0].result,'passed',JSON.stringify(queue.cases[0]));assert.equal(queue.cases[0].sale.assignedSlot,null);assert.equal(queue.messages.filter(m=>m.role==='agent').length,0);assert.equal((await core.one('SELECT COUNT(*) AS n FROM quotes')).n,quotesBefore);
doneWithMessage=true;
const nonempty=await runner.startAutomatic(owner,args('quote','automatic'));await until(nonempty.id,j=>j.cases[0].result!=='pending');const continued=await runner.automaticDetail(nonempty.id,owner);
assert.equal(continued.cases[0].result,'passed');assert.equal(continued.cases[0].sale.step,'completed');assert.equal(continued.cases[0].earlyFinishRecoveries,2,'done must not discard a real selection message either');
earlyBeforeQuote=true;
const tooEarly=await runner.startAutomatic(owner,args('quote','automatic'));await until(tooEarly.id,j=>j.cases[0].result!=='pending');const notApproved=await runner.automaticDetail(tooEarly.id,owner);
assert.equal(notApproved.cases[0].result,'inconclusive');assert.equal(notApproved.cases[0].sale,undefined);assert.equal(repairCalls,2,'one original customer call and one bounded repair, never an infinite retry');
assert.equal(notApproved.cases[0].criteria.find(c=>c.id==='sale-complete').status,'fail');assert.equal(notApproved.messages.filter(m=>m.role==='agent').length,0);assert.match(notApproved.cases[0].reason,/encerrar antes da confirmação/);
earlyBeforeQuote=false;
const auth=await import('../lib/server/app-auth.ts'),route=await import('../app/api/playground/route.ts');
const token=await auth.createSession(owner),headers={Cookie:'__Host-cc_session='+token,'Content-Type':'application/json'};
const requestBody={action:'attendant',id:job.id,operation:'complete',slot:1,revision:0};
assert.equal((await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',headers:{...headers,Origin:'https://other.test'},body:JSON.stringify(requestBody)}))).status,403);
assert.equal((await route.POST(new Request('https://fixture.test/api/playground',{method:'POST',body:JSON.stringify(requestBody)}))).status,403);
assert.equal((await core.config()).enabled,false);assert.equal(await core.getSetting('ceci:manualPause'),true);
console.log('PASS complete sales runtime: manual takeover, correct attendant only, stale/double-submit guards, confirmation required, no new quotes, Ceci stopped, queue case, API auth/origin, production and pause preserved');
