export const DAYS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
export const APPS=['Não informado','ATM EVS','VOLVO CAR ELETROPOSTOS','ELETROGRAAL+','TUPI RECARGA','CIA CHARGE','WECHARGE','CHARGER PRO','CURY ENERGIA','NUCHARGE','EASY VOLT ELETROPOSTO'];
export function daySummary(values){
 const known=values.filter(x=>x!==null);return {hours:known.length?known.reduce((a,b)=>a+b,0):null,known:known.length,total:24,coverage:known.length/24};
}
export function dateParts(iso){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error('Data inválida.');const [y,m,d]=iso.split('-').map(Number),v=new Date(Date.UTC(y,m-1,d));if(v.getUTCFullYear()!==y||v.getUTCMonth()!==m-1||v.getUTCDate()!==d)throw Error('Data inválida.');return v;}
export const isoDate=d=>d.toISOString().slice(0,10);
export function rangeFor(type,anchor){const d=dateParts(anchor),y=d.getUTCFullYear(),m=d.getUTCMonth();let a=new Date(d),b=new Date(d);
 if(type==='week'){a.setUTCDate(a.getUTCDate()-((a.getUTCDay()+6)%7));b=new Date(a);b.setUTCDate(b.getUTCDate()+6);}
 if(type==='month'){a=new Date(Date.UTC(y,m,1));b=new Date(Date.UTC(y,m+1,0));}
 if(type==='quarter'){const s=Math.floor(m/3)*3;a=new Date(Date.UTC(y,s,1));b=new Date(Date.UTC(y,s+3,0));}
 if(type==='semester'){const s=m<6?0:6;a=new Date(Date.UTC(y,s,1));b=new Date(Date.UTC(y,s+6,0));}
 return {start:isoDate(a),end:isoDate(b)};
}
export function project(station,start,end){let a=dateParts(start),b=dateParts(end);if(b<a)throw Error('A data final deve ser posterior à inicial.');let hours=0,known=0,total=0,days=0;
 for(;a<=b;a.setUTCDate(a.getUTCDate()+1)){const p=station.profiles[a.getUTCDay()],s=daySummary(p.values);if(s.hours!==null)hours+=s.hours;known+=s.known;total+=24;days++;}
 return {hours:known?hours:null,known,total,coverage:known/total,days,complete:known===total};
}
export function validStation(s){if(!s||typeof s.id!=='string'||!s.id||typeof s.name!=='string'||!s.name.trim()||!APPS.includes(s.app)||typeof s.city!=='string'||!(/^[A-Z]{2}$/).test(s.uf)||!['connector','station','unknown'].includes(s.scope)||!Array.isArray(s.profiles)||s.profiles.length!==7)throw Error('Ponto inválido. Revise nome, aplicativo, cidade, UF e escopo.');
 for(const p of s.profiles){if(!p||!Array.isArray(p.values)||p.values.length!==24||p.values.some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1)))throw Error('Cada perfil precisa de 24 valores entre 0 e 1, ou null para horários sem dados.');if(typeof p.reference!=='string'||typeof p.note!=='string'||typeof p.source!=='string'||typeof p.capturedAt!=='string')throw Error('Metadados do perfil inválidos.');if(p.values.some(v=>v!==null)&&!p.reference.trim())throw Error('Informe a referência de 100% em cada perfil com dados.');}
 if(s.ocmId!==undefined&&(!Number.isSafeInteger(s.ocmId)||s.ocmId<=0))throw Error('ID Open Charge Map inválido.');if((s.lat!==undefined||s.lng!==undefined)&&(!Number.isFinite(s.lat)||!Number.isFinite(s.lng)||s.lat < -90||s.lat > 90||s.lng < -180||s.lng > 180))throw Error('Coordenadas inválidas.');return s;
}
export const blankProfile=()=>({values:Array(24).fill(null),reference:'Linha definida pelo usuário = 100%',source:'Preenchimento manual',note:'Escala adotada como premissa; não validada junto ao aplicativo.',capturedAt:''});
export function newStation(){return {id:typeof crypto.randomUUID==='function'?crypto.randomUUID():[...crypto.getRandomValues(new Uint32Array(4))].map(n=>n.toString(16).padStart(8,'0')).join('-'),name:'',app:APPS[0],city:'',uf:'SP',scope:'unknown',connector:'',power:'',address:'',profiles:Array.from({length:7},blankProfile)};}
export const scopes={connector:'Conector',station:'Eletroposto agregado',unknown:'Escopo a confirmar'};
export function seedStations(){const s={id:'charger-pro-emporio-jota-sjrp',name:'Empório Jota · SJRP',app:'CHARGER PRO',city:'São José do Rio Preto',uf:'SP',scope:'unknown',connector:'Tomada 1 exibida; gráfico sem escopo confirmado',power:'60',address:'Av. Sebastião Tavares da Silva, 1005 · Jardim Vista Alegre',profiles:Array.from({length:7},blankProfile)};
 const heights=[null,49,22,26,27,null,null,27,25,87,93,66,44,29,14,15,107,151,58,54,36,74,62,51];
 s.profiles[0]={values:heights.map(x=>x===null?null:Math.round(x/190*1000)/1000),reference:'190 px: base até a linha intermediária indicada pelo usuário',source:'Leitura aproximada do print enviado por Fred',note:'Domingo típico. Linha intermediária adotada como 100%; hipótese não validada pelo aplicativo. Barras ausentes mantidas como sem dados; o resultado é parcial. Escopo do gráfico a confirmar.',capturedAt:'2026-10-18'};
 return [s];}
