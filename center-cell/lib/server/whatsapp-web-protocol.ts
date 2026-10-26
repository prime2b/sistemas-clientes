export function bridgeUrl(value:unknown){
  if(typeof value!=='string'||value.length>300)throw new Error('Informe a URL HTTPS do servidor de conexão.');
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.')||/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(url.hostname))throw new Error('Use uma URL HTTPS pública do servidor de conexão.');
  return url.origin;
}

export async function verifyBridgeEvent(raw:string,timestamp:string,signature:string,token:string){
  if(!token||!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>5*60*1000||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.slice(7).match(/../g)!,part=>parseInt(part,16)),new TextEncoder().encode(timestamp+'.'+raw));
}
