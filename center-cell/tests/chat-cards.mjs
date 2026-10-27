import assert from 'node:assert/strict';
import {parseChatCard,productMessage,catalogMessages,quoteMessage} from '../lib/chat-cards.ts';
import {centerCellPolicy,productForQuote} from '../lib/erp/quote.ts';
const raw={id:101,nome:'Tela iPhone 15 · Original',quantidade:12,valorVenda:389.90,valorCusto:210,excluido:0,snExibirCatalogo:1,produtoDisponibilidadeId:1,snPeca:1,snAcessorio:0,snServico:0};
const verified=productForQuote(raw,centerCellPolicy('lojista'));
const options=productMessage('Temos as duas opções. Veja os valores conferidos:',[
  {productId:verified.id,name:verified.name,stock:verified.stock,unitCents:verified.priceCents},
  {productId:102,name:'Tela iPhone 15 · Incell',stock:34,unitCents:19950}
],Date.now());
assert.equal(options.card.items[0].unitCents,38990);
assert.match(options.body,/R\$\s*389,90/);
assert.match(options.body,/Disponível/);assert.doesNotMatch(options.body,/\b(?:12|34) em estoque/);assert.equal(options.card.items[1].stock,34,'keep inventory available for internal validation');
assert.doesNotMatch(options.body,/210/);
assert.equal(parseChatCard(JSON.stringify(options.card))?.type,'products');
assert.equal(parseChatCard(''),null);
const list=catalogMessages('Encontrei as opções para o seu modelo:',Array.from({length:17},(_,i)=>({productId:1000+i,name:`Tela iPhone 12 qualidade ${i+1}`,stock:i===16?0:5,unitCents:i===16?null:7990+i,status:i===16?'unavailable':'available'})),Date.now(),'Qual opção você prefere?');
assert.equal(list.length,3);assert.deepEqual(list.map(part=>part.card.items.length),[8,8,1]);
assert.ok(list.every(part=>part.body.length<=4000&&parseChatCard(JSON.stringify(part.card))?.type==='catalog'));
assert.match(list.at(-1).body,/Indisponível no momento/);assert.ok(list.every(p=>!p.body.includes('5 em estoque')));assert.match(list[0].body,/Disponível/);
assert.doesNotMatch(list.at(-1).body,/R\$\s*0,00/);
const draft={storeId:4046,checkedAt:Date.now(),priceField:'valorVenda',reserved:false,
  lines:[{productId:102,name:'Tela iPhone 15 · Incell',quantity:2,unitCents:19950,totalCents:39900,priceField:'valorVenda'},{productId:101,name:'Tela iPhone 15 · Original',quantity:1,unitCents:38990,totalCents:38990,priceField:'valorVenda'}],totalCents:78890};
const quote=quoteMessage('bc9fd456-aabb-4000-9000-0ec77fd3b522',draft);
assert.match(quote.body,/Orçamento #BC9FD456/);
assert.match(quote.body,/Total: R\$\s*788,90/);
assert.equal(quote.card.status,'awaiting');
assert.equal(quote.card.items[0].totalCents,39900);assert.match(quote.body,/2 × Tela iPhone 15/,'requested quantities remain visible');
assert.equal(parseChatCard(JSON.stringify(quote.card))?.type,'quote');
assert.throws(()=>quoteMessage('x',{...draft,totalCents:78891}),/UNVERIFIED_PRICE_SOURCE/);
console.log('PASS: verified product and quote cards preserve exact server cents and safe plain-text output');
