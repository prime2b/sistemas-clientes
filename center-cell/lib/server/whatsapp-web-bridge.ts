import * as core from './core';
import {bridgeUrl} from './whatsapp-web-protocol';

export async function bridgeRequest(path:'/status'|'/connect'|'/logout'|'/send',body?:Record<string,unknown>){
  const setting=await core.getSetting('whatsappWebBridge');
  const token=await core.secret('WHATSAPP_WEB_BRIDGE_TOKEN');
  if(!setting?.url||!token)throw new Error('Configure o servidor de conexão e a chave compartilhada.');
  const origin=bridgeUrl(setting.url);
  let response:Response;
  try{response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000),redirect:'error'});}
  catch{throw new Error('O servidor de conexão não respondeu. Verifique se ele está online.');}
  if(!response.ok)throw new Error(response.status===401?'A chave compartilhada não corresponde à do servidor.':'O servidor de conexão recusou a solicitação.');
  return await response.json() as Record<string,any>;
}
