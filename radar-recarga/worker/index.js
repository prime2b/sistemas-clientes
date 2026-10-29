import {createOCMService,createUFResolver} from './ocm-service.mjs';
import {createWeChargePilot} from './pilot-service.mjs';
// __ASSET_MAP__
const pilot=createWeChargePilot();
let service;
function getService(){if(!service){const geo=JSON.parse(ASSETS['/data/br-uf-ibge.geojson'].body);service=createOCMService({geographicUF:createUFResolver(geo)});}return service;}
const common={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/pilot/wecharge')){
  const collect=url.pathname==='/api/pilot/wecharge/collect',read=url.pathname==='/api/pilot/wecharge';
  if(!collect&&!read)return Response.json({error:'Não encontrado.'},{status:404});
  const method=collect?'POST':'GET',headers={...common,'Cache-Control':'private, no-store'};
  if(request.method!==method)return Response.json({error:'Método não permitido.'},{status:405,headers:{...headers,Allow:method}});
  if(collect&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return Response.json({error:'Origem não autorizada.'},{status:403,headers});
  if(!env.DB)return Response.json({error:'Armazenamento do piloto indisponível.'},{status:503,headers});
  try{return Response.json(await (collect?pilot.collect(env.DB):pilot.read(env.DB,Object.fromEntries(url.searchParams))),{headers});}
  catch(error){return Response.json({error:error.message||'Piloto temporariamente indisponível.'},{status:/Data inválida|Período inválido|Selecione/.test(error.message)?400:503,headers});}
 }
 if(url.pathname==='/api/ocm/locations'){
  if(request.method!=='GET')return Response.json({error:'Método não permitido.'},{status:405,headers:{...common,Allow:'GET'}});
  try{const cache=globalThis.caches?.default,key=new Request(new URL('/__catalog_cache/ocm-br-v4',url.origin));const data=await getService().get(env,cache,key,ctx);return Response.json(data,{headers:{...common,'Cache-Control':'private, no-cache'}});}catch(error){return Response.json({error:error.message||'Catálogo temporariamente indisponível.'},{status:error.status||503,headers:{...common,'Cache-Control':'no-store','Retry-After':'60'}});}
 }
 if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido.',{status:405,headers:{...common,Allow:'GET, HEAD'}});
 let path;try{path=decodeURIComponent(url.pathname);}catch{return new Response('Caminho inválido.',{status:400});}
 const asset=ASSETS[path==='/'?'/index.html':path];if(!asset)return new Response('Não encontrado.',{status:404,headers:common});
 return new Response(request.method==='HEAD'?null:asset.encoding==='base64'?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{...common,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
}};
