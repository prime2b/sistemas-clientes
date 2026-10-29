export const REFRESH_MS=5*60*1000;
export const RESULT_LIMIT=10000;
const UF_NAMES={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
const clean=v=>String(v??'').replace(/<[^>]*>/g,'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function resolveUF(text){const n=norm(text).replace(/[^a-z ]/g,'').trim();for(const [uf,name] of Object.entries(UF_NAMES)){if([uf.toLowerCase(),norm(name),'estado de '+norm(name),norm(name)+' '+uf.toLowerCase()].includes(n))return uf;}return 'ND';}
function inRing(x,y,ring){let inside=false;let [xj,yj]=ring.at(-1);for(const [xi,yi] of ring){if((yi>y)!=(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;[xj,yj]=[xi,yi];}return inside;}
export function createUFResolver(geo){const regions=(geo?.features||[]).map(f=>{const points=f.geometry.coordinates.flat(2);return {uf:f.properties.uf,polygons:f.geometry.coordinates,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};});return (x,y)=>{for(const r of regions){if(x<r.bounds[0]||y<r.bounds[1]||x>r.bounds[2]||y>r.bounds[3])continue;for(const rings of r.polygons){if(inRing(x,y,rings[0])&&!rings.slice(1).some(ring=>inRing(x,y,ring)))return r.uf;}}return 'ND';};}
export function normalizePOI(p,geographicUF=()=> 'ND'){
 const a=p?.AddressInfo||{},lat=a.Latitude,lng=a.Longitude;
 if(!Number.isSafeInteger(p?.ID)||p.ID<=0||typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -35||lat > 6||lng < -74||lng > -34)return null;
 if(a.CountryID!==undefined&&a.CountryID!==36)return null;
 const provider=p.DataProvider||{};
 if(provider.IsOpenDataLicensed===false&&p.DataProviderID!==1)return null;
 let uf=resolveUF(a.StateOrProvince),ufSource='ocm';if(uf==='ND'){uf=geographicUF(lng,lat);ufSource=uf==='ND'?'unknown':'geometry-ibge';}
 const conns=Array.isArray(p.Connections)?p.Connections:[];
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 return {id:p.ID,name:clean(a.Title)||'Eletroposto OCM '+p.ID,address:clean(a.AddressLine1),address2:clean(a.AddressLine2),city:clean(a.Town)||'Município não informado',state:clean(a.StateOrProvince),uf,ufSource,postcode:clean(a.Postcode),lat,lng,operator:clean(p.OperatorInfo?.Title)||'Operador não informado',operatorId:p.OperatorID,connections:conns.map(c=>({id:c.ID??null,type:clean(c.ConnectionType?.Title)||'Não informado',typeId:c.ConnectionTypeID,power:number(c.PowerKW),quantity:number(c.Quantity),status:clean(c.StatusType?.Title),statusId:c.StatusTypeID??null,isOperational:typeof c.StatusType?.IsOperational==='boolean'?c.StatusType.IsOperational:null,reference:clean(c.Reference),amps:number(c.Amps),voltage:number(c.Voltage),current:clean(c.CurrentType?.Title),currentTypeId:c.CurrentTypeID??null,level:clean(c.Level?.Title),levelId:c.LevelID??null,comments:clean(c.Comments)})),numberOfPoints:typeof p.NumberOfPoints==='number'?p.NumberOfPoints:null,status:clean(p.StatusType?.Title)||'Não informado',isOperational:typeof p.StatusType?.IsOperational==='boolean'?p.StatusType.IsOperational:null,usage:clean(p.UsageType?.Title)||'Não informado',usageCost:clean(p.UsageCost),access:clean(a.AccessComments),updatedAt:p.DateLastStatusUpdate||null,verifiedAt:p.DateLastVerified||null,providerId:p.DataProviderID,provider:clean(provider.Title)||'Open Charge Map contributors',license:clean(provider.License)||(p.DataProviderID===1?'Creative Commons Attribution 4.0 International (CC BY 4.0)':'Licença aberta do provedor; consultar registro OCM'),providerURL:provider.WebsiteURL||null,ocmURL:'https://openchargemap.org/site/poi/details/'+p.ID,raw:p};
}
export function normalizeCatalog(raw,geographicUF=()=> 'ND',now=Date.now()){
 if(!Array.isArray(raw)||raw.length===0)throw new Error('O Open Charge Map retornou uma lista vazia ou inválida.');
 const map=new Map();for(const p of raw){const point=normalizePOI(p,geographicUF);if(point)map.set(point.id,point);}
 if(!map.size)throw new Error('A resposta não continha unidades brasileiras com coordenadas válidas.');
 const points=[...map.values()],counts={};for(const p of points)counts[p.uf]=(counts[p.uf]||0)+1;
 return {meta:{source:'Open Charge Map',schemaVersion:4,includesCompletePOI:true,mode:'live',sourceURL:'https://openchargemap.org/develop/api',fetchedAt:new Date(now).toISOString(),sourceDate:null,scope:'BR',total:points.length,countsByUF:counts,states:UF_NAMES,refreshSeconds:REFRESH_MS/1000,sourceDescription:'Consulta atual à API oficial. Cadastros técnicos; disponibilidade e ocupação ao vivo não garantidas.',resultLimit:RESULT_LIMIT,limitReached:raw.length>=RESULT_LIMIT,excluded:raw.length-points.length},points};
}
export class OCMError extends Error{constructor(message,status=503){super(message);this.status=status;}}
export function createOCMService({fetchImpl=fetch,clock=Date.now,geographicUF=()=> 'ND'}={}){
 let saved=null,inflight=null,nextAttempt=0;
 async function get(env,platformCache,cacheKey,ctx){
  const now=clock();if(saved&&now-saved.time<REFRESH_MS)return saved.payload;
  if(platformCache&&cacheKey){try{const hit=await platformCache.match(cacheKey);if(hit){const payload=await hit.json(),time=Date.parse(payload.meta?.fetchedAt);if(Number.isFinite(time)&&now-time<REFRESH_MS){saved={payload,time};return payload;}}}catch{}}
  if(inflight)return inflight;
  if(now<nextAttempt){if(saved)return {...saved.payload,meta:{...saved.payload.meta,mode:'stale',connectionError:'A API está temporariamente indisponível; mostrando a última consulta bem-sucedida.'}};throw new OCMError('A API está temporariamente indisponível. Tente novamente em um minuto.');}
  if(!env.OPENCHARGEMAP_API_KEY)throw new OCMError('A conexão com o Open Charge Map ainda não está configurada no servidor.',503);
  inflight=(async()=>{try{
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
   let response,raw;try{response=await fetchImpl('https://api.openchargemap.io/v3/poi/?output=json&countrycode=BR&maxresults='+RESULT_LIMIT+'&compact=false&verbose=true&opendata=true&includecomments=true&sortby=id_asc',{headers:{'X-API-Key':env.OPENCHARGEMAP_API_KEY,'Accept':'application/json','User-Agent':'RadarRecarga/1.0 (+https://radar-recarga-sp.fredborrasca.chatgpt.site)'},signal:controller.signal});if(response.ok)raw=await response.json();}finally{clearTimeout(timer);}
   if(response.status===401||response.status===403)throw new OCMError('O Open Charge Map recusou a credencial configurada. A chave não é exibida ao navegador.',502);
   if(response.status===429)throw new OCMError('O Open Charge Map atingiu um limite temporário. Aguarde antes de atualizar.',503);
   if(!response.ok)throw new OCMError('Não foi possível consultar o Open Charge Map neste momento.',503);
   const payload=normalizeCatalog(raw,geographicUF,clock());saved={payload,time:clock()};nextAttempt=0;
   if(platformCache&&cacheKey){const write=platformCache.put(cacheKey,new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=300'}})).catch(()=>{});if(ctx?.waitUntil)ctx.waitUntil(write);else await write;}
   return payload;
  }catch(error){nextAttempt=clock()+60000;if(saved)return {...saved.payload,meta:{...saved.payload.meta,mode:'stale',connectionError:'A API não respondeu; esta é a última consulta bem-sucedida, sem atualização atual.'}};if(error instanceof OCMError)throw error;throw new OCMError('A API do Open Charge Map não respondeu com dados válidos. Tente novamente em um minuto.',503);
  }finally{inflight=null;}})();return inflight;
 }
 return {get};
}
