import {cp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('public','dist',{recursive:true});console.log('Interface e recursos locais preparados para Netlify.');

await writeFile('worker/generated-uf.mjs','export default '+await readFile('public/data/br-uf-ibge.geojson','utf8')+';\n');
