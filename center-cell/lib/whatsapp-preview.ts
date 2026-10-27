export type PreviewMessage={id:string;role:string;body:string;created:number;pending?:boolean};
/** WhatsApp transport is currently text-only. Never expose internal notes or admin cards to this view. */
export function whatsappPreviewMessages(messages:PreviewMessage[]){
 const seen=new Set<string>();return messages.filter(message=>{if(seen.has(message.id)||!['user','assistant','agent'].includes(message.role)||typeof message.body!=='string'||!message.body.trim())return false;seen.add(message.id);return true;});
}

type AutomaticRun={state?:string;index:number;selectedIndex?:number;phase?:string;cases:Record<string,any>[]};
/** The phone follows the active speaker; historical/paused runs never pretend to type. */
export function automaticPhoneActivity(run:AutomaticRun|null,backingOff=false){
 if(!run||backingOff||run.state!=='running'||(run.selectedIndex??run.index)!==run.index)return null;
 if(run.phase==='ceci')return {side:'business' as const,label:'Ceci está preparando a resposta'};
 if(run.phase==='client')return {side:'customer' as const,label:'Cliente simulado está digitando'};
 if(run.phase!=='attendant')return null;
 const sale=run.cases[run.index]?.sale;
 if(!sale||['queued','completed','claim'].includes(sale.step))return null;
 if(sale.pendingCustomer)return {side:'customer' as const,label:'Cliente simulado está digitando'};
 if(sale.mode==='manual')return null;
 return {side:'business' as const,label:(sale.team?.find((t:Record<string,any>)=>t.slot===sale.assignedSlot)?.name||'Atendente')+' está preparando a resposta'};
}
/** Optimistic customer message has the same identity as its later persisted version. */
export function automaticPhoneMessages(messages:PreviewMessage[],run:AutomaticRun|null){
 const pending=run&&(run.selectedIndex??run.index)===run.index?run.cases[run.index]?.pending:null;
 return pending?.id&&pending.body&&!messages.some(m=>m.id===pending.id)?[...messages,{id:pending.id,role:'user',body:pending.body,created:Date.now(),pending:true}]:messages;
}
