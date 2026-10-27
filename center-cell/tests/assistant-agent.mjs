import assert from 'node:assert/strict';
import {assistantTools,buildAssistantInstructions,safeToolError} from '../lib/server/assistant-agent.ts';
const prompt=buildAssistantInstructions({name:'Ceci',greeting:'Referência personalizada',instructions:'Sem emojis e sem urgência falsa.',handoff:'Referência da equipe'},{profile:'lojista',customerStatus:'verified',customerName:'Marcos Silva',introduced:true});
for(const text of ['Ceci','Sem emojis e sem urgência falsa.','Referência personalizada','Referência da equipe','Marcos','compra_confirmada','três atendentes','Nunca cite o nome do ERP'])assert.ok(prompt.includes(text),text);
assert.match(prompt,/continue o assunto sem nova apresentação/);
assert.match(prompt,/quantidades ABSOLUTAS/);
assert.match(prompt,/Valores e totais são montados pelo servidor/);
for(const name of ['responder_cliente','consultar_historico','recuperar_orcamento','consultar_e_orcar'])assert.ok(assistantTools.some(t=>t.name===name));
function strictSchema(schema){if(schema.type==='object'){assert.equal(schema.additionalProperties,false);assert.deepEqual([...schema.required].sort(),Object.keys(schema.properties).sort());for(const child of Object.values(schema.properties))strictSchema(child);}if(schema.items)strictSchema(schema.items);}
for(const tool of assistantTools){assert.equal(tool.strict,true);strictSchema(tool.parameters);}
assert.match(safeToolError(new Error('INSUFFICIENT_OR_UNAVAILABLE_STOCK')).error,/pedido anterior foi preservado/);
assert.doesNotMatch(safeToolError(new Error('ERP_NETWORK_ERROR')).error,/MercadoPhone/i);
console.log('PASS: saved settings, conversational instructions, transactional restrictions and strict tool schemas');

assert.match(prompt,/linguagem de sistema e formalidades/);assert.match(prompt,/termos técnicos somente quando forem necessários/);assert.match(prompt,/Mantenha nomes oficiais, códigos, tecnologias e variantes nos cards/);
