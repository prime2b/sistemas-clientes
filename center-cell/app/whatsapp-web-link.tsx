'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Check,ChevronRight,Copy,ExternalLink,KeyRound,Link2,Loader2,QrCode,RefreshCw,ShieldCheck,Smartphone,Unplug} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {WhatsAppIcon} from './whatsapp-icon';
type Status={state:string;qr?:string;phone?:string;error?:string;expiresAt?:number;webhookReady?:boolean};
type Props={instanceId:string;tokenReady:boolean;clientTokenReady:boolean;webhookReady:boolean;busy:boolean;onSave:(id:string)=>Promise<void>;onToken:()=>void;onClientToken:()=>void;onRefresh:()=>Promise<void>;receivedAt?:number;connected?:boolean};
export function WhatsAppWebLink({instanceId,tokenReady,clientTokenReady,webhookReady,busy,onSave,onToken,onClientToken,onRefresh,receivedAt}:Props){
 const [draft,setDraft]=useState(instanceId),[status,setStatus]=useState<Status>({state:'unconfigured'}),[working,setWorking]=useState(false),[clock,setClock]=useState(Date.now());
 const mounted=useRef(true),inFlight=useRef(false),attempts=useRef(0),previous=useRef('');
 const configured=!!instanceId&&tokenReady&&clientTokenReady,remaining=Math.max(0,Math.ceil(((status.expiresAt||0)-clock)/1000)),hasQr=!!status.qr&&remaining>0;
 useEffect(()=>setDraft(instanceId),[instanceId]);
 const read=useCallback(async()=>{try{const response=await fetch('/api/whatsapp-web',{cache:'no-store'}),next=await response.json() as Status;if(!mounted.current)return;setStatus(old=>next.state==='connected'||next.state==='unconfigured'||!response.ok?next:{...next,qr:old.qr,expiresAt:old.expiresAt});if(next.state==='connected'&&previous.current!=='connected'){attempts.current=0;void onRefresh();}previous.current=next.state;}catch{if(mounted.current)setStatus(old=>({...old,state:'error',error:'Não foi possível consultar a conexão.'}));}},[onRefresh]);
 useEffect(()=>{mounted.current=true;void read();const timer=setInterval(()=>{setClock(Date.now());if(document.visibilityState==='visible'&&!inFlight.current)void read();},10000);const clockTimer=setInterval(()=>setClock(Date.now()),1000);return()=>{mounted.current=false;clearInterval(timer);clearInterval(clockTimer)};},[instanceId,tokenReady,clientTokenReady]);
 const act=async(action:'connect'|'logout'|'webhooks',automatic=false)=>{
  if(inFlight.current||busy)return;
  if(action==='logout'&&!window.confirm('Desconectar este número da Z-API? Será preciso parear novamente para voltar a atender.'))return;
  if(action==='connect'){if(!automatic)attempts.current=0;attempts.current++;}
  inFlight.current=true;setWorking(true);
  try{const response=await fetch('/api/whatsapp-web',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}),next=await response.json() as Status;if(!response.ok)throw new Error(next.error||'Não foi possível concluir a conexão.');if(!mounted.current)return;if(action==='webhooks'){setStatus(old=>({...old,error:undefined}));await read();}else setStatus(next);setClock(Date.now());await onRefresh();}
  catch(e){if(mounted.current)setStatus(old=>({...old,error:(e as Error).message,qr:undefined,expiresAt:undefined}));}
  finally{inFlight.current=false;if(mounted.current)setWorking(false);}
 };
 useEffect(()=>{if(!status.qr||!status.expiresAt||status.state==='connected'||status.error||attempts.current>=3)return;const timer=setTimeout(()=>{if(document.visibilityState==='visible')void act('connect',true);},Math.max(0,status.expiresAt-Date.now()-5000));return()=>clearTimeout(timer);},[status.qr,status.expiresAt,status.state,status.error]);
 const state=status.state==='connected'?'Conectado':hasQr?'Aguardando leitura':status.state==='challenge'?'Verificação adicional':!configured?'Configuração pendente':'Desconectado';
 const copyId=()=>void navigator.clipboard.writeText(instanceId).then(()=>toast.success('ID da instância copiado.')).catch(()=>toast.error('Não foi possível copiar o ID.'));
 return <div className="zi-workspace">
  <section className="zi-instance">
   <div className="zi-heading"><span className="zi-provider-icon"><Link2 size={22}/></span><div><h3>Center Cell · produção</h3><p>Conexão com o WhatsApp pela Z-API</p></div><span className={'zi-state '+(status.state==='connected'?'connected':'')}><i/>{state}</span></div>
   <div className="zi-credentials" id="wa-token"><div className="zi-section-heading"><h4>Credenciais da instância</h4><span><ShieldCheck size={14}/> Protegidas no servidor</span></div>
    <label htmlFor="zi-instance-id">ID da instância</label><div className="zi-id-field"><Input id="zi-instance-id" value={draft} onChange={e=>setDraft(e.target.value.trim())} placeholder="ID da instância Z-API" autoComplete="off"/><button type="button" title="Copiar ID da instância" aria-label="Copiar ID da instância" disabled={!instanceId} onClick={copyId}><Copy size={16}/></button></div><Button variant="outline" className="zi-save-id" disabled={busy||!draft||draft===instanceId||!/^[a-f0-9]{32}$/i.test(draft)} onClick={()=>void onSave(draft)}>Salvar ID</Button>
    <div className="zi-credential-row"><span><strong>Token da instância</strong><small>{tokenReady?'Configurado · valor protegido':'Ainda não configurado'}</small></span><Button variant="outline" disabled={busy} onClick={onToken}><KeyRound size={14}/>{tokenReady?'Atualizar':'Adicionar token'}</Button></div>
    <div className="zi-credential-row"><span><strong>Client-Token</strong><small>Token de segurança da conta Z-API</small></span><Button variant="outline" disabled={busy} onClick={onClientToken}><KeyRound size={14}/>{clientTokenReady?'Atualizar':'Adicionar Client-Token'}</Button></div>
    {!clientTokenReady&&<p className="zi-client-token-note">Falta o Client-Token para validar a instância e gerar o QR Code. Você o encontra em <a href="https://developer.z-api.io/security/client-token" target="_blank" rel="noreferrer">Z-API → Segurança → Token de segurança da conta <ExternalLink size={12}/></a>.</p>}
   </div>
   <section className="zi-events" id="wa-receive"><div className="zi-section-heading"><h4>Recebimento de mensagens</h4><span className={webhookReady?'zi-ok':''}>{webhookReady?<Check size={14}/>:<RefreshCw size={14}/>} {webhookReady?'Configurado':'Pendente'}</span></div><p>Ao gerar o QR Code, a central configura o recebimento, a conexão e os status das mensagens na Z-API.</p><div className="zi-receiver-status"><i className={receivedAt?'ready':''}/><span>{receivedAt?<>Última mensagem recebida em <strong>{new Date(receivedAt).toLocaleString('pt-BR')}</strong></>:'Depois de conectar, envie uma mensagem ao número para validar o recebimento e a Ceci.'}</span></div>{configured&&!webhookReady&&<Button variant="outline" disabled={busy||working} onClick={()=>void act('webhooks')}>Configurar recebimento</Button>}</section>
   <div className="zi-instructions"><Smartphone size={21}/><div><h4>Como conectar</h4><ol><li>Abra o <span><WhatsAppIcon width={15} height={15}/> WhatsApp</span> no celular.</li><li>Acesse <strong>Aparelhos conectados</strong> <ChevronRight size={12}/> <strong>Conectar aparelho</strong>.</li><li>Aponte a câmera para o QR Code ao lado.</li></ol></div></div>
  </section>
  <aside className="zi-pairing" id="wa-pair"><div className="zi-pairing-title"><span><WhatsAppIcon width={23} height={23}/></span><h3>{status.state==='connected'?'WhatsApp conectado':'Leia o QR Code'}</h3><p>{status.state==='connected'?'Seu número já está vinculado à Z-API.':'Abra o WhatsApp no celular e escaneie o código para conectar esta instância.'}</p></div>
   <div className={'zi-qr-frame '+(hasQr?'ready':'')}>
    {status.state==='connected'?<div className="zi-connected"><span><Check size={54}/></span><strong>Conexão ativa</strong><p>{status.phone||'O aparelho está conectado.'}</p><small>Recebimento: {receivedAt?'validado':'aguardando primeira mensagem'}</small></div>:hasQr?<img src={status.qr} alt="QR Code real da Z-API para conectar o WhatsApp" width={440} height={440}/>:<div className="zi-qr-empty">{working?<Loader2 size={52} className="spin"/>:<QrCode size={70} strokeWidth={1.25}/>}<strong>{working?'Preparando a conexão…':!configured?'Configure as credenciais':'Pronto para conectar'}</strong><p>{working?'Aguarde o retorno da Z-API.':!clientTokenReady?'Adicione o Client-Token para gerar o código.':status.qr?'Este QR Code expirou. Gere outro para continuar.':'Gere um QR Code para vincular o aparelho.'}</p>{!clientTokenReady?<Button onClick={onClientToken}><KeyRound size={15}/>Adicionar Client-Token</Button>:<Button disabled={!configured||working||busy} onClick={()=>void act('connect')}><QrCode size={16}/>Gerar QR Code</Button>}</div>}
   </div>
   {hasQr&&<div className="zi-qr-expiry"><i style={{width:`${remaining/20*100}%`}}/><span>{attempts.current<3?'Atualiza':'Expira'} em {remaining}s · leitura {attempts.current} de 3</span></div>}
   {status.error&&<div className="zi-error" role="alert">{status.error}</div>}
   <div className="zi-pair-actions">{status.state==='connected'?<Button variant="outline" disabled={working||busy} onClick={()=>void act('logout')}><Unplug size={15}/>Desconectar</Button>:configured&&<Button variant="outline" disabled={working||busy} onClick={()=>void act('connect')}><RefreshCw size={15} className={working?'spin':''}/>Atualizar QR Code</Button>}<button type="button" disabled={working} onClick={()=>void read()}><RefreshCw size={14}/>Verificar conexão</button></div>
   {status.state==='challenge'&&<a className="zi-alternative" href="https://developer.z-api.io/tips/extension-guide" target="_blank" rel="noreferrer">Ver alternativa oficial de conexão <ExternalLink size={14}/></a>}
   <p className="zi-qr-hint">O código expira por segurança. Após três gerações, clique em atualizar para continuar.</p>
  </aside>
 </div>;
}
