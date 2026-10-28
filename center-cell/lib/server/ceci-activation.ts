import * as core from './core';
import * as zapi from './zapi';

/** Runtime prerequisites, independent of historical test/first-message badges. */
export async function ceciAutomationReadiness(cfg:Record<string,any>){
 const blockers:string[]=[];
 if(cfg.whatsappMode!=='web')return {ready:false,blockers:['Selecione a conexão do WhatsApp pela Z-API.']};
 if(!await core.secret('OPENAI_API_KEY'))blockers.push('Configure a chave da IA.');
 if(!await core.secret('MERCADOPHONE_API_KEY'))blockers.push('Configure a conexão com o MercadoPhone.');
 if(!Number((await core.one('SELECT COUNT(*) AS count FROM products'))?.count))blockers.push('Sincronize o catálogo de produtos.');
 if(!await zapi.credentialsReady())blockers.push('Complete as credenciais da Z-API.');
 if(!await zapi.webhookConfigured())blockers.push('Configure o recebimento de mensagens.');
 if(!(await zapi.connection())?.connected)blockers.push('Conecte o WhatsApp pelo QR Code.');
 return {ready:blockers.length===0,blockers};
}
