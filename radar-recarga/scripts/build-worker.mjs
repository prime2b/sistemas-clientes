import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),assets={};
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.txt':'text/plain; charset=utf-8','.woff2':'font/woff2'};
async function collect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await collect(p);else{const ext=path.extname(p);if(!types[ext])throw Error('Asset não suportado: '+e.name);assets['/'+path.relative(path.join(root,'public'),p).split(path.sep).join('/')]={type:types[ext],body:await readFile(p,ext==='.woff2'?'base64':'utf8'),...(ext==='.woff2'?{encoding:'base64'}:{})};}}}
await collect(path.join(root,'public'));
const service=(await readFile(path.join(root,'worker/ocm-service.mjs'),'utf8')).replace(/^export /gm,'');
const pilotEngine=(await readFile(path.join(root,'public/pilot-engine.mjs'),'utf8')).replace(/^export /gm,'');
const pilotService=(await readFile(path.join(root,'worker/pilot-service.mjs'),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const worker=(await readFile(path.join(root,'worker/index.js'),'utf8')).replace("import {createOCMService,createUFResolver} from './ocm-service.mjs';",'').replace("import {createWeChargePilot} from './pilot-service.mjs';",'').replace('// __ASSET_MAP__','const ASSETS='+JSON.stringify(assets)+';');
await rm(path.join(root,'dist'),{recursive:true,force:true});await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
await writeFile(path.join(root,'dist/server/index.js'),service+'\n'+pilotEngine+'\n'+pilotService+'\n'+worker);await writeFile(path.join(root,'dist/.openai/hosting.json'),await readFile(path.join(root,'.openai/hosting.json')));
console.log('Worker gerado; '+Object.keys(assets).length+' arquivos de interface embutidos, sem segredos.');
