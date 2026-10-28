import {sharedGet,sharedPost,sharedActions,listSharedConversations} from '../../../lib/server/shared-inbox';
import {TEST_MODEL,testModels} from '../../../lib/playground-economy';
import {createTestPolicy,getTestPolicy,testUsage} from '../../../lib/server/playground-meter';
import {processCeci,canResumeCeciValidation,resumeCeciValidation} from '../../../lib/server/ceci-inbound';
import {ceciDiagnostic} from '../../../lib/ceci-diagnostics';
import {requestCeciModel,type ModelDiagnostic} from '../../../lib/server/ceci-model-client';
import {currentUser} from '../../../lib/server/app-auth';
import { z } from 'zod';
import * as core from '../../../lib/server/core';
import {integrationStatus,testConnection,signature} from '../../../lib/server/integrations';
import {beginCatalogSync,syncCatalogPage} from '../../../lib/erp/catalog-sync';
import {autoSyncSettings,saveAutoSyncSettings} from '../../../lib/erp/auto-sync';
import {isOwner} from '../../../lib/server/roles';
import {bridgeUrl} from '../../../lib/server/whatsapp-web-protocol';
import * as zapi from '../../../lib/server/zapi';
import {catalogMeta,queryCatalog,catalogPrices,enrichCatalogBatch,recordCatalogActivity,recordAddedProduct} from '../../../lib/server/catalog';
import {quoteMessage} from '../../../lib/chat-cards';
import {prepareQuote,centerCellPolicy} from '../../../lib/erp/quote';

export const dynamic='force-dynamic';
const profile=z.enum(['lojista','consumidor_final','nao_identificado']);
const quoteItems=z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(10000)})).min(1).max(30);
const configSchema=z.object({flowMode:z.enum(['catalog_handoff','quote']).default('catalog_handoff'),sharedInbox:z.boolean().default(true),handoffAssignment:z.enum(['manual','automatic']).default('manual'),catalogPricing:z.enum(['lojista','identified']).default('lojista'),name:z.string().min(1).max(80),greeting:z.string().min(1).max(800),instructions:z.string().max(6000),handoff:z.string().min(1).max(800),enabled:z.boolean(),model:z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/),whatsappMode:z.enum(['web','cloud']).default('web'),phoneId:z.string().regex(/^\d{0,40}$/),graphVersion:z.string().regex(/^v\d+\.\d+$/),team:z.array(z.string().trim().min(1).max(60)).length(3).refine(items=>new Set(items.map(item=>item.toLocaleLowerCase('pt-BR'))).size===3),hours:z.string().max(300)});
const actions=z.discriminatedUnion('action',[
  z.object({action:z.literal('config'),config:configSchema,automationIntent:z.boolean().optional()}),
  z.object({action:z.literal('secret'),key:z.enum(['OPENAI_API_KEY','MERCADOPHONE_API_KEY','WHATSAPP_TOKEN','META_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_WEB_BRIDGE_TOKEN','ZAPI_INSTANCE_TOKEN','ZAPI_CLIENT_TOKEN']),value:z.string().min(8).max(4000)}),
  z.object({action:z.literal('webBridgeConfig'),url:z.string().max(300)}),
  z.object({action:z.literal('zapiConfig'),instanceId:z.string().regex(/^[A-Fa-f0-9]{32}$/)}),
  z.object({action:z.literal('beginSync'),restart:z.boolean().optional()}),
  z.object({action:z.literal('sync'),runId:z.string().uuid(),page:z.number().int().min(1).max(10000)}),
  z.object({action:z.literal('testErp')}),
  z.object({action:z.literal('autoSync'),enabled:z.boolean(),interval:z.union([z.literal(15),z.literal(30),z.literal(60),z.literal(360),z.literal(1440)])}),
  z.object({action:z.literal('disconnectErp')}),
  z.object({action:z.literal('testConnection'),service:z.enum(['openai','whatsapp'])}),
  z.object({action:z.literal('createConversation'),name:z.string().min(1).max(100),profile,phone:z.string().regex(/^[+\d().\s-]{0,30}$/).optional(),testMode:z.enum(['economic','production']).default('economic'),caseTokens:z.number().int().min(1000).max(1000000).default(60000)}),
  z.object({action:z.literal('conversation'),id:z.string().uuid(),status:z.enum(['bot','human','closed']),profile,assigned:z.string().max(60),notes:z.string().max(4000)}),
  z.object({action:z.literal('archiveConversation'),id:z.string().uuid(),archive:z.boolean()}),
  z.object({action:z.literal('deleteConversation'),id:z.string().uuid()}),
  z.object({action:z.literal('deleteMessage'),id:z.string().uuid(),messageId:z.string().min(1).max(160)}),
  z.object({action:z.literal('routeConversation'),id:z.string().uuid(),reason:z.enum(['compra_confirmada','atendimento_humano'])}),
  z.object({action:z.literal('resumeCeci'),id:z.string().uuid()}),
  z.object({action:z.literal('playgroundReview'),id:z.string().uuid(),verdict:z.enum(['approved','changes','pending']),notes:z.string().max(2000)}),
  z.object({action:z.literal('playgroundProbe'),testMode:z.enum(['economic','production']).default('economic'),id:z.string().uuid().optional()}),
  z.object({action:z.literal('message'),id:z.string().uuid(),body:z.string().min(1).max(4000),role:z.enum(['user','agent','note'])}),
  z.object({action:z.literal('quote'),items:quoteItems,profile,name:z.string().trim().min(1).max(100),conversationId:z.string().uuid().optional()}),
  z.object({action:z.literal('editQuote'),id:z.string().uuid(),items:quoteItems,profile,name:z.string().trim().min(1).max(100)}),
  z.object({action:z.literal('deleteQuote'),id:z.string().uuid()})
  ,z.object({action:z.literal('catalogActivity'),kind:z.enum(['search','product','model']),value:z.string().min(1).max(100)})
  ,z.object({action:z.literal('enrichCatalog')})
  ,z.object({action:z.literal('sendQuote'),quoteId:z.string().uuid(),conversationId:z.string().uuid()})
]);
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function quoteStockChanges(items:{productId:number;quantity:number}[]){
  const client=await core.erp();const stockChanges=[];
  for(const item of items){const found=await client.product(item.productId);const stock=found?.item?.quantidade;stockChanges.push({productId:item.productId,available:typeof stock==='number'?Math.max(0,stock):0,requested:item.quantity});}
  return stockChanges;
}

export async function GET(request:Request){
  const user=await currentUser(request);
  if(!user)return json({error:'Entre na sua conta para acessar a central.'},401);
  if(!isOwner(user)){if(user.mustChangePassword)return json({error:'Altere sua senha inicial.'},403);try{return await sharedGet(request,user);}catch{return json({error:'Parâmetros inválidos.'},400);}}
  if(user.mustChangePassword)return json({error:'Altere sua senha inicial antes de continuar.'},403);
  try{
    const u=new URL(request.url);
    if(u.searchParams.has('playground')){
      const cfg=await core.config(),check=await core.getSetting('check:openai');
      const modelCheck=async(model:string)=>{const saved=await core.getSetting('check:playgroundModel:'+model);return {...saved,ok:!!saved?.ok&&saved.fingerprint===await signature('openai',{...cfg,model})};};
      return json({sessions:await core.all("SELECT c.id,c.name,c.status,c.profile,c.updated,(SELECT value FROM settings WHERE key='playground:review:'||c.id) AS review FROM conversations c WHERE c.channel='test' ORDER BY c.updated DESC LIMIT 40"),config:cfg,testModels:testModels('economic',cfg.model),testChecks:{economic:await modelCheck(TEST_MODEL),production:await modelCheck(cfg.model)},readiness:{generation:!!check?.responseValidated&&!!check?.ok&&check.fingerprint===await signature('openai',cfg),openai:!!await core.secret('OPENAI_API_KEY'),erp:!!await core.secret('MERCADOPHONE_API_KEY'),catalog:Number((await core.one('SELECT COUNT(*) AS n FROM products'))?.n||0)}});
    }
    if(u.searchParams.get('catalog')==='meta')return json(await catalogMeta(core.db()));
    if(u.searchParams.get('catalog')==='prices')return json({items:await catalogPrices(core.db(),(u.searchParams.get('ids')||'').split(',').map(Number).filter(n=>Number.isSafeInteger(n)&&n>0).slice(0,30),profile.parse(u.searchParams.get('profile')||'lojista'))});
    if(u.searchParams.get('catalog')==='results')return json(await queryCatalog(core.db(),{query:u.searchParams.get('search')||'',profile:profile.parse(u.searchParams.get('profile')||'lojista'),model:u.searchParams.get('model')||'',type:u.searchParams.get('type')||'',brand:u.searchParams.get('brand')||'',stockOnly:u.searchParams.get('stockOnly')!=='false',lowOnly:u.searchParams.get('lowOnly')==='true',sort:u.searchParams.get('sort')||'popular',offset:Math.max(0,Math.min(100000,Number(u.searchParams.get('offset'))||0)),limit:Math.min(50,Math.max(1,Number(u.searchParams.get('limit'))||50))}));
    if(u.searchParams.has('search'))return json(await core.searchProducts(u.searchParams.get('search')||'',profile.parse(u.searchParams.get('profile')||'lojista'),u.searchParams.get('category')||'',Math.max(0,Math.min(100000,Number(u.searchParams.get('offset'))||0))));
    if(u.searchParams.has('messages')){
      const id=u.searchParams.get('messages');
      const conversation=await core.one('SELECT id,channel,status,profile,customer_status FROM conversations WHERE id=?',id);
      const test=conversation?.channel==='test';
      const retry=test?await core.getSetting('ceci:retry:'+id):null;
      const modelDiagnostic=test?await core.getSetting('ceci:modelDiagnostic:'+id):null;
      const review=test?await core.getSetting('playground:review:'+id):null;
      const snapshot=test?await core.getSetting('playground:config:'+id):null;
      const currentFingerprint=test?await signature('internal',await core.config()):'';
      return json({retryable:id?await canResumeCeciValidation(id):false,messages:await core.all('SELECT * FROM messages WHERE conversation_id=? AND deleted_at=0 ORDER BY created,rowid',id),conversation,...(test?{testPolicy:await getTestPolicy(id!),usage:await testUsage(id!),configurationChanged:!!snapshot&&snapshot.fingerprint!==currentFingerprint,diagnostic:retry?{...retry,...modelDiagnostic,attempts:retry.attempts,message:ceciDiagnostic(retry.reason)}:null,review:review?{...review,current:review.fingerprint===currentFingerprint}:null,state:await core.getSetting('playground:state:'+id)}:{})});
    }
    const cfg=await core.config();
    const navigation={
      conversationsWaiting:Number((await core.one("SELECT COUNT(*) AS count FROM conversations c WHERE c.channel!='test' AND c.status='human' AND c.archived_at=0 AND c.last_inbound>0 AND c.last_inbound>(SELECT COALESCE(MAX(created),0) FROM messages m WHERE m.conversation_id=c.id AND m.role='agent' AND m.deleted_at=0)"))?.count||0),
      quotesOpen:Number((await core.one("SELECT COUNT(*) AS count FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.channel!='test' AND m.deleted_at=0 AND m.created>? AND CASE WHEN json_valid(m.card_data) THEN json_extract(m.card_data,'$.type') ELSE NULL END='quote' AND CASE WHEN json_valid(m.card_data) THEN json_extract(m.card_data,'$.status') ELSE NULL END='awaiting'",Date.now()-15*60_000))?.count||0),
      teamAvailable:await core.all("SELECT id,display_name AS name,avatar,slot FROM app_users WHERE role='attendant' AND active=1 AND presence='available' ORDER BY slot")
    };
    const secrets=Object.fromEntries(await Promise.all(['MERCADOPHONE_API_KEY','OPENAI_API_KEY','WHATSAPP_TOKEN','META_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_WEB_BRIDGE_TOKEN','ZAPI_INSTANCE_TOKEN','ZAPI_CLIENT_TOKEN'].map(async key=>[key,!!await core.secret(key)])));
    return json({config:cfg,secrets,navigation,webBridge:await core.getSetting('whatsappWebBridge'),zapiInstanceId:await zapi.instanceId(),zapiWebhookReady:await zapi.webhookConfigured(),activation:await integrationStatus(cfg),ceciPaused:!!await core.getSetting('ceci:manualPause'),ceciReply:await core.getSetting('check:ceciReply'),autoSync:await autoSyncSettings(core.db()),webReceivedAt:(await zapi.received())?.at||0,whatsappReady:cfg.whatsappMode==='web'?!!(await zapi.credentialsReady()&&(await zapi.connection())?.connected):core.runtime.WHATSAPP_WEBHOOK_PUBLIC==='true',conversations:await listSharedConversations(user),quotes:await core.all("SELECT q.* FROM quotes q LEFT JOIN conversations c ON c.id=q.conversation_id WHERE q.deleted_at=0 AND q.superseded_by='' AND (q.conversation_id='' OR (c.id IS NOT NULL AND c.channel!='test')) ORDER BY q.created DESC LIMIT 100"),catalog:await core.one('SELECT COUNT(*) AS count,MAX(synced) AS synced FROM products'),sync:await core.getSetting('sync'),erpCheck:await core.getSetting('erpCheck'),categories:await core.all('SELECT DISTINCT category FROM products ORDER BY category')});
  }catch{return json({error:'Não foi possível carregar os dados. Tente novamente.'},503);}
}

export async function POST(request:Request){
  const user=await currentUser(request);
  if(!user)return json({error:'Acesso restrito.'},401);
  if(user.mustChangePassword)return json({error:'Altere sua senha inicial antes de continuar.'},403);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  try{
    if(Number(request.headers.get('content-length')||0)>30000)return json({error:'Conteúdo muito extenso.'},413);
    const raw=await request.json() as Record<string,any>;
    if(sharedActions.has(raw.action)){const handled=await sharedPost(request,user,raw);if(handled)return handled;}
    if(!isOwner(user))return json({error:'Acesso restrito à administração.'},403);
    const a=actions.parse(raw);
    switch(a.action){
      case 'config':{
        const previous=await core.config();
        const agentChanged=(['name','greeting','instructions','handoff','model'] as const).some(key=>previous[key]!==a.config[key]);
        const pausedForValidation=agentChanged&&a.config.enabled;
        const next=pausedForValidation?{...a.config,enabled:false}:a.config;
        if(next.enabled){const status=await integrationStatus(next);if(!(next.whatsappMode==='web'?status.automation?.ready:status.ready))return json({error:'Conclua as conexões e a sincronização do catálogo em Integrações antes de ligar o atendimento automático.'},409);}
        await core.saveConfig(next);
        // Only the explicit automation switch is a manual pause. Validation must resume automatically.
        if(a.automationIntent){await core.setting('ceci:manualPause',!a.config.enabled);await zapi.cancelCeciOnConnect();}
        return json({ok:true,pausedForValidation});
      }
      case 'secret':
        if(a.key==='ZAPI_CLIENT_TOKEN'){
          try{return json(await zapi.updateClientToken(a.value));}
          catch(error){return error instanceof zapi.ClientTokenUpdateError?json({error:error.message},error.status):json({error:'Não foi possível concluir a atualização segura do Client-Token. Verifique a conexão e tente novamente.'},503);}
        }
        await core.saveSecret(a.key,a.value);
        if(a.key==='MERCADOPHONE_API_KEY')await core.setting('erpCheck',null);
        if(a.key==='WHATSAPP_WEB_BRIDGE_TOKEN'||a.key==='ZAPI_INSTANCE_TOKEN'){
          await core.setting('check:whatsappWeb',{connected:false,at:Date.now()});
          await core.setting('check:whatsappWebReceived',null);
        }
        await core.setting('config',{...await core.config(),enabled:false}); return json({ok:true});
      case 'zapiConfig':
        await core.saveSecret('ZAPI_INSTANCE_ID',a.instanceId.toUpperCase());
        await core.setting('zapi:webhooks',null);
        await core.setting('config',{...await core.config(),whatsappMode:'web',enabled:false});
        await core.setting('check:whatsappWeb',{connected:false,at:Date.now()});
        await core.setting('check:whatsappWebReceived',null);
        return json({ok:true});
      case 'webBridgeConfig':
        await core.setting('whatsappWebBridge',{url:bridgeUrl(a.url)});
        await core.setting('config',{...await core.config(),whatsappMode:'web',enabled:false});
        await core.setting('check:whatsappWeb',{connected:false,at:Date.now()});
        await core.setting('check:whatsappWebReceived',null);
        return json({ok:true});
      case 'testConnection': return json(await testConnection(a.service));
      case 'beginSync': return json(await beginCatalogSync(core.db(),a.restart));
      case 'sync': return json(await syncCatalogPage(core.db(),a.runId,a.page,async page=>(await core.erp()).inventory({page,limit:300})));
      case 'autoSync': await saveAutoSyncSettings(core.db(),a.enabled,a.interval);return json({ok:true});
      case 'disconnectErp':
        await core.saveSecret('MERCADOPHONE_API_KEY','');
        await core.setting('erpCheck',null);
        await saveAutoSyncSettings(core.db(),false,(await autoSyncSettings(core.db())).interval);
        await core.setting('config',{...await core.config(),enabled:false});
        return json({ok:true});
      case 'testErp':{
        await core.setting('erpCheck',null); const erp=await core.erp(); const result=await erp.diagnostic('inventory');
        await core.setting('erpCheck',{at:Date.now(),total:result.totalReportedByErp}); return json({ok:true,total:result.totalReportedByErp});
      }
      case 'createConversation':{
        const id=crypto.randomUUID(); const phone=String(a.phone||'').replace(/\D/g,'');
        if(phone&&(phone.length<10||phone.length>15))return json({error:'Informe um telefone válido com DDD.'},400);
        await core.run("INSERT INTO conversations (id,name,phone,channel,profile,updated) VALUES (?,?,?,'test',?,?)",id,a.name,phone,a.profile,Date.now());
        const testConfig=await core.config(),policy=createTestPolicy(testConfig.model,a.testMode,{caseTokens:a.caseTokens,maxTokens:a.caseTokens});
        await core.setting('playground:policy:'+id,policy);
        await core.setting('playground:config:'+id,{fingerprint:await signature('internal',testConfig),model:policy.models.ceci,mode:policy.mode,at:Date.now()});
        if(phone)await core.identifyMercadoPhoneCustomer(id);
        return json({id});
      }
      case 'conversation':
        await core.run('UPDATE conversations SET status=?,profile=?,assigned=?,notes=?,updated=? WHERE id=?',a.status,a.profile,a.assigned,a.notes,Date.now(),a.id); return json({ok:true});
      case 'archiveConversation':{
        const result=await core.run('UPDATE conversations SET archived_at=? WHERE id=?',a.archive?Date.now():0,a.id);
        if(!result.meta.changes)return json({error:'Conversa não encontrada.'},404);
        return json({ok:true});
      }
      case 'deleteConversation':{
        const existing=await core.one('SELECT id FROM conversations WHERE id=?',a.id);
        if(!existing)return json({error:'Conversa não encontrada.'},404);
        const database=core.db();
        await database.batch([
          database.prepare('DELETE FROM messages WHERE conversation_id=?').bind(a.id),
          database.prepare('DELETE FROM quotes WHERE conversation_id=?').bind(a.id),
          database.prepare('DELETE FROM conversations WHERE id=?').bind(a.id),
          database.prepare('DELETE FROM settings WHERE key IN (?,?,?,?,?,?)').bind('chatAvatar:'+a.id,'ceci:lease:'+a.id,'ceci:memory:'+a.id,'ceci:answered:'+a.id,'ceci:progress:'+a.id,'ceci:retry:'+a.id)
        ]);
        return json({ok:true});
      }
      case 'deleteMessage':{
        const result=await core.run("UPDATE messages SET body='',deleted_at=? WHERE id=? AND conversation_id=? AND deleted_at=0",Date.now(),a.messageId,a.id);
        if(!result.meta.changes)return json({error:'Mensagem não encontrada nesta conversa.'},404);
        await core.forgetCeciMemory(a.id);
        return json({ok:true});
      }
      case 'routeConversation':{
        const conversation=await core.one('SELECT * FROM conversations WHERE id=?',a.id);
        if(!conversation)return json({error:'Conversa não encontrada.'},404);
        if(conversation.status==='closed')return json({error:'Reabra o atendimento antes de encaminhar.'},409);
        const attendant=await core.routeToAttendant(a.id,(await core.config()).team);
        const label=a.reason==='compra_confirmada'?'Compra confirmada após cotação':'Atendimento humano solicitado';
        await core.addMessage(a.id,'note',`Encaminhamento manual: ${label}\nResponsável: ${attendant}`);
        return json({ok:true,assigned:attendant});
      }
      case 'quote': {
        if('conversationId' in a&&a.conversationId){const c=await core.one('SELECT id,status,profile,name FROM conversations WHERE id=?',a.conversationId);if(!c||c.status==='closed'||c.profile!==a.profile)return json({error:'Conversa indisponível ou perfil comercial diferente.'},409);}
        try{return json(await core.quote(a.items,a.profile,a.name,a.conversationId||''));}
        catch(error){if(error instanceof Error&&error.message==='INSUFFICIENT_OR_UNAVAILABLE_STOCK'){
          return json({error:'O estoque mudou durante a validação. Ajuste os itens antes de enviar.',stockChanges:await quoteStockChanges(a.items)},409);
        }throw error;}
      }
      case 'editQuote': return json(await core.reviseQuote(a.id,a.items,a.profile,a.name));
      case 'deleteQuote': await core.deleteQuote(a.id); return json({ok:true});
      case 'catalogActivity': if(a.kind==='product'){await recordAddedProduct(core.db(),Number(a.value));}else await recordCatalogActivity(core.db(),a.kind,a.value);return json({ok:true});
      case 'enrichCatalog': return json(await enrichCatalogBatch(core.db()));
      case 'sendQuote': {
        const c=await core.one('SELECT * FROM conversations WHERE id=?',a.conversationId);
        const saved=await core.one("SELECT * FROM quotes WHERE id=? AND conversation_id=? AND deleted_at=0 AND superseded_by=''",a.quoteId,a.conversationId);
        if(!c||c.status==='closed'||!saved||c.profile!==saved.profile)return json({error:'Conversa ou orçamento indisponível. Gere novamente.'},409);
        const sent=await core.one("SELECT id FROM messages WHERE conversation_id=? AND json_valid(card_data) AND json_extract(card_data,'$.id')=? LIMIT 1",a.conversationId,a.quoteId);
        if(sent)return json({error:'Este orçamento já foi enviado nesta conversa.'},409);
        const original=JSON.parse(String(saved.data)) as {lines:{productId:number;quantity:number;unitCents:number}[];totalCents:number};
        let current;
        try{current=await prepareQuote(await core.erp(),original.lines.map(line=>({productId:line.productId,quantity:line.quantity})),centerCellPolicy(saved.profile));}
        catch(error){if(error instanceof Error&&error.message==='INSUFFICIENT_OR_UNAVAILABLE_STOCK')return json({error:'O estoque mudou antes do envio. Ajuste os itens.',stockChanges:await quoteStockChanges(original.lines)},409);throw error;}
        const changed=current.totalCents!==original.totalCents||current.lines.some((line,index)=>line.unitCents!==original.lines[index]?.unitCents);
        if(changed){const revised=await core.reviseQuote(a.quoteId,original.lines.map(line=>({productId:line.productId,quantity:line.quantity})),saved.profile,saved.name);return json({error:'Preço foi atualizado. Revise os novos valores antes de enviar.',changed:true,quote:revised},409);}
        const formatted=quoteMessage(a.quoteId,current,saved.profile);
        if(['whatsapp','whatsapp_web'].includes(c.channel))await core.sendWhatsapp(c,formatted.body);
        await core.run("UPDATE conversations SET status='human' WHERE id=?",c.id);
        await core.addMessage(c.id,'agent',formatted.body,['whatsapp','whatsapp_web'].includes(c.channel)?'accepted':'saved',undefined,formatted.card);
        return json({ok:true,quote:{id:a.quoteId,...current}});
      }
      case 'playgroundProbe':{
        const cfg=await core.config(),policy=a.id?await getTestPolicy(a.id):null,model=policy?.models.ceci||testModels(a.testMode,cfg.model).ceci,key=await core.secret('OPENAI_API_KEY');
        if(a.id&&!await core.one("SELECT id FROM conversations WHERE id=? AND channel='test'",a.id))return json({error:'Selecione um teste interno.'},400);
        if(!key)return json({ok:false,message:'Configure a chave da OpenAI em Integrações.'});
        const cooldown=await core.getSetting('playground:probeDiagnostic');
        if(cooldown?.model===model&&Number(cooldown.retryAt||0)>Date.now())return json({ok:false,message:`A API pediu uma pausa. Aguarde ${Math.ceil((cooldown.retryAt-Date.now())/1000)} segundos antes de testar novamente.`});
        let diagnostic:ModelDiagnostic|undefined;
        try{
          const result=await requestCeciModel({key,payload:{model:model,store:false,input:'Chame confirmar_teste.',tools:[{type:'function',name:'confirmar_teste',description:'Confirma que as ferramentas funcionam neste modelo.',strict:true,parameters:{type:'object',properties:{},required:[],additionalProperties:false}}],tool_choice:'required',parallel_tool_calls:false,max_output_tokens:256,reasoning:{effort:'low'}},onDiagnostic:async value=>{diagnostic=value;await core.setting('playground:probeDiagnostic',{...value,model:model});}});
          await core.run('DELETE FROM settings WHERE key=?','playground:probeDiagnostic');
          const ok=Array.isArray(result.output)&&result.output.some((item:any)=>item.type==='function_call'&&item.name==='confirmar_teste');
          const message=ok?'O modelo '+model+' respondeu e confirmou suporte às ferramentas. Você pode iniciar o atendimento.':'O modelo não confirmou a chamada de ferramenta. O teste não trocará automaticamente para outro modelo.';
          await core.setting('check:playgroundModel:'+model,{ok,responseValidated:ok,at:Date.now(),fingerprint:await signature('openai',{...cfg,model}),label:model,message});
          return json({ok,message});
        }catch(error){const reason=error instanceof Error?error.message:'CECI_MODEL_TEMPORARY';const message=ceciDiagnostic(reason);await core.setting('check:playgroundModel:'+model,{ok:false,responseValidated:false,at:Date.now(),fingerprint:await signature('openai',{...cfg,model}),label:model,message});return json({ok:false,message,diagnostic});}
      }
      case 'playgroundReview':{
        const c=await core.one("SELECT id FROM conversations WHERE id=? AND channel='test'",a.id);
        if(!c)return json({error:'Selecione uma conversa do playground.'},404);
        const snapshot=await core.getSetting('playground:config:'+a.id);
        if(a.verdict==='approved'&&snapshot&&snapshot.fingerprint!==await signature('internal',await core.config()))return json({error:'A configuração mudou. Inicie um novo teste para aprovar a versão atual.'},409);
        if(a.verdict==='approved'&&(!await core.one("SELECT id FROM messages WHERE conversation_id=? AND role='assistant' AND deleted_at=0 LIMIT 1",a.id)||await core.getSetting('ceci:retry:'+a.id)))return json({error:'Conclua a resposta da Ceci antes de aprovar este cenário.'},409);
        await core.setting('playground:review:'+a.id,{verdict:a.verdict,notes:a.notes,at:Date.now(),reviewer:user.displayName,fingerprint:await signature('internal',await core.config())});
        return json({ok:true});
      }
      case 'resumeCeci':{
        const auto=await core.getSetting('playground:autoFor:'+a.id);
        if(auto&&['running','paused'].includes((await core.getSetting('playground:autoControl:'+auto.runId))?.state))return json({error:'Assuma a conversa no teste automático antes de enviar mensagens manualmente.'},409);
        const answered=await resumeCeciValidation(a.id);
        if(answered)await core.setting((await getTestPolicy(a.id))?.mode==='production'?'check:internal':'check:playgroundInternal',{ok:true,at:Date.now(),fingerprint:await signature('internal',await core.config()),message:'Conversa retomada com o mesmo fluxo e consultas reais.'});
        return json({ok:true,retryable:!answered&&await canResumeCeciValidation(a.id),...(!answered?{warning:'A consulta ainda não foi concluída. O contexto foi preservado; tente continuar novamente.'}:{})});
      }
      case 'message':{
        const auto=await core.getSetting('playground:autoFor:'+a.id);
        if(auto&&['running','paused'].includes((await core.getSetting('playground:autoControl:'+auto.runId))?.state))return json({error:'Assuma a conversa no teste automático antes de enviar mensagens manualmente.'},409);
        const c=await core.one('SELECT * FROM conversations WHERE id=?',a.id);
        if(!c)return json({error:'Conversa não encontrada.'},404);
        if(c.status==='closed')return json({error:'Reabra o atendimento para enviar mensagens.'},409);
        if(a.role==='user'&&c.channel!=='test')return json({error:'Mensagem simulada permitida somente no teste interno.'},400);
        if(a.role==='agent'&&['whatsapp','whatsapp_web'].includes(c.channel))await core.sendWhatsapp(c,a.body);
        if(a.role==='agent')await core.run("UPDATE conversations SET status='human' WHERE id=?",a.id);
        await core.addMessage(a.id,a.role,a.body,a.role==='agent'&&['whatsapp','whatsapp_web'].includes(c.channel)?'accepted':'saved');
        if(a.role==='user'&&c.status==='bot'){
          try{
            const cfg=await core.config();
            const fingerprint=await signature('internal',cfg);
            const answered=await processCeci(a.id,{foreground:true});
            if(answered)await core.setting((await getTestPolicy(a.id))?.mode==='production'?'check:internal':'check:playgroundInternal',{ok:true,at:Date.now(),fingerprint,message:'A Ceci respondeu usando as configurações atuais, memória do pedido e consultas reais de catálogo e preço.'});
            else return json({ok:true,retryable:await canResumeCeciValidation(a.id),warning:'A consulta demorou. O atendimento e as etapas concluídas foram preservados para continuar.'});
          }catch(e){return json({ok:true,warning:e instanceof Error&&['AbortError','TimeoutError','CECI_TIMEOUT'].includes(e.name==='Error'?e.message:e.name)?'A Ceci demorou para responder. Tente outra mensagem ou reinicie a validação.':e instanceof Error?e.message:'A IA não respondeu.'});}
        }
        return json({ok:true});
      }
    }
  }catch(e){
    if(e instanceof z.ZodError)return json({error:'Confira os campos preenchidos.'},400);
    const code=e instanceof Error?e.message:'';
    if(code==='QUOTE_NOT_FOUND')return json({error:'Orçamento não encontrado ou já alterado. Atualize a lista.'},404);
    const errors:Record<string,string>={CECI_RETRY_LATER:'A API pediu uma pausa. Aguarde a contagem indicada antes de retomar.',CECI_NOT_RESUMABLE:'Esta conversa não tem uma interrupção técnica para retomar.',SYNC_CONFLICT:'A sincronização foi atualizada em outra aba. Atualize o painel para continuar.',SYNC_PAGE_ORDER:'Atualize o painel e retome da última página concluída.',UNSTABLE_INVENTORY_PAGINATION:'O ERP repetiu produtos entre páginas. Reinicie a sincronização.',ERP_INVALID_PAGE:'O ERP retornou uma página inconsistente. O catálogo anterior foi preservado.',PRICE_UNAVAILABLE:'O produto não possui preço válido para esse perfil. Encaminhe à equipe.',CUSTOMER_PROFILE_REQUIRED:'Identifique se o cliente é lojista ou consumidor final.',INSUFFICIENT_OR_UNAVAILABLE_STOCK:'Estoque insuficiente ou produto indisponível. Atualize o catálogo.',PRODUCT_CLASSIFICATION_REVIEW:'A classificação deste produto precisa ser revisada.',SECOND_PRICE_SCOPE_REVIEW:'O preço deste produto precisa ser confirmado pela equipe.',ERP_HTTP_ERROR:'O MercadoPhone recusou a consulta. Verifique a credencial e as permissões.',ERP_NETWORK_ERROR:'O MercadoPhone está indisponível. Tente novamente.',API_KEY_REQUIRED:'Conecte o MercadoPhone em Integrações.'};
    return json({error:errors[code]||'Não foi possível concluir a operação. Confira os dados e a conexão.'},400);
  }
}
