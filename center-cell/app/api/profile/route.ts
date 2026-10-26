import {z} from 'zod';
import * as core from '../../../lib/server/core';
import {currentUser,digest,hashPassword,normalized,randomSalt,sameOrigin,tokenFromRequest,validPassword,verifyPassword} from '../../../lib/server/app-auth';
import {avatarValid} from '../../../lib/server/avatar';

export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const schema=z.discriminatedUnion('action',[
  z.object({action:z.literal('profile'),displayName:z.string().trim().min(2).max(60),email:z.string().trim().email().max(254),phone:z.string().max(30),avatar:z.string().max(150000)}),
  z.object({action:z.literal('password'),currentPassword:z.string().min(1).max(128),newPassword:z.string().min(12).max(128)}),
  z.object({action:z.literal('presence'),presence:z.enum(['available','away'])}),
  z.object({action:z.literal('logoutOthers')})
]);
export async function GET(request:Request){const user=await currentUser(request);return user?json({user}):json({error:'Entre na sua conta.'},401);}
export async function POST(request:Request){
  if(!sameOrigin(request))return json({error:'Origem inválida.'},403);
  if(Number(request.headers.get('content-length')||0)>155000)return json({error:'Arquivo ou dados muito extensos.'},413);
  const user=await currentUser(request);
  if(!user)return json({error:'Entre na sua conta.'},401);
  try{
    const action=schema.parse(await request.json());
    if(action.action==='presence'){
      await core.run('UPDATE app_users SET presence=?,updated=? WHERE id=?',action.presence,Date.now(),user.id);
      return json({ok:true,presence:action.presence});
    }
    if(action.action==='profile'){
      if(!avatarValid(action.avatar))return json({error:'Envie uma imagem PNG, JPG ou WebP de até 90 KB.'},400);
      const email=normalized(action.email);
      if(await core.one('SELECT id FROM app_users WHERE email=? AND id!=?',email,user.id))return json({error:'Este e-mail já pertence a outra conta.'},409);
      await core.run('UPDATE app_users SET display_name=?,email=?,phone=?,avatar=?,updated=? WHERE id=?',action.displayName,email,action.phone.trim(),action.avatar,Date.now(),user.id);
      return json({ok:true});
    }
    if(action.action==='password'){
      if(!validPassword(action.newPassword))return json({error:'Use ao menos 12 caracteres, incluindo letras e números.'},400);
      const row=await core.one('SELECT salt,password_hash FROM app_users WHERE id=?',user.id);
      if(!row||!await verifyPassword(action.currentPassword,String(row.salt),String(row.password_hash)))return json({error:'Senha atual incorreta.'},403);
      if(action.currentPassword===action.newPassword)return json({error:'Escolha uma senha diferente da atual.'},400);
      const salt=randomSalt();
      await core.db().batch([
        core.db().prepare('UPDATE app_users SET password_hash=?,salt=?,must_change_password=0,updated=? WHERE id=?').bind(await hashPassword(action.newPassword,salt),salt,Date.now(),user.id),
        core.db().prepare('DELETE FROM app_sessions WHERE user_id=? AND token_hash!=?').bind(user.id,await digest(await tokenFromRequest(request)))
      ]);
      return json({ok:true});
    }
    await core.run('DELETE FROM app_sessions WHERE user_id=? AND token_hash!=?',user.id,await digest(await tokenFromRequest(request)));
    return json({ok:true});
  }catch(error){
    if(error instanceof z.ZodError)return json({error:'Confira os dados do perfil.'},400);
    return json({error:'Não foi possível salvar. Tente novamente.'},503);
  }
}
