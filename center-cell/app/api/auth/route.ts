import {z} from 'zod';
import * as core from '../../../lib/server/core';
import {recoverMaster} from '../../../lib/server/master-recovery';
import {clearCookie,createSession,currentUser,hashPassword,loginBlocked,normalized,publicUser,rateKey,recordFailure,revokeSession,sameOrigin,sessionCookie,verifyPassword} from '../../../lib/server/app-auth';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('recoverMaster'),token:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}),
  z.object({action:z.literal('login'),identifier:z.string().trim().min(3).max(254),password:z.string().min(1).max(128)}),
  z.object({action:z.literal('logout')})
]);

export async function GET(request:Request){return json({user:await currentUser(request)});}
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
  if(Number(request.headers.get('content-length')||0)>4000)return json({error:'Dados muito extensos.'},413);
  let stage='parse';
  try{
    const input=schema.parse(await request.json());
    if(input.action==='recoverMaster'){
      const ok=await recoverMaster(core.db(),core.runtime.MASTER_RECOVERY,input.token);
      return ok?json({ok:true}):json({error:'Recuperação indisponível ou expirada.'},403);
    }
    if(input.action==='logout'){
      const current=await currentUser(request);
      if(current)await core.run("UPDATE app_users SET presence='away' WHERE id=?",current.id);
      await revokeSession(request);
      return json({ok:true},200,clearCookie());
    }
    stage='rate_key';
    const identifier=normalized(input.identifier);
    const key=await rateKey(request,identifier);
    stage='throttle';
    if(await loginBlocked(key))return json({error:'Muitas tentativas. Aguarde 15 minutos para tentar novamente.'},429);
    stage='user_lookup';
    const row=await core.one('SELECT * FROM app_users WHERE (username=? OR email=?) AND active=1',identifier,identifier);
    stage='password_verify';
    const valid=await verifyPassword(input.password,String(row?.salt||'2a460d15c1f9a44b3920a1f65a11f942'),String(row?.password_hash||'0'.repeat(64)));
    stage='failure_record';
    if(!row||!valid){await recordFailure(key);return json({error:'Usuário ou senha inválidos.'},401);}
    stage='session_create';
    await core.run('DELETE FROM login_throttle WHERE key=?',key);
    if(!String(row.password_hash).startsWith('v2:')){
      const upgraded=await hashPassword(input.password,String(row.salt));
      await core.run('UPDATE app_users SET password_hash=?,updated=? WHERE id=? AND password_hash=?',upgraded,Date.now(),row.id,row.password_hash);
    }
    await core.run("UPDATE app_users SET last_login=?,presence='available' WHERE id=?",Date.now(),row.id);
    const token=await createSession(String(row.id));
    const user=publicUser({...row,presence:'available'});
    return json({user,redirect:user.mustChangePassword?'/conta':'/'},200,sessionCookie(token));
  }catch(error){
    if(error instanceof z.ZodError)return json({error:'Confira usuário e senha.'},400);
    console.error('cc_auth_error',stage,error instanceof Error?error.name:'unknown',error instanceof Error?error.message:'');
    return json({error:'Não foi possível entrar. Tente novamente.'},503);
  }
}
