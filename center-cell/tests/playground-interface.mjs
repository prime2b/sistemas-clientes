/** Render the real initial React interface; no browser or production services are used. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {fileURLToPath} from 'node:url';
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){const url=new URL(specifier,context.parentURL);if(!/\.[a-z]+$/i.test(url.pathname)){for(const suffix of ['.ts','.tsx'])if(existsSync(fileURLToPath(url)+suffix))return next(url.href+suffix,context);}}return next(specifier,context);},
 load(url,context,next){if(url.endsWith('.tsx'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
const {default:AutomaticTests}=await import('../app/playground/automatic-tests.tsx');
globalThis.fetch=()=>{throw new Error('Rendering cannot start or fetch a test');};
const html=renderToStaticMarkup(createElement(AutomaticTests,{ready:true,onActive:()=>{},onTakeover:()=>{}}));
assert.match(html,/<option value="economic" selected="">Econômico · Luna<\/option>/);assert.match(html,/Homologação · modelo de produção/);
assert.match(html,/Iniciar conversa natural/);assert.match(html,/Desde o “Oi” até a compra/);
assert.match(html,/Primeira mensagem/);assert.match(html,/<option value="oi" selected="">Oi<\/option>/);
assert.equal((html.match(/class="ax-choice /g)||[]).length,3,'only three primary test choices');
assert.match(html,/role="tablist"/);for(const name of ['Conversa','Resultado','Detalhes'])assert.ok(html.includes('>'+name+'<'));
assert.match(html,/Histórico/);assert.match(html,/Configurações/);
assert.ok(!html.includes('Orçamento de tokens'),'advanced settings are closed initially');
assert.ok(!html.includes('Comparar com outra execução'),'report is not stacked below the initial screen');
assert.ok(!html.includes('ax-history-row'),'completed runs do not replace the new-test screen');
assert.ok(html.indexOf('ax-start-area')>html.indexOf('ax-setup-scroll'),'start action is outside the scrolling form');
console.log('PASS interface: natural conversation is the default, greeting is Oi, three compact choices, tabbed results, closed history/settings and persistent start action');
