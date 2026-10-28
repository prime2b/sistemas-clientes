import {currentUser} from '../../../lib/server/app-auth';
import {isOwner} from '../../../lib/server/roles';
import * as core from '../../../lib/server/core';
import * as zapi from '../../../lib/server/zapi';
import {ceciAutomationReadiness} from '../../../lib/server/ceci-activation';
import {waitUntil} from 'cloudflare:workers';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function owner(request:Request){const user=await currentUser(request);return !!user&&isOwner(user)&&!user.mustChangePassword;}
async function agentStatus(){const cfg=await core.config(),paused=!!await core.getSetting('ceci:manualPause'),readiness=await ceciAutomationReadiness(cfg),startup=await core.getSetting('zapi:startupError');return {active:cfg.enabled&&!paused&&readiness.ready,paused,blockers:startup?[startup.message,...readiness.blockers]:readiness.blockers};}
export async function GET(request:Request){
 if(!await owner(request))return json({error:'Acesso restrito.'},403);
 const configured=await zapi.credentialsReady();
 if(!configured)return json({provider:'zapi',state:'unconfigured',instanceId:await zapi.instanceId(),missingClientToken:!await core.secret('ZAPI_CLIENT_TOKEN')});
 try{const cached=await zapi.connection(),status=cached&&Date.now()-cached.at<5000?{state:cached.state,provider:'zapi'}:await zapi.status();return json({...status,ceci:await agentStatus(),webhookReady:await zapi.webhookConfigured(),receivedAt:(await zapi.received())?.at||0,disconnectAlert:status.state==='connected'?null:(await core.getSetting('whatsapp:disconnectAlert'))?.provider==='zapi'?await core.getSetting('whatsapp:disconnectAlert'):null});}
 catch(e){return json({provider:'zapi',state:'error',error:e instanceof Error?e.message:'Não foi possível consultar a Z-API.'},503);}
}
export async function POST(request:Request){
 if(!await owner(request))return json({error:'Acesso restrito.'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 if(Number(request.headers.get('content-length')||0)>8000)return json({error:'Solicitação muito grande.'},413);
 try{const {action}=await request.json() as {action?:string};
  if(action==='connect'||action==='activate'){
   const result=await zapi.connect(waitUntil),ceci=await agentStatus(),webhookReady=await zapi.webhookConfigured();
   return json({...result,ceci,webhookReady,...('expiresAt' in result&&typeof result.expiresAt==='number'?{expiresInMs:Math.max(0,result.expiresAt-Date.now())}:{}),...(!webhookReady&&result.state==='qr'?{warning:'QR Code pronto. O recebimento está sendo preparado em segundo plano.'}:{})});
  }
  if(action==='webhooks'){await zapi.setup(true);await zapi.status();return json({ok:true,webhookReady:true,ceci:await agentStatus()});}
  if(action==='logout'){const result=await zapi.disconnect();await core.setting('config',{...await core.config(),enabled:false});return json(result);}
  return json({error:'Ação inválida.'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'A Z-API não respondeu.'},503);}
}
