import assert from 'node:assert/strict';
import {minimumMatchedGroups,productSearchPlan,productSearchScore,sqlLike} from '../lib/erp/product-search.ts';

const plan=productSearchPlan('Quero uma frontal de iPhone15');
assert.deepEqual(plan.tokens,['frontal','iphone','15']);
assert.equal(plan.groups[0].includes('display'),true);
assert.equal(minimumMatchedGroups(plan),2);

const candidates=[
  'DISPLAY OLED IPHONE 15 INCELL',
  'CABO USB-C PARA IPHONE 15',
  'FRONTAL IPHONE 14'
].map(name=>({name,...productSearchScore(name,'Peças',plan)})).sort((a,b)=>b.score-a.score);

assert.equal(candidates[0].name,'DISPLAY OLED IPHONE 15 INCELL');
assert.equal(candidates[0].matchedGroups,3);
assert.ok(candidates[0].score>candidates[1].score);
assert.equal(sqlLike('15_%'),'%15%');

const proMax=productSearchPlan('frontal 15PM');
assert.deepEqual(proMax.tokens,['frontal','15','pm']);
assert.ok(proMax.groups[2].includes('pro max'));
const network=productSearchPlan('dock redmi note 12 5G');
assert.ok(network.tokens.includes('5g'));
assert.ok(network.groups[0].includes('centro de carga'));

console.log('PASS: intent-aware product search handles repair synonyms, 15PM, network variants, and exact models');
