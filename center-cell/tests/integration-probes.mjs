import assert from 'node:assert/strict';
import {probeConnection} from '../lib/server/integration-probes.ts';

let requests = [];
const mock = (status,body) => async (url,options) => {
  requests.push({url,options});
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
};
const secret = 'local-test-only-token';
assert.equal((await probeConnection('openai','','gpt-6-astra','',mock(200,{}))).ok,false);
assert.equal((await probeConnection('whatsapp',secret,'bad/id','v23.0',mock(200,{}))).ok,false);
assert.equal(requests.length,0,'Missing credentials and invalid targets must not make requests');
let result = await probeConnection('openai',secret,'gpt-6-astra','',mock(200,{id:'gpt-6-astra'}));
assert.equal(result.ok,true);
assert.equal(requests.at(-1).url,'https://api.openai.com/v1/models/gpt-6-astra');
assert.equal(requests.at(-1).options.body,undefined,'Connection test must not generate a response');
assert.equal('redirect' in requests.at(-1).options,false,'Use the runtime-compatible default redirect handling');
assert.equal((await probeConnection('openai',secret,'gpt-6-astra','',mock(200,{id:'other-model'}))).ok,false);
for (const [status,word] of [[401,'credencial'],[403,'credencial'],[404,'modelo'],[429,'Limite'],[500,'serviço']]) {
  result = await probeConnection('openai',secret,'gpt-6-astra','',mock(status,{error:{message:secret}}));
  assert.equal(result.ok,false);
  assert.ok(result.message.includes(word));
  assert.ok(!JSON.stringify(result).includes(secret),'Never return upstream error details or secrets');
}
result = await probeConnection('whatsapp',secret,'123456789','v23.0',mock(200,{id:'123456789',display_phone_number:'+55 17 0000-0000',verified_name:'Center Cell'}));
assert.equal(result.ok,true);
assert.equal(result.label,'+55 17 0000-0000');
assert.ok(!requests.at(-1).url.includes('/messages'),'Connection test must not send messages');
result = await probeConnection('openai',secret,'gpt-6-astra','',async()=>{throw new Error(secret);});
assert.equal(result.ok,false);
assert.ok(!result.message.includes(secret));
console.log('PASS: read-only connection checks, target validation, unavailable model, auth/permission/rate errors, network failure, and secret redaction');
