import assert from 'node:assert/strict';
import {requestCeciModel,retryDelay} from '../lib/server/ceci-model-client.ts';
const key='fixture-only-secret';
const payload={model:'gpt-5.6-terra',input:'Teste'};
const success=()=>Response.json({output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]});
let calls=0,waits=[],diagnostics=[];
const result=await requestCeciModel({key,payload,now:()=>1000,wait:async ms=>{waits.push(ms);},onDiagnostic:async d=>diagnostics.push(d),request:async(_url,init)=>{calls++;assert.equal(JSON.parse(init.body).model,'gpt-5.6-terra');return calls===1?Response.json({error:{code:'rate_limit_exceeded',type:'rate_limit_error'}},{status:429,headers:{'retry-after':'2'}}):success();}});
assert.equal(calls,2);assert.deepEqual(waits,[2000]);assert.equal(result.output[0].type,'message');assert.equal(diagnostics[0].retryAt,3000);
for(const [code,expected] of [['insufficient_quota','CECI_MODEL_QUOTA'],['credit_balance_exhausted','CECI_MODEL_CREDITS'],['project_spend_limit_exceeded','CECI_MODEL_SPEND'],['organization_spend_limit_exceeded','CECI_MODEL_SPEND'],['organization_usage_limit_exceeded','CECI_MODEL_USAGE'],['unknown','CECI_MODEL_LIMIT']]){
 calls=0;waits=[];
 await assert.rejects(requestCeciModel({key,payload,wait:async ms=>waits.push(ms),request:async()=>{calls++;return Response.json({error:{code,message:key}},{status:429});}}),new RegExp(expected));
 assert.equal(calls,1);assert.equal(waits.length,0);
}
waits=[];diagnostics=[];
await assert.rejects(requestCeciModel({key,payload,now:()=>1000,wait:async ms=>waits.push(ms),onDiagnostic:async d=>diagnostics.push(d),request:async()=>Response.json({error:{code:'server_is_overloaded'}},{status:503,headers:{'retry-after':'30'}})}),/CECI_MODEL_TEMPORARY/);
assert.equal(waits.length,0);assert.equal(diagnostics[0].retryAt,31000);
calls=0;waits=[];
await assert.rejects(requestCeciModel({key,payload,now:()=>1000,wait:async ms=>waits.push(ms),request:async()=>{calls++;return Response.json({error:{code:'slow_down'}},{status:429});}}),/CECI_MODEL_RATE_LIMIT/);
assert.equal(calls,3);assert.equal(waits.length,2);
const controller=new AbortController();calls=0;
await assert.rejects(requestCeciModel({key,payload,signal:controller.signal,wait:async()=>controller.abort(),request:async()=>{calls++;return Response.json({error:{code:'slow_down'}},{status:429});}}),/CECI_TIMEOUT/);
assert.equal(calls,1);
await assert.rejects(requestCeciModel({key,payload,request:async()=>{throw new Error(key);}}),/CECI_MODEL_NETWORK/);
assert.equal(retryDelay('2',1000),2000);assert.equal(retryDelay('invalid',1000),null);
assert.ok(!JSON.stringify(diagnostics).includes(key));
console.log('PASS: temporary errors recover, bounded retries honor server delay, billing never retries, cancellation and diagnostics stay safe');
