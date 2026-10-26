import {beginCatalogSync,syncCatalogPage} from './catalog-sync';
import {MercadoPhone} from './mercadophone';

type Settings={enabled:boolean;interval:number;lastAttempt?:number;lastSuccess?:number;error?:string};
export const syncIntervals=[15,30,60,360,1440];
export async function autoSyncSettings(db:D1Database):Promise<Settings>{
  const row=await db.prepare("SELECT value FROM settings WHERE key='autoSync'").first<{value:string}>();
  return row?JSON.parse(row.value) as Settings:{enabled:false,interval:60};
}
export async function saveAutoSyncSettings(db:D1Database,enabled:boolean,interval:number){
  if(!syncIntervals.includes(interval))throw new Error('INVALID_SYNC_INTERVAL');
  const old=await autoSyncSettings(db);
  await db.prepare("INSERT INTO settings (key,value) VALUES ('autoSync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(JSON.stringify({...old,enabled,interval})).run();
}
export async function runDueAutoSync(db:D1Database,getKey:()=>Promise<string>){
  const row=await db.prepare("SELECT value FROM settings WHERE key='autoSync'").first<{value:string}>();
  if(!row)return;
  const old=JSON.parse(row.value) as Settings;
  if(!old.enabled||!syncIntervals.includes(old.interval)||Date.now()-(old.lastAttempt||0)<old.interval*60000)return;
  const working={...old,lastAttempt:Date.now(),error:undefined};
  const claimed=await db.prepare("UPDATE settings SET value=? WHERE key='autoSync' AND value=?")
    .bind(JSON.stringify(working),row.value).run();
  if(!claimed.meta.changes)return;
  try{
    const client=new MercadoPhone(await getKey());await client.connect();
    let checkpoint=await beginCatalogSync(db);
    for(let i=0;!checkpoint.complete&&i<10000;i++)checkpoint=await syncCatalogPage(db,checkpoint.runId,checkpoint.page+1,page=>client.inventory({page,limit:300}));
    if(!checkpoint.complete)throw new Error('A sincronização excedeu o limite de páginas.');
    const latest=await autoSyncSettings(db);
    await db.prepare("UPDATE settings SET value=? WHERE key='autoSync'").bind(JSON.stringify({...latest,lastSuccess:Date.now(),error:undefined})).run();
  }catch(error){
    const latest=await autoSyncSettings(db);
    await db.prepare("UPDATE settings SET value=? WHERE key='autoSync'").bind(JSON.stringify({...latest,error:'A sincronização automática falhou. Confira a credencial e tente novamente.'})).run();
    throw error;
  }
}
