import {getDatabase} from '@netlify/database';
import geo from '../../worker/generated-uf.mjs';
import {createWeChargePilot} from '../../worker/pilot-service.mjs';
import {createOCMService,createUFResolver} from '../../worker/ocm-service.mjs';
import {postgresDB} from '../../worker/postgres-db.mjs';
const pilot=createWeChargePilot();let ocm;
export default async function(request){const url=new URL(request.url),collect=url.pathname==='/api/pilot/wecharge/collect',headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};try{
 if(url.pathname==='/api/ocm/locations'){if(request.method!=='GET')return new Response(null,{status:405});if(!ocm){ocm=createOCMService({geographicUF:createUFResolver(geo)});}return Response.json(await ocm.get(process.env),{headers});}
 if(!['/api/pilot/wecharge','/api/pilot/wecharge/collect'].includes(url.pathname))return new Response(null,{status:404});
 if(request.method!==(collect?'POST':'GET'))return new Response(null,{status:405});
 if(collect&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return new Response(null,{status:403});
 const db=postgresDB(getDatabase().pool);return Response.json(await(collect?pilot.collect(db):pilot.read(db,Object.fromEntries(url.searchParams))),{headers});
 }catch(e){console.error('Radar API:',e.name);return Response.json({error:/Data inválida|Período inválido|Selecione|consulta à WeCharge/.test(e.message)?e.message:'Serviço temporariamente indisponível.'},{status:503,headers});}}
export const config={path:['/api/pilot/wecharge','/api/pilot/wecharge/collect','/api/ocm/locations']};
