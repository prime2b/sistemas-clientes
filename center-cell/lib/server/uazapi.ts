import * as core from './core';
import {activateCeciForInbound} from './ceci-inbound';

export function serverUrl(value:string){
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||!/^([a-z0-9-]+\.)*uazapi\.com$/.test(url.hostname))throw new Error('Informe a URL HTTPS do servidor UAZAPI.');
  return url.origin;
}

export async function baseUrl(){return serverUrl(String((await core.getSetting('uazapiUrl'))||core.runtime.UAZAPI_SERVER_URL||'https://free.uazapi.com'));}
export async function instanceToken(){return core.secret('UAZAPI_INSTANCE_TOKEN');}
export async function call(path:'/instance/create'|'/instance/status'|'/instance/connect'|'/instance/disconnect'|'/webhook'|'/send/text'|'/chat/avatar',body?:Record<string,unknown>){
  const token=path==='/instance/create'?await core.secret('UAZAPI_ADMIN_TOKEN'):await instanceToken();
  if(!token)throw new Error('Credencial da UAZAPI não configurada.');
  let response:Response;
  try{response=await fetch(await baseUrl()+path,{method:body?'POST':'GET',headers:{[path==='/instance/create'?'admintoken':'token']:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(path==='/send/text'?7000:12000),redirect:'manual'});}
  catch(error){console.warn('uazapi_request_error',error instanceof Error?error.message.replaceAll(token,'[redacted]').slice(0,180):'unknown');throw new Error('A UAZAPI não respondeu. Confira o servidor e tente novamente.');}
  if(!response.ok){
    console.warn('uazapi_response_status',response.status);
    if(response.status===401||response.status===403)throw new Error('A UAZAPI recusou a credencial deste servidor.');
    if(response.status===429)throw new Error('Limite de solicitações ou instâncias da UAZAPI atingido.');
    throw new Error(`A UAZAPI recusou a solicitação (${response.status}).`);
  }
  return await response.json() as Record<string,any>;
}

export function statusView(result:Record<string,any>){
  const instance=result.instance||{};
  const state=instance.status==='connected'||result.connected===true||result.status?.connected===true?'connected':instance.qrcode?'qr':instance.status==='connecting'?'connecting':'offline';
  const qr=typeof instance.qrcode==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(instance.qrcode)&&instance.qrcode.length<100000?instance.qrcode:undefined;
  const phone=String(result.status?.jid?.user||result.jid?.user||'');
  return {state:qr&&state!=='connected'?'qr':state,qr:state==='connected'?undefined:qr,phone:/^\d{10,15}$/.test(phone)?phone:undefined};
}

export async function recordConnection(state:string,reason='',manual=false){
  const previous=await core.getSetting('check:whatsappWeb');
  const connected=state==='connected',at=Date.now();
  const manualAt=Number(await core.getSetting('whatsapp:manualDisconnectAt')||0);
  await core.setting('check:whatsappWeb',{connected,state,at});
  if(!connected&&previous?.connected&&!manual&&at-manualAt>30000){
    await core.setting('whatsapp:disconnectAlert',{id:crypto.randomUUID(),at,reason:String(reason||'').slice(0,160)});
  }
  if(connected){await core.setting('whatsapp:manualDisconnectAt',0);await core.setting('whatsapp:disconnectAlert',null);await activateCeciForInbound(await core.config());}
  if(manual&&!connected)await core.setting('whatsapp:disconnectAlert',null);
}

export async function setup(){
  let token=await instanceToken();
  if(!token){
    if((await baseUrl()).startsWith('https://free.'))throw new Error('Informe um token de instância para testar no servidor gratuito.');
    if(!core.runtime.UAZAPI_WEBHOOK_URL)throw new Error('Configure o recebimento externo antes de criar uma instância de produção.');
    const result=await call('/instance/create',{name:'Center Cell Atendimento'});
    token=String(result.token||result.instance?.token||'');
    if(!token||token.length>4000)throw new Error('A UAZAPI criou a instância, mas não retornou a credencial.');
    await core.saveSecret('UAZAPI_INSTANCE_TOKEN',token);
  }
  if(core.runtime.UAZAPI_WEBHOOK_URL)await call('/webhook',{enabled:true,url:core.runtime.UAZAPI_WEBHOOK_URL,events:['messages','connection'],excludeMessages:['wasSentByApi'],addUrlEvents:false,addUrlTypesMessages:false});
  return token;
}

export async function send(phone:string,text:string){
  const number=phone.startsWith('lid:')?phone.slice(4)+'@lid':phone;
  if(!/^(?:\d{10,15}|\d{8,25}@lid)$/.test(number))throw new Error('Destinatário WhatsApp inválido.');
  const result=await call('/send/text',{number,text});
  return result.messageid||result.id||result.message?.id||null;
}
