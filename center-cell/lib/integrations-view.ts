export type IntegrationKey='whatsapp'|'mercadophone'|'openai';
export type ActivationStep={id:string;label:string;done:boolean;detail:string};
type Data={activation:{steps:ActivationStep[];completed:number;total:number;ready:boolean;checks:Record<string,{ok:boolean;at:number;message:string}|null>};config:{enabled:boolean;model:string};erpCheck?:{at:number}|null;catalog:{count:number;synced:number};sync?:{page:number;received:number;reportedTotal:number;at:number;complete:boolean;error?:string}|null;secrets:Record<string,boolean>;zapiInstanceId?:string;zapiWebhookReady?:boolean;webReceivedAt?:number};

export const orderedStepIds=['erp','catalog','openai','whatsapp','receiver','internal'];
export const stepTarget:Record<string,{integration:IntegrationKey;anchor:string}>={erp:{integration:'mercadophone',anchor:'erp-connection'},catalog:{integration:'mercadophone',anchor:'erp-sync'},openai:{integration:'openai',anchor:'ai-model'},internal:{integration:'openai',anchor:'ai-test'},whatsapp:{integration:'whatsapp',anchor:'wa-pair'},receiver:{integration:'whatsapp',anchor:'wa-receive'}};
export function integrationView(data:Data){
  const steps=orderedStepIds.map(id=>data.activation.steps.find(item=>item.id===id)).filter((item):item is ActivationStep=>!!item);
  const done=(id:string)=>!!steps.find(item=>item.id===id)?.done;
  const pending=[
    !done('whatsapp')&&{integration:'whatsapp' as const,anchor:data.secrets.ZAPI_INSTANCE_TOKEN&&data.secrets.ZAPI_CLIENT_TOKEN?'wa-pair':'wa-token',label:'Conectar WhatsApp',text:'Pareie o aparelho para receber mensagens na central.'},
    !done('openai')&&{integration:'openai' as const,anchor:'ai-model',label:'Validar OpenAI',text:'Configure a chave e valide o acesso ao modelo.'},
    !done('internal')&&{integration:'openai' as const,anchor:'ai-test',label:'Teste interno da IA',text:'Envie uma pergunta à Ceci e confira a resposta.'},
    !done('receiver')&&{integration:'whatsapp' as const,anchor:'wa-receive',label:'Validar mensagem real',text:'Envie uma mensagem real ao número pareado.'},
    !done('erp')&&{integration:'mercadophone' as const,anchor:'erp-connection',label:'Reconectar MercadoPhone',text:'Valide a credencial e a consulta ao ERP.'},
    !done('catalog')&&{integration:'mercadophone' as const,anchor:'erp-sync',label:'Sincronizar catálogo',text:'Atualize os produtos da Center Cell.'}
  ].filter((item):item is Exclude<typeof item,false>=>Boolean(item));
  const statuses={
    mercadophone:{tone:!done('erp')?'danger':done('catalog')?'success':'warning',label:!done('erp')?'Erro':done('catalog')?'Ativo':'Revisar',detail:done('catalog')?`${new Intl.NumberFormat('pt-BR').format(data.catalog.count)} produtos sincronizados`:done('erp')?'Catálogo pendente de sincronização':'Conexão ainda não validada'},
    openai:{tone:!data.secrets.OPENAI_API_KEY?'danger':done('openai')&&done('internal')?'success':'warning',label:done('openai')&&done('internal')?'Ativo':'Revisar',detail:done('openai')?done('internal')?'Acesso e resposta validados':'Acesso ok · refazer teste interno':'Acesso ao modelo pendente'},
    whatsapp:{tone:done('whatsapp')?done('receiver')?'success':'warning':'danger',label:done('whatsapp')?done('receiver')?'Ativo':'Revisar':'Pendente',detail:done('whatsapp')?done('receiver')?'Aparelho e recebimento validados':'Aparelho conectado · valide mensagem real':'Desconectado · aparelho não pareado'}
  } as const;
  const activeConnections=Object.values(statuses).filter(status=>status.tone==='success').length;
  const totalConnections=Object.keys(statuses).length;
  const names={mercadophone:'MercadoPhone',openai:'OpenAI',whatsapp:'WhatsApp'};
  const pendingConnections=Object.entries(statuses).filter(([,status])=>status.tone!=='success').map(([key])=>names[key as IntegrationKey]);
  const connections={active:activeConnections,total:totalConnections,pending:pendingConnections.length,
    label:`${activeConnections}/${totalConnections}`,
    detail:`${activeConnections} integrações ativas de ${totalConnections}. ${pendingConnections.length?`A validar: ${pendingConnections.join(', ')}.`:'Todas validadas.'}`};
  return {steps,done,pending,statuses,connections,ready:data.activation.ready,active:data.activation.ready&&data.config.enabled};
}
