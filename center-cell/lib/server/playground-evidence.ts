import * as core from './core';
/** Evidence is opt-in and exists only for conversations created by the automatic runner. */
export async function automaticEvidence(conversationId:string,target:number,kind:string,data:unknown){
 if(!await core.getSetting('playground:autoFor:'+conversationId))return;
 await core.setting('playground:autoEvidence:'+conversationId+':'+crypto.randomUUID(),{id:crypto.randomUUID(),kind,at:Date.now(),target,data:{...(data as Record<string,unknown>),conversationId}});
}
export async function readAutomaticEvidence(id:string){const key='playground:autoEvidence:'+id+':';return (await core.all("SELECT value FROM settings WHERE key >= ? AND key < ? ORDER BY key LIMIT 1500",key,key+'~')).map(r=>JSON.parse(r.value)).sort((a,b)=>a.at-b.at);}
