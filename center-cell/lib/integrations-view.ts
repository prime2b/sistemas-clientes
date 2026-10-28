export type IntegrationKey='whatsapp'|'mercadophone'|'openai';
export type ActivationStep={id:string;label:string;done:boolean;detail:string};
type Data={activation:{steps:ActivationStep[];completed:number;total:number;ready:boolean;agent?:{validated:boolean;productionValidated:boolean;model?:string|null;mode?:string|null};connections?:Partial<Record<IntegrationKey,{connected:boolean}>>;checks:Record<string,{ok:boolean;at:number;message:string}|null>};config:{enabled:boolean;model:string};erpCheck?:{at:number}|null;catalog:{count:number;synced:number};sync?:{page:number;received:number;reportedTotal:number;at:number;complete:boolean;error?:string}|null;secrets:Record<string,boolean>;zapiInstanceId?:string;zapiWebhookReady?:boolean;webReceivedAt?:number};

export const orderedStepIds=['erp','catalog','openai','whatsapp','receiver','internal'];
export const stepTarget:Record<string,{integration:IntegrationKey;anchor:string}>={erp:{integration:'mercadophone',anchor:'erp-connection'},catalog:{integration:'mercadophone',anchor:'erp-sync'},openai:{integration:'openai',anchor:'ai-model'},internal:{integration:'openai',anchor:'ai-test'},whatsapp:{integration:'whatsapp',anchor:'wa-pair'},receiver:{integration:'whatsapp',anchor:'wa-receive'}};
export function integrationView(data:Data){
  const steps=orderedStepIds.map(id=>data.activation.steps.find(item=>item.id===id)).filter((item):item is ActivationStep=>!!item);
  const done=(id:string)=>!!steps.find(item=>item.id===id)?.done;
  const connected=(key:IntegrationKey)=>data.activation.connections?.[key]?.connected??done(key==='mercadophone'?'erp':key);
  const agentValidated=data.activation.agent?.validated??done('internal');
  const pending=[
    !done('whatsapp')&&{integration:'whatsapp' as const,anchor:connected('whatsapp')?'wa-receive':data.secrets.ZAPI_INSTANCE_TOKEN&&data.secrets.ZAPI_CLIENT_TOKEN?'wa-pair':'wa-token',label:connected('whatsapp')?'Preparar recebimento':'Conectar WhatsApp',text:connected('whatsapp')?'Aparelho conectado. Confira o recebimento de eventos.':'Pareie o aparelho para receber mensagens na central.'},
    !done('openai')&&{integration:'openai' as const,anchor:'ai-model',label:connected('openai')?'Modelo de produção':'Validar OpenAI',text:connected('openai')?'Conexão confirmada. Valide o acesso ao modelo de produção.':'Configure a chave e valide o acesso ao modelo.'},
    !done('internal')&&{integration:'openai' as const,anchor:'ai-test',label:agentValidated?'Homologação de produção':'Teste interno da IA',text:agentValidated?'Playground validado. A resposta com o modelo de produção é acompanhada separadamente.':'Envie uma pergunta à Ceci e confira a resposta.'},
    !done('receiver')&&{integration:'whatsapp' as const,anchor:'wa-receive',label:'Validar mensagem real',text:'Envie uma mensagem real ao número pareado.'},
    !done('erp')&&{integration:'mercadophone' as const,anchor:'erp-connection',label:'Reconectar MercadoPhone',text:'Valide a credencial e a consulta ao ERP.'},
    !done('catalog')&&{integration:'mercadophone' as const,anchor:'erp-sync',label:'Sincronizar catálogo',text:'Atualize os produtos da Center Cell.'}
  ].filter((item):item is Exclude<typeof item,false>=>Boolean(item));
  const statuses={
    mercadophone:{tone:!connected('mercadophone')?'danger':done('catalog')?'success':'warning',label:connected('mercadophone')?'Conectado':'Pendente',detail:done('catalog')?`${new Intl.NumberFormat('pt-BR').format(data.catalog.count)} produtos sincronizados`:connected('mercadophone')?'Conectado · catálogo pendente':'Conexão ainda não validada'},
    openai:{tone:!data.secrets.OPENAI_API_KEY?'danger':connected('openai')&&agentValidated?'success':'warning',label:connected('openai')?'Conectado':'Validar',detail:agentValidated?data.activation.agent?.mode==='economic'?'Conexão e resposta validadas · playground econômico':'Conexão e resposta validadas':connected('openai')?'Conectado · teste da Ceci pendente':'Acesso ao modelo pendente'},
    whatsapp:{tone:connected('whatsapp')?done('whatsapp')&&done('receiver')?'success':'warning':'danger',label:connected('whatsapp')?'Conectado':'Pendente',detail:connected('whatsapp')?done('whatsapp')&&done('receiver')?'Aparelho e recebimento validados':'Aparelho conectado · recebimento pendente':'Desconectado · aparelho não pareado'}
  } as const;
  const activeConnections=(Object.keys(statuses) as IntegrationKey[]).filter(connected).length;
  const totalConnections=Object.keys(statuses).length;
  const names={mercadophone:'MercadoPhone',openai:'OpenAI',whatsapp:'WhatsApp'};
  const pendingConnections=(Object.keys(statuses) as IntegrationKey[]).filter(key=>!connected(key)).map(key=>names[key]);
  const connections={active:activeConnections,total:totalConnections,pending:pendingConnections.length,
    label:`${activeConnections}/${totalConnections}`,
    detail:`${activeConnections} integrações conectadas de ${totalConnections}. ${pendingConnections.length?`Conexões pendentes: ${pendingConnections.join(', ')}.`:'Todas conectadas.'}`};
  return {steps,done,connected,agentValidated,pending,statuses,connections,ready:data.activation.ready,active:data.activation.ready&&data.config.enabled};
}
