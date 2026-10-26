/** Each inbound gets a waiter. A busy conversation never drops its next message. */
export async function drainCeci<T>(p:{
  now:()=>number;wait:(ms:number)=>Promise<void>;claim:()=>Promise<string|null>;release:(owner:string)=>Promise<void>;
  pending:()=>Promise<number>;answered:()=>Promise<number>;
  generate:(target:number,signal:AbortSignal)=>Promise<T|undefined>;publish:(reply:T)=>Promise<void>;
  fail:(error:unknown,target:number)=>Promise<void>;
},budgetMs=26000){
  const deadline=p.now()+budgetMs;
  let answered=false;
  await p.wait(700);
  while(p.now()<deadline-1000){
    const owner=await p.claim();
    if(!owner){await p.wait(Math.min(450,Math.max(1,deadline-p.now()-500)));continue;}
    let target=0;
    try{
      target=await p.pending();
      if(!target||target<=await p.answered())return answered;
      // A short quiet window combines WhatsApp fragments, capped to avoid endless debounce.
      const settleBy=Math.min(deadline-1200,p.now()+1800);
      while(p.now()<settleBy){
        await p.wait(Math.min(650,settleBy-p.now()));
        const newer=await p.pending();
        if(newer===target)break;
        target=newer;
      }
      if(p.now()>=deadline-6000)return answered;
      const controller=new AbortController();
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{
        const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('CECI_TIMEOUT'));},Math.max(1,deadline-p.now()-4300));});
        const reply=await Promise.race([p.generate(target,controller.signal),timeout]);
        if(reply){await p.publish(reply);answered=true;}
        else return answered;
      }finally{if(timer)clearTimeout(timer);}
    }catch(error){
      const reason=error instanceof Error?error.message:'';
      if(reason==='CECI_STOPPED')return answered;
      if(reason==='CECI_SUPERSEDED'||await p.pending()>target){continue;}
      await p.fail(error,target);return answered;
    }finally{await p.release(owner);}
    if(await p.pending()<=await p.answered())return answered;
  }
  return answered;
}
