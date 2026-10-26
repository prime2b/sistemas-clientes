import type {AppUser} from './app-auth';
import * as core from './core';

export const isOwner=(user:AppUser)=>user.role==='admin';

export async function attendantFor(user:AppUser){
  if(user.role!=='attendant'||!user.slot)return null;
  const cfg=await core.config();
  return {slot:user.slot,email:user.email,name:String(cfg.team[user.slot-1]),displayName:user.displayName,avatar:user.avatar};
}
