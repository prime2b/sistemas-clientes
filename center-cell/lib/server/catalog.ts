import {classifyProduct,fold,slug,catalogTypes} from '../erp/catalog-classification';
import {productSearchPlan,sqlLike} from '../erp/product-search';
import {centerCellPolicy,productForQuote,type CustomerProfile} from '../erp/quote';

type Row=Record<string,any>;
const day=()=>Math.floor(Date.now()/86400000);
export async function recordCatalogActivity(db:D1Database,kind:'search'|'product'|'model',item:string){
  const normalized=kind==='search'?fold(item).toLowerCase().trim():item;
  if(!normalized||normalized.length>100)return;
  const current=day(),id=`${current}:${kind}:${normalized}`;
  await db.prepare('INSERT INTO catalog_activity (id,day,kind,item,count) VALUES (?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET count=count+1').bind(id,current,kind,normalized).run();
}
export async function recordAddedProduct(db:D1Database,id:number){
  const row=await db.prepare('SELECT models FROM products WHERE id=?').bind(id).first<{models:string}>();
  await recordCatalogActivity(db,'product',String(id));
  for(const model of JSON.parse(row?.models||'[]') as {slug:string}[])await recordCatalogActivity(db,'model',model.slug);
}
export async function enrichCatalogBatch(db:D1Database){
  const rows=(await db.prepare('SELECT id,name FROM products WHERE enriched=0 LIMIT 200').all()).results as {id:number;name:string}[];
  if(rows.length){
    await db.batch(rows.map(row=>{
      const d=classifyProduct(row.name);
      return db.prepare('UPDATE products SET type=?,brand=?,models=?,variant=?,display_name=?,enriched=1 WHERE id=? AND enriched=0').bind(d.type,d.brand,JSON.stringify(d.models),d.variant,d.displayName,row.id);
    }));
  }
  const remaining=await db.prepare('SELECT COUNT(*) AS n FROM products WHERE enriched=0').first<{n:number}>();
  return {remaining:remaining?.n||0};
}
export async function catalogMeta(db:D1Database){
  const recent=day()-30;
  const [modelRows,typeRows,frequent,low]=await Promise.all([
    db.prepare(`SELECT json_extract(j.value,'$.slug') AS slug,json_extract(j.value,'$.name') AS name,json_extract(j.value,'$.brand') AS brand,COUNT(*) AS count,COALESCE(MAX(a.popularity),0) AS popularity
      FROM products p JOIN json_each(p.models) j LEFT JOIN
      (SELECT item,SUM(count) AS popularity FROM catalog_activity WHERE kind='model' AND day>=? GROUP BY item) a ON a.item=json_extract(j.value,'$.slug')
      WHERE p.enriched=1 GROUP BY slug ORDER BY popularity DESC,count DESC,name LIMIT 2000`).bind(recent).all(),
    db.prepare('SELECT type,COUNT(*) AS count,GROUP_CONCAT(DISTINCT variant) AS variants FROM products WHERE enriched=1 GROUP BY type').all(),
    db.prepare("SELECT item,SUM(count) AS popularity FROM catalog_activity WHERE kind='search' AND day>=? GROUP BY item ORDER BY popularity DESC LIMIT 6").bind(recent).all(),
    db.prepare(`SELECT p.*,COALESCE(a.popularity,0) AS popularity FROM products p LEFT JOIN
      (SELECT item,SUM(count) AS popularity FROM catalog_activity WHERE kind='product' AND day>=? GROUP BY item) a ON a.item=CAST(p.id AS TEXT)
      WHERE p.enriched=1 AND CAST(json_extract(p.data,'$.quantidade') AS INTEGER) BETWEEN 1 AND 5 ORDER BY popularity DESC,p.name LIMIT 5`).bind(recent).all()
  ]);
  const project=(row:Row)=>({id:row.id,name:row.name,displayName:row.display_name||row.name,type:row.type,brand:row.brand,models:JSON.parse(row.models||'[]'),stock:Number(JSON.parse(row.data).quantidade||0),popularity:row.popularity||0});
  return {models:(modelRows.results as Row[]).filter(row=>row.slug),types:catalogTypes.map(type=>({...type,count:Number((typeRows.results as Row[]).find(row=>row.type===type.id)?.count||0),examples:String((typeRows.results as Row[]).find(row=>row.type===type.id)?.variants||'').split(',').filter(Boolean).slice(0,3)})),frequent:(frequent.results as Row[]).map(row=>row.item),lowStock:(low.results as Row[]).map(project)};
}
export async function catalogPrices(db:D1Database,ids:number[],profile:CustomerProfile){
  if(!ids.length)return [];
  const unique=[...new Set(ids)].slice(0,30);
  const rows=(await db.prepare(`SELECT * FROM products WHERE id IN (${unique.map(()=>'?').join(',')})`).bind(...unique).all()).results as Row[];
  return rows.map(row=>{try{const p=productForQuote(JSON.parse(row.data),centerCellPolicy(profile));const stock=Math.max(0,Math.floor(p.stock||0));return {...p,stock,canQuote:p.canQuote&&stock>=1,displayName:row.display_name||row.name,type:row.type,brand:row.brand,models:JSON.parse(row.models||'[]')};}catch{return {id:row.id,name:row.name,displayName:row.display_name||row.name,type:row.type,brand:row.brand,models:JSON.parse(row.models||'[]'),stock:0,priceCents:null,canQuote:false};}});
}
export async function queryCatalog(db:D1Database,params:{query:string;profile:CustomerProfile;model?:string;type?:string;brand?:string;stockOnly?:boolean;lowOnly?:boolean;sort?:string;offset?:number;limit?:number}){
  const plan=productSearchPlan(params.query);
  const where=['p.enriched=1'];const args:(string|number)[]=[];
  const searchTerms:string[]=[];const searchArgs:string[]=[];
  for(const group of plan.groups){searchTerms.push('('+group.map(()=>"p.search LIKE ? OR lower(p.models) LIKE ?").join(' OR ')+')');for(const term of group)searchArgs.push(sqlLike(term),sqlLike(term));}
  if(/^\d+$/.test(params.query.trim())){where.push(`(p.id=? OR (${searchTerms.join(' AND ')}))`);args.push(Number(params.query.trim()),...searchArgs);}
  else if(searchTerms.length){where.push(...searchTerms);args.push(...searchArgs);}
  if(params.model){where.push("EXISTS (SELECT 1 FROM json_each(p.models) j WHERE json_extract(j.value,'$.slug')=?)");args.push(slug(params.model));}
  if(params.brand){where.push('p.brand=?');args.push(params.brand);}
  if(params.stockOnly!==false){where.push("CAST(json_extract(p.data,'$.quantidade') AS REAL)>0");}
  if(params.lowOnly){where.push("CAST(json_extract(p.data,'$.quantidade') AS REAL) BETWEEN 1 AND 5");}
  const base='FROM products p WHERE '+where.join(' AND ');
  const counts=(await db.prepare(`SELECT p.type,COUNT(*) AS count ${base} GROUP BY p.type`).bind(...args).all()).results as Row[];
  const selected=params.type&&params.type!=='all'?params.type:'';
  const allWhere='WHERE '+where.join(' AND '),allArgs=[...args];
  if(selected){where.push('p.type=?');args.push(selected);}
  const filtered='WHERE '+where.join(' AND ');
  const total=Number((await db.prepare(`SELECT COUNT(*) AS n FROM products p ${filtered}`).bind(...args).first<{n:number}>())?.n||0);
  const cutoff=day()-30;
  const price=params.profile==='consumidor_final'?"CASE WHEN json_extract(p.data,'$.snAcessorio') IN (1,'1',true) OR json_extract(p.data,'$.tipoProdutoId') IN (51875,78020) THEN json_extract(p.data,'$.valorVenda2') ELSE json_extract(p.data,'$.valorVenda') END":"json_extract(p.data,'$.valorVenda')";
  const order=params.sort==='price' ? `CAST(${price} AS REAL) ASC,p.display_name`:
    params.sort==='stock' ? "CAST(json_extract(p.data,'$.quantidade') AS REAL) DESC,p.display_name":
    params.sort==='name' ? 'p.display_name COLLATE NOCASE ASC':
    'COALESCE(a.popularity,0) DESC,p.display_name COLLATE NOCASE ASC';
  const limit=Math.min(50,Math.max(1,params.limit||50)),offset=Math.max(0,params.offset||0);
  const activity="LEFT JOIN (SELECT item,SUM(count) AS popularity FROM catalog_activity WHERE kind='product' AND day>=? GROUP BY item) a ON a.item=CAST(p.id AS TEXT)";
  const rows=selected?(await db.prepare(`SELECT p.*,COALESCE(a.popularity,0) AS popularity FROM products p ${activity} ${filtered} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(cutoff,...args,limit,offset).all()).results as Row[]:[];
  const previewRows=!selected?(await db.prepare(`WITH ranked AS (SELECT p.*,COALESCE(a.popularity,0) AS popularity,ROW_NUMBER() OVER (PARTITION BY p.type ORDER BY ${order}) AS rn FROM products p ${activity} ${allWhere}) SELECT * FROM ranked WHERE rn<=4 ORDER BY type,rn`).bind(cutoff,...allArgs).all()).results as Row[]:[];
  const project=(row:Row)=>{
    const raw=JSON.parse(row.data),derived=classifyProduct(row.name);
    try{const p=productForQuote(raw,centerCellPolicy(params.profile));const stock=Math.max(0,Math.floor(p.stock||0));return {...p,stock,canQuote:p.canQuote&&stock>=1,name:row.name,displayName:row.display_name||derived.displayName,type:row.type,brand:row.brand,models:JSON.parse(row.models||'[]'),variant:row.variant,popularity:row.popularity};}
    catch{return {id:row.id,name:row.name,displayName:row.display_name||derived.displayName,type:row.type,brand:row.brand,models:JSON.parse(row.models||'[]'),stock:raw.quantidade||0,priceCents:null,canQuote:false,popularity:row.popularity};}
  };
  return {total,counts,items:rows.map(project),previews:previewRows.map(project)};
}
