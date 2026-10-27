/** Render the real initial React interface; no browser or production services are used. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('@/'))specifier=new URL('../'+specifier.slice(2),import.meta.url).href;if(specifier.startsWith('file:')){for(const suffix of ['.ts','.tsx'])if(existsSync(fileURLToPath(specifier)+suffix))return next(specifier+suffix,context);}if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier,context.parentURL);if(!/\.[a-z]+$/i.test(url.pathname)){for(const suffix of ['.ts','.tsx'])if(existsSync(fileURLToPath(url)+suffix))return next(url.href+suffix,context);}}return next(specifier,context);},
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

const {default:SharedCentral}=await import('../app/playground/shared-central-preview.tsx');
const shared=renderToStaticMarkup(createElement(SharedCentral,{sale:{...received,shared:true,step:'claim',assignedSlot:null,acceptedAt:0,quote:null,catalog:[]},messages:[],busy:false,active:true,onAction:async()=>{}}));
assert.match(shared,/Central de atendimento/);assert.match(shared,/Assumir atendimento/);assert.match(shared,/Não atribuídas/);assert.ok(!shared.includes('Selecionar painel da atendente'));assert.equal((shared.match(/aria-label="Central compartilhada simulada"/g)||[]).length,1);
console.log('PASS shared central UI: one inbox, operator identity, shared waiting conversation, explicit claim and no individual panels');

const {InboxView}=await import('../app/inbox-view.tsx');
const noop=()=>{},contact={id:'fixture-conversation',name:'Cliente',phone:'5517999990000',channel:'whatsapp_web',status:'human',assigned:'',profile:'lojista',notes:'',updated:Date.now(),unreadCount:2,canRespond:false};
const inbox=renderToStaticMarkup(createElement(InboxView,{isAdmin:false,data:{conversations:[contact],whatsappReady:true},cfg:{sharedInbox:true,team:['Ana','Bia','Carla'],enabled:true},conversation:contact,messages:[{id:'inbound',role:'user',body:'Olá',created:Date.now()}],selected:contact.id,filter:'all',search:'',compose:'',role:'agent',notes:'',busy:'',setSelected:noop,setFilter:noop,setSearch:noop,setCompose:noop,setRole:noop,setNotes:noop,onTest:noop,onNavigate:noop,onSend:noop,onRoute:noop,onAutoAssign:noop,onAssign:noop,onUpdate:noop,onArchive:noop,onStatusById:noop,onArchiveById:noop,onDeleteConversation:noop,onDelete:noop,onClaim:noop,onRead:noop}));
assert.match(inbox,/Não lidas/);assert.match(inbox,/Filtros de atendimento/);assert.match(inbox,/Buscar nesta conversa/);assert.match(inbox,/Assumir/);assert.match(inbox,/aria-label="Resposta"[^>]*disabled/);assert.match(inbox,/cx-whatsapp-layout/);
console.log('PASS actual inbox render: WhatsApp controls, unread/assigned filters, contact drawer, claim action and locked reply before claim');

const editable={...contact,canRespond:true,assigned:'Ana'};
const props={isAdmin:false,data:{conversations:[editable],whatsappReady:true},cfg:{sharedInbox:true,team:['Ana','Bia','Carla'],enabled:true},conversation:editable,messages:[{id:'sent',role:'agent',author_name:'Ana',body:'Já estou com as opções.',created:Date.now(),status:'accepted'}],selected:contact.id,filter:'all',search:'',compose:'Olá',role:'agent',notes:'',busy:'',setSelected:noop,setFilter:noop,setSearch:noop,setCompose:noop,setRole:noop,setNotes:noop,onTest:noop,onNavigate:noop,onSend:noop,onRoute:noop,onAutoAssign:noop,onAssign:noop,onUpdate:noop,onArchive:noop,onStatusById:noop,onArchiveById:noop,onDeleteConversation:noop,onDelete:noop,onClaim:noop,onRead:noop};
const sent=renderToStaticMarkup(createElement(InboxView,props));assert.match(sent,/aria-label="Enviada ao canal"/);assert.ok(!sent.includes('Lida pelo cliente'));assert.match(sent,/rows="1"/);assert.match(sent,/Enviar mensagem/);assert.match(sent,/Mais opções da mensagem/);assert.ok(!sent.includes('Anexos exigem suporte'));
const delivered=renderToStaticMarkup(createElement(InboxView,{...props,messages:[{...props.messages[0],status:'delivered'}]}));assert.match(delivered,/aria-label="Entregue ao cliente"/);assert.ok(!delivered.includes('Lida pelo cliente'));
const read=renderToStaticMarkup(createElement(InboxView,{...props,messages:[{...props.messages[0],status:'read'}]}));assert.match(read,/aria-label="Lida pelo cliente"/);assert.match(read,/cx-receipt read/);
const empty=renderToStaticMarkup(createElement(InboxView,{...props,selected:'',conversation:undefined,messages:[]}));assert.match(empty,/Selecione uma conversa para começar/);assert.match(empty,/Visão geral da central/);assert.ok(!empty.includes('PRÓXIMA DA FILA'));
console.log('PASS WhatsApp presentation: compact composer, actual sender, truthful sent/delivered/read receipts and quiet empty state with overview access');

const {default:WhatsAppPhone}=await import('../app/playground/whatsapp-phone.tsx');
const phoneProps={messages:[],text:'',onText:noop,onSend:noop,onBack:noop,disabled:true,typing:true,clock:Date.now(),handoff:true};
const agentTyping=renderToStaticMarkup(createElement(WhatsAppPhone,{...phoneProps,typingSide:'business',typingLabel:'Ana está preparando a resposta'}));assert.match(agentTyping,/digitando…/);assert.match(agentTyping,/wa-typing incoming/);assert.match(agentTyping,/role="status" aria-label="Ana está preparando a resposta"/);
const clientTyping=renderToStaticMarkup(createElement(WhatsAppPhone,{...phoneProps,typingSide:'customer',typingLabel:'Cliente simulado está digitando'}));assert.match(clientTyping,/wa-typing outgoing/);assert.match(clientTyping,/Conta comercial/);assert.ok(!clientTyping.includes('>digitando…<'));
console.log('PASS phone typing render: business animates incoming dots and contact status; customer animates outgoing dots without mislabeling the business');
