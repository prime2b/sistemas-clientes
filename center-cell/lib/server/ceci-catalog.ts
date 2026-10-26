import {classifyProduct} from '../erp/catalog-classification.ts';
import {productSearchPlan,productSearchScore} from '../erp/product-search.ts';
const normalizeQuery=(query:string)=>query.replace(/\b(telas|frontais|baterias)\b/gi,word=>({telas:'tela',frontais:'frontal',baterias:'bateria'})[word.toLowerCase()]||word);
function modelsIn(value:string){
  const text=value.toUpperCase();
  const apple=[...text.matchAll(/\bIPHONE\s*(1[0-9]|[6-9]|SE|XR|XS|X)(?:\s*(PRO\s*MAX|PRO|PLUS|MAX|MINI))?\b/g)]
    .flatMap(match=>{
      const build=(model:string,variant='')=>'iphone-'+model.toLowerCase()+(variant?'-'+variant.toLowerCase().replace(/\s+/g,'-'):'');
      const found=[build(match[1],match[2])];
      // Product names often abbreviate only the repeated brand: IPHONE 12/12 PRO.
      const rest=text.slice(match.index+match[0].length);
      for(const alias of rest.matchAll(/^\s*\/\s*(?:IPHONE\s*)?(1[0-9]|[6-9]|SE|XR|XS|X)(?:\s*(PRO\s*MAX|PRO|PLUS|MAX|MINI))?\b/g))found.push(build(alias[1],alias[2]));
      return found;
    });
  return apple.length?[...new Set(apple)]:classifyProduct(value).models.map(model=>model.slug);
}

/** Exact model matching matters: an iPhone 12 Pro alone is not an iPhone 12 item. */
export function matchesCatalogRequest(query:string,name:string){
  const plan=productSearchPlan(normalizeQuery(query));
  if(plan.tokens.length<2||productSearchScore(name,'',plan).matchedGroups!==plan.groups.length)return false;
  const requested=modelsIn(query);
  if(requested.length!==1)return false;
  if(!modelsIn(name).includes(requested[0]))return false;
  const network=(value:string)=>/\b(?:4g|5g)\b/i.exec(value)?.[0].toLowerCase()||'';
  if(network(query)&&network(name)&&network(query)!==network(name))return false;
  return true;
}

export function catalogSearchTerms(query:string){
  const plan=productSearchPlan(normalizeQuery(query));
  if(plan.tokens.length<2||modelsIn(query).length!==1)throw new Error('SPECIFIC_MODEL_REQUIRED');
  return plan.groups;
}

/** Obvious one-model price inquiries can start a complete consultation before the model answers. */
type DialogueMessage={role:string;body:string;id?:string};
export function commercialProfileEvidence(messages:DialogueMessage[]){
  const last=messages.at(-1);
  if(last?.role!=='user')return null;
  const answer=last.body.trim().replace(/[.!?]+$/,'').trim();
  if(/\b(?:sou\s+lojista|(?:minha|nossa|pra|para|pela|da|na)\s+(?:(?:a|uma|minha|nossa)\s+)?(?:loja|assist[eê]ncia)|revenda|revendo)\b/i.test(answer))return last.id||'';
  const previous=messages.slice(0,-1).reverse().find(message=>message.role==='assistant'||message.role==='agent');
  if(/^(?:loja|assist[eê]ncia|lojista|pra loja|para loja)$/i.test(answer)&&previous&&/\b(?:loja|assist[eê]ncia)\b/i.test(previous.body)&&/\b(?:uso pr[oó]prio|uso pessoal|voc[eê])\b/i.test(previous.body))return last.id||'';
  return null;
}
export function initialCatalogQuery(messages:DialogueMessage[]){
  const user=messages.filter(message=>message.role==='user');
  const latest=user.at(-1)?.body||'';
  const profileAnswer=commercialProfileEvidence(messages)!==null;
  const recent=profileAnswer?user.slice(-5).map(message=>message.body).join(' '):latest;
  if(!profileAnswer&&!/(?:\b(?:valor|pre[cç]o|op[cç][oõ]es|quanto custa|quero|procuro|tem|preciso)\b)/i.test(latest))return '';
  if((profileAnswer?user.slice(-5).map(message=>message.body):[latest]).some(body=>/\b(?:\d+|duas?|tr[eê]s|quatro|cinco)\s+(?:unidades?|pe[cç]as?|telas?|baterias?|frontais?|displays?)\b/i.test(body)))return '';
  const piece=/\b(telas?|frontais?|displays?|baterias?|conectores?|docks?|tampas?)\b/i.exec(recent)?.[1];
  if(!piece)return '';
  const apple=/\biphone\s*(1[0-9]|[6-9]|SE|XR|XS|X)(?:\s*(Pro\s*Max|Pro|Plus|Max|Mini))?\b/i.exec(recent);
  const model=apple?`iPhone ${apple[1]}${apple[2]?' '+apple[2]:''}`:classifyProduct(recent).models.length===1?classifyProduct(recent).models[0].name:'';
  if(!model||modelsIn(recent).length!==1)return '';
  return `${normalizeQuery(piece)} ${model}`;
}
