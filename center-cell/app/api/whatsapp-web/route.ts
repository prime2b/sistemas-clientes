import {currentUser} from '../../../lib/server/app-auth';
import {isOwner} from '../../../lib/server/roles';
import * as core from '../../../lib/server/core';
import {call,instanceToken,statusView,setup,baseUrl,recordConnection} from '../../../lib/server/uazapi';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

async function owner(request:Request){const user=await currentUser(request);return !!user&&isOwner(user)&&!user.mustChangePassword;}

export async function GET(request:Request){
  if(!await owner(request))return json({error:'Acesso restrito.'},403);
  try{
    const server=await baseUrl();
    if(!await instanceToken()){await core.setting('check:whatsappWeb',{connected:false,at:Date.now()});return json({state:'unconfigured',server,demo:server==='https://free.uazapi.com'});}
    const status=statusView(await call('/instance/status'));
    await recordConnection(status.state);
    return json({...status,server,demo:server==='https://free.uazapi.com',disconnectAlert:status.state==='connected'?null:await core.getSetting('whatsapp:disconnectAlert')});
  }catch(e){return json({state:'offline',error:e instanceof Error?e.message:'Conexão indisponível.'},503);}
}

export async function POST(request:Request){
  if(!await owner(request))return json({error:'Acesso restrito.'},403);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
  try{
    const action=(await request.json() as {action?:string}).action;
    if(action!=='connect'&&action!=='logout')return json({error:'Ação inválida.'},400);
    if(action==='connect'){
      await setup();
      const current=statusView(await call('/instance/status'));
      if(current.state==='connected'||current.state==='qr'||current.state==='connecting')return json(current);
    }
    if(action==='logout')await core.setting('whatsapp:manualDisconnectAt',Date.now());
    const result=statusView(await call(action==='connect'?'/instance/connect':'/instance/disconnect',{}));
    await recordConnection(result.state,'',true);
    if(action==='logout'){
      await core.setting('config',{...await core.config(),enabled:false});
      await core.setting('check:whatsappWebReceived',null);
    }
    return json(result);
  }catch(e){return json({error:e instanceof Error?e.message:'A conexão não respondeu.'},503);}
}
