import {classifyProduct,fold} from './erp/catalog-classification.ts';
import {matchesCatalogRequest} from './server/ceci-catalog.ts';
export type TestProduct={key:string;brand:string;model:string;modelSlug:string;part:string;query:string;exampleId:number;exampleName:string;network:string};
export const testBrands=['Samsung','Apple','Motorola','Xiaomi','Realme'] as const;
export const openingChoices={oi:'Oi',afternoon:'Boa tarde, tudo bem?',explore:'Vocês vendem peças pra assistência?'};
export type OpeningVariant='auto'|keyof typeof openingChoices;
export function seedNumber(value:string){let hash=2166136261;for(const c of value)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;}
/** Derive requests only from actual catalog descriptions. This does not confirm stock or price. */
export function testProductPool(rows:{id:number;name:string}[]){
 const pool=new Map<string,TestProduct>();
 for(const row of rows){const text=fold(row.name);if(/\b(?:PELICULA|CAPINHA|FERRAMENTA|MOLDE|PROTETOR)\b/.test(text))continue;
 const part=/\b(?:TELA|FRONTAL|DISPLAY|LCD|OLED)\b/.test(text)?'tela':/\bBATERIA\b/.test(text)?'bateria':/\b(?:CONECTOR|DOCK)\b/.test(text)?'conector':/\bTAMPA\b/.test(text)?'tampa':'';
 if(!part)continue;
 const classified=classifyProduct(row.name),network=/\b(?:4G|5G)\b/.exec(text)?.[0]||'';
 for(const m of classified.models){if(!testBrands.includes(m.brand as any))continue;const model=(m.brand==='Samsung'?m.name.replace(/^Galaxy /,'Samsung '):m.name)+(network?' '+network:'');const query=part+' '+model;if(!matchesCatalogRequest(query,row.name))continue;const key=[part,m.slug,network].join(':');if(!pool.has(key))pool.set(key,{key,brand:m.brand,model,modelSlug:m.slug,part,query,exampleId:row.id,exampleName:row.name,network});}
 }
 return [...pool.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
export function mentionsTestModel(text:string,product:TestProduct){return classifyProduct(text).models.some(m=>m.slug===product.modelSlug);}
export function similarTestModels(a:TestProduct,b:TestProduct){
 if(a.key===b.key||a.brand!==b.brand||a.part!==b.part)return false;
 if(a.modelSlug===b.modelSlug)return !!a.network&&!!b.network&&a.network!==b.network;
 if(a.network&&b.network&&a.network!==b.network)return false;
 const family=(s:string)=>s.replace(/-(?:pro|max|plus|mini|ultra|fe|play|power|stylus)\b/g,'').replace(/-+/g,'-');
 if(family(a.modelSlug)===family(b.modelSlug))return true;
 const x=family(a.modelSlug).match(/^(.*?)(\d+)([a-z]?)$/i),y=family(b.modelSlug).match(/^(.*?)(\d+)([a-z]?)$/i);
 return !!x&&!!y&&x[1]===y[1]&&x[3]===y[3]&&Math.abs(Number(x[2])-Number(y[2]))===1;
}
export function chooseTestProducts(pool:TestProduct[],kinds:string[],seed:string,recent:TestProduct[]=[],brand='auto'){
 const available=pool.filter(p=>brand==='auto'||p.brand===brand),used:TestProduct[]=[];
 const pairs=new Map<string,TestProduct[]>();
 if(kinds.includes('models')){
  const buckets=new Map<string,TestProduct[]>();
  for(const product of available){const family=product.modelSlug.replace(/-(?:pro|max|plus|mini|ultra|fe|play|power|stylus)\b/g,'').replace(/\d+/g,'#');const key=[product.brand,product.part,family].join(':');buckets.set(key,[...(buckets.get(key)||[]),product]);}
  for(const group of buckets.values())for(const product of group)pairs.set(product.key,group.filter(other=>similarTestModels(product,other)));
 }
 const count=(list:TestProduct[],key:(p:TestProduct)=>string,value:string)=>list.filter(p=>key(p)===value).length;
 return kinds.map((kind,index)=>{if(kind==='missing')return null;
 const candidates=kind==='models'?available.filter(p=>pairs.get(p.key)?.length):available;
 const scored=candidates.map(p=>({p,score:count(used,x=>x.key,p.key)*50000+count(used,x=>x.brand,p.brand)*10000+count(used,x=>x.part,p.part)*1000+count(recent,x=>x.brand,p.brand)*50+count(recent,x=>x.key,p.key)*500,tie:seedNumber(seed+':'+index+':'+p.key)})).sort((a,b)=>a.score-b.score||a.tie-b.tie);
 const product=scored[0]?.p;if(!product)return null;used.push(product);
 const pair=kind==='models'?(pairs.get(product.key)||[]).sort((a,b)=>seedNumber(seed+a.key)-seedNumber(seed+b.key))[0]:undefined;
 return {product,pair};
 });
}
