import {headers} from 'next/headers';
import {createHmac} from 'node:crypto';
import * as core from './core';

const COOKIE='__Host-cc_session';
const SESSION_MS=7*24*60*60*1000;
const LEGACY_ITERATIONS=600_000;
const HASH_ROUNDS=6;
const ROUND_ITERATIONS=100_000;
const HASH_PREFIX='v2:';
export type AppUser={id:string;role:'admin'|'attendant';slot:number|null;username:string;email:string;displayName:string;phone:string;avatar:string;presence:'available'|'away';mustChangePassword:boolean;lastLogin:number};

export const normalized=(value:string)=>value.trim().toLocaleLowerCase('pt-BR');
const bytesToHex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hexToBytes=(value:string)=>new Uint8Array(value.match(/../g)?.map(part=>parseInt(part,16))||[]);
const randomBytes=(size:number)=>crypto.getRandomValues(new Uint8Array(size));
export const randomSalt=()=>bytesToHex(randomBytes(16));
export async function digest(value:string){return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));}
export async function hashPassword(password:string,salt:string){
  const baseSalt=hexToBytes(salt);
  let keyBytes:Uint8Array<ArrayBuffer>=new TextEncoder().encode(password);
  for(let round=0;round<HASH_ROUNDS;round++){
    const roundSalt=new Uint8Array(baseSalt.length+1);
    roundSalt.set(baseSalt);
    roundSalt[baseSalt.length]=round;
    const key=await crypto.subtle.importKey('raw',keyBytes,'PBKDF2',false,['deriveBits']);
    keyBytes=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:roundSalt,iterations:ROUND_ITERATIONS,hash:'SHA-256'},key,256));
  }
  return HASH_PREFIX+bytesToHex(keyBytes);
}
function equalHex(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function legacyHashPassword(password:string,salt:string){
  const block=new Uint8Array(hexToBytes(salt).length+4);
  block.set(hexToBytes(salt));
  block[block.length-1]=1;
  const key=new TextEncoder().encode(password);
  let value=createHmac('sha256',key).update(block).digest();
  const result=Uint8Array.from(value);
  for(let iteration=1;iteration<LEGACY_ITERATIONS;iteration++){
    value=createHmac('sha256',key).update(value).digest();
    for(let i=0;i<result.length;i++)result[i]^=value[i];
  }
  return bytesToHex(result);
}
export async function verifyPassword(password:string,salt:string,expected:string){
  return expected.startsWith(HASH_PREFIX)
    ?equalHex(await hashPassword(password,salt),expected)
    :equalHex(legacyHashPassword(password,salt),expected);
}
export function validPassword(password:string){return password.length>=12&&password.length<=128&&/[A-Za-zÀ-ÿ]/.test(password)&&/\d/.test(password);}
export const publicUser=(row:Record<string,unknown>):AppUser=>({id:String(row.id),role:row.role as AppUser['role'],slot:row.slot==null?null:Number(row.slot),username:String(row.username),email:String(row.email),displayName:String(row.display_name),phone:String(row.phone||''),avatar:String(row.avatar||''),presence:row.presence==='away'?'away':'available',mustChangePassword:!!row.must_change_password,lastLogin:Number(row.last_login||0)});
function cookieValue(header:string){return header.split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
export async function tokenFromRequest(request?:Request){const cookie=request?.headers.get('cookie')??(await headers()).get('cookie')??'';const token=cookieValue(cookie);return /^[A-Za-z0-9_-]{40,60}$/.test(token)?token:'';}
export async function currentUser(request?:Request):Promise<AppUser|null>{
  const token=await tokenFromRequest(request);
  if(!token)return null;
  const row=await core.one('SELECT u.* FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1',await digest(token),Date.now());
  return row?publicUser(row):null;
}
export async function createSession(userId:string){
  const token=Array.from(randomBytes(48),b=>'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b%64]).join('');
  const now=Date.now();
  await core.run('INSERT INTO app_sessions (token_hash,user_id,created,expires) VALUES (?,?,?,?)',await digest(token),userId,now,now+SESSION_MS);
  return token;
}
export function sessionCookie(token:string){return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS/1000}`;}
export function clearCookie(){return `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export async function revokeSession(request:Request){const token=await tokenFromRequest(request);if(token)await core.run('DELETE FROM app_sessions WHERE token_hash=?',await digest(token));}
export async function revokeUserSessions(userId:string){await core.run('DELETE FROM app_sessions WHERE user_id=?',userId);}
export async function rateKey(request:Request,identifier:string){return digest(`${request.headers.get('cf-connecting-ip')||'local'}:${normalized(identifier)}`);}
export async function loginBlocked(key:string){const row=await core.one('SELECT lock_until FROM login_throttle WHERE key=?',key);return Number(row?.lock_until||0)>Date.now();}
export async function recordFailure(key:string){
  const now=Date.now();
  await core.run(`INSERT INTO login_throttle (key,failures,window_start,lock_until) VALUES (?,1,?,0)
    ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_start<? THEN 1 ELSE failures+1 END,
      window_start=CASE WHEN window_start<? THEN ? ELSE window_start END,
      lock_until=CASE WHEN window_start>=? AND failures>=5 THEN ? ELSE 0 END`,key,now,now-15*60_000,now-15*60_000,now,now-15*60_000,now+15*60_000);
}
