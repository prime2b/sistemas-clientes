import assert from 'node:assert/strict';
import {whatsappPreviewMessages,automaticPhoneActivity,automaticPhoneMessages} from '../lib/whatsapp-preview.ts';
const messages=[
 {id:'1',role:'user',body:'Quero a tela',created:1},
 {id:'2',role:'assistant',body:'*Orçamento*\n2 × Tela\n*Total: R$ 100,00*',created:2,card_data:'ADMIN_CARD_NOT_TRANSPORT'},
 {id:'3',role:'note',body:'PRIVATE_HANDOFF_SUMMARY',created:3},
 {id:'4',role:'agent',body:'Vou finalizar com você.',created:4},
 {id:'5',role:'system',body:'INTERNAL_CONFIG',created:5}
];
const visible=whatsappPreviewMessages(messages);
assert.deepEqual(visible.map(m=>m.id),['1','2','4']);
assert.equal(visible[1].body,messages[1].body);
assert.ok(!visible.some(m=>m.body.includes('PRIVATE_HANDOFF_SUMMARY')));
assert.equal(whatsappPreviewMessages([]).length,0);
console.log('PASS: phone uses exact outgoing text, keeps customer/business messages, excludes internal notes');

assert.deepEqual(whatsappPreviewMessages([...messages,{id:'empty',role:'agent',body:'   ',created:6},messages[0]]).map(m=>m.id),['1','2','4']);
const run={state:'running',phase:'attendant',index:0,cases:[{sale:{mode:'automatic',step:'confirmation',assignedSlot:1,team:[{slot:1,name:'Ana'}],pendingCustomer:''}}]};
assert.equal(automaticPhoneActivity(run).side,'business');assert.match(automaticPhoneActivity(run).label,/Ana/);
run.cases[0].sale.pendingCustomer='agent-question';assert.equal(automaticPhoneActivity(run).side,'customer');run.cases[0].sale.pendingCustomer='';run.cases[0].sale.mode='manual';assert.equal(automaticPhoneActivity(run),null);run.cases[0].sale.pendingCustomer='manual-question';assert.equal(automaticPhoneActivity(run).side,'customer');
for(const state of ['paused','completed','blocked'])assert.equal(automaticPhoneActivity({...run,state}),null);
assert.equal(automaticPhoneActivity({...run,selectedIndex:1}),null);assert.equal(automaticPhoneActivity(run,true),null);assert.equal(automaticPhoneActivity({...run,phase:'ceci'}).side,'business');assert.equal(automaticPhoneActivity({...run,phase:'client'}).side,'customer');
run.cases[0].pending={id:'pending',body:'Minha escolha'};const optimistic=automaticPhoneMessages(messages,run);assert.equal(optimistic.length,messages.length+1);assert.equal(automaticPhoneMessages(optimistic,run).length,optimistic.length);assert.equal(automaticPhoneMessages(messages,{...run,selectedIndex:1}).length,messages.length);
assert.equal(whatsappPreviewMessages([{id:'a',role:'user',body:'Pix',created:1},{id:'b',role:'user',body:'Pix',created:2}]).length,2,'distinct real messages are never hidden just because their text matches');
console.log('PASS phone activity: Ceci, human and customer typing; manual wait/pause/history/backoff stay idle; optimistic message replaced by identity and no empty historical bubbles');
