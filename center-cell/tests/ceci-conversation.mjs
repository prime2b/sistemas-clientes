import assert from 'node:assert/strict';
import {runCeciAgent,confirmsPurchase} from '../lib/server/ceci-engine.ts';
import {emptyCeciMemory,patchOrder,applyContext,replyViolation} from '../lib/server/ceci-memory.ts';
import {drainCeci} from '../lib/server/ceci-queue.ts';
import {initialProductQueries} from '../lib/server/ceci-search.ts';
import {matchesCatalogRequest,catalogSearchTerms,initialCatalogQuery,commercialProfileEvidence} from '../lib/server/ceci-catalog.ts';
const cfg={name:'Ceci',greeting:'Oi! Sou Ceci',instructions:'Sem emojis.',handoff:'Chamar a equipe'};
const ctx={profile:'lojista',customerStatus:'verified',customerName:'Marcos'};
const context={fatos:[],pendencia:'',proximaAcao:''};
const finish=(text='Atualizei o pedido.',next='')=>['responder_cliente',{texto:text,proximoPasso:next,contexto:context}];
const user=(body,id='u1',created=10)=>({id,role:'user',body,created});
const products=[{id:101,name:'Frontal iPhone 15 Pro Max sem aro'},{id:102,name:'Conector iPhone 15 Pro Max'}];
async function run(calls,{memory=emptyCeciMemory(),messages=[user('Duas telas')],profile=ctx,quotePresentedAt=0,prepare,history,restore}={}){
 const consumed=[],prepared=[],offered=[];let idx=0;
 const ports={active:async()=>{},respond:async(_instructions,input,tools)=>{const c=calls[idx++];assert.ok(c,'unexpected extra model call');consumed.push(structuredClone(input));offered.push(tools.map(t=>t.name));return [{type:'function_call',call_id:'call-'+idx,name:c[0],arguments:JSON.stringify(c[1])}];},
 search:async()=>({items:products,total:2}),
 inspect:async ids=>({items:ids.map(id=>({productId:id,name:products.find(p=>p.id===id).name,unitCents:id===101?20000:3500,stock:20,available:true})),checkedAt:Date.now()}),
 prepare:async items=>{prepared.push(structuredClone(items));if(prepare)return prepare(items);return {storeId:4046,priceField:'valorVenda',checkedAt:Date.now(),reserved:false,lines:items.map(x=>({...x,name:products.find(p=>p.id===x.productId).name,unitCents:20000,totalCents:20000*x.quantity,priceField:'valorVenda'})),totalCents:items.reduce((n,x)=>n+20000*x.quantity,0)};},
 history:history||(async()=>[]),restore:restore||(async()=>{throw new Error('QUOTE_NOT_FOUND');})};
 const result=await runCeciAgent({config:cfg,context:profile,memory,messages,quotePresentedAt,ports});assert.equal(idx,calls.length);return {result,consumed,prepared,offered};
}
// Direct inquiry gets one contextual final answer, with evidence-backed memory.
let {result}=await run([['responder_cliente',{texto:'Esse A15 é o 4G ou o 5G?',proximoPasso:'',contexto:{fatos:[{chave:'prioridade',valor:'menor custo',mensagemId:'u1'},{chave:'inventado',valor:'entrega grátis',mensagemId:'fake'}],pendencia:'Versão do A15',proximaAcao:'Consultar a variante'}}]],{messages:[user('Tela barata para A15')]});
assert.equal(result.memory.facts.length,1);assert.equal(result.memory.pending,'Versão do A15');assert.equal(result.memory.introduced,true);
// Search -> live options -> conversational final; remembered order of displayed cards.
({result}=await run([['buscar_catalogo',{busca:'15 Pro Max frontal'}],['consultar_opcoes',{productIds:[101,102],exibirCards:true}],finish('Encontrei estas opções.','Qual você prefere?')]));
assert.deepEqual(result.memory.lastOptions,[101,102]);assert.equal(result.products[0].unitCents,20000);
// A later turn can quote a previously displayed SKU without another literal search.
let memory=result.memory;
let outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:2},{productId:102,quantity:1}]}],finish()],{memory});
assert.deepEqual(outcome.prepared[0],[{productId:101,quantity:2},{productId:102,quantity:1}]);
memory={...outcome.result.memory,currentQuoteId:'quote-current'};
outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:3}]}],finish('Atualizei as telas e mantive o conector.')],{memory,messages:[user('Então põe três telas')]});
assert.deepEqual(outcome.prepared[0],[{productId:101,quantity:3},{productId:102,quantity:1}]);assert.equal(outcome.result.previousQuoteId,'quote-current');
// Remove one line, retain the rest; do not mutate the input state.
outcome=await run([['consultar_e_orcar',{itens:[{productId:102,quantity:0}]}],finish()],{memory});
assert.deepEqual(outcome.result.memory.cart,[{productId:101,quantity:2}]);assert.equal(memory.cart.length,2);
// Unavailable quantity preserves the prior order.
outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:100}]}],finish('Não consegui confirmar essa quantidade.','Quer que eu confira uma alternativa?')],{memory,prepare:async()=>{throw new Error('INSUFFICIENT_OR_UNAVAILABLE_STOCK');}});
assert.deepEqual(outcome.result.memory.cart,memory.cart);assert.equal(outcome.result.draft,undefined);
// Arbitrary product IDs never reach the pricing service.
outcome=await run([['consultar_e_orcar',{itens:[{productId:999,quantity:1}]}],finish('Qual é o modelo completo?')],{memory});assert.equal(outcome.prepared.length,0);
// A selected past quote is restored by server-provided items, with a fresh consultation.
outcome=await run([['recuperar_orcamento',{orcamentoId:'older'}],finish()],{memory,restore:async id=>{assert.equal(id,'older');return [{productId:102,quantity:2}];}});
assert.deepEqual(outcome.prepared[0],[{productId:102,quantity:2}]);
// Legacy history is queryable; historical evidence can support memory updates.
outcome=await run([['consultar_historico',{busca:'Mirassol'}],['responder_cliente',{texto:'Vou considerar Mirassol na solicitação à equipe.',proximoPasso:'',contexto:{fatos:[{chave:'destino',valor:'Mirassol',mensagemId:'old'}],pendencia:'Confirmar entrega',proximaAcao:'Encaminhar'}}]],{history:async()=>[user('A entrega é em Mirassol','old',1)]});
assert.equal(outcome.result.memory.facts[0].value,'Mirassol');
// Final text cannot inject price, costs, source names or unsupported compatibility.
outcome=await run([finish('O valor é R$ 123,00.'),finish('Vou precisar confirmar o item.')]);assert.equal(outcome.result.text,'Vou precisar confirmar o item.');
outcome=await run([finish('Aqui estão as opções nos cards abaixo.'),finish('Vou conferir as opções antes de apresentar.')]);assert.equal(outcome.result.text,'Vou conferir as opções antes de apresentar.');
assert.ok(replyViolation('Isso serve no seu celular.',true));assert.ok(replyViolation('Consultado no MercadoPhone.',true));
// Handoff only after a displayed quote and an actual buying confirmation.
const handoff=(message='Pode fechar',reason='compra_confirmada')=>['encaminhar_humano',{motivo:reason,resumo:'Cliente quer concluir o orçamento.',mensagem:'Vou chamar a equipe para concluir o pedido por aqui.',orcamentoId:'quote-current',mensagemId:'u1',contexto:context}];
outcome=await run([handoff()],{memory,messages:[user('Pode fechar')],quotePresentedAt:5});assert.equal(outcome.result.handoff.reason,'compra_confirmada');
outcome=await run([handoff(),finish('Por nada!')],{memory,messages:[user('Obrigado')],quotePresentedAt:5});assert.equal(outcome.result.handoff,undefined);
outcome=await run([handoff(),finish('Vou atualizar o orçamento antes de concluir.')],{memory,messages:[user('Pode fechar','u1',2)],quotePresentedAt:5});assert.equal(outcome.result.handoff,undefined);
for(const text of ['Obrigado','Vou pensar','Não pode fechar','Pode fechar?'])assert.equal(confirmsPurchase(text,'Quer concluir o pedido?'),false);
assert.equal(confirmsPurchase('Sim','Vai uma unidade?'),false);assert.equal(confirmsPurchase('Sim','Quer concluir o pedido?'),true);
// Reported loop: accept the displayed quote, without a new draft or confirmation.
const invitation='Se estiver de acordo e quiser finalizar a compra, me confirme por aqui.';
for(const text of ['Estou de acordo, pode finalizar a compra.','Confirmo, desejo finalizar a compra.','Confirmo, desejo finalizar.','Pode finalizar.','Quero prosseguir com a compra.','Pode fechar','Confirmo a compra','Fechado','Pode seguir','Sim','Confirmo','Estou de acordo','Sim quero comprar','Pode fechar, quero comprar.','Confirmo novamente, desejo finalizar a compra.','Confirmo de novo']){
 assert.equal(confirmsPurchase(text,invitation),true,text);
 outcome=await run([handoff()],{memory,messages:[{id:'q',role:'assistant',body:invitation,created:5},user(text)],quotePresentedAt:5});
 assert.equal(outcome.result.handoff.quoteId,'quote-current',text);assert.equal(outcome.result.draft,undefined);assert.equal(outcome.prepared.length,0);assert.deepEqual(outcome.offered,[['encaminhar_humano']]);
}
for(const text of ['Confirmo','Sim','Obrigado','Pode fechar?','Não quero finalizar','Pode finalizar se tiver desconto','Pode finalizar, mas troca a cor','Pode fechar com 3 unidades','Pode fechar a preta','Vou pensar e depois finalizar','Pode finalizar antes de confirmar o frete']){
 assert.equal(confirmsPurchase(text,text==='Confirmo'||text==='Sim'?'Qual quantidade?':invitation),false,text);
}
const quotedTwo=[{productId:101,quantity:2}];
for(const text of ['Estou de acordo, pode finalizar a compra das 2 unidades.','Pode fechar as duas unidades.','Confirmo a compra das duas peças.']){
 assert.equal(confirmsPurchase(text,invitation,quotedTwo),true,text);
 outcome=await run([handoff()],{memory:{...memory,cart:quotedTwo},messages:[{id:'q',role:'assistant',body:invitation,created:5},user(text)],quotePresentedAt:5});
 assert.equal(outcome.result.handoff.reason,'compra_confirmada');assert.equal(outcome.prepared.length,0);assert.deepEqual(outcome.offered,[['encaminhar_humano']]);
}
for(const text of ['Pode finalizar a compra das 3 unidades.','Pode finalizar a compra das 2 unidades da preta.','Pode finalizar a compra das 2 unidades, código 999.','Pode finalizar a compra das 2 unidades, mas quero desconto.','Pode finalizar a compra das 2 unidades?','Não pode finalizar a compra das 2 unidades.','Pode fechar com 2 unidades.'])assert.equal(confirmsPurchase(text,invitation,quotedTwo),false,text);
assert.equal(confirmsPurchase('Pode finalizar a compra das 2 unidades.',invitation),false,'quantity requires the actual quoted order');
outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:2}]}],finish('Revalidei o orçamento.','Confirma novamente?'),handoff()],{memory,messages:[{id:'q',role:'assistant',body:invitation,created:5},user('Estou de acordo, pode finalizar a compra.')],quotePresentedAt:5});
assert.equal(outcome.prepared.length,0);assert.equal(outcome.result.draft,undefined);assert.equal(outcome.result.memory.currentQuoteId,'quote-current');assert.equal(outcome.result.handoff.quoteId,'quote-current');
assert.ok(outcome.consumed[1].some(m=>m.type==='function_call_output'&&JSON.parse(m.output).orcamentoVigente==='quote-current'));
// The same-order invariant also holds for ambiguous acknowledgments; clarify
// rather than minting another quote. An explicit refresh still consults the ERP.
outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:2}]}],finish('O orçamento continua o mesmo.','Você quer prosseguir com a compra?')],{memory,messages:[user('Tudo certo por aqui.')],quotePresentedAt:5});
assert.equal(outcome.prepared.length,0);assert.equal(outcome.result.memory.currentQuoteId,'quote-current');assert.equal(outcome.result.draft,undefined);
outcome=await run([['consultar_e_orcar',{itens:[{productId:101,quantity:2}]}],finish('Atualizei a cotação a seu pedido.')],{memory,messages:[user('Atualize esse orçamento, por favor.')],quotePresentedAt:5});assert.equal(outcome.prepared.length,1);assert.ok(outcome.result.draft);
// An old confirmation cannot override a subsequent correction or refusal.
outcome=await run([handoff(),finish('Vou conferir a alteração antes de seguir.')],{memory,messages:[user('Pode fechar','u1',6),user('Não, muda para três','u2',10)],quotePresentedAt:5});assert.equal(outcome.result.handoff,undefined);
console.log('PASS purchase: natural confirmations, no duplicate quote or second consent, mixed changes/questions refused, old confirmations invalidated');
// A profile inferred without an actual declaration is rejected.
outcome=await run([['definir_perfil',{perfil:'lojista',mensagemId:'u1'}],finish('A compra é para loja ou uso próprio?')],{profile:{...ctx,profile:'nao_identificado',customerStatus:'not_found'},messages:[user('Vocês têm loja?')]});assert.equal(outcome.result.profile,'nao_identificado');
// Queue groups fragments and discards stale generations without dropping newer messages.
let now=0,pending=1,answered=0,lock=false,generated=[],published=[],waits=0;
const base={now:()=>now,wait:async ms=>{now+=ms;if(++waits===1)pending=2;},claim:async()=>lock?null:(lock=true,'owner'),release:async()=>{lock=false;},pending:async()=>pending,answered:async()=>answered,generate:async target=>{generated.push(target);if(target===2){pending=3;throw new Error('CECI_SUPERSEDED');}return {target};},publish:async reply=>{published.push(reply.target);answered=reply.target;},fail:async()=>assert.fail('must not hand off superseded work')};
await drainCeci(base);assert.deepEqual(generated,[2,3]);assert.deepEqual(published,[3]);assert.equal(lock,false);
// A duplicate waiter observes the committed cursor and does not generate again.
await drainCeci(base);assert.deepEqual(published,[3]);
// Multi-model read-ahead preserves variants and never treats an unseparated quantity as a model.
const batteryMessages=[user('eu quero peças para minha loja'),user('baterias para iphones')];
assert.deepEqual(initialProductQueries([...batteryMessages,user('iphone 12, 13 e 15')]),['baterias iPhone 12','baterias iPhone 13','baterias iPhone 15']);
assert.deepEqual(initialProductQueries([...batteryMessages,user('iPhone 15 Pro Max e 15 Plus')]),['baterias iPhone 15 Pro Max','baterias iPhone 15 Plus']);
assert.deepEqual(initialProductQueries([...batteryMessages,user('iPhone 12 6 unidades')]),['baterias iPhone 12']);
assert.deepEqual(initialProductQueries([user('oi')]),[]);
assert.equal(matchesCatalogRequest('telas iPhone 12','FRONTAL IPHONE 12 OLED'),true);
assert.equal(matchesCatalogRequest('tela iPhone 12','TELA IPHONE 12 PRO INCELL'),false);
assert.equal(matchesCatalogRequest('tela iPhone 12','TELA IPHONE 13'),false);
assert.equal(matchesCatalogRequest('tela iPhone 12','TELA IPHONE 12 MINI'),false);
assert.equal(matchesCatalogRequest('tela iPhone 12','FRONTAL IPHONE 12/12 PRO S/A CHINA'),true);
assert.equal(matchesCatalogRequest('tela iPhone 12 Pro','FRONTAL IPHONE 12/12 PRO S/A CHINA'),true);
assert.equal(matchesCatalogRequest('tela iPhone 14','FRONTAL IPHONE 14 SOFT OLED ASUGAR PREMIUM'),true);
assert.equal(matchesCatalogRequest('tela iPhone 14','FRONTAL IPHONE 14 PRO VIVID'),false);
assert.equal(matchesCatalogRequest('bateria iPhone XR','BATERIA IPHONE XR'),true);
assert.equal(matchesCatalogRequest('tela Galaxy A54 5G','TELA SAMSUNG A54 4G'),false);
assert.equal(matchesCatalogRequest('bateria Moto G84','BATERIA MOTO G84'),true);
assert.throws(()=>catalogSearchTerms('tela'),/SPECIFIC_MODEL_REQUIRED/);
assert.equal(initialCatalogQuery([user('Quero tela de iphone 12')]),'tela iPhone 12');
assert.equal(initialCatalogQuery([user('Qual o preço da bateria do Moto G84?')]),'bateria Moto G84');
const fragments=[user('iPhone 12','u1'),{role:'assistant',body:'Qual peça você precisa para o iPhone 12?'},user('tela','u2'),{role:'assistant',body:'A compra da tela é para loja/assistência ou para uso próprio?'},user('loja','u3')];
assert.equal(commercialProfileEvidence(fragments),'u3');
assert.equal(initialCatalogQuery(fragments),'tela iPhone 12');
assert.equal(commercialProfileEvidence([user('loja','u1')]),null);
// Batch lookup contains partial failures and checkpoints successfully found candidates.
let batchCheckpoint,batchStep=0,batchSearches=[];
const batch=await runCeciAgent({config:cfg,context:ctx,memory:emptyCeciMemory(),messages:[user('baterias 12, 13 e 15')],quotePresentedAt:0,ports:{
 active:async()=>{},checkpoint:async value=>{batchCheckpoint=structuredClone(value);},
 respond:async(_instructions,input)=>{
  if(batchStep++){
   const results=JSON.parse(input.at(-1).output).consultas;
   assert.equal(results.length,3);assert.ok(results[1].error);assert.equal(results[2].items[0].id,215);
   return [{type:'function_call',name:'responder_cliente',call_id:'final',arguments:JSON.stringify(finish('Você prefere alguma marca de bateria?')[1])}];
  }
  return [{type:'function_call',name:'buscar_catalogos',call_id:'batch',arguments:JSON.stringify({buscas:['bateria 12','bateria 13','bateria 15']})}];
 },search:async query=>{batchSearches.push(query);if(query==='bateria 13')throw new Error('ERP_UNAVAILABLE');return {items:[{id:200+Number(query.slice(-2)),name:query}],total:1};},
 inspect:async()=>assert.fail(),prepare:async()=>assert.fail(),restore:async()=>assert.fail(),history:async()=>[]
}});
assert.equal(batchSearches.length,3);assert.equal(batchCheckpoint.step,1);assert.equal(batch.memory.products.length,2);
console.log('PASS: conversation memory, cross-turn options, partial edits, removal, failures, restoration, history, safeguards, handoff and inbound batching');

for(const text of ['Temos 3 em estoque.','Há três unidades em estoque.','Estoque: 12','Estoque total de 20 peças.','Temos 3 peças.','Restam 4 unidades disponíveis.'])assert.match(replyViolation(text,true),/interno/,text);
assert.equal(replyViolation('Esse produto está disponível.',true),'');assert.equal(replyViolation('Seu orçamento inclui 2 unidades.',true),'');
const inspected=await run([['buscar_catalogo',{busca:'frontal'}],['consultar_opcoes',{productIds:[101],exibirCards:true}],finish('Encontrei esta opção disponível.')]);
const toolOutputs=inspected.consumed.flatMap(input=>input.filter(row=>row.type==='function_call_output').map(row=>JSON.parse(row.output)));
assert.ok(!toolOutputs.some(row=>row.items?.some(item=>'stock' in item)),'model receives availability but never numeric inventory');assert.equal(inspected.result.products[0].stock,20,'internal stock validation is preserved');
console.log('PASS inventory privacy: numeric stock cannot appear in Ceci prose or model tool results; availability and ordered quantities remain allowed');
