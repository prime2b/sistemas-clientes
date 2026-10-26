import * as core from './core';
import {requestCeciModel,type ModelDiagnostic} from './ceci-model-client';
import {automaticEvidence} from './playground-evidence';
import {testModels,testOutputLimits,estimatedRequestTokens,type TestMode} from '../playground-economy';
type Row=Record<string,any>;
export type TestPolicy={mode:TestMode;models:ReturnType<typeof testModels>;caseTokens:number;maxTokens:number;batchId?:string;rates:Record<string,{input:number;output:number}>};
export function createTestPolicy(production:string,mode:TestMode='economic',options:Partial<TestPolicy>={}):TestPolicy{return {mode,models:testModels(mode,production),caseTokens:60000,maxTokens:100000,rates:{},...options};}
export async function getTestPolicy(id:string){return await core.getSetting('playground:policy:'+id) as TestPolicy|null;}
export async function ensureTestPolicy(id:string){
 const saved=await getTestPolicy(id);if(saved)return saved;
 const c=await core.one('SELECT channel FROM conversations WHERE id=?',id);if(c?.channel!=='test')throw new Error('AUTO_TEST_CHANNEL_REQUIRED');
 const link=await core.getSetting('playground:autoFor:'+id),old=link?await core.getSetting('playground:auto:'+link.runId):null;
 const snapshot=await core.getSetting('playground:config:'+id),legacyModel=old&&!old.policy?old.snapshot?.model:!snapshot?.mode?snapshot?.model:null;
 const p=legacyModel?createTestPolicy(legacyModel,'production',{models:{ceci:legacyModel,client:legacyModel,reviewer:legacyModel},...(old?{batchId:old.id,caseTokens:old.limits.maxTokens,maxTokens:old.limits.maxTokens,rates:{[legacyModel]:old.rates}}:{})}):createTestPolicy((await core.config()).model);
 // Runs already in progress retain their original model and consumed budget.
 if(old&&legacyModel&&!await core.getSetting(meterKey(id,p))){const u=old.usage||{};await core.setting(meterKey(id,p),{entries:[{id:'legacy',conversationId:id,role:'legacy',model:legacyModel,input:u.input||0,output:u.output||0,known:!u.unknown,state:'completed'}]});}
 await core.setting('playground:policy:'+id,p);return p;
}
const meterKey=(id:string,p:TestPolicy)=>'playground:meter:'+(p.batchId||id);
const total=(entry:Row)=>Number(entry.input||0)+Number(entry.output||0);
export function summarizeTestUsage(entries:Row[],policy:TestPolicy,conversationId?:string){
 const rows=conversationId?entries.filter(e=>e.conversationId===conversationId):entries;
 const result:Row={input:0,output:0,cachedInput:0,unknown:0,calls:0,estimatedTokens:0,byRole:{},byModel:{},costUsd:0,pricedCostUsd:0,contextBefore:0,contextAfter:0};let unpriced=false;
 for(const e of rows){if(e.state==='rejected')continue;result.calls++;result.input+=Number(e.input||0);result.output+=Number(e.output||0);result.cachedInput+=Number(e.cached||0);if(!e.known){result.unknown++;result.estimatedTokens+=total(e);}result.contextBefore+=e.contextBefore||0;result.contextAfter+=e.contextAfter||0;
  for(const [group,key] of [['byRole',e.role],['byModel',e.model]]){const v=result[group][key]||{input:0,output:0,cachedInput:0,calls:0,unknown:0,model:e.model};v.input+=e.input||0;v.output+=e.output||0;v.cachedInput+=e.cached||0;v.calls++;v.unknown+=e.known?0:1;result[group][key]=v;}
  const rate=policy.rates?.[e.model];if(!e.known||!rate||!(rate.input>0&&rate.output>0))unpriced=true;else result.pricedCostUsd+=(e.input*rate.input+e.output*rate.output)/1e6;
 }
 result.costUsd=unpriced?null:rows.length?result.pricedCostUsd:null;
 result.total=result.input+result.output;result.warning=result.total>=(conversationId?policy.caseTokens:policy.maxTokens)*.8;return result;
}
export async function testUsage(id:string,caseOnly=false){const p=await getTestPolicy(id);if(!p)return null;return summarizeTestUsage((await core.getSetting(meterKey(id,p)))?.entries||[],p,caseOnly?id:undefined);}
/** One reservation for every API call, including tool rounds, with cached successful retries. */
export async function requestTestModel(args:{id:string;role:'ceci'|'client'|'reviewer';key:string;payload:Row;signal?:AbortSignal;contextBefore?:number;onDiagnostic?:(value:ModelDiagnostic)=>Promise<void>}){
 const policy=await ensureTestPolicy(args.id),c=await core.one('SELECT channel FROM conversations WHERE id=?',args.id);if(c?.channel!=='test')throw new Error('AUTO_TEST_CHANNEL_REQUIRED');
 const payload={...args.payload,model:policy.models[args.role],max_output_tokens:testOutputLimits[args.role]};
 const bytes=new TextEncoder().encode(JSON.stringify(payload));const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const cacheKey='playground:response:'+args.id+':'+args.role+':'+hash,cached=await core.getSetting(cacheKey);
 if(cached?.at>Date.now()-10*60000){
  if(cached.entry){const saved=await core.getSetting(meterKey(args.id,policy));const found=saved?.entries?.findIndex((e:Row)=>e.id===cached.entry.id);if(found>=0&&saved.entries[found].state==='pending'){saved.entries[found]=cached.entry;await core.setting(meterKey(args.id,policy),saved);}}
  return cached.data as Row;
 }
 const key=meterKey(args.id,policy),meter=await core.getSetting(key)||{entries:[]},estimate=estimatedRequestTokens(payload);
 const spent=meter.entries.filter((e:Row)=>e.state!=='rejected').reduce((n:number,e:Row)=>n+total(e),0),caseSpent=meter.entries.filter((e:Row)=>e.state!=='rejected'&&e.conversationId===args.id).reduce((n:number,e:Row)=>n+total(e),0);
 if(spent+estimate>policy.maxTokens||caseSpent+estimate>policy.caseTokens)throw new Error('TEST_TOKEN_BUDGET');
 const entry:Row={id:crypto.randomUUID(),conversationId:args.id,role:args.role,model:payload.model,at:Date.now(),input:estimate-Number(payload.max_output_tokens),output:payload.max_output_tokens,known:false,state:'pending',contextBefore:args.contextBefore||bytes.length,contextAfter:bytes.length};meter.entries.push(entry);await core.setting(key,meter);
 let data:Row;
 try{data=await requestCeciModel({key:args.key,payload,signal:args.signal,onDiagnostic:args.onDiagnostic});}
 catch(error){const reason=error instanceof Error?error.message:'';entry.state=/AUTH|ACCESS|QUOTA|CREDITS|SPEND|USAGE|REQUEST|RATE_LIMIT/.test(reason)?'rejected':'uncertain';await core.setting(key,meter);throw error;}
 const u=data.usage;entry.state='completed';entry.known=!!u&&Number.isFinite(u.input_tokens)&&Number.isFinite(u.output_tokens);
 if(entry.known){entry.input=u.input_tokens;entry.output=u.output_tokens;entry.cached=Number(u.input_tokens_details?.cached_tokens||0);}
 // Save the successful provider response before metrics, so a reporting failure
 // cannot make a resume pay again. The entry also recovers an unfinished meter write.
 await core.setting(cacheKey,{at:Date.now(),data,entry});
 await core.setting(key,meter);
 try{await automaticEvidence(args.id,0,'usage',{role:args.role,model:payload.model,usage:u||null,estimatedTokens:entry.known?0:total(entry),requestId:entry.id});}catch{console.warn('playground_usage_evidence_pending');}
 return data;
}
