import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {beginCatalogSync,syncCatalogPage} from '../lib/erp/catalog-sync.ts';

class Prepared {
  constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
  bind(...args){return new Prepared(this.db,this.sql,args);}
  first(){return this.db.prepare(this.sql).get(...this.args) ?? null;}
  all(){return {results:this.db.prepare(this.sql).all(...this.args)};}
  run(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}
}
class D1Mock {
  constructor(){this.sqlite=new DatabaseSync(':memory:');}
  prepare(sql){return new Prepared(this.sqlite,sql);}
  batch(statements){
    this.sqlite.exec('BEGIN');
    try {const result=statements.map(s=>s.run());this.sqlite.exec('COMMIT');return Promise.resolve(result);}
    catch(e){this.sqlite.exec('ROLLBACK');throw e;}
  }
}
const db=new D1Mock();
db.sqlite.exec(`CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,search TEXT NOT NULL,category TEXT NOT NULL,data TEXT NOT NULL,synced INTEGER NOT NULL,type TEXT DEFAULT 'outros',brand TEXT DEFAULT 'Outras',models TEXT DEFAULT '[]',variant TEXT DEFAULT '',display_name TEXT DEFAULT '',enriched INTEGER DEFAULT 0);
CREATE TABLE product_stage(run_id TEXT NOT NULL,id INTEGER NOT NULL,name TEXT NOT NULL,search TEXT NOT NULL,category TEXT NOT NULL,data TEXT NOT NULL,synced INTEGER NOT NULL,type TEXT DEFAULT 'outros',brand TEXT DEFAULT 'Outras',models TEXT DEFAULT '[]',variant TEXT DEFAULT '',display_name TEXT DEFAULT '',enriched INTEGER DEFAULT 0,PRIMARY KEY(run_id,id));`);
db.sqlite.prepare("INSERT INTO products (id,name,search,category,data,synced) VALUES (999,'Catálogo anterior','catalogo anterior','Outros','{}',1)").run();
const item=id=>({id,nome:'Produto '+id,quantidade:10,valorVenda:100,tipoProdutoDescricao:'Peças'});
const page=(n,items,total=301)=>({page:n,limit:300,total,items});

let state=await beginCatalogSync(db);
state=await syncCatalogPage(db,state.runId,1,async()=>page(1,Array.from({length:300},(_,i)=>item(i+1))));
assert.equal(state.received,300);assert.equal(state.complete,false);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM products').get().n,1,'Published catalog must remain available while staging');
assert.equal((await syncCatalogPage(db,state.runId,1,async()=>{throw new Error('must not refetch')})).received,300,'Retrying a committed page must be idempotent');
state=await syncCatalogPage(db,state.runId,2,async()=>page(2,[item(301)]));
assert.equal(state.complete,true);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM products').get().n,301);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM product_stage').get().n,0);
assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM products WHERE id=999').get().n,0,'Final commit replaces the previous snapshot');

state=await beginCatalogSync(db,true);
await assert.rejects(()=>syncCatalogPage(db,state.runId,1,async()=>{throw new Error('ERP_NETWORK_ERROR')}),/ERP_NETWORK_ERROR/);
let saved=JSON.parse(db.sqlite.prepare("SELECT value FROM settings WHERE key='sync'").get().value);
assert.equal(saved.page,0);assert.ok(saved.error.includes('retomar'));
assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM products').get().n,301,'Failure must preserve the published catalog');

state=await beginCatalogSync(db,true);
state=await syncCatalogPage(db,state.runId,1,async()=>page(1,Array.from({length:300},(_,i)=>item(i+1))));
await assert.rejects(()=>syncCatalogPage(db,state.runId,2,async()=>page(2,[item(2)])),/UNSTABLE_INVENTORY_PAGINATION/);
saved=JSON.parse(db.sqlite.prepare("SELECT value FROM settings WHERE key='sync'").get().value);
assert.equal(saved.page,1);assert.ok(saved.error.includes('repetiu'));

state=await beginCatalogSync(db,true);
let release;const waiting=new Promise(r=>release=r);
const a=syncCatalogPage(db,state.runId,1,async()=>{await waiting;return page(1,[],0)});
const b=syncCatalogPage(db,state.runId,1,async()=>{await waiting;return page(1,[],0)});
release();
const results=await Promise.allSettled([a,b]);
assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.message==='SYNC_CONFLICT').length,1);
console.log('PASS: atomic catalog staging, resume, idempotent retry, failure preservation, duplicate detection, and concurrent-run fencing');
