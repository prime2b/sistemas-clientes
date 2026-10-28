import * as core from './core';
import * as zapi from './zapi';
import {reconcilePlaygroundValidation} from './playground-validation';
import {TEST_MODEL} from '../playground-economy';
import {probeConnection, summarizeReadiness, type Service} from './integration-probes';

export async function signature(service: Service | 'internal', cfg: Record<string,any>) {
  const keys = service === 'whatsapp' ? ['WHATSAPP_TOKEN'] : ['OPENAI_API_KEY'];
  const values = await Promise.all(keys.map(core.secret));
  const context = service === 'whatsapp' ? [cfg.phoneId,cfg.graphVersion] : service === 'internal'
    ? ['shared-inbox-v1',cfg.flowMode,cfg.handoffAssignment,cfg.catalogPricing,cfg.model,cfg.name,cfg.greeting,cfg.instructions,cfg.handoff] : [cfg.model];
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([...context,...values])));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

export async function testConnection(service: Service) {
  const cfg = await core.config();
  const fingerprint = await signature(service,cfg);
  const result = await probeConnection(service,await core.secret(service==='openai'?'OPENAI_API_KEY':'WHATSAPP_TOKEN'),service==='openai'?cfg.model:cfg.phoneId,cfg.graphVersion);
  await core.setting('check:'+service,{...result,fingerprint});
  return result;
}

export async function integrationStatus(cfg: Record<string,any>) {
  try{await reconcilePlaygroundValidation(cfg);}catch{console.warn('playground_validation_reconcile_pending');}
  const checks: Record<string,any> = {};
  for (const service of ['openai','whatsapp','internal'] as const) {
    const saved = await core.getSetting('check:'+service);
    const current = !!saved && saved.fingerprint === await signature(service,cfg);
    checks[service] = saved ? {ok:current && saved.ok, at:saved.at, label:current?saved.label:undefined,
      message:current?saved.message:'Configuração alterada. Faça o teste novamente.'} : null;
  }
  const erp = await core.getSetting('erpCheck');
  const sync = await core.getSetting('sync');
  const catalog = await core.one('SELECT COUNT(*) AS count FROM products');
  const credentials = !!(await core.secret('WHATSAPP_TOKEN') && await core.secret('META_APP_SECRET') && await core.secret('WHATSAPP_VERIFY_TOKEN'));
  const signup = await core.getSetting('metaSignup');
  const subscriptionReady = !signup?.phoneId || signup.phoneId!==cfg.phoneId || signup.subscribed===true;
  const publicReceiver = core.runtime.WHATSAPP_WEBHOOK_PUBLIC === 'true';
  const webMode=cfg.whatsappMode==='web';
  const webCheck=await zapi.connection();
  const webReceived=await zapi.received();
  const webConfigured=await zapi.credentialsReady()&&await zapi.webhookConfigured();
  const modelChecks=await Promise.all([...new Set([cfg.model,TEST_MODEL])].map(async model=>{const saved=await core.getSetting('check:playgroundModel:'+model);return {model,...saved,ok:!!saved?.ok&&saved.fingerprint===await signature('openai',{...cfg,model})};}));
  const economic=await core.getSetting('check:playgroundInternal'),economicValid=!!economic?.ok&&economic.fingerprint===await signature('internal',cfg);
  const agent={validated:!!checks.internal?.ok||economicValid,productionValidated:!!checks.internal?.ok,model:checks.internal?.ok?cfg.model:economicValid?economic.model||TEST_MODEL:null,mode:checks.internal?.ok?'production':economicValid?'economic':null,at:checks.internal?.ok?checks.internal.at:economicValid?economic.at:null};
  const connections={mercadophone:{connected:!!erp&&!!await core.secret('MERCADOPHONE_API_KEY')},openai:{connected:!!await core.secret('OPENAI_API_KEY')&&(!!checks.openai?.ok||modelChecks.some(c=>c.ok)),models:modelChecks.filter(c=>c.ok).map(c=>c.model)},whatsapp:{connected:webMode?!!await zapi.credentialsReady()&&!!webCheck?.connected:credentials&&!!checks.whatsapp?.ok}};
  return {checks,agent,connections, ...summarizeReadiness([
    {id:'erp',label:'Conexão com o MercadoPhone',done:!!erp && !!await core.secret('MERCADOPHONE_API_KEY'),detail:erp?'Consulta ao ERP validada.':'Teste a conexão com o ERP.',page:'integrations'},
    {id:'catalog',label:'Catálogo sincronizado',done:!!sync?.complete && Number(catalog?.count)>0,detail:sync?.complete?`${catalog?.count || 0} produtos no catálogo.`:'Conclua a sincronização dos produtos.',page:'catalog'},
    {id:'openai',label:'Acesso ao modelo de IA',done:!!checks.openai?.ok,detail:checks.openai?.message || 'Adicione a chave e teste o acesso ao modelo.',page:'integrations'},
    {id:'internal',label:'Resposta em teste interno',done:!!checks.internal?.ok,detail:checks.internal?.message || 'Envie uma mensagem de teste e confira a resposta da IA.',page:'integrations'},
    {id:'whatsapp',label:webMode?'Sessão Z-API':'Número e credenciais da Meta',done:webMode?webConfigured&&!!webCheck?.connected:credentials && subscriptionReady && !!checks.whatsapp?.ok,detail:webMode?webCheck?.connected?'Aparelho conectado.':webConfigured?'Abra o QR e vincule o número.':'Configure a instância Z-API e o recebimento de eventos.':!subscriptionReady?'Inscrição nos eventos pendente. Configure o webhook na Meta e refaça a conexão.':checks.whatsapp?.message || 'Configure as três credenciais e teste o número.',page:'integrations'},
    {id:'receiver',label:'Recebimento externo de mensagens',done:webMode?!!webReceived:publicReceiver,detail:webMode?webReceived?'Mensagem real recebida pela Z-API.':'Envie uma mensagem de teste para validar a entrega à central.':publicReceiver?'Recebimento marcado como validado na configuração de implantação.':'Pendente de implantação e validação do recebimento externo. O painel continua privado.',page:'integrations'}
  ])};
}
