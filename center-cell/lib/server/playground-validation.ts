import * as core from './core';
type Row=Record<string,any>;
async function newer(key:string,value:Row){
 await core.run("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE COALESCE(json_extract(settings.value,'$.fingerprint'),'')!=? OR COALESCE(CAST(json_extract(settings.value,'$.at') AS INTEGER),0)<?",key,JSON.stringify(value),value.fingerprint,value.at);
}
async function recover(row:Row,cfg:Row,fingerprint:string){
 const snapshot=JSON.parse(row.snapshot||'null'),policy=JSON.parse(row.policy||'null'),meter=JSON.parse(row.meter||'null');
 if(snapshot?.fingerprint!==fingerprint)return;
 const model=policy?.models?.ceci||snapshot.model;
 const entries=(Array.isArray(meter?.entries)?meter.entries:[]).filter((e:Row)=>e.conversationId===row.id&&e.role==='ceci'&&e.state==='completed'&&e.model===model);
 if(!entries.length)return;
 const at=Math.max(...entries.map((e:Row)=>Number(e.at||snapshot.at||0)));if(!at)return;
 const {signature}=await import('./integrations');
 const access={ok:true,responseValidated:true,at,model,label:model,source:'playground',conversationId:row.id,fingerprint:await signature('openai',{...cfg,model}),message:'Conexão e resposta confirmadas no playground com '+model+'.'};
 await newer('check:playgroundModel:'+model,access);
 if(model===cfg.model)await newer('check:openai',access);
 if(await core.getSetting('ceci:retry:'+row.id))return;
 const production=model===cfg.model;
 await newer(production?'check:internal':'check:playgroundInternal',{ok:true,at,model,mode:production?'production':'economic',source:'playground',conversationId:row.id,fingerprint,message:production?'Resposta validada no playground com o modelo de produção.':'Resposta validada no playground econômico com '+model+'.'});
}
async function rows(fingerprint:string,id?:string){
 return core.all(`SELECT c.id,s.value AS snapshot,p.value AS policy,m.value AS meter FROM conversations c
 JOIN settings s ON s.key='playground:config:'||c.id
 JOIN settings a ON a.key='ceci:answered:'||c.id AND CAST(json_extract(a.value,'$.seq') AS INTEGER)>0
 LEFT JOIN settings p ON p.key='playground:policy:'||c.id
 LEFT JOIN settings m ON m.key='playground:meter:'||COALESCE(json_extract(p.value,'$.batchId'),c.id)
 WHERE c.channel='test' AND json_extract(s.value,'$.fingerprint')=? AND EXISTS(SELECT 1 FROM messages msg WHERE msg.conversation_id=c.id AND msg.role='assistant' AND msg.deleted_at=0 AND length(trim(msg.body))>0) ${id?'AND c.id=?':''}
 ORDER BY c.updated DESC LIMIT 30`,fingerprint,...(id?[id]:[]));
}
/** Backfill real response evidence, without new API requests, approvals, or production activation. */
export async function reconcilePlaygroundValidation(cfg:Row,id?:string){
 const {signature}=await import('./integrations');const fingerprint=await signature('internal',cfg);
 const scanned=await core.getSetting('validation:playgroundScan');if(!id&&scanned?.fingerprint===fingerprint&&Date.now()-Number(scanned.at||0)<30000)return;
 for(const row of await rows(fingerprint,id))await recover(row,cfg,fingerprint);
 if(!id)await core.setting('validation:playgroundScan',{fingerprint,at:Date.now()});
}
