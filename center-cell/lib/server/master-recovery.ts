/** Owner-provisioned recovery, disabled unless a short-lived secret is configured. */
export async function recoverMaster(db:D1Database,configuration:string|undefined,token:string,now=Date.now()){
  if(!configuration)return false;
  let config:{userId:string;tokenHash:string;passwordHash:string;salt:string;expires:number};
  try{config=JSON.parse(configuration);}catch{return false;}
  if(!config||typeof config.userId!=='string'||!config.userId||!/^v2:[a-f0-9]{64}$/.test(config.passwordHash)||! /^[a-f0-9]{32}$/.test(config.salt)||! /^[a-f0-9]{64}$/.test(config.tokenHash)||!Number.isFinite(config.expires)||config.expires<=now||config.expires>now+24*60*60*1000)return false;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
  let difference=0;for(let i=0;i<64;i++)difference|=hash.charCodeAt(i)^config.tokenHash.charCodeAt(i);
  if(difference)return false;
  const key='masterRecoveryUsed:'+hash,claim=crypto.randomUUID();
  const results=await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT ?,? WHERE EXISTS (SELECT 1 FROM app_users WHERE id=? AND role='admin' AND active=1)").bind(key,claim,config.userId),
    db.prepare("UPDATE app_users SET password_hash=?,salt=?,must_change_password=1,updated=? WHERE id=? AND role='admin' AND active=1 AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)").bind(config.passwordHash,config.salt,now,config.userId,key,claim),
    db.prepare('DELETE FROM app_sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)').bind(config.userId,key,claim)
  ]);
  return Number(results[1].meta.changes)===1;
}
