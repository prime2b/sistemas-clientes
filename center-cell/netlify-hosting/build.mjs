import {cp, mkdir, rm, writeFile} from 'node:fs/promises';
const output = new URL('./dist/', import.meta.url);
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
await cp(new URL('../public/', import.meta.url), output, {recursive:true});
await writeFile(new URL('robots.txt', output), 'User-agent: *\nDisallow: /\n');
console.log('Center Cell: public assets prepared; dynamic routes use the existing application backend.');
