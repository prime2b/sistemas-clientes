import assert from 'node:assert/strict';
import {whatsappPreviewMessages} from '../lib/whatsapp-preview.ts';
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
