// SQLite-backed D1 contract for local QA only; never bundled into the hosted Worker.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function localPilotDB(filename=':memory:'){
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
 sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){
  if(sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
  sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
 }
 function prepare(sql,args=[]){return {sql,args,bind(...values){return prepare(sql,values);},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:r.changes}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args),success:true};}};}
 return {prepare,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}
