/** Editable, ordered keywords used only by the local catalog index. */
export const catalogTypes = [
  {id:'telas',label:'Telas',keywords:['TELA','DISPLAY','FRONTAL','LCD','OLED','INCELL']},
  {id:'baterias',label:'Baterias',keywords:['BATERIA']},
  {id:'capas',label:'Capas',keywords:['CAPA','CAPINHA']},
  {id:'peliculas',label:'Películas',keywords:['PELICULA','VIDRO']},
  {id:'cabos',label:'Cabos e carregadores',keywords:['CABO','CARREGADOR','FONTE','VEICULAR']},
  {id:'pecas',label:'Conectores e peças',keywords:['CONECTOR','FLEX','CAMERA','ALTO FALANTE','TAMPA']},
  {id:'outros',label:'Outros',keywords:[]}
] as const;
const variants=['ORIGINAL','INCELL','OLED','CERAMICA','3D','SPACE','SILICONE'];
export const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export const slug=(value:string)=>fold(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const unique=<T>(array:T[])=>[...new Set(array)];

function modelsOf(name:string){
  const text=fold(name).replace(/\s+/g,' ');
  const found:{brand:string;name:string;slug:string}[]=[];
  function add(brand:string,model:string){const name=model.replace(/\s+/g,' ').trim();const key=slug(name);if(key&&!found.some(item=>item.slug===key))found.push({brand,name,slug:key});}
  for(const match of text.matchAll(/\bIPHONE\s*(\d{1,2})(?:\s*(PRO\s*MAX|PRO|PLUS|MAX))?\b/g))add('Apple',`iPhone ${match[1]}${match[2]?' '+match[2].replace(/\s+/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):''}`);
  for(const match of text.matchAll(/\b(?:SAMSUNG\s+)?(?:GALAXY\s+)?([ASM]\s?\d{1,3})(?:\s*(ULTRA|PLUS|FE))?\b/g)){
    const code=match[1].replace(/\s/g,'');
    if(code[0]==='M'||code[0]==='A'||text.includes('SAMSUNG')||text.includes('GALAXY')||(/^S\d/.test(code)&&!text.includes('IPHONE')))add('Samsung',`Galaxy ${code}${match[2]?' '+match[2].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):''}`);
  }
  for(const match of text.matchAll(/\bMOTO(?:ROLA)?\s+([A-Z]?\d{1,3})(?:\s*(PLAY|PLUS|POWER|STYLUS))?\b/g))add('Motorola',`Moto ${match[1]}${match[2]?' '+match[2].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):''}`);
  for(const match of text.matchAll(/\b(?:XIAOMI\s+)?(REDMI\s+(?:NOTE\s*)?\d{1,3}[A-Z]?|POCO\s+[A-Z]\d{1,3}[A-Z]?|NOTE\s*\d{1,3}(?:\s*PRO)?)(?![A-Z0-9])/g)){
    if(match[1].startsWith('NOTE')&&text.includes('REALME')&&!text.includes('REDMI')&&!text.includes('XIAOMI'))continue;
    const value=match[1].replace(/\s+/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
    add('Xiaomi',value.startsWith('Note')?'Redmi '+value:value);
  }
  if(text.includes('REALME')){
    for(const match of text.matchAll(/\b(?:REALME\s+)?(C\d{1,3}|NOTE\s*\d{1,3})(?:\s*(PRO|PLUS))?\b/g))add('Realme',`Realme ${match[1].replace(/\s+/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}${match[2]?' '+match[2].toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):''}`);
  }
  return found;
}

function displayName(raw:string,models:ReturnType<typeof modelsOf>,variant:string){
  let name=raw.toLocaleLowerCase('pt-BR').replace(/\b\p{L}/gu,char=>char.toLocaleUpperCase('pt-BR'));
  name=name.replace(/\bIphone\b/gi,'iPhone').replace(/\bUsb\b/gi,'USB').replace(/\bLcd\b/gi,'LCD').replace(/\bOled\b/gi,'OLED').replace(/\bInc ell\b/gi,'Incell');
  name=name.replace(/\b([A-Za-z]{1,3})-(\d+[A-Za-z])\b/g,(_,a,b)=>`${a.toUpperCase()}-${b.toUpperCase()}`);
  for(const model of models){const pattern=new RegExp(model.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*'),'i');name=name.replace(pattern,model.name);}
  if(variant){const pattern=new RegExp(`(?:\\s*[·-]\\s*|\\s+)${variant}\\b`,'i');name=name.replace(pattern,'').trim()+` · ${variant==='3D'||variant==='OLED'?' '+variant:variant.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}`;}
  return name.replace(/\s+/g,' ').replace(/\s+·/g,' ·').trim();
}

export function classifyProduct(raw:string){
  const normalized=fold(raw);
  const type=catalogTypes.find(type=>type.keywords.some(word=>new RegExp(`\\b${word}\\b`).test(normalized)))||catalogTypes.at(-1)!;
  const models=modelsOf(raw);
  const variant=variants.find(word=>new RegExp(`\\b${word}\\b`).test(normalized))||'';
  return {type:type.id,brand:models[0]?.brand||'Outras',models,modelSlugs:unique(models.map(model=>model.slug)),variant,displayName:displayName(raw,models,variant)};
}
