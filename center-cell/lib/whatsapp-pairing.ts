export type PairingAction='connect'|'logout'|'webhooks'|'activate';
export type PairingStatus={state:string;qr?:string;phone?:string;error?:string;warning?:string;expiresAt?:number;expiresInMs?:number;webhookReady?:boolean;ceci?:{active:boolean;paused:boolean;blockers:string[]}};

/** Discard obsolete polls and bound the entire request, including JSON parsing. */
export class WhatsAppPairingRequests{
 private generation=0;
 private sequence=0;
 private actionRunning=false;
 private controllers=new Set<AbortController>();
 private fetcher:typeof fetch;
 private timeoutMs:number;
 private now:()=>number;
 constructor(fetcher:typeof fetch=fetch,timeoutMs=28000,now:()=>number=Date.now){this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.now=now;}
 cancel(){this.generation++;for(const controller of this.controllers)controller.abort();this.controllers.clear();this.actionRunning=false;}
 async run(action?:PairingAction):Promise<PairingStatus|undefined>{
  if(this.actionRunning)return;
  if(action){this.cancel();this.actionRunning=true;}
  const generation=this.generation,sequence=++this.sequence,controller=new AbortController();this.controllers.add(controller);
  let expired=false;
  const timer=setTimeout(()=>{expired=true;controller.abort();},this.timeoutMs);
  const interrupted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('PAIRING_ABORTED')),{once:true}));
  try{
   const load=async()=>{
    const response=await this.fetcher('/api/whatsapp-web',action?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),signal:controller.signal}:{cache:'no-store',signal:controller.signal});
    let result:PairingStatus;try{result=await response.json();}catch{throw new Error('Não foi possível ler o retorno da conexão. Tente novamente.');}
    if(!response.ok)throw new Error(result?.error||'Não foi possível concluir a conexão. Tente novamente.');
    if(!result||typeof result!=='object'||Array.isArray(result)||(typeof result.state!=='string'&&action!=='webhooks'))throw new Error('O retorno da conexão é inválido. Tente novamente.');
    // Device clocks can differ from the server. A freshly returned QR uses a
    // local countdown; status polls never extend its validity.
    if(result.qr)result={...result,expiresAt:this.now()+Math.max(0,Math.min(20000,result.expiresInMs??20000))};
    return result;
   };
   const result=await Promise.race([load(),interrupted]);
   return generation===this.generation&&sequence===this.sequence?result:undefined;
  }catch(error){
   if(generation!==this.generation||sequence!==this.sequence)return;
   if(expired)throw new Error('A conexão excedeu o tempo de espera. Clique em Gerar QR Code para tentar novamente.');
   throw error instanceof Error?error:new Error('Não foi possível consultar a conexão. Tente novamente.');
  }finally{clearTimeout(timer);this.controllers.delete(controller);if(action&&generation===this.generation)this.actionRunning=false;}
 }
}

export function mergePairingStatus(previous:PairingStatus,next:PairingStatus){
 if(['connected','unconfigured'].includes(next.state))return next;
 return {...next,qr:next.qr||previous.qr,expiresAt:next.qr?next.expiresAt:previous.expiresAt};
}
