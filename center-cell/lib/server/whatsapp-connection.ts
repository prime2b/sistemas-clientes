import * as core from './core';

/** Shared connection alerts. Legacy UAZAPI checks cannot validate a Z-API session. */
export async function recordZapiConnection(state:string,instanceId:string,reason='',manual=false){
 const previous=await core.getSetting('check:whatsappWeb'),at=Date.now(),connected=state==='connected';
 const same=previous?.provider==='zapi'&&previous.instanceId===instanceId;
 await core.setting('check:whatsappWeb',{provider:'zapi',instanceId,connected,state,at});
 const manualAt=Number(await core.getSetting('whatsapp:manualDisconnectAt')||0);
 if(!connected&&same&&previous.connected&&!manual&&at-manualAt>30000)await core.setting('whatsapp:disconnectAlert',{id:crypto.randomUUID(),at,provider:'zapi',reason:reason.slice(0,160)});
 if(connected){await core.setting('whatsapp:manualDisconnectAt',0);await core.setting('whatsapp:disconnectAlert',null);const {activateCeciForInbound}=await import('./ceci-inbound');await activateCeciForInbound(await core.config());}
 if(manual&&!connected)await core.setting('whatsapp:disconnectAlert',null);
}
