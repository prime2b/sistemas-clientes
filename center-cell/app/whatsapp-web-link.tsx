'use client';
import {useEffect,useState} from 'react';
import {Loader2,QrCode,Unplug} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {WhatsAppIcon} from './whatsapp-icon';
import {Check} from 'lucide-react';

type Status={state:string;qr?:string;phone?:string;demo?:boolean;error?:string};
type Props={url:string;tokenReady:boolean;instanceReady:boolean;webhookReady:boolean;busy:boolean;onSave:(url:string)=>Promise<void>;onToken:()=>void;onInstanceToken:()=>void;onRefresh:()=>Promise<void>;receivedAt?:number;connected?:boolean};

export function WhatsAppWebLink({url,tokenReady,instanceReady,webhookReady,busy,onSave,onToken,onInstanceToken,onRefresh,receivedAt,connected}:Props){
  const [draft,setDraft]=useState(url),[status,setStatus]=useState<Status>({state:'unconfigured'}),[working,setWorking]=useState(false);
  useEffect(()=>setDraft(url),[url]);
  useEffect(()=>{
    let active=true;
    const read=async()=>{
      try{const response=await fetch('/api/whatsapp-web',{cache:'no-store'});const data=await response.json() as Status;if(active)setStatus(data);}
      catch{if(active)setStatus({state:'offline',error:'Não foi possível consultar a conexão.'});}
    };
    void read();const timer=setInterval(()=>void read(),10000);
    return()=>{active=false;clearInterval(timer)};
  },[url,instanceReady]);
  const action=async(kind:'connect'|'logout')=>{
    if(kind==='logout'&&!window.confirm('Desvincular o WhatsApp da Center Cell? Será preciso ler outro QR para reconectar.'))return;
    setWorking(true);
    try{
      const response=await fetch('/api/whatsapp-web',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:kind})});
      const data=await response.json() as Status;if(!response.ok)throw new Error(data.error||'Falha ao conectar.');
      setStatus(data);await onRefresh();
    }catch(e){setStatus(current=>({...current,error:(e as Error).message}));}
    finally{setWorking(false)};
  };
  const demo=url==='https://free.uazapi.com';
  const label=status.state==='connected'?'Conectado':status.state==='qr'?'Aguardando leitura do QR':status.state==='connecting'?'Conectando…':'Desconectado';
  const step=(number:number,done:boolean,current:boolean,title:string,id:string,content:React.ReactNode)=><div className={'ix-step '+(done?'done':current?'current':'future')} id={id}><div className="ix-step-track"><span>{done?<Check size={15}/>:number}</span></div><div className="ix-step-main"><div className="ix-step-title"><h3>{title}</h3>{done&&<span>Concluído</span>}</div>{content}</div></div>;
  return <div className="ix-steps ix-whatsapp-steps">
    {demo&&<div className="ix-alert"><strong>Servidor gratuito em uso.</strong> Ele é temporário: pareie só um número de teste. Antes de vincular o número comercial, troque para um servidor de produção.</div>}
    {status.error&&<div className="ix-error" role="alert"><strong>Falha na conexão.</strong><details><summary>Ver detalhes</summary>{status.error}</details></div>}
    {step(1,!!url,!url,'Servidor UAZAPI','wa-server',<div className="ix-inline-action"><Input className="ix-url" type="url" value={draft} onChange={e=>setDraft(e.target.value)} placeholder="https://seu-servidor.uazapi.com" aria-label="Server URL da UAZAPI"/><Button variant="outline" disabled={busy||!draft||draft===url} onClick={()=>void onSave(draft)}>Salvar</Button></div>)}
    {step(2,instanceReady,!!url&&!instanceReady,'Token da instância','wa-token',<div className="ix-inline-action"><span>{instanceReady?'Configurado com segurança':'Adicione o token da instância.'}</span><Button variant="outline" onClick={onInstanceToken}>{instanceReady?'Atualizar token':'Adicionar token'}</Button>{!instanceReady&&<Button variant="ghost" onClick={onToken}>{tokenReady?'Atualizar token administrativo':'Token administrativo'}</Button>}</div>)}
    {step(3,status.state==='connected'||!!connected,instanceReady&&status.state!=='connected','Parear o aparelho','wa-pair',<div className="ix-pair"><div><div className="web-link-state"><WhatsAppIcon width={16} height={16}/><strong>{label}</strong>{status.phone&&<span> · {status.phone}</span>}</div><ol><li>Gere o QR Code.</li><li>No celular, abra WhatsApp › Aparelhos conectados › Conectar aparelho.</li><li>Aponte a câmera para o código.</li><li>A conexão confirma automaticamente.</li></ol><p className="ix-hint">O código expira em alguns segundos; gere outro se precisar.</p></div><div className="ix-qr-box">{status.state==='qr'&&status.qr?<img src={status.qr} alt="QR para vincular o WhatsApp da Center Cell"/>:status.state==='connected'?<div className="ix-qr-connected"><WhatsAppIcon width={31} height={31}/><strong>{status.phone||'Aparelho conectado'}</strong></div>:<QrCode size={40}/>}<Button disabled={!url||(!instanceReady&&(!tokenReady||demo||!webhookReady))||busy||working||status.state==='connecting'||status.state==='qr'||status.state==='connected'} onClick={()=>void action('connect')}>{working?<Loader2 size={16} className="spin"/>:<QrCode size={16}/>} Gerar QR Code</Button>{status.state==='connected'&&<Button variant="outline" disabled={working} onClick={()=>void action('logout')}><Unplug size={15}/> Desconectar</Button>}</div></div>)}
    {step(4,!!receivedAt,!!connected&&!receivedAt,'Validar recebimento','wa-receive',<><p>Envie uma mensagem de teste para o número pareado. A IA é ativada assim que ela chegar à central pelo receptor seguro.</p>{receivedAt&&<p className="ix-success"><Check size={15}/> Mensagem recebida em {new Date(receivedAt).toLocaleString('pt-BR')}</p>}{!webhookReady&&<div className="ix-alert"><strong>Receptor pendente.</strong> Configure o webhook seguro antes de validar a mensagem real.</div>}</>)}
  </div>;
}
