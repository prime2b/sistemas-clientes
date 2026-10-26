type State={config?:{enabled?:boolean};secrets?:{OPENAI_API_KEY?:boolean};ceciPaused?:boolean;ceciReply?:{state?:string};activation?:{ready?:boolean;steps?:{id:string;done:boolean;detail?:string}[]}};
/** Agent validation and production-channel availability are separate states. */
export function ceciAvailability(data:State|null){
 if(!data)return {label:'Carregando',tone:'pausada',detail:'Consultando o estado da Ceci.',internalReady:false};
 const steps=data.activation?.steps||[],done=(id:string)=>!!steps.find(step=>step.id===id)?.done;
 const configured=data.secrets?.OPENAI_API_KEY??(done('openai')||!!data.activation?.ready);
 if(!configured)return {label:'Configurar',tone:'pausada',detail:'Configure a chave da IA em Integrações para testar a Ceci.',internalReady:false};
 const internalReady=steps.length?done('openai')&&done('internal'):!!data.activation?.ready;
 if(!internalReady)return {label:'Validar',tone:'pausada',detail:steps.find(step=>['openai','internal'].includes(step.id)&&!step.done)?.detail||'Valide o acesso à IA e a resposta no playground. O WhatsApp não é necessário para o teste interno.',internalReady:false};
 const live=!!data.config?.enabled&&!data.ceciPaused&&!!data.activation?.ready;
 if(live)return {label:'Ativa',tone:'ativa',detail:data.ceciReply?.state==='retryable'?'Atendimento de produção ligado. Uma conversa precisa de revisão; consulte os atendimentos.':'Ceci validada e atendimento automático no WhatsApp ligado.',internalReady:true};
 return {label:'Validada',tone:'ativa',detail:'Ceci validada para testes no playground. '+(!done('whatsapp')?'O WhatsApp de produção ainda não está conectado.':data.ceciPaused?'O atendimento automático de produção está desligado.':'A ativação do atendimento de produção ainda tem etapas pendentes.'),internalReady:true};
}
