import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {bridgeUrl,verifyBridgeEvent} from '../lib/server/whatsapp-web-protocol.ts';

assert.equal(bridgeUrl('https://conexao.centercell.com.br/'),'https://conexao.centercell.com.br');
for(const url of ['http://conexao.centercell.com.br','https://127.0.0.1','https://user:pass@conexao.centercell.com.br','https://conexao.centercell.com.br/admin'])assert.throws(()=>bridgeUrl(url));
const payload='{"kind":"message","id":"web-123"}',token='local-test-key';
const timestamp=String(Date.now());
const signature='sha256='+createHmac('sha256',token).update(timestamp+'.'+payload).digest('hex');
assert.equal(await verifyBridgeEvent(payload,timestamp,signature,token),true);
assert.equal(await verifyBridgeEvent(payload+' ',timestamp,signature,token),false);
assert.equal(await verifyBridgeEvent(payload,String(Date.now()-6*60*1000),signature,token),false);
assert.equal(await verifyBridgeEvent(payload,timestamp,signature,'other-key'),false);
console.log('PASS: HTTPS bridge URL and signed, fresh event verification');
