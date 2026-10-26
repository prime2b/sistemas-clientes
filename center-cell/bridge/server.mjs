import http from 'node:http';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import makeWASocket,{BufferJSON,DisconnectReason,initAuthCreds,jidDecode,jidNormalizedUser,proto} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const {BRIDGE_API_TOKEN,SESSION_KEY,SITE_EVENTS_URL,SITE_AUTH_HEADER}=process.env;
const sessionKey=Buffer.from(SESSION_KEY||'','base64');
if(!BRIDGE_API_TOKEN||BRIDGE_API_TOKEN.length<32||sessionKey.length!==32||!SITE_EVENTS_URL?.startsWith('https://')||!SITE_AUTH_HEADER)throw new Error('Configure BRIDGE_API_TOKEN, SESSION_KEY (32 bytes em Base64), SITE_EVENTS_URL e SITE_AUTH_HEADER.');
const file=process.env.SQLITE_FILE||'./data/center-cell.sqlite';
mkdirSync(dirname(file),{recursive:true,mode:0o700});
const db=new DatabaseSync(file);
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS auth (key TEXT PRIMARY KEY, value BLOB NOT NULL); CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, payload BLOB NOT NULL, delivered INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);');
const putAuth=db.prepare('INSERT INTO auth (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
const getAuth=db.prepare('SELECT value FROM auth WHERE key=?');
const putMessage=db.prepare('INSERT OR IGNORE INTO outbox (id,payload,created) VALUES (?,?,?)');

function encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',sessionKey,iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);}
function decrypt(value){const iv=value.subarray(0,12),tag=value.subarray(value.length-16),cipher=createDecipheriv('aes-256-gcm',sessionKey,iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(value.subarray(12,-16)),cipher.final()]);}
function read(key){const row=getAuth.get(key);return row?JSON.parse(decrypt(row.value).toString(),BufferJSON.reviver):null;}
function write(key,value){putAuth.run(key,encrypt(Buffer.from(JSON.stringify(value,BufferJSON.replacer))));}
const creds=read('creds')||initAuthCreds();
const auth={creds,keys:{
  async get(type,ids){const result={};for(const id of ids){let value=read(`${type}-${id}`);if(value&&type==='app-state-sync-key')value=proto.Message.AppStateSyncKeyData.fromObject(value);if(value)result[id]=value;}return result;},
  async set(data){db.exec('BEGIN');try{for(const [type,entries] of Object.entries(data))for(const [id,value] of Object.entries(entries)){const key=`${type}-${id}`;if(value)write(key,value);else db.prepare('DELETE FROM auth WHERE key=?').run(key);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
}};
const logger=pino({level:'silent'});
let socket=null, generation=0, state='offline',qr=null,phone=null,retryTimer=null;

function connect(force=false){
  if(!force&&['connected','connecting','qr'].includes(state))return;
  if(retryTimer)clearTimeout(retryTimer);
  generation++;const current=generation;
  try{socket?.end(new Error('Reiniciando conexão'));}catch{}
  state='connecting';qr=null;
  socket=makeWASocket({auth,logger,syncFullHistory:false});
  socket.ev.on('creds.update',()=>write('creds',auth.creds));
  socket.ev.on('connection.update',async update=>{
    if(current!==generation)return;
    if(update.qr){state='qr';qr=await QRCode.toDataURL(update.qr,{width:320,margin:2,errorCorrectionLevel:'M'}).catch(()=>null);}
    if(update.connection==='open'){state='connected';qr=null;phone=jidDecode(socket.user?.id||'')?.user||null;}
    if(update.connection==='close'){
      qr=null;state='offline';
      const reason=update.lastDisconnect?.error?.output?.statusCode;
      if(reason===DisconnectReason.loggedOut){db.exec('DELETE FROM auth');auth.creds=initAuthCreds();phone=null;return;}
      retryTimer=setTimeout(()=>{if(current===generation)connect(true);},reason===DisconnectReason.restartRequired?1000:5000);
    }
  });
  socket.ev.on('messages.upsert',async event=>{
    if(current!==generation||event.type!=='notify')return;
    for(const message of event.messages){
      const jid=jidNormalizedUser(message.key.remoteJid||'');
      if(message.key.fromMe||!message.key.id||!['s.whatsapp.net','lid'].includes(jidDecode(jid)?.server))continue;
      const alt=jidNormalizedUser(message.key.remoteJidAlt||'');
      let mapped=null;
      try{if(jid.endsWith('@lid'))mapped=await socket.signalRepository?.lidMapping?.getPNForLID(jid);}catch{}
      const pn=[jid,alt,mapped].find(value=>jidDecode(value||'')?.server==='s.whatsapp.net');
      const identifier=pn?jidDecode(pn)?.user:'lid:'+jidDecode(jid)?.user;
      if(!identifier||identifier.length>40)continue;
      const content=message.message?.ephemeralMessage?.message||message.message?.viewOnceMessageV2?.message||message.message;
      const text=content?.conversation||content?.extendedTextMessage?.text||'';
      const payload={kind:'message',id:'web-'+createHash('sha256').update(jid+':'+message.key.id).digest('hex'),phone:identifier,name:String(message.pushName||identifier).slice(0,100),type:text?'text':'media',body:String(text).slice(0,4000)};
      putMessage.run(payload.id,encrypt(Buffer.from(JSON.stringify(payload))),Date.now());
    }
    void drain();
  });
}

let draining=false;
async function drain(){
  if(draining)return;draining=true;
  try{
    for(const row of db.prepare('SELECT id,payload FROM outbox WHERE delivered=0 ORDER BY created LIMIT 30').all()){
      const raw=decrypt(row.payload).toString(),timestamp=String(Date.now());
      const signature='sha256='+createHmac('sha256',BRIDGE_API_TOKEN).update(timestamp+'.'+raw).digest('hex');
      let response;
      try{response=await fetch(SITE_EVENTS_URL,{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':SITE_AUTH_HEADER,'X-Bridge-Timestamp':timestamp,'X-Bridge-Signature':signature},body:raw,signal:AbortSignal.timeout(10000)});}catch{break;}
      if(response.status===400){db.prepare('UPDATE outbox SET delivered=-1 WHERE id=?').run(row.id);continue;}
      if(!response.ok)break;
      db.prepare('UPDATE outbox SET delivered=1 WHERE id=?').run(row.id);
    }
  }finally{draining=false;}
}

function authorized(value){const expected=Buffer.from('Bearer '+BRIDGE_API_TOKEN),actual=Buffer.from(value||'');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
function respond(res,status,payload){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));}
const server=http.createServer(async(req,res)=>{
  if(!authorized(req.headers.authorization))return respond(res,401,{error:'Unauthorized'});
  if(req.method==='GET'&&req.url==='/status')return respond(res,200,{state,qr:state==='qr'?qr:undefined,phone,pending:Number(db.prepare('SELECT COUNT(*) AS total FROM outbox WHERE delivered=0').get().total)});
  if(req.method!=='POST'||!['/connect','/logout','/send'].includes(req.url))return respond(res,404,{error:'Not found'});
  let raw='';for await(const part of req){raw+=part;if(raw.length>10000)return respond(res,413,{error:'Too large'});}
  let body;try{body=JSON.parse(raw||'{}');}catch{return respond(res,400,{error:'Invalid JSON'});}
  try{
    if(req.url==='/connect'){connect(true);return respond(res,200,{state});}
    if(req.url==='/logout'){
      generation++;if(retryTimer)clearTimeout(retryTimer);
      try{await socket?.logout();}catch{}socket=null;
      db.exec('DELETE FROM auth');auth.creds=initAuthCreds();state='offline';qr=null;phone=null;
      return respond(res,200,{state});
    }
    if(state!=='connected'||!socket)return respond(res,503,{error:'Disconnected'});
    const identifier=String(body.phone||'');
    if(!/^(?:\d{10,15}|lid:\d{8,25})$/.test(identifier)||typeof body.body!=='string'||!body.body.trim()||body.body.length>4000)return respond(res,400,{error:'Invalid message'});
    const jid=identifier.startsWith('lid:')?identifier.slice(4)+'@lid':identifier+'@s.whatsapp.net';
    const sent=await socket.sendMessage(jid,{text:body.body});
    return respond(res,200,{id:sent?.key?.id||null});
  }catch{return respond(res,503,{error:'WhatsApp unavailable'});}
});
server.listen(Number(process.env.PORT)||3100,process.env.BIND_HOST||'127.0.0.1');
connect();setInterval(()=>void drain(),3000);
