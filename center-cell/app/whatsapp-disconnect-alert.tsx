'use client';
import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,RefreshCw,Plug, X} from 'lucide-react';
import {WhatsAppIcon} from './whatsapp-icon';

type Health={state:string;qr?:string;disconnectAlert?:{id:string;at:number;reason?:string}|null;error?:string};
export default function WhatsAppDisconnectAlert({onIntegrations}:{onIntegrations:()=>void}){
  const [alert,setAlert]=useState<Health['disconnectAlert']>(null);
  const [state,setState]=useState('');
  const [qr,setQr]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const check=useCallback(async()=>{
    try{
      const response=await fetch('/api/whatsapp-web',{cache:'no-store'});
      if(!response.ok)return;
      const health=await response.json() as Health;
      setState(health.state);
      if(health.state==='connected'){setAlert(null);setQr('');setError('');return;}
      if(health.qr)setQr(health.qr);
      if(health.disconnectAlert?.id&&sessionStorage.getItem('cc-dismissed-disconnect')!==health.disconnectAlert.id)setAlert(health.disconnectAlert);
    }catch{/* Sem diagnóstico confiável durante uma falha de rede. */}
  },[]);
  useEffect(()=>{void check();const timer=setInterval(()=>void check(),15000);return()=>clearInterval(timer);},[check]);
  const dismiss=()=>{if(alert?.id)sessionStorage.setItem('cc-dismissed-disconnect',alert.id);setAlert(null);setError('');};
  const reconnect=async()=>{
    setBusy(true);setError('');
    try{
      const response=await fetch('/api/whatsapp-web',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect'})});
      const result=await response.json() as Health;
      if(!response.ok)throw new Error(result.error||'Não foi possível iniciar a conexão.');
      setState(result.state);if(result.qr)setQr(result.qr);
      if(result.state==='connected'){setAlert(null);setQr('');}else await check();
    }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível reconectar.');}
    finally{setBusy(false);}
  };
  if(!alert)return null;
  return <div className="cc-disconnect-backdrop" role="presentation"><section className="cc-disconnect-modal" role="alertdialog" aria-modal="true" aria-labelledby="cc-disconnect-title" aria-describedby="cc-disconnect-description">
    <button className="cc-disconnect-close" aria-label="Fechar alerta" onClick={dismiss}><X size={18}/></button>
    <span className="cc-disconnect-icon"><WhatsAppIcon width={23} height={23}/></span>
    <h2 id="cc-disconnect-title">WhatsApp desconectado</h2>
    <p id="cc-disconnect-description">A conexão do número da Center Cell foi interrompida. Reconecte para voltar a receber e responder mensagens pela central.</p>
    {qr&&<div className="cc-disconnect-qr"><img src={qr} alt="QR Code para vincular o WhatsApp"/><span>Abra o WhatsApp no celular em Aparelhos conectados e escaneie o código.</span></div>}
    {state==='connecting'&&!qr&&<p className="cc-disconnect-hint">Aguardando conexão. O estado será atualizado automaticamente.</p>}
    {error&&<p className="cc-disconnect-error" role="status">{error}</p>}
    <div className="cc-disconnect-actions"><button className="cc-disconnect-primary" disabled={busy} onClick={()=>void reconnect()}><RefreshCw size={16} className={busy?'spin':''}/>{busy?'Conectando…':'Reconectar agora'}</button><button onClick={()=>{dismiss();onIntegrations();}}><Plug size={16}/> Abrir Integrações</button><button onClick={dismiss}>Agora não</button></div>
  </section></div>;
}
