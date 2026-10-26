import assert from 'node:assert/strict';
import {centerCellPolicy,customerQuoteText,prepareQuote,productForQuote} from '../lib/erp/quote.ts';

const item={
  id:15015,
  nome:'FRONTAL IPHONE 15 PRO MAX SOFT OLED ASUGAR PREMIUM',
  quantidade:3,
  valorVenda:396,
  valorVenda2:0,
  valorCusto:215,
  excluido:0,
  snExibirCatalogo:1,
  produtoDisponibilidadeId:1,
  snPeca:1,
  snAcessorio:0,
  snServico:0
};

const projected=productForQuote(item,centerCellPolicy('lojista'));
assert.equal(projected.priceField,'valorVenda');
assert.equal(projected.priceCents,39600);
assert.equal('valorCusto' in projected,false);

const draft=await prepareQuote({product:async id=>id===item.id?{item,checkedAt:Date.now()}:null},[{productId:item.id,quantity:1}],centerCellPolicy('lojista'));
assert.equal(draft.lines[0].unitCents,39600);
assert.equal(draft.totalCents,39600);
const reply=customerQuoteText(draft);
assert.match(reply,/Valor unitário: R\$\s396,00/);
assert.match(reply,/Total: R\$\s396,00/);
assert.doesNotMatch(reply,/346/);
assert.doesNotMatch(reply,/215/);
assert.match(reply,/confirmados agora no sistema da CenterCell/);
assert.doesNotMatch(reply,/MercadoPhone/i);

console.log('PASS: quote uses the exact MercadoPhone valorVenda and deterministic server formatting');
