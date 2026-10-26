import assert from 'node:assert/strict';
import {shouldRestartWithCeci} from '../lib/server/ceci-policy.ts';

assert.equal(shouldRestartWithCeci({status:'closed',assigned:'Atendente 1'},true,true,true),true);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,false),true);
assert.equal(shouldRestartWithCeci({status:'human',assigned:'Atendente 1'},true,true,false),false);
assert.equal(shouldRestartWithCeci({status:'human',assigned:''},true,true,true),false);
assert.equal(shouldRestartWithCeci({status:'closed',assigned:''},false,true,false),false);
assert.equal(shouldRestartWithCeci({status:'closed',assigned:''},true,false,false),false);
console.log('PASS: Ceci restarts closed or unhandled conversations while preserving active human work');
