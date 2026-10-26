import {z} from 'zod';
import * as core from '../../../../lib/server/core';
import {currentUser,hashPassword,normalized,randomSalt,revokeUserSessions,sameOrigin,validPassword} from '../../../../lib/server/app-auth';
import {avatarValid} from '../../../../lib/server/avatar';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const slot=z.number().int().min(1).max(3);
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('saveAttendant'),slot,displayName:z.string().trim().min(2).max(60),username:z.string().trim().regex(/^[a-zA-Z0-9._-]{3,40}$/),email:z.string().trim().email().max(254),active:z.boolean(),password:z.string().max(128).optional(),avatar:z.string().max(150000).optional()}),
  z.object({action:z.literal('revokeSessions'),slot})
]);
async function admin(request:Request){const user=await currentUser(request);return user?.role==='admin'&&!user.mustChangePassword?user:null;}
export async function GET(request:Request){
  if(!await admin(request))return json({error:'Acesso restrito à administração.'},403);
  const cfg=await core.config();
  const rows=await core.all("SELECT u.id,u.slot,u.username,u.email,u.display_name,u.phone,u.avatar,u.active,u.must_change_password,u.last_login,u.updated,(SELECT COUNT(*) FROM app_sessions s WHERE s.user_id=u.id AND s.expires>?) AS sessions FROM app_users u WHERE u.role='attendant' ORDER BY u.slot",Date.now());
  return json({slots:[1,2,3].map(slot=>({slot,name:cfg.team[slot-1],account:rows.find(row=>row.slot===slot)||null}))});
}
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
  if(!await admin(request))return json({error:'Acesso restrito à administração.'},403);
  if(Number(request.headers.get('content-length')||0)>155000)return json({error:'Arquivo ou dados muito extensos.'},413);
  try{
    const input=schema.parse(await request.json());
    const existing=await core.one("SELECT * FROM app_users WHERE role='attendant' AND slot=?",input.slot);
    if(input.action==='revokeSessions'){
      if(!existing)return json({error:'Conta não encontrada.'},404);
      await revokeUserSessions(String(existing.id));
      return json({ok:true});
    }
    if(input.avatar!==undefined&&!avatarValid(input.avatar))return json({error:'Envie uma imagem PNG, JPG ou WebP de até 90 KB.'},400);
    const username=normalized(input.username),email=normalized(input.email),password=input.password||'';
    if((!existing||password)&&!validPassword(password))return json({error:'Defina uma senha de ao menos 12 caracteres, com letras e números.'},400);
    if(await core.one('SELECT id FROM app_users WHERE (username=? OR email=?) AND id!=?',username,email,existing?.id||''))return json({error:'Usuário ou e-mail já em uso.'},409);
    const cfg=await core.config();
    if((cfg.team as string[]).some((name,index)=>index!==input.slot-1&&normalized(name)===normalized(input.displayName)))return json({error:'Cada atendente precisa ter um nome diferente para receber apenas suas conversas.'},409);
    if(existing){
      const avatar=input.avatar??String(existing.avatar||'');
      if(password){
        const salt=randomSalt();
        await core.run('UPDATE app_users SET display_name=?,username=?,email=?,avatar=?,active=?,password_hash=?,salt=?,must_change_password=1,updated=? WHERE id=?',input.displayName,username,email,avatar,input.active?1:0,await hashPassword(password,salt),salt,Date.now(),existing.id);
      }else await core.run('UPDATE app_users SET display_name=?,username=?,email=?,avatar=?,active=?,updated=? WHERE id=?',input.displayName,username,email,avatar,input.active?1:0,Date.now(),existing.id);
      if(!input.active||password)await revokeUserSessions(String(existing.id));
    }else{
      const salt=randomSalt(),now=Date.now();
      await core.run('INSERT INTO app_users (id,role,slot,username,email,display_name,avatar,password_hash,salt,active,must_change_password,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),'attendant',input.slot,username,email,input.displayName,input.avatar||'',await hashPassword(password,salt),salt,input.active?1:0,1,now,now);
    }
    const team=[...cfg.team];team[input.slot-1]=input.displayName;
    await core.saveConfig({...cfg,team});
    return json({ok:true});
  }catch(error){
    if(error instanceof z.ZodError)return json({error:'Confira os dados da atendente.'},400);
    return json({error:'Não foi possível atualizar o acesso.'},503);
  }
}
