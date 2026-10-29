// D1-compatible interface over a PostgreSQL pool; all SQL comes from our services.
export function postgresSQL(sql){let i=0;const ignore=/^INSERT OR IGNORE /i.test(sql);sql=sql.replace(/^INSERT OR IGNORE /i,'INSERT ' ).replace(/\?/g,()=>'$'+(++i));return ignore?sql+' ON CONFLICT DO NOTHING':sql;}
export function postgresDB(pool){
 function prepare(sql,args=[]){const query=postgresSQL(sql);return {query,args,bind(...values){return prepare(sql,values);},async run(){const r=await pool.query(query,args);return {meta:{changes:r.rowCount}};},async first(){return (await pool.query(query,args)).rows[0]||null;},async all(){return {results:(await pool.query(query,args)).rows};}};}
 return {prepare,async batch(statements){const c=await pool.connect();try{await c.query('BEGIN');for(const s of statements)await c.query(s.query,s.args);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
}
