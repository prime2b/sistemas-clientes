import assert from 'node:assert/strict';
import {WhatsAppPairingRequests,mergePairingStatus} from '../lib/whatsapp-pairing.ts';
const qr={state:'qr',qr:'data:image/png;base64,fixture',expiresAt:9999999999999,expiresInMs:20000};
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
// Browser fetch performs a Window brand check; arrow-function fixtures do not.
const originalFetch=globalThis.fetch,browserCalls=[];
try{
 globalThis.fetch=function(input,init){
  if(this!==globalThis)throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
  browserCalls.push({input,init});return Promise.resolve(Response.json(init?.method==='POST'?qr:{state:'offline'}));
 };
 const browserClient=new WhatsAppPairingRequests();
 assert.equal((await browserClient.run()).state,'offline');
 assert.equal((await browserClient.run('connect')).state,'qr');
 assert.equal(browserCalls.length,2);assert.ok(browserCalls.every(({input,init})=>input==='/api/whatsapp-web'&&init.signal instanceof AbortSignal));
 assert.equal(JSON.parse(browserCalls[1].init.body).action,'connect');
}finally{globalThis.fetch=originalFetch;}
console.log('PASS browser fetch context: default status and QR requests retain the Window receiver and send the expected request');
const old=pending();let calls=0;
const client=new WhatsAppPairingRequests(async(_,init)=>{calls++;return init.method==='POST'?Response.json(qr):old.promise;},100,()=>10000);
const stale=client.run(),fresh=await client.run('connect');assert.equal(fresh.state,'qr');assert.equal(fresh.expiresAt,30000,'server/device clock differences cannot immediately expire a fresh QR');assert.equal(await stale,undefined,'obsolete credential/status polls are canceled');
old.resolve(Response.json({state:'error',error:'Old token refused'},{status:503}));await Promise.resolve();
assert.equal(mergePairingStatus(fresh,{state:'offline'}).qr,fresh.qr);assert.equal(mergePairingStatus(fresh,{state:'offline'}).expiresAt,30000,'polling does not extend validity');assert.equal(mergePairingStatus(fresh,{state:'connected'}).qr,undefined,'confirmed connection removes QR');
console.log('PASS credential-change race: late old-token failure cannot replace the new QR; countdown is relative to the device and offline polls preserve it without renewing its lifetime');
const actionGate=pending();let actionCount=0;
const serialized=new WhatsAppPairingRequests(async()=>{actionCount++;return actionGate.promise;},100);
const action=serialized.run('connect');assert.equal(await serialized.run('connect'),undefined);assert.equal(await serialized.run(),undefined);assert.equal(actionCount,1);actionGate.resolve(Response.json(qr));assert.ok((await action).qr);
const polls=[pending(),pending()];let index=0;const ordered=new WhatsAppPairingRequests(async()=>polls[index++].promise,100);
const first=ordered.run(),second=ordered.run();polls[1].resolve(Response.json({state:'connected'}));assert.equal((await second).state,'connected');polls[0].resolve(Response.json({state:'offline'}));assert.equal(await first,undefined);
console.log('PASS request order: one connection action at a time, polling suspended during pairing and latest status wins');
let hang=true;
const bounded=new WhatsAppPairingRequests(async()=>hang?new Promise(()=>{}):Response.json(qr),8);
await assert.rejects(bounded.run('connect'),/tempo de espera/);hang=false;assert.equal((await bounded.run('connect')).state,'qr','timeout must release the action so retry works');
const bodyTimeout=new WhatsAppPairingRequests(async()=>({ok:true,json:()=>new Promise(()=>{})}),8);await assert.rejects(bodyTimeout.run('connect'),/tempo de espera/);
const canceled=new WhatsAppPairingRequests(async()=>new Promise(()=>{}),100);const waiting=canceled.run('connect');canceled.cancel();assert.equal(await waiting,undefined);
const invalid=new WhatsAppPairingRequests(async()=>Response.json({error:'Confira o Client-Token.'},{status:403}),100);await assert.rejects(invalid.run('connect'),/Client-Token/);
console.log('PASS bounded loading: stalled transport/JSON end with a retryable error, cancellation settles old work and authorization errors stay visible');
