import assert from 'node:assert/strict';
import {shouldRestartWithCeci,CECI_SESSION_IDLE_MS} from '../lib/server/ceci-policy.ts';

assert.equal(shouldRestartWithCeci({status:'closed',assigned:'Atendente 1'},true,true,true),true);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,false),true);
assert.equal(shouldRestartWithCeci({status:'human',assigned:'Atendente 1'},true,true,false),false);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,true),false);
assert.equal(shouldRestartWithCeci({status:'closed',assigned:''},false,true,false),false);
assert.equal(shouldRestartWithCeci({status:'closed',assigned:''},true,false,false),false);
assert.equal(shouldRestartWithCeci({status:'closed',assigned:'Atendente 1'},true,true,true,true),true);
const now=Date.now(),old=now-CECI_SESSION_IDLE_MS-1;
assert.equal(shouldRestartWithCeci({status:'human',assigned:'Admin',claimed_at:old},true,true,true,true,{lastInteraction:old,now}),true);
assert.equal(shouldRestartWithCeci({status:'human',assigned:'Admin',claimed_at:now},true,true,true,true,{lastInteraction:old,now}),false);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,true,true,{lastInteraction:now,now}),false);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,true,true),false);
console.log('PASS: Ceci restarts closed or unhandled conversations while preserving active human work');
