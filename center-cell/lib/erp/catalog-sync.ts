import type {Page} from './mercadophone';
import {classifyProduct} from './catalog-classification.ts';

export type SyncState = {runId:string;page:number;received:number;reportedTotal:number;at:number;complete:boolean;error?:string};
const guard = "EXISTS (SELECT 1 FROM settings WHERE key='sync' AND value=?)";
const keep = ['id','nome','aparelhoDescricao','quantidade','valorVenda','valorVenda2','valorVenda3','valorPrazo','produtoDisponibilidadeId','excluido','snExibirCatalogo','tipoProdutoId','tipoProdutoDescricao','snPeca','snAcessorio','snServico'];
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function read(db:D1Database) {
  const row = await db.prepare("SELECT value FROM settings WHERE key='sync'").first<{value:string}>();
  return {raw:row?.value, state:row?JSON.parse(row.value) as SyncState:null};
}

export async function beginCatalogSync(db:D1Database,restart=false):Promise<SyncState> {
  const old = await read(db);
  if(old.state?.runId && !old.state.complete && !restart)return old.state;
  const state:SyncState = {runId:crypto.randomUUID(),page:0,received:0,reportedTotal:0,at:Date.now(),complete:false};
  const next = JSON.stringify(state);
  const statements = old.raw !== undefined ? [
    db.prepare(`DELETE FROM product_stage WHERE ${guard}`).bind(old.raw),
    db.prepare("UPDATE settings SET value=? WHERE key='sync' AND value=?").bind(next,old.raw)
  ] : [db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('sync',?)").bind(next)];
  const results = await db.batch(statements);
  if(!results.at(-1)?.meta.changes)throw new Error('SYNC_CONFLICT');
  return state;
}

export async function syncCatalogPage(db:D1Database,runId:string,page:number,getPage:(page:number)=>Promise<Page>):Promise<SyncState> {
  const {raw,state} = await read(db);
  if(!raw||state?.runId!==runId)throw new Error('SYNC_CONFLICT');
  // A response can be lost after commit. Retrying that page returns the checkpoint.
  if(page<=state.page)return state;
  if(state.complete||page!==state.page+1)throw new Error('SYNC_PAGE_ORDER');
  try {
    const result = await getPage(page);
    if(result.page!==page || result.limit!==300 || result.items.length>300)throw new Error('ERP_INVALID_PAGE');
    const stamp = Date.now();
    const ids = new Set<number>();
    const rows = result.items.map(item=>{
      const id = item.id;
      if(typeof id!=='number'||!Number.isSafeInteger(id)||id<=0||ids.has(id))throw new Error('UNSTABLE_INVENTORY_PAGINATION');
      ids.add(id);
      const name = String(item.nome||item.aparelhoDescricao||id);
      const derived=classifyProduct(name);
      return {id,name,search:normalize(name),category:String(item.tipoProdutoDescricao||'Outros'),
        data:JSON.stringify(Object.fromEntries(keep.filter(k=>k in item).map(k=>[k,item[k]]))),synced:stamp,
        type:derived.type,brand:derived.brand,models:JSON.stringify(derived.models),variant:derived.variant,displayName:derived.displayName,enriched:1};
    });
    const duplicate = await db.prepare('SELECT id FROM product_stage WHERE run_id=? AND id IN (SELECT value FROM json_each(?)) LIMIT 1').bind(runId,JSON.stringify([...ids])).first();
    if(duplicate)throw new Error('UNSTABLE_INVENTORY_PAGINATION');
    const next:SyncState = {...state,page,received:state.received+rows.length,reportedTotal:result.total,at:stamp,complete:rows.length<300};
    delete next.error;
    const statements = [db.prepare(`INSERT INTO product_stage (run_id,id,name,search,category,data,synced,type,brand,models,variant,display_name,enriched)
      SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.search'),json_extract(value,'$.category'),json_extract(value,'$.data'),json_extract(value,'$.synced'),json_extract(value,'$.type'),json_extract(value,'$.brand'),json_extract(value,'$.models'),json_extract(value,'$.variant'),json_extract(value,'$.displayName'),1 FROM json_each(?) WHERE ${guard}`).bind(runId,JSON.stringify(rows),raw)];
    if(next.complete)statements.push(
      db.prepare(`DELETE FROM products WHERE ${guard}`).bind(raw),
      db.prepare(`INSERT INTO products (id,name,search,category,data,synced,type,brand,models,variant,display_name,enriched) SELECT id,name,search,category,data,synced,type,brand,models,variant,display_name,enriched FROM product_stage WHERE run_id=? AND ${guard}`).bind(runId,raw),
      db.prepare(`DELETE FROM product_stage WHERE run_id=? AND ${guard}`).bind(runId,raw)
    );
    statements.push(db.prepare("UPDATE settings SET value=? WHERE key='sync' AND value=?").bind(JSON.stringify(next),raw));
    // D1 batch is transactional. The checkpoint guard fences concurrent callers;
    // catalog replacement and the final checkpoint commit together.
    const committed = await db.batch(statements);
    if(!committed.at(-1)?.meta.changes)throw new Error('SYNC_CONFLICT');
    return next;
  } catch(error) {
    const code = error instanceof Error?error.message:'';
    const message = code==='UNSTABLE_INVENTORY_PAGINATION'
      ? 'O ERP repetiu produtos entre páginas. Reinicie a sincronização para obter uma nova leitura.'
      : code==='API_KEY_REQUIRED'?'Configure a credencial do MercadoPhone em Integrações.'
      : code==='SYNC_CONFLICT'?'A sincronização avançou em outra aba. Atualize para continuar.'
      : 'A atualização foi interrompida. Você pode retomar da última página concluída.';
    await db.prepare("UPDATE settings SET value=? WHERE key='sync' AND value=?").bind(JSON.stringify({...state,error:message}),raw).run();
    throw error;
  }
}
