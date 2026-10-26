import assert from 'node:assert/strict';
import {classifyProduct} from '../lib/erp/catalog-classification.ts';

const examples=[
  ['FRONTAL IPHONE 13/IPHONE 14 OLED','telas',['iphone-13','iphone-14']],
  ['CAPA REALME C53/NOTE 50 SPACE','capas',['realme-c53','realme-note-50']],
  ['BATERIA SAMSUNG A25 ORIGINAL','baterias',['galaxy-a25']],
  ['PELICULA MOTO G9/MOTO G9 PLAY CERAMICA','peliculas',['moto-g9','moto-g9-play']],
  ['CABO USB V8','cabos',[]],
  ['FLEX XIAOMI REDMI NOTE 12','pecas',['redmi-note-12']]
];
for(const [name,type,models] of examples){const item=classifyProduct(name);assert.equal(item.type,type,name);assert.deepEqual(item.modelSlugs,models,name);assert.ok(!item.displayName.startsWith(name),name);}
assert.equal(classifyProduct(examples[0][0]).displayName,'Frontal iPhone 13/iPhone 14 · OLED');
console.log('PASS: local type, brand, multi-model, variant and display classification');
