import {selectAttendantIndex} from '../attendant-routing';
import {automaticEvidence} from './playground-evidence';
import {initialProductQueries} from './ceci-search';
import {adoptCeciModel,CECI_DEFAULT_MODEL} from './ceci-model-update';
import {requestCeciModel} from './ceci-model-client';
import {catalogSearchTerms,matchesCatalogRequest,initialCatalogQuery,commercialProfileEvidence} from './ceci-catalog';
import { env } from 'cloudflare:workers';
import { MercadoPhone, ErpError, normalizePhone } from '../erp/mercadophone';
import { centerCellPolicy, prepareQuote, productForQuote, type CustomerProfile } from '../erp/quote';
import {minimumMatchedGroups, productSearchPlan, productSearchScore, sqlLike} from '../erp/product-search';
import {runCeciAgent,type AgentResult,type AgentCheckpoint} from './ceci-engine';
import {confirmsPurchase} from '../ceci-purchase';
import {compactAgentHistory} from '../playground-economy';
import {ensureTestPolicy,requestTestModel} from './playground-meter';
import {readCeciMemory,mergeProducts} from './ceci-memory';
import {productMessage,catalogMessages,quoteMessage,parseChatCard,type ChatCardData,type CatalogItem} from '../chat-cards';
import {recordAddedProduct} from './catalog';
export const runtime = env as unknown as Record<string,string> & {DB:D1Database};
export const db=()=>runtime.DB;
export const all=async(sql:string,...args:unknown[]) => (await db().prepare(sql).bind(...args).all()).results as Record<string,any>[];
export const one=async(sql:string,...args:unknown[]) => await db().prepare(sql).bind(...args).first() as Record<string,any>|null;
export const run=async(sql:string,...args:unknown[])=>db().prepare(sql).bind(...args).run();
export const defaults={name:'Ceci',greeting:'Oi! Sou a Ceci, assistente da CenterCell. O que você está procurando hoje?',instructions:'Entenda rápido, consulte com precisão e resolva sem enrolação. Seja simpática, natural, tecnicamente competente e direta. Faça uma pergunta por vez, use humor leve somente quando apropriado e nunca sacrifique precisão para manter a conversa fluida.',handoff:'Certo, vou passar seu atendimento para uma pessoa da equipe continuar com você. Já deixei todo o contexto organizado para você não precisar repetir nada.',enabled:false,flowMode:'catalog_handoff' as 'catalog_handoff'|'quote',sharedInbox:true,handoffAssignment:'manual' as 'manual'|'automatic',catalogPricing:'lojista' as 'lojista'|'identified',model:CECI_DEFAULT_MODEL,whatsappMode:'web' as const,phoneId:'',graphVersion:'v23.0',team:['Atendente 1','Atendente 2','Atendente 3'],hours:'Segunda a sexta, 08h às 18h — confirmar com a equipe'};
const PERSONA_REVISION='ceci-2';
function normalizeTeam(value:unknown){
  const names=Array.isArray(value)?value.map(item=>String(item||'').trim().slice(0,60)).filter(Boolean).slice(0,3):[];
  if(names.length===1&&names[0].toLocaleLowerCase('pt-BR')==='comercial')names.length=0;
  for(let slot=1;names.length<3;slot++){
    const fallback=`Atendente ${slot}`;
    if(!names.some(name=>name.toLocaleLowerCase('pt-BR')===fallback.toLocaleLowerCase('pt-BR')))names.push(fallback);
  }
  return names;
}
export async function config(){
  await adoptCeciModel(db());
  const row=await one('SELECT value FROM settings WHERE key=?','config');
  const stored=row?JSON.parse(row.value):{};
  const revision=await one('SELECT value FROM settings WHERE key=?','personaRevision');
  if(revision?.value!==JSON.stringify(PERSONA_REVISION)){
    // A persona revision may add defaults, but must never replace admin edits.
    const next={...defaults,...stored,team:normalizeTeam(stored.team)};
    await db().batch([
      db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('config',JSON.stringify(next)),
      db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('personaRevision',JSON.stringify(PERSONA_REVISION))
    ]);
    return next;
  }
  return {...defaults,...stored,team:normalizeTeam(stored.team)};
}
export async function setting(key:string,value:unknown){await run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value));}
export async function getSetting(key:string){const r=await one('SELECT value FROM settings WHERE key=?',key);return r?JSON.parse(r.value):null;}
export async function saveConfig(value:Record<string,unknown>){
  const previous=await config();
  const next={...value,team:normalizeTeam(value.team)};
  const oldTeam=previous.team as string[],newTeam=next.team as string[];
  const remap=db().prepare("UPDATE conversations SET assigned=CASE assigned WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? ELSE assigned END WHERE status!='closed' AND assigned IN (?,?,?)")
    .bind(oldTeam[0],newTeam[0],oldTeam[1],newTeam[1],oldTeam[2],newTeam[2],...oldTeam);
  await db().batch([remap,db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('config',JSON.stringify(next))]);
}
export async function routeToAttendant(id:string,teamValue:unknown){
  const team=normalizeTeam(teamValue);
  const available=await all("SELECT slot,id FROM app_users WHERE role='attendant' AND active=1 AND presence='available' AND slot BETWEEN 1 AND 3");
  const eligible=new Set(available.map(item=>Number(item.slot)-1));
  if(!eligible.size){
    await run("UPDATE conversations SET status='human',assigned='',assigned_user_id='',claimed_at=0,updated=? WHERE id=?",Date.now(),id);
    return 'a equipe';
  }
  const placeholders=team.map(()=>'?').join(',');
  const rows=await all(`SELECT assigned,COUNT(*) AS total FROM conversations WHERE status='human' AND channel!='test' AND assigned IN (${placeholders}) GROUP BY assigned`,...team);
  const load=new Map(rows.map(row=>[String(row.assigned),Number(row.total||0)]));
  const cursor=Number((await getSetting('attendantRouting'))?.index??-1);
  const index=selectAttendantIndex(team,[...eligible],Object.fromEntries(load),cursor)!;
  const chosen={index,name:team[index]};
  await run("UPDATE conversations SET status='human',assigned=?,assigned_user_id=?,claimed_at=?,updated=? WHERE id=?",chosen.name,String(available.find(p=>Number(p.slot)-1===index)?.id||''),Date.now(),Date.now(),id);
  await setting('attendantRouting',{index:chosen.index,at:Date.now()});
  return chosen.name;
}
async function cryptKey(){if(!runtime.CONFIG_ENCRYPTION_KEY)throw new Error('Proteção de credenciais indisponível.');return crypto.subtle.importKey('raw',Uint8Array.from(atob(runtime.CONFIG_ENCRYPTION_KEY),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function saveSecret(key:string,value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptKey(),new TextEncoder().encode(value));await setting('secret:'+key,{iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(data)))});}
export async function secret(key:string){const row=await getSetting('secret:'+key);if(!row)return runtime[key]||'';const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(row.iv),c=>c.charCodeAt(0))},await cryptKey(),Uint8Array.from(atob(row.data),c=>c.charCodeAt(0)));return new TextDecoder().decode(result);}
export async function erp(){const client=new MercadoPhone(await secret('MERCADOPHONE_API_KEY'));await client.connect();return client;}
export {normalize} from '../erp/catalog-sync';
export async function searchProducts(query:string,profile:CustomerProfile,category='',offset=0){
  const plan=productSearchPlan(query);
  let rows:Record<string,unknown>[]=[];
  let total=0;
  if(!plan.groups.length){
    const where=category?'category = ?':'1=1';
    const args=category?[category]:[];
    rows=await all(`SELECT * FROM products WHERE ${where} ORDER BY name LIMIT 40 OFFSET ?`,...args,offset);
    total=Number((await one(`SELECT COUNT(*) AS count FROM products WHERE ${where}`,...args))?.count||0);
  }else{
    const categorySql=category?' AND category = ?':'';
    const strictSql=plan.groups.map(group=>'('+group.map(()=> 'search LIKE ?').join(' OR ')+')').join(' AND ');
    const strictArgs=plan.groups.flatMap(group=>group.map(sqlLike));
    rows=await all(`SELECT * FROM products WHERE ${strictSql}${categorySql} LIMIT 240`,...strictArgs,...(category?[category]:[]));
    if(!rows.length){
      const aliases=[...new Set(plan.groups.flat())].slice(0,40);
      const relaxedSql='('+aliases.map(()=> 'search LIKE ?').join(' OR ')+')'+categorySql;
      rows=await all(`SELECT * FROM products WHERE ${relaxedSql} LIMIT 300`,...aliases.map(sqlLike),...(category?[category]:[]));
    }
    const minimum=minimumMatchedGroups(plan);
    const ranked=rows.map(row=>({row,rank:productSearchScore(String(row.name||''),String(row.category||''),plan)}))
      .filter(item=>item.rank.matchedGroups>=minimum)
      .sort((a,b)=>b.rank.score-a.rank.score||String(a.row.name).localeCompare(String(b.row.name),'pt-BR'));
    total=ranked.length;
    rows=ranked.slice(offset,offset+40).map(item=>item.row);
  }
  return {total,items:rows.map(row=>{try{return {...productForQuote(JSON.parse(String(row.data)),centerCellPolicy(profile)),category:row.category,synced:row.synced};}catch{return {id:row.id,name:row.name,category:row.category,stock:JSON.parse(String(row.data)).quantidade,priceCents:null,canQuote:false,review:true,synced:row.synced};}})};
}
/** Exhaustive discovery in the synchronized index. Every price/stock is read separately from the live ERP. */
async function catalogCandidates(query:string){
  const groups=catalogSearchTerms(query);
  const clauses=groups.map(group=>'('+group.map(()=>'search LIKE ?').join(' OR ')+')').join(' AND ');
  const rows=await all(`SELECT id,name FROM products WHERE ${clauses} ORDER BY name,id`,...groups.flatMap(group=>group.map(sqlLike)));
  return rows.filter(row=>matchesCatalogRequest(query,String(row.name))).map(row=>({id:Number(row.id),name:String(row.name)}));
}
export async function quote(items:{productId:number,quantity:number}[],profile:CustomerProfile,name:string,conversationId=''){const draft=await prepareQuote(await erp(),items,centerCellPolicy(profile));const id=crypto.randomUUID();await run('INSERT INTO quotes (id,name,profile,conversation_id,data,total,created) VALUES (?,?,?,?,?,?,?)',id,name,profile,conversationId,JSON.stringify(draft),draft.totalCents,Date.now());for(const line of draft.lines)await recordAddedProduct(db(),line.productId).catch(()=>{});return {id,...draft};}
/** Read-only catalog consultation for the simulated human side; never creates an ERP order. */
export async function consultCatalog(query:string){
 const candidates=await catalogCandidates(query),client=await erp();let checkedAt=Date.now();const items:import('../chat-cards').CatalogItem[]=[];
 for(const candidate of candidates){try{const found=await client.product(candidate.id);if(!found||found.item.id!==candidate.id)throw new Error('PRODUCT_NOT_FOUND');const p=productForQuote(found.item,centerCellPolicy('lojista'));checkedAt=Math.min(checkedAt,found.checkedAt);items.push({productId:p.id,name:p.name,unitCents:p.priceCents,stock:p.stock,status:p.canQuote?'available':p.eligible?'unconfirmed':'unavailable'});}catch{items.push({productId:candidate.id,name:candidate.name,unitCents:null,stock:null,status:'unconfirmed'});}}
 return {items,total:items.length,checkedAt};
}
export async function reviseQuote(id:string,items:{productId:number,quantity:number}[],profile:CustomerProfile,name:string){
  const existing=await one("SELECT id FROM quotes WHERE id=? AND deleted_at=0 AND superseded_by=''",id);
  if(!existing)throw new Error('QUOTE_NOT_FOUND');
  const draft=await prepareQuote(await erp(),items,centerCellPolicy(profile));
  const nextId=crypto.randomUUID();
  const results=await db().batch([
    db().prepare("UPDATE quotes SET superseded_by=? WHERE id=? AND deleted_at=0 AND superseded_by=''").bind(nextId,id),
    db().prepare('INSERT INTO quotes (id,name,profile,conversation_id,data,total,created) SELECT ?,?,?,conversation_id,?,?,? FROM quotes WHERE id=? AND superseded_by=?')
      .bind(nextId,name,profile,JSON.stringify(draft),draft.totalCents,Date.now(),id,nextId)
  ]);
  if(!results[0].meta.changes||!results[1].meta.changes)throw new Error('QUOTE_NOT_FOUND');
  return {id:nextId,name,profile,...draft,revisedFrom:id};
}
export async function deleteQuote(id:string){
  const result=await run("UPDATE quotes SET deleted_at=? WHERE id=? AND deleted_at=0 AND superseded_by=''",Date.now(),id);
  if(!result.meta.changes)throw new Error('QUOTE_NOT_FOUND');
}
export async function addMessage(id:string,role:string,body:string,status='saved',messageId=crypto.randomUUID(),card?:ChatCardData,author?:{id:string;name:string},providerMessageId?:string){await db().batch([db().prepare('INSERT OR IGNORE INTO messages (id,conversation_id,role,body,status,card_data,created,author_id,author_name) VALUES (?,?,?,?,?,?,?,?,?)').bind(messageId,id,role,body,status,card?JSON.stringify(card):'',Date.now(),author?.id||'',author?.name||''),db().prepare('UPDATE conversations SET updated=? WHERE id=?').bind(Date.now(),id)]);if(providerMessageId){const {linkMessage}=await import('./zapi');await linkMessage(providerMessageId,messageId);}return messageId;}
export async function identifyMercadoPhoneCustomer(id:string){
  const c=await one('SELECT * FROM conversations WHERE id=?',id);
  if(!c)return {status:'unavailable' as const};
  if(String(c.phone||'').startsWith('lid:'))return {status:'unavailable' as const};
  const phone=normalizePhone(c.phone);
  if(phone.length<10||phone.length>15)return {status:'unavailable' as const};
  const age=Date.now()-Number(c.customer_checked_at||0);
  if(c.customer_status==='verified')return {status:'verified' as const,id:c.customer_id,name:c.customer_name};
  if(c.customer_status==='not_found'&&age<24*60*60*1000)return {status:'not_found' as const};
  if(c.customer_status==='ambiguous'&&age<24*60*60*1000)return {status:'ambiguous' as const};
  if(c.customer_status==='error'&&age<5*60*1000)return {status:'error' as const};
  try{
    const customer=await (await erp()).findCustomerByPhone(phone);
    if(customer){
      await run("UPDATE conversations SET customer_status='verified',customer_id=?,customer_name=?,customer_checked_at=?,profile='lojista' WHERE id=?",customer.id,customer.name,Date.now(),id);
      if(c.customer_status!=='verified')await addMessage(id,'note','Cliente identificado automaticamente no MercadoPhone.');
      return {status:'verified' as const,...customer};
    }
    await run("UPDATE conversations SET customer_status='not_found',customer_id=NULL,customer_name='',customer_checked_at=? WHERE id=?",Date.now(),id);
    return {status:'not_found' as const};
  }catch(error){
    if(error instanceof ErpError&&error.code==='AMBIGUOUS_CUSTOMER_PHONE'){
      await run("UPDATE conversations SET customer_status='ambiguous',customer_id=NULL,customer_name='',customer_checked_at=? WHERE id=?",Date.now(),id);
      return {status:'ambiguous' as const};
    }
    await run("UPDATE conversations SET customer_status='error',customer_id=NULL,customer_name='',customer_checked_at=? WHERE id=?",Date.now(),id);
    return {status:'error' as const};
  }
}
export async function latestCeciInbound(id:string){
  return await one("SELECT rowid AS seq,id,created FROM messages WHERE conversation_id=? AND role='user' AND deleted_at=0 ORDER BY rowid DESC LIMIT 1",id);
}
export async function resetCeciOrder(id:string){
  const memory=readCeciMemory(await getSetting('ceci:memory:'+id));
  memory.cart=[];memory.lastOptions=[];memory.currentQuoteId='';memory.pending='';memory.nextAction='';memory.updatedAt=Date.now();
  await setting('ceci:memory:'+id,memory);
}
export async function forgetCeciMemory(id:string){await run('DELETE FROM settings WHERE key IN (?,?)','ceci:memory:'+id,'ceci:progress:'+id);}
export type CeciReply={body:string;handoff:boolean;card?:ChatCardData;parts?:{body:string;card:ChatCardData}[];target:number;result:AgentResult;quoteId:string;deletedCount:number};
export async function chatReply(id:string,options?:{signal?:AbortSignal;target?:number}):Promise<CeciReply|undefined>{
  let c=await one('SELECT * FROM conversations WHERE id=?',id);
  if(!c||c.status!=='bot')return;
  const inbound=await latestCeciInbound(id);
  if(!inbound)return;
  const target=options?.target??Number(inbound.seq);
  const audit=c.channel==='test'?(kind:string,data:unknown)=>automaticEvidence(id,target,kind,data):async(_kind:string,_data:unknown)=>{};
  const deletedCount=Number((await one('SELECT COUNT(*) AS total FROM messages WHERE conversation_id=? AND deleted_at>0',id))?.total||0);
  const active=async()=>{
    if(options?.signal?.aborted)throw new Error('CECI_TIMEOUT');
    const current=await one('SELECT status,(SELECT COUNT(*) FROM messages WHERE conversation_id=? AND deleted_at>0) AS deletedCount FROM conversations WHERE id=?',id,id);
    if(current?.status!=='bot')throw new Error('CECI_STOPPED');
    if(Number(current.deletedCount)!==deletedCount)throw new Error('CECI_SUPERSEDED');
    if(Number((await latestCeciInbound(id))?.seq)!==target)throw new Error('CECI_SUPERSEDED');
  };
  await active();
  const identity=await identifyMercadoPhoneCustomer(id);
  await active();
  c=(await one('SELECT * FROM conversations WHERE id=?',id))!;
  const productionConfig=await config(),testPolicy=c.channel==='test'?await ensureTestPolicy(id):null;
  const cfg=testPolicy?{...productionConfig,model:testPolicy.models.ceci}:productionConfig,key=await secret('OPENAI_API_KEY');
  if(!key)throw new Error('Conecte a OpenAI em Integrações para testar a IA.');
  const history=await all("SELECT id,role,body,card_data,created FROM messages WHERE conversation_id=? AND rowid<=? AND deleted_at=0 AND role IN ('user','assistant','agent') ORDER BY rowid DESC LIMIT 40",id,target);
  const messages=history.reverse() as {id:string;role:string;body:string;created:number}[];
  const profile=c.profile==='nao_identificado'&&(commercialProfileEvidence(messages)!==null||cfg.flowMode==='catalog_handoff'&&cfg.catalogPricing==='lojista')?'lojista':c.profile;
  const memory=readCeciMemory(await getSetting('ceci:memory:'+id));
  const latestCard=await one("SELECT card_data,created FROM messages WHERE conversation_id=? AND deleted_at=0 AND CASE WHEN json_valid(card_data) THEN json_extract(card_data,'$.type') ELSE NULL END='quote' ORDER BY rowid DESC LIMIT 1",id);
  const card=latestCard?parseChatCard(latestCard.card_data):null;
  if(card?.type==='quote'&&card.status!=='approved'&&Number(latestCard!.created)>memory.updatedAt){
    memory.cart=card.items.map(item=>({productId:item.productId,quantity:item.quantity}));
    memory.currentQuoteId=card.id;mergeProducts(memory,card.items.map(item=>({id:item.productId,name:item.name})));
  }
  let quotePresentedAt=0;
  if(memory.currentQuoteId){
    const presented=await one("SELECT created FROM messages WHERE conversation_id=? AND deleted_at=0 AND CASE WHEN json_valid(card_data) THEN json_extract(card_data,'$.id') ELSE NULL END=? ORDER BY rowid DESC LIMIT 1",id,memory.currentQuoteId);
    const valid=c.channel==='test'||await one("SELECT id FROM quotes WHERE id=? AND conversation_id=? AND deleted_at=0 AND superseded_by=''",memory.currentQuoteId,id);
    if(presented&&valid)quotePresentedAt=Number(presented.created);else memory.currentQuoteId='';
  }
  const introduced=memory.introduced||!!await one("SELECT id FROM messages WHERE conversation_id=? AND role IN ('assistant','agent') AND deleted_at=0 LIMIT 1",id);
  let clientPromise:ReturnType<typeof erp>|undefined;
  const client=()=>clientPromise??=(erp());
  const listCatalog=async(query:string)=>{
    const candidates=await catalogCandidates(query);
    const service=await client();
    const items:CatalogItem[]=[];
    let checkedAt=Date.now();
    for(let index=0;index<candidates.length;index+=8){
      await active();
      const batch=await Promise.all(candidates.slice(index,index+8).map(async candidate=>{
        try{
          const found=await service.product(candidate.id);
          if(!found||Date.now()-found.checkedAt>60_000||found.checkedAt>Date.now())return {productId:candidate.id,name:candidate.name,stock:null,unitCents:null,status:'unconfirmed' as const};
          const product=productForQuote(found.item,centerCellPolicy('lojista'));
          if(product.id!==candidate.id||!matchesCatalogRequest(query,product.name))return {productId:candidate.id,name:candidate.name,stock:null,unitCents:null,status:'unconfirmed' as const};
          checkedAt=Math.min(checkedAt,found.checkedAt);
          return {productId:product.id,name:product.name,stock:product.stock,unitCents:product.priceCents,
            status:product.canQuote?'available' as const:product.eligible?'unconfirmed' as const:'unavailable' as const};
        }catch{return {productId:candidate.id,name:candidate.name,stock:null,unitCents:null,status:'unconfirmed' as const};}
      }));
      items.push(...batch);
    }
    await audit('catalog',{query,items,total:candidates.length,checkedAt});
    return {items,total:candidates.length,checkedAt};
  };
  const signature=JSON.stringify(['shared-catalog-v1',cfg.flowMode,cfg.catalogPricing,cfg.model,cfg.name,cfg.greeting,cfg.instructions,cfg.handoff]);
  const stored=await getSetting('ceci:progress:'+id);
  const checkpoint=stored?.target===target&&stored?.deletedCount===deletedCount&&stored?.signature===signature&&Date.now()-stored.at<10*60_000?stored.value as AgentCheckpoint:undefined;
  const lastUser=messages.filter(m=>m.role==='user').at(-1);
  const lastAnswer=lastUser?messages.slice(0,messages.indexOf(lastUser)).filter(m=>m.role!=='user').at(-1)?.body||'':'';
  const confirming=!!lastUser&&!!memory.currentQuoteId&&quotePresentedAt>0&&lastUser.created>=quotePresentedAt&&confirmsPurchase(lastUser.body,lastAnswer,memory.cart);
  const suggested=checkpoint||confirming||profile!=='lojista'?'':initialCatalogQuery(messages,cfg.flowMode==='catalog_handoff');
  const initialCatalog=suggested?await listCatalog(suggested).then(found=>found.total?{query:suggested,...found}:undefined).catch(()=>undefined):undefined;
  const lookups=checkpoint||initialCatalog||confirming?[]:await Promise.allSettled(initialProductQueries(messages).map(async busca=>{const found=await searchProducts(busca,c!.profile);return {busca,items:found.items.slice(0,12).map(p=>({id:Number(p.id),name:String(p.name)})),count:found.total};}));
  for(const lookup of lookups)if(lookup.status==='fulfilled')await audit('search',{query:lookup.value.busca,items:lookup.value.items,total:lookup.value.count});
  const initialCandidates=lookups.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const compact=testPolicy?compactAgentHistory(messages):null;
  const contextSaved=compact?Math.max(0,new TextEncoder().encode(JSON.stringify(messages.map(m=>({id:m.id,role:m.role,body:m.body,created:m.created})))).length-new TextEncoder().encode(JSON.stringify(compact.messages.map(m=>({id:m.id,role:m.role,body:m.body,created:m.created})))).length):0;
  await active();
  const result=await runCeciAgent({checkpoint,initialCandidates,initialCatalog,representedProducts:compact?.represented,config:cfg,context:{profile,customerStatus:identity.status,customerName:'name' in identity?String(identity.name||''):'',introduced},memory,messages:compact?.messages||messages,quotePresentedAt,ports:{
    active,
    checkpoint:async value=>{await active();await setting('ceci:progress:'+id,{target,deletedCount,signature,at:Date.now(),value});},
    respond:async(instructions,input,tools)=>{
      const payload={model:cfg.model,store:false,max_output_tokens:1800,reasoning:{effort:'low'},instructions,input,tools,tool_choice:'required',parallel_tool_calls:false};
      const onDiagnostic=async(value:import('./ceci-model-client').ModelDiagnostic)=>{await setting('ceci:modelDiagnostic:'+id,value);console.warn('ceci_openai_status',value.status,value.reason);};
      const data=testPolicy?await requestTestModel({id,role:'ceci',key,payload,signal:options?.signal,contextBefore:new TextEncoder().encode(JSON.stringify(payload)).length+contextSaved,onDiagnostic}):await requestCeciModel({key,signal:options?.signal,payload,onDiagnostic});
      await run('DELETE FROM settings WHERE key=?','ceci:modelDiagnostic:'+id);
      return Array.isArray(data.output)?data.output:[];
    },
    search:async(query)=>{const found=await searchProducts(query,c!.profile);await audit('search',{query,total:found.total,items:found.items.map(p=>({id:p.id,name:p.name}))});return {total:found.total,items:found.items.slice(0,12).map(p=>({id:Number(p.id),name:String(p.name)}))};},
    catalog:listCatalog,
    inspect:async(ids)=>{
      const service=await client();let checkedAt=Date.now();
      const items=await Promise.all(ids.map(async productId=>{
        const found=await service.product(productId);
        if(!found)throw new Error('PRODUCT_NOT_FOUND');
        if(!Number.isFinite(found.checkedAt)||Date.now()-found.checkedAt>60000||found.checkedAt>Date.now())throw new Error('STALE_INVENTORY');
        const p=productForQuote(found.item,centerCellPolicy('lojista'));
        if(p.id!==productId)throw new Error('PRODUCT_NOT_FOUND');
        if(p.priceCents===null||p.priceCents<=0||p.stock===null)throw new Error('PRICE_UNAVAILABLE');
        checkedAt=Math.min(checkedAt,found.checkedAt);
        return {productId,name:p.name,stock:p.stock,unitCents:p.priceCents,available:p.canQuote};
      }));
      await audit('inspect',{items,checkedAt});
      return {items,checkedAt};
    },
    prepare:async(items)=>{const draft=await prepareQuote(await client(),items,centerCellPolicy('lojista'));await audit('prepare',draft);return draft;},
    restore:async(quoteId)=>{
      const previous=await one("SELECT card_data FROM messages WHERE conversation_id=? AND deleted_at=0 AND CASE WHEN json_valid(card_data) THEN json_extract(card_data,'$.id') ELSE NULL END=? ORDER BY rowid DESC LIMIT 1",id,quoteId);
      const parsed=previous?parseChatCard(previous.card_data):null;
      if(parsed?.type!=='quote')throw new Error('QUOTE_NOT_FOUND');
      return parsed.items.map(item=>({productId:item.productId,quantity:item.quantity}));
    },
    history:async(query)=>{
      const firstId=messages[0]?.id||'';
      const rows=query
        ? await all("SELECT id,role,body,created FROM messages WHERE conversation_id=? AND deleted_at=0 AND role IN ('user','assistant','agent') AND rowid<=? AND body LIKE ? ESCAPE '\\' ORDER BY rowid DESC LIMIT 30",id,target,'%'+query.replace(/[\\%_]/g,'\\$&')+'%')
        : await all("SELECT id,role,body,created FROM messages WHERE conversation_id=? AND deleted_at=0 AND role IN ('user','assistant','agent') AND rowid<(SELECT rowid FROM messages WHERE id=?) ORDER BY rowid DESC LIMIT 30",id,firstId);
      return rows.reverse() as {id:string;role:string;body:string;created:number}[];
    }
  }});
  await active();
  const quoteId=result.draft?crypto.randomUUID():'';
  let formatted:{body:string;card?:ChatCardData}={body:[result.text,result.nextStep].filter(Boolean).join('\n\n')};
  if(result.draft)formatted=quoteMessage(quoteId,result.draft,'lojista',result.text,{closing:result.nextStep,contextual:true});
  else if(result.catalog?.length){const parts=catalogMessages(result.text,result.catalog,result.checkedAt,result.nextStep);return {...parts[0],parts,handoff:!!result.handoff,target,result,quoteId,deletedCount};}
  else if(result.products?.length)formatted=productMessage(result.text,result.products,result.checkedAt,result.nextStep);
  return {...formatted,handoff:!!result.handoff,target,result,quoteId,deletedCount};
}
/** Commit only an answer to the current inbound batch; discarded generations have no order side effects. */
export async function publishCeciReply(id:string,reply:CeciReply){
  const c=await one('SELECT * FROM conversations WHERE id=?',id);
  if(c?.status!=='bot')throw new Error('CECI_STOPPED');
  if(Number((await latestCeciInbound(id))?.seq)!==reply.target)throw new Error('CECI_SUPERSEDED');
  if(Number((await one('SELECT COUNT(*) AS total FROM messages WHERE conversation_id=? AND deleted_at>0',id))?.total||0)!==reply.deletedCount)throw new Error('CECI_SUPERSEDED');
  const firstId='ceci-'+id+'-'+reply.target;
  const existing=!!await one('SELECT id FROM messages WHERE id=?',firstId);
  if(existing&&Number((await getSetting('ceci:answered:'+id))?.seq)>=reply.target&&(!reply.result.handoff||await one('SELECT id FROM messages WHERE id=?',firstId+'-handoff')))return;
  const {result}=reply,simulation=c.channel==='test';
  if(result.handoff?.reason==='compra_confirmada'&&!simulation){
    if(!await one("SELECT id FROM quotes WHERE id=? AND conversation_id=? AND deleted_at=0 AND superseded_by=''",result.handoff.quoteId,id))throw new Error('CECI_SUPERSEDED');
  }
  let providerMessageId:string|undefined;
  if(reply.parts?.length){
    for(const [index,part] of reply.parts.entries()){
      const messageId=index===0?firstId:firstId+'-part-'+(index+1);
      if(await one('SELECT id FROM messages WHERE id=?',messageId))continue;
      if(Number((await latestCeciInbound(id))?.seq)!==reply.target)throw new Error('CECI_SUPERSEDED');
      const providerMessageId=!simulation?await sendWhatsapp(c,part.body):undefined;
      await run('INSERT OR IGNORE INTO messages (id,conversation_id,role,body,status,card_data,created) VALUES (?,?,?,?,?,?,?)',messageId,id,'assistant',part.body,simulation?'saved':'accepted',JSON.stringify(part.card),Date.now());if(providerMessageId&&c.channel==='whatsapp_web'){const {linkMessage}=await import('./zapi');await linkMessage(providerMessageId,messageId);}
    }
  }else if(!simulation&&!existing)providerMessageId=await sendWhatsapp(c,reply.body);
  // The message and the memory are saved together so another worker cannot answer the same batch.
  result.memory.updatedAt=Date.now();
  const previousQuoteId=result.previousQuoteId;
  if(result.draft)result.memory.currentQuoteId=reply.quoteId;
  const statements=[
    ...(!reply.parts?.length?[db().prepare('INSERT OR IGNORE INTO messages (id,conversation_id,role,body,status,card_data,created) VALUES (?,?,?,?,?,?,?)').bind(firstId,id,'assistant',reply.body,simulation?'saved':'accepted',reply.card?JSON.stringify(reply.card):'',Date.now())]:[]),
    db().prepare('DELETE FROM settings WHERE key IN (?,?)').bind('ceci:progress:'+id,'ceci:retry:'+id),
    db().prepare('UPDATE conversations SET profile=?,updated=? WHERE id=?').bind(result.profile,Date.now(),id),
    db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('ceci:memory:'+id,JSON.stringify(result.memory)),
    db().prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('ceci:answered:'+id,JSON.stringify({seq:reply.target}))
  ];
  if(result.draft&&!simulation){
    statements.push(db().prepare('INSERT INTO quotes (id,name,profile,conversation_id,data,total,created) VALUES (?,?,?,?,?,?,?)').bind(reply.quoteId,c.name,result.profile,id,JSON.stringify(result.draft),result.draft.totalCents,Date.now()));
    if(previousQuoteId)statements.push(db().prepare("UPDATE quotes SET superseded_by=? WHERE id=? AND conversation_id=? AND deleted_at=0 AND superseded_by='' ").bind(reply.quoteId,previousQuoteId,id));
  }
  await db().batch(statements);if(providerMessageId&&c.channel==='whatsapp_web'){const {linkMessage}=await import('./zapi');await linkMessage(providerMessageId,firstId);}
  if(result.draft&&!simulation)for(const line of result.draft.lines)await recordAddedProduct(db(),line.productId).catch(()=>{});
  if(result.handoff){
    const operation=await config();
    const queued=operation.sharedInbox&&operation.handoffAssignment==='manual';
    const attendant=simulation||queued?'a equipe':await routeToAttendant(id,operation.team);
    if(queued&&!simulation)await run("UPDATE conversations SET status='human',assigned='',assigned_user_id='',updated=? WHERE id=?",Date.now(),id);
    if(simulation)await run("UPDATE conversations SET status='human' WHERE id=?",id);
    if(result.handoff.reason==='compra_confirmada')await run("UPDATE messages SET card_data=json_set(card_data,'$.status','approved') WHERE conversation_id=? AND deleted_at=0 AND CASE WHEN json_valid(card_data) THEN json_extract(card_data,'$.id') ELSE NULL END=?",id,result.handoff.quoteId);
    const label=result.handoff.reason==='compra_confirmada'?'Compra confirmada após cotação':result.handoff.reason==='catalogo_listado'?'Produtos listados · aguardando atendente':result.handoff.reason;
    const order=result.memory.cart.map(item=>`${item.quantity} × ${result.memory.products.find(p=>p.id===item.productId)?.name||'Produto'} (cód. ${item.productId})`).join('\n');
    await addMessage(id,'note','Encaminhamento automático: '+label+'\nResponsável: '+attendant+'\nResumo: '+result.handoff.summary+'\nPedido em contexto: '+(order||'Nenhum item definido')+'\nOrçamento apresentado: '+(previousQuoteId||'Nenhum')+'\nPendência: '+result.memory.pending+'\nPróxima ação: '+result.memory.nextAction,'saved',firstId+'-handoff');
  }
}
export async function sendWhatsapp(c:Record<string,any>,body:string){if(c.channel==='whatsapp_web'){const {send}=await import('./zapi');return send(c.phone,body);}if(runtime.WHATSAPP_WEBHOOK_PUBLIC!=='true')throw new Error('WhatsApp pendente de ativação do canal.');if(Date.now()-c.last_inbound>24*60*60*1000)throw new Error('Janela de atendimento encerrada. É necessário um modelo aprovado pela Meta.');const cfg=await config();const token=await secret('WHATSAPP_TOKEN');if(!token||!/^\d+$/.test(cfg.phoneId))throw new Error('Conecte o WhatsApp em Integrações.');const res=await fetch(`https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneId}/messages`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:c.phone,type:'text',text:{body}}),signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error('A Meta não confirmou o envio. Confira a conexão antes de tentar novamente.');const result:any=await res.json();return result.messages?.[0]?.id;}
