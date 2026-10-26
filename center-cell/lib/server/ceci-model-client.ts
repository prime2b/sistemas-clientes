import {modelFailure} from '../ceci-diagnostics.ts';
export type ModelDiagnostic={reason:string;status:number;code:string;type:string;attempt:number;at:number;retryAt?:number;requestId?:string};
export function retryDelay(value:string|null,now:number){
  if(!value?.trim())return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds))return seconds>=0?seconds*1000:null;
  const date=Date.parse(value);return Number.isFinite(date)?Math.max(0,date-now):null;
}
const pause=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(new Error('CECI_TIMEOUT'));return;}
  const abort=()=>{clearTimeout(timer);reject(new Error('CECI_TIMEOUT'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
});
/** A single response request with bounded retries; never retries billing or authorization failures. */
export async function requestCeciModel(args:{key:string;payload:Record<string,unknown>;signal?:AbortSignal;request?:typeof fetch;wait?:(ms:number,signal?:AbortSignal)=>Promise<void>;now?:()=>number;onDiagnostic?:(value:ModelDiagnostic)=>Promise<void>}){
  const now=args.now||Date.now,request=args.request||fetch,wait=args.wait||pause;
  const signal=args.signal||AbortSignal.timeout(45000),started=now();
  for(let attempt=1;attempt<=3;attempt++){
    if(signal.aborted)throw new Error('CECI_TIMEOUT');
    let response:Response;
    try{response=await request('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+args.key,'Content-Type':'application/json'},body:JSON.stringify(args.payload),signal});}
    catch{
      const reason=signal.aborted?'CECI_TIMEOUT':'CECI_MODEL_NETWORK';
      await args.onDiagnostic?.({reason,status:0,code:'',type:'',attempt,at:now()});
      throw new Error(reason);
    }
    if(response.ok)return await response.json() as Record<string,any>;
    const body=await response.json().catch(()=>null) as {error?:{code?:string;type?:string}}|null;
    // Persist only bounded machine identifiers; never the upstream message, prompt, or key.
    const clean=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value)&&!value.includes(args.key)?value:'';
    const code=clean(body?.error?.code),type=clean(body?.error?.type),reason=modelFailure(response.status,code,type);
    const hint=retryDelay(response.headers.get('retry-after'),now());
    const delay=hint??(800*2**(attempt-1)+Math.floor(Math.random()*200));
    const retryable=reason==='CECI_MODEL_RATE_LIMIT'||reason==='CECI_MODEL_TEMPORARY';
    await args.onDiagnostic?.({reason,status:response.status,code,type,attempt,at:now(),...(retryable?{retryAt:now()+delay}:{}),requestId:clean(response.headers.get('x-request-id'))});
    // Respect long Retry-After hints by deferring instead of retrying early.
    if(!retryable||attempt===3||delay>4000||now()-started+delay>10000)throw new Error(reason);
    await wait(delay,signal);
  }
  throw new Error('CECI_MODEL_TEMPORARY');
}
