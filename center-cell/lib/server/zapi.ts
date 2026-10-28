import * as core from './core';
import {recordZapiConnection} from './whatsapp-connection';

const HOST='https://api.z-api.io';
export async function instanceId(){return String(await core.secret('ZAPI_INSTANCE_ID')).trim().toUpperCase();}
export async function credentialsReady(){return !!(await instanceId()&&await core.secret('ZAPI_INSTANCE_TOKEN')&&await core.secret('ZAPI_CLIENT_TOKEN'));}
export async function connection(){const saved=await core.getSetting('check:whatsappWeb');return saved?.provider==='zapi'&&saved.instanceId===await instanceId()?saved:null;}
export async function received(){const saved=await core.getSetting('check:whatsappWebReceived');return saved?.provider==='zapi'&&saved.instanceId===await instanceId()?saved:null;}
async function fingerprint(){const values=await Promise.all(['ZAPI_INSTANCE_ID','ZAPI_INSTANCE_TOKEN','ZAPI_CLIENT_TOKEN','ZAPI_WEBHOOK_SECRET'].map(core.secret));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['received-delivery-v2',...values,core.runtime.ZAPI_WEBHOOK_URL]))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function webhookConfigured(){const saved=await core.getSetting('zapi:webhooks');return !!saved?.ok&&saved.fingerprint===await fingerprint();}
export async function call(path:string,method:'GET'|'PUT'|'POST'='GET',body?:Record<string,unknown>){
 const [id,token,clientToken]=await Promise.all([instanceId(),core.secret('ZAPI_INSTANCE_TOKEN'),core.secret('ZAPI_CLIENT_TOKEN')]);
 return callWithCredentials({id,token,clientToken},path,method,body);
}
async function callWithCredentials({id,token,clientToken}:{id:string;token:string;clientToken:string},path:string,method:'GET'|'PUT'|'POST'='GET',body?:Record<string,unknown>){
 if(!id||!token)throw new Error('Configure o ID e o token da instância Z-API.');
 if(!clientToken)throw new Error('Adicione o Client-Token, o token de segurança da conta Z-API.');
 if(!/^[A-Za-z0-9_-]{8,200}$/.test(id)||!path.startsWith('/')||path.startsWith('//'))throw new Error('Configuração da instância inválida.');
 let response:Response;
 try{response=await fetch(`${HOST}/instances/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}${path}`,{method,headers:{'Client-Token':clientToken,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(path==='/send-text'?10000:12000)});}
 catch{throw new Error('A Z-API não respondeu. Confira a conexão e tente novamente.');}
 if(!response.ok){console.warn('zapi_response_status',response.status);if([401,403].includes(response.status))throw new Error('A Z-API recusou as credenciais. Confira o token da instância e o Client-Token.');if(response.status===429)throw new Error('A Z-API limitou as solicitações. Aguarde antes de tentar novamente.');throw new Error(`A Z-API não confirmou a solicitação (${response.status}).`);}
 const raw=await response.text();if(raw.length>500000)throw new Error('Resposta da Z-API fora do tamanho esperado.');
 let result:any;try{result=JSON.parse(raw);}catch{throw new Error('A Z-API retornou uma resposta inválida.');}
 // `/status` uses `error` for documented connection details, including success.
 // Accept only those details on a typed status payload; actual API failures still fail.
 const statusDetail=path==='/status'&&typeof result?.connected==='boolean'&&typeof result?.error==='string'&&/^You (?:are already connected|are not connected|need to restore the session)\.?$/i.test(result.error.trim());
 if(result?.error&&!statusDetail)throw new Error('A Z-API não confirmou a operação. Confira as credenciais, a assinatura e a conexão da instância.');
 return result;
}
export class ClientTokenUpdateError extends Error{
 status:number;
 constructor(message:string,status=400){super(message);this.status=status;}
}
/** Test the candidate in isolation; a rejected credential never replaces the live secret. */
export async function updateClientToken(value:string){
 const clientToken=value.trim();
 if(clientToken.length<8||clientToken.length>4000||/[\r\n]/.test(clientToken))throw new ClientTokenUpdateError('Informe um Client-Token válido. A credencial anterior foi preservada.');
 const lease='zapi:clientTokenUpdate',owner=crypto.randomUUID(),now=Date.now();
 const claimed=await core.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE COALESCE(CAST(json_extract(settings.value,'$.expires') AS INTEGER),0)<?",lease,JSON.stringify({owner,expires:now+60000}),now);
 if(!claimed.meta.changes)throw new ClientTokenUpdateError('Há uma atualização do Client-Token em andamento. Aguarde a conclusão.',409);
 try{
  const [id,token]=await Promise.all([instanceId(),core.secret('ZAPI_INSTANCE_TOKEN')]);
  let checked:any;
  try{checked=await callWithCredentials({id,token,clientToken},'/status');if(typeof checked?.connected!=='boolean')throw new Error('INVALID_STATUS');}
  catch{throw new ClientTokenUpdateError('A nova credencial não foi validada pela Z-API. Confira o Client-Token e a conexão e tente novamente. A credencial anterior foi preservada.');}
  if(id!==await instanceId()||token!==await core.secret('ZAPI_INSTANCE_TOKEN'))throw new ClientTokenUpdateError('A instância foi alterada durante a validação. Atualize a página e tente novamente.',409);
  // Existing encryption is applied before the single secret write. No config,
  // session, received-message proof or explicit pause is cleared by rotation.
  await core.saveSecret('ZAPI_CLIENT_TOKEN',clientToken);
  const state=checked.connected?'connected':'offline';
  await recordZapiConnection(state,id,'',false,{preservePause:true});
  const cfg=await core.config(),paused=!!await core.getSetting('ceci:manualPause');
  const ready=await webhookConfigured(),startup=await core.getSetting('zapi:startupError');
  const {ceciAutomationReadiness}=await import('./ceci-activation'),automation=await ceciAutomationReadiness(cfg);
  const active=checked.connected&&ready&&!startup&&cfg.enabled&&!paused&&automation.ready;
  const warning=!checked.connected?'Client-Token validado e salvo. O aparelho está desconectado; conecte o WhatsApp para retomar o canal.':!ready||startup?'Client-Token validado e salvo. A configuração do recebimento está pendente e será tentada novamente ao verificar a conexão.':!paused&&(!cfg.enabled||!automation.ready)?'Client-Token validado e salvo. A retomada da Ceci aguarda as demais configurações de atendimento.':undefined;
  return {ok:true,validated:true,connected:checked.connected,ceciActive:!!active,...(warning?{warning}:{}),message:paused?'Client-Token validado e salvo. A pausa manual da Ceci foi mantida.':active?'Client-Token validado e salvo. Canal disponível e Ceci ativa.':'Client-Token validado e salvo.'};
 }finally{await core.run("DELETE FROM settings WHERE key=? AND json_extract(value,'$.owner')=?",lease,owner);}
}
export async function callbackUrl(){
 const url=new URL(core.runtime.ZAPI_WEBHOOK_URL||'https://center-cell-atendimento.fredborrasca.chatgpt.site/api/z-api/events');
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/api/z-api/events')throw new Error('Recebimento da Z-API não configurado.');
 let key=await core.secret('ZAPI_WEBHOOK_SECRET');
 if(!key){key=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');await core.saveSecret('ZAPI_WEBHOOK_SECRET',key);}
 url.searchParams.set('key',key);return url.href;
}
export async function setup(force=false){
 if(!force&&await webhookConfigured())return;
 await core.setting('zapi:webhooks',null);
 const value=await callbackUrl();
 // Z-API prioritizes received-delivery over received when notifySentByMe is
 // enabled. Set both destinations; the receiver continues to filter own echoes.
 await Promise.all(['received','received-delivery','connected','disconnected','message-status'].map(async route=>{const result=await call('/update-webhook-'+route,'PUT',{value});if(result?.value!==true)throw new Error('A Z-API não confirmou o recebimento de eventos. Tente configurar novamente.');}));
 await core.setting('zapi:webhooks',{ok:true,at:Date.now(),fingerprint:await fingerprint()});
}
export async function status(){const result=await call('/status');if(typeof result?.connected!=='boolean')throw new Error('A Z-API retornou um status de conexão inválido. Tente novamente.');const state=result.connected?'connected':'offline';await recordZapiConnection(state,await instanceId());return {state,provider:'zapi',...(typeof result.phone==='string'?{phone:result.phone}:{}),smartphoneConnected:result.smartphoneConnected===true};}
export function qrView(result:any){
 const image=typeof result==='string'?result:result?.value||result?.qrcode||result?.qrCode;
 const value=typeof image==='string'?(image.startsWith('data:image/png;base64,')?image:'data:image/png;base64,'+image):'';
 if(value.length<300000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))return {state:'qr',qr:value,expiresAt:Date.now()+20000,expiresInMs:20000,provider:'zapi'};
 if(result?.challenge||result?.publicKey||result?.type==='challenge')return {state:'challenge',provider:'zapi',error:'Este aparelho exige uma verificação adicional. Conclua a conexão pelo painel ou pela extensão oficial da Z-API.'};
 throw new Error('A Z-API não retornou um QR Code válido. Atualize o código ou confira a instância.');
}
export async function armCeciOnConnect(){await core.setting('zapi:startOnConnect',{instanceId:await instanceId(),pending:true,at:Date.now()});}
export async function cancelCeciOnConnect(){await core.setting('zapi:startOnConnect',{instanceId:await instanceId(),pending:false,at:Date.now()});}
export async function connect(deferPreparation?:(task:Promise<void>)=>void){
 await armCeciOnConnect();const current=await status();if(current.state==='connected')return current;
 const view=qrView(await call('/qr-code/image'));
 if(view.state==='qr'){
  const preparation=setup().catch(async()=>{await core.setting('zapi:startupError',{at:Date.now(),message:'A preparação do recebimento está pendente. Use Reparar recebimento para tentar novamente.'});console.warn('zapi_pairing_receiver_pending');});
  if(deferPreparation)deferPreparation(preparation);else await preparation;
 }
 return view;
}
export async function disconnect(){await cancelCeciOnConnect();await core.setting('whatsapp:manualDisconnectAt',Date.now());await call('/disconnect');await recordZapiConnection('offline',await instanceId(),'',true);await core.setting('check:whatsappWebReceived',null);return {state:'offline',provider:'zapi'};}
export async function send(phone:string,message:string){const number=phone.startsWith('lid:')?phone.slice(4)+'@lid':phone;if(!/^(?:\d{10,15}|\d{8,25}@lid)$/.test(number)||!message.trim())throw new Error('Mensagem ou destinatário WhatsApp inválido.');const result=await call('/send-text','POST',{phone:number,message});const id=String(result.messageId||result.id||'');if(!id||id.length>250)throw new Error('A Z-API não retornou a confirmação do envio. Confira o histórico antes de repetir.');return id;}
export async function avatar(phone:string){const number=phone.startsWith('lid:')?phone.slice(4)+'@lid':phone;if(!/^(?:\d{10,15}|\d{8,25}@lid)$/.test(number))return '';const result=await call('/profile-picture?phone='+encodeURIComponent(number));return Array.isArray(result)?result[0]?.link:result.link||'';}

/** Receipts may arrive before the message transaction; keep the highest confirmed status. */
export async function receipt(providerId:string,state:string){
 const status=state==='READ'||state==='PLAYED'?'read':state==='RECEIVED'?'delivered':state==='SENT'?'sent':'';if(!status||!providerId||providerId.length>250)return;
 const key='zapi:receipt:'+await instanceId()+':'+providerId;
 const rank={sent:1,delivered:2,read:3},value={status,rank:rank[status],at:Date.now()};
 await core.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE COALESCE(CAST(json_extract(settings.value,'$.rank') AS INTEGER),0)<?",key,JSON.stringify(value),value.rank);
 const link=await core.getSetting('zapi:message:'+await instanceId()+':'+providerId);if(link)await applyReceipt(link.id,(await core.getSetting(key)).status);
}
async function applyReceipt(id:string,status:string){await core.run("UPDATE messages SET status=? WHERE id=? AND role IN ('assistant','agent') AND CASE status WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'sent' THEN 1 ELSE 0 END < ?",status,id,status==='read'?3:status==='delivered'?2:1);}
export async function linkMessage(providerId:string,id:string){try{if(!providerId||providerId.length>250)return;const prefix=await instanceId()+':'+providerId;await core.setting('zapi:message:'+prefix,{id,at:Date.now()});const saved=await core.getSetting('zapi:receipt:'+prefix);if(saved)await applyReceipt(id,saved.status);}catch{console.warn('zapi_receipt_link_pending');}}
