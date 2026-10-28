import * as core from './core';
import {drainCeci} from './ceci-queue';
import {integrationStatus} from './integrations';
import * as zapi from './zapi';
import {ceciAutomationReadiness} from './ceci-activation';

const backgroundBudgetMs=26_000;
const foregroundBudgetMs=60_000;

// A connection or credential update pauses the old configuration. Once both
// services are usable, the next real inbound message starts the assistant.
// An explicit pause in the chatbot panel always wins.
export async function activateCeciForInbound(cfg:Record<string,any>){
  if(await core.getSetting('ceci:manualPause'))return false;
  if(cfg.whatsappMode==='web'&&(!await zapi.credentialsReady()||!(await zapi.connection())?.connected))return false;
  if(cfg.enabled)return true;
  const [openai,instance,connection]=await Promise.all([
    core.secret('OPENAI_API_KEY'),zapi.credentialsReady(),zapi.connection()
  ]);
  if(!openai||!instance||!await zapi.webhookConfigured()||!connection?.connected)return false;
  // Waiting for a first received message/internal-test badge here made startup
  // circular. Live prerequisites are checked without calling any provider/model.
  if(!(cfg.whatsappMode==='web'?(await ceciAutomationReadiness(cfg)).ready:(await integrationStatus(cfg)).ready))return false;
  await core.setting('config',{...cfg,enabled:true});
  cfg.enabled=true;
  return true;
}

export async function claimCeci(conversationId:string,leaseMs=28_000){
  const runId=crypto.randomUUID();
  const now=Date.now();
  const key='ceci:lease:'+conversationId;
  const value=JSON.stringify({runId,expires:now+leaseMs});
  const result=await core.run(
    "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(json_extract(settings.value,'$.expires') AS INTEGER) < ?",
    key,value,now
  );
  return result.meta.changes?runId:null;
}

export async function processCeci(conversationId:string,options?:{foreground?:boolean}){
  const budget=options?.foreground?foregroundBudgetMs:backgroundBudgetMs;
  const current=await core.one('SELECT channel,status FROM conversations WHERE id=?',conversationId);
  const simulation=current?.channel==='test';
  return drainCeci<core.CeciReply>({
    now:Date.now,wait:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
    claim:()=>claimCeci(conversationId,budget+2000),
    release:async owner=>{await core.run("DELETE FROM settings WHERE key=? AND json_extract(value,'$.runId')=?",'ceci:lease:'+conversationId,owner);},
    pending:async()=>Number((await core.latestCeciInbound(conversationId))?.seq||0),
    answered:async()=>Number((await core.getSetting('ceci:answered:'+conversationId))?.seq||0),
    generate:async(target,signal)=>{
      const cfg=await core.config();
      if(!simulation&&!cfg.enabled)throw new Error('CECI_STOPPED');
      await core.setting(simulation?'playground:state:'+conversationId:'check:ceciReply',{state:'processing',at:Date.now()});
      return core.chatReply(conversationId,{target,signal});
    },
    publish:async reply=>{
      if(!simulation&&!(await core.config()).enabled)throw new Error('CECI_STOPPED');
      await core.publishCeciReply(conversationId,reply);
      await core.setting(simulation?'playground:state:'+conversationId:'check:ceciReply',{state:'answered',at:Date.now()});
    },
    fail:async(error,target)=>{
      const reason=error instanceof Error?error.message==='CECI_TIMEOUT'?'timeout':error.message:'unknown';
      console.warn('ceci_reply_failed',reason);
      const c=await core.one('SELECT * FROM conversations WHERE id=?',conversationId);
      if(c?.status!=='bot')return;
      const cfg=await core.config();
      if(!simulation&&!cfg.enabled)return;
      const previous=await core.getSetting('ceci:retry:'+conversationId);
      const attempts=previous?.target===target?Number(previous.attempts||0)+1:1;
      await core.setting('ceci:retry:'+conversationId,{target,reason,attempts,at:Date.now()});
      // A processing failure is not a commercial handoff. Preserve bot ownership and progress.
      if(!simulation){
        const progress=await core.getSetting('ceci:progress:'+conversationId);
        if(progress?.target===target&&progress?.value?.memory)await core.setting('ceci:memory:'+conversationId,progress.value.memory);
        const body='A consulta está levando mais tempo que o normal. Mantive os itens do seu atendimento; você pode me pedir para continuar daqui ou chamar uma atendente.';
        const warningId='ceci-retry-'+conversationId+'-'+target;
        if(!await core.one('SELECT id FROM messages WHERE id=?',warningId)){
          await core.sendWhatsapp(c,body);
          await core.addMessage(conversationId,'assistant',body,'accepted',warningId);
        }
        await core.setting('ceci:answered:'+conversationId,{seq:target});
      }
      await core.setting(simulation?'playground:state:'+conversationId:'check:ceciReply',{state:'retryable',reason,at:Date.now()});
    }
  },budget);
}
export async function canResumeCeciValidation(id:string){
  const c=await core.one('SELECT channel,status FROM conversations WHERE id=?',id);
  if(c?.channel!=='test')return false;
  if(c.status==='bot')return !!await core.getSetting('ceci:retry:'+id);
  if(c.status!=='human')return false;
  const note=await core.one("SELECT rowid AS seq,body FROM messages WHERE conversation_id=? AND role='note' AND deleted_at=0 ORDER BY rowid DESC LIMIT 1",id);
  if(!String(note?.body||'').startsWith('A Ceci não concluiu a resposta automática.'))return false;
  return !await core.one("SELECT id FROM messages WHERE conversation_id=? AND role='agent' AND rowid>? AND deleted_at=0 LIMIT 1",id,note!.seq);
}
export async function resumeCeciValidation(id:string){
  if(!await canResumeCeciValidation(id))throw new Error('CECI_NOT_RESUMABLE');
  const diagnostic=await core.getSetting('ceci:modelDiagnostic:'+id);
  if(Number(diagnostic?.retryAt||0)>Date.now())throw new Error('CECI_RETRY_LATER');
  await core.run("UPDATE conversations SET status='bot',assigned='' WHERE id=? AND channel='test'",id);
  await core.setting('ceci:answered:'+id,{seq:0});
  return processCeci(id,{foreground:true});
}
