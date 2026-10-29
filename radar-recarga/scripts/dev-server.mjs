import http from 'node:http';import {readFile,stat} from 'node:fs/promises';import path from 'node:path';
import {localPilotDB} from './local-pilot-db.mjs';
import {createWeChargePilot} from '../worker/pilot-service.mjs';
import {createOCMService,createUFResolver} from '../worker/ocm-service.mjs';
const root=path.resolve(import.meta.dirname,'..'),publicDir=path.join(root,'public');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.txt':'text/plain','.woff2':'font/woff2'};
const geo=JSON.parse(await readFile(path.join(publicDir,'data/br-uf-ibge.geojson'),'utf8')),service=createOCMService({geographicUF:createUFResolver(geo)});
let pilotPreview=null;
try{const capture=JSON.parse(await readFile(path.join(root,'.qa/wecharge-capture.json'),'utf8'));const fixedTime=Date.parse(capture.queriedAt);const db=localPilotDB();const pilot=createWeChargePilot({clock:()=>fixedTime,fetchImpl:async()=>Response.json(capture.response)});await pilot.collect(db);pilotPreview={pilot,db};}catch{}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/pilot/wecharge')){if(!pilotPreview)throw Object.assign(Error('Captura real de QA não disponível.'),{status:503});let payload;if(url.pathname.endsWith('/collect'))payload={collected:false,reason:'Prévia: utiliza uma captura real arquivada, sem gravar novos horários.'};else {payload=await pilotPreview.pilot.read(pilotPreview.db,Object.fromEntries(url.searchParams));payload.meta.preview=true;}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(payload));return;}if(url.pathname==='/api/ocm/locations'){
 let payload;
 try{payload=JSON.parse(await readFile(path.join(root,'.qa/ocm-live-response.json'),'utf8'));payload.meta.preview=true;}catch{payload=await service.get(process.env);}
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(payload));return;}
 const rel=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(publicDir,rel);if(!file.startsWith(publicDir+path.sep))throw Error('Caminho inválido.');const data=await readFile(file);res.writeHead(200,{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+(path.extname(file)==='.woff2'?'':'; charset=utf-8'),'Cache-Control':'no-cache'});res.end(data);
}catch(error){res.writeHead(error.status||404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.status?error.message:'Arquivo não encontrado.'}));}});
server.listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log('Radar Recarga dev pronto.'));
