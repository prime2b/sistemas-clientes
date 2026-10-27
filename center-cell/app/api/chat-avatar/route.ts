import {currentUser} from '../../../lib/server/app-auth';
import {isOwner,attendantFor} from '../../../lib/server/roles';
import * as core from '../../../lib/server/core';
import {avatar,credentialsReady} from '../../../lib/server/zapi';

export const dynamic='force-dynamic';
const empty=()=>new Response(null,{status:204,headers:{'Cache-Control':'private,max-age=300'}});
const safeUrl=(value:unknown)=>{
  if(typeof value!=='string')return '';
  try{const url=new URL(value);return url.protocol==='https:'&&(/(^|\.)(whatsapp\.net|fbcdn\.net|z-api\.io)$/).test(url.hostname)?url.href:'';}catch{return '';}
};

export async function GET(request:Request){
  const user=await currentUser(request);
  if(!user||user.mustChangePassword)return empty();
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!/^[a-f0-9-]{36}$/i.test(id))return empty();
  const conversation=await core.one('SELECT id,phone,channel,assigned FROM conversations WHERE id=?',id);
  if(!conversation)return empty();
  if(!isOwner(user)){
    const attendant=await attendantFor(user);
    if(!attendant||!(await core.config()).sharedInbox&&attendant.name!==conversation.assigned||conversation.channel==='test')return empty();
  }
  if(conversation.channel!=='whatsapp_web'||!await credentialsReady())return empty();
  const number=String(conversation.phone||'').startsWith('lid:')?String(conversation.phone).slice(4)+'@lid':String(conversation.phone||'');
  if(!/^(?:\d{10,15}|\d{8,25}@lid)$/.test(number))return empty();
  const key='chatAvatar:'+id;
  let cached=await core.getSetting(key);
  if(!cached||Date.now()-Number(cached.at||0)>10*60*1000){
    try{
      const result=await avatar(String(conversation.phone));
      cached={url:safeUrl(result),at:Date.now()};
      await core.setting(key,cached);
    }catch{return empty();}
  }
  const url=safeUrl(cached.url);
  return url?Response.redirect(url,302):empty();
}
