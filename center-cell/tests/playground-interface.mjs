/** Render the real initial React interface; no browser or production services are used. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier,context.parentURL);if(!/\.[a-z]+$/i.test(url.pathname)){for(const suffix of ['.ts','.tsx'])if(existsSync(fileURLToPath(url)+suffix))return next(url.href+suffix,context);}}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
const {default:AutomaticTests}=await import('../app/playground/automatic-tests.tsx');
globalThis.fetch=()=>{throw new Error('Rendering cannot start or fetch a test');};
const html=renderToStaticMarkup(createElement(AutomaticTests,{ready:true,onActive:()=>{},onTakeover:()=>{}}));
assert.match(html,/<option value="economic" selected="">Econômico · Luna<\/option>/);assert.match(html,/Homologação · modelo de produção/);
assert.match(html,/Iniciar conversa natural/);assert.match(html,/Desde o “Oi” até a compra/);
assert.match(html,/Primeira mensagem/);assert.match(html,/<option value="oi" selected="">Oi<\/option>/);
assert.equal((html.match(/class="ax-choice /g)||[]).length,3,'only three primary test choices');
assert.match(html,/role="tablist"/);for(const name of ['Conversa','Resultado','Detalhes'])assert.ok(html.includes('>'+name+'<'));
assert.match(html,/Histórico/);assert.match(html,/Configurações/);
assert.ok(!html.includes('Orçamento de tokens'),'advanced settings are closed initially');
assert.ok(!html.includes('Comparar com outra execução'),'report is not stacked below the initial screen');
assert.ok(!html.includes('ax-history-row'),'completed runs do not replace the new-test screen');
assert.ok(html.indexOf('ax-start-area')>html.indexOf('ax-setup-scroll'),'start action is outside the scrolling form');
console.log('PASS interface: natural conversation is the default, greeting is Oi, three compact choices, tabbed results, closed history/settings and persistent start action');

const {default:AttendantPreview}=await import('../app/playground/attendant-preview.tsx');
const received={revision:0,mode:'manual',step:'delivery',team:[1,2,3].map(slot=>({slot,name:'Atendente '+slot,avatar:'',available:true,load:0})),assignedSlot:2,receivedAt:1,acceptedAt:0,completedAt:0,quote:{type:'quote',id:'fixture-quote',intro:'Orçamento aceito',checkedAt:Date.now(),status:'approved',items:[{productId:1,name:'TELA SAMSUNG A14 4G',quantity:2,unitCents:100,totalCents:200}],totalCents:200},quoteMessageId:'q',consentMessageId:'yes',handoffMessageId:'h',summary:'Cliente aceitou duas telas; falta combinar retirada e pagamento.',delivery:'',payment:'',confirmationMessageId:'',pendingCustomer:'',turns:0,deliveryChoice:'retirada',paymentChoice:'pix'};
const receipt=renderToStaticMarkup(createElement(AttendantPreview,{sale:received,messages:[],busy:false,active:true,onAction:async()=>{}}));
assert.match(receipt,/Novo atendimento/);assert.match(receipt,/Resumo do encaminhamento/);assert.match(receipt,/Cliente aceitou duas telas/);assert.match(receipt,/Atendente 2/);assert.equal((receipt.match(/aria-label="Atendimentos recebidos"/g)||[]).length,3);assert.match(receipt,/Resposta ao cliente/);assert.ok(!receipt.includes('Concluir venda simulada'),'receipt alone cannot expose completion action');
const ready=renderToStaticMarkup(createElement(AttendantPreview,{sale:{...received,step:'ready',acceptedAt:2,delivery:'retirada',payment:'pix',confirmationMessageId:'final'},messages:[],busy:false,active:true,onAction:async()=>{}}));assert.match(ready,/Concluir venda simulada/);
const queue=renderToStaticMarkup(createElement(AttendantPreview,{sale:{...received,step:'queued',assignedSlot:null,team:received.team.map(t=>({...t,available:false}))},messages:[],busy:false,active:true,onAction:async()=>{}}));assert.match(queue,/Aguardando disponibilidade/);assert.ok(!queue.includes('Resposta ao cliente'));
console.log('PASS attendant interface: three isolated views, assigned panel selected, received summary/quote, manual composer, explicit completion and unavailable queue');
