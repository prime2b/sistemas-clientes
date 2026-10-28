import * as core from './core';

/** Shared connection alerts. Legacy UAZAPI checks cannot validate a Z-API session. */
export async function recordZapiConnection(state:string,instanceId:string,reason='',manual=false){
 const previous=await core.getSetting('check:whatsappWeb'),at=Date.now(),connected=state==='connected';
 const same=previous?.provider==='zapi'&&previous.instanceId===instanceId;
 await core.setting('check:whatsappWeb',{provider:'zapi',instanceId,connected,state,at});
 const manualAt=Number(await core.getSetting('whatsapp:manualDisconnectAt')||0);
 if(!connected&&same&&previous.connected&&!manual&&at-manualAt>30000)await core.setting('whatsapp:disconnectAlert',{id:crypto.randomUUID(),at,provider:'zapi',reason:reason.slice(0,160)});
 if(connected){
  await core.setting('whatsapp:manualDisconnectAt',0);await core.setting('whatsapp:disconnectAlert',null);
  const zapi=await import('./zapi');
  try{
   // Also repairs already-paired instances after callback configuration changes.
   await zapi.setup();
   const start=await core.getSetting('zapi:startOnConnect'),cfg=await core.config();
   // First connection on this policy adopts the requested automatic startup;
   // subsequent polls/reconnections preserve a later explicit manual pause.
   if((cfg.whatsappMode==='web'||(start?.pending&&start.instanceId===instanceId))&&(!start||start.instanceId!==instanceId||start.pending)){
    await core.setting('ceci:manualPause',false);
    await core.setting('config',{...cfg,whatsappMode:'web'});
    await zapi.cancelCeciOnConnect();
   }
   const {activateCeciForInbound}=await import('./ceci-inbound');
   await activateCeciForInbound(await core.config());
   await core.setting('zapi:startupError',null);
  }catch{await core.setting('zapi:startupError',{at:Date.now(),message:'Não foi possível preparar o recebimento. Use Reparar recebimento para tentar novamente.'});console.warn('zapi_startup_pending');}
 }
 if(manual&&!connected)await core.setting('whatsapp:disconnectAlert',null);
}
