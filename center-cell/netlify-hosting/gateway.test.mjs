import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forward,UPSTREAM} from './functions/center-cell.mjs';
const host = 'https://center-cell-atendimento.netlify.app';

test('same-origin login preserves body/session without forwarding unrelated cookies or identity headers',async()=>{
  let calls=0;
  const result=await forward(new Request(host+'/api/auth',{method:'POST',headers:{origin:host,'content-type':'application/json',cookie:'other=private; __Host-cc_session=fixture','oai-authenticated-user-id':'spoof','x-forwarded-host':'evil.example'},body:JSON.stringify({action:'login',identifier:'fixture',password:'test-only'})}),async(url,options)=>{
    calls++;
    assert.equal(url.href,UPSTREAM+'/api/auth');
    assert.equal(options.headers.get('origin'),UPSTREAM);
    assert.equal(options.headers.get('cookie'),'__Host-cc_session=fixture');
    assert.equal(options.headers.get('oai-authenticated-user-id'),null);
    assert.equal(options.headers.get('x-forwarded-host'),null);
    assert.equal(JSON.parse(new TextDecoder().decode(options.body)).identifier,'fixture');
    return Response.json({ok:true},{headers:{'set-cookie':'__Host-cc_session=newfixture; Path=/; Secure; HttpOnly; SameSite=Lax'}});
  });
  assert.equal(calls,1);
  assert.deepEqual(await result.json(),{ok:true});
  assert.match(result.headers.get('set-cookie'),/HttpOnly/);
  assert.equal(result.headers.get('netlify-cdn-cache-control'),'no-store');
});
test('cross-site writes are rejected before the upstream request',async()=>{
  for(const headers of [{origin:'https://evil.example'},{'sec-fetch-site':'cross-site'}]){
    const response=await forward(new Request(host+'/api/manage',{method:'POST',headers,body:'{}'}),()=>assert.fail('Must not forward'));
    assert.equal(response.status,403);
  }
});
test('RSC, URL query and HTTP errors are preserved, without cookie leakage',async()=>{
  const response=await forward(new Request(host+'/playground?_rsc=abc',{headers:{rsc:'1','next-router-state-tree':'fixture'}}),async(url,options)=>{
    assert.equal(url.search,'?_rsc=abc');
    assert.equal(options.headers.get('rsc'),'1');
    const headers=new Headers({'content-type':'application/json'});
    headers.append('set-cookie','__cf_bm=unrelated; Domain=chatgpt.site; Secure');
    return new Response('{"error":"Restricted"}',{status:403,headers});
  });
  assert.equal(response.status,403);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(await response.text(),'{"error":"Restricted"}');
});
test('upstream redirects remain on Netlify and connection failures never retry writes',async()=>{
  const response=await forward(new Request(host+'/'),async()=>new Response(null,{status:307,headers:{location:UPSTREAM+'/login?next=%2Fplayground'}}));
  assert.equal(response.headers.get('location'),host+'/login?next=%2Fplayground');
  let calls=0;
  const failed=await forward(new Request(host+'/api/manage',{method:'POST',body:'{}'}),async()=>{calls++;throw new Error('offline');});
  assert.equal(failed.status,504);
  assert.equal(calls,1);
});
test('encoded and double-slash paths cannot select an alternative upstream',async()=>{
  await forward(new Request(host+'//evil.example/api?url=https://evil.example'),async(url)=>{
    assert.equal(url.origin,UPSTREAM);
    return new Response('ok');
  });
});
