import test from 'node:test';
import assert from 'node:assert/strict';
import {projectedDays,chartMarkup,renderCatalogCharts} from '../public/analysis-charts.mjs';
const station={profiles:Array.from({length:7},()=>({values:Array(24).fill(null)}))};
test('daily projection preserves missing days and distinguishes a known zero',()=>{const s=structuredClone(station);s.profiles[0].values[8]=.5;s.profiles[2].values[8]=0;const days=projectedDays(s,'2026-10-18','2026-10-20');assert.deepEqual(days.map(x=>x.value),[.5,null,0]);assert.deepEqual(days.map(x=>x.known),[1,0,1]);});
test('line chart breaks at missing data rather than drawing a false zero',()=>{const html=chartMarkup('Example',[{label:'a',value:1},{label:'b',value:null},{label:'c',value:2}]);assert.equal((html.match(/<path /g)||[]).length,2);assert.equal((html.match(/<circle /g)||[]).length,2);assert.match(html,/Lacunas representam ausência de dados/);});
test('catalog current chart counts technical records without inventing quantities or current',()=>{const html=renderCatalogCharts([{isOperational:true,connections:[{current:'DC',quantity:20},{current:'AC (Three-Phase)'},{current:null}]}]);assert.match(html,/Total<b>3<\/b>/);assert.match(html,/AC 1/);assert.match(html,/DC 1/);assert.match(html,/Não informado 1/);});
