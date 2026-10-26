import {parseChatCard} from './chat-cards.ts';
export const TEST_MODEL='gpt-5.6-luna';
export type TestMode='economic'|'production';
export const testModels=(mode:TestMode,production:string)=>({ceci:mode==='production'?production:TEST_MODEL,client:TEST_MODEL,reviewer:TEST_MODEL});
export const testOutputLimits={ceci:1400,client:320,reviewer:1100};
type Row=Record<string,any>;
/** Financial evidence stays in the database; these are compact representations for reasoning. */
export function compactTestMessage(message:Row,options=true){
 const card=parseChatCard(message.card_data);
 if(!card)return String(message.body||'');
 const framing=[card.intro,card.closing].filter(Boolean).join('\n');
 if(card.type==='quote')return framing+'\nORÇAMENTO '+JSON.stringify({id:card.id,items:card.items.map(p=>[p.productId,p.name,p.quantity,p.unitCents]),totalCents:card.totalCents});
 if(!options)return framing+`\n[${card.items.length} produtos em cards; dados transacionais verificados separadamente.]`;
 return framing+'\nOPÇÕES [posição,código,nome,centavos,disponível]: '+JSON.stringify(card.items.map((p:any,i:number)=>[(card.type==='catalog'?(card.part-1)*8:0)+i+1,p.productId,p.name,p.unitCents,p.status?p.status==='available':p.stock>0]));
}
export function compactClientContext(messages:Row[]){
 const visible=messages.filter(m=>m.role!=='note'),recent=new Set(visible.slice(-6));
 // Retain the most recent list (all its pages) and quote, even after clarification turns.
 const cards=visible.map(m=>({m,c:parseChatCard(m.card_data)})),lastList=cards.filter(x=>x.c?.type==='catalog'||x.c?.type==='products').at(-1),lastQuote=cards.filter(x=>x.c?.type==='quote').at(-1);
 const pinned=cards.filter(x=>x===lastQuote||x===lastList||lastList?.c?.type==='catalog'&&x.c?.type==='catalog'&&x.c.checkedAt===lastList.c.checkedAt).map(x=>x.m);
 pinned.forEach(m=>recent.add(m));
 return {customerFacts:visible.filter(m=>m.role==='user'&&!recent.has(m)).map(m=>({id:m.id,text:m.body})),messages:visible.filter(m=>recent.has(m)).map(m=>({id:m.id,role:m.role,body:compactTestMessage(m,pinned.includes(m))}))};
}
export function compactAgentHistory<T extends Row>(messages:T[]){
 const visible=new Set(messages.slice(-12));
 const cards=messages.filter(m=>parseChatCard(m.card_data));
 const lastList=cards.filter(m=>['catalog','products'].includes(parseChatCard(m.card_data)!.type)).at(-1),lastQuote=cards.filter(m=>parseChatCard(m.card_data)?.type==='quote').at(-1);
 for(const m of cards){const c=parseChatCard(m.card_data),last=lastList?parseChatCard(lastList.card_data):null;if(m===lastQuote||m===lastList||c?.type==='catalog'&&last?.type==='catalog'&&c.checkedAt===last.checkedAt)visible.add(m);}
 const represented=new Set<number>();
 const history=messages.filter(m=>visible.has(m)).map(m=>{const c=parseChatCard(m.card_data);c?.items.forEach(p=>represented.add(p.productId));return {...m,body:compactTestMessage(m)};});
 return {messages:history,represented:[...represented]};
}
export function estimatedRequestTokens(payload:unknown){
 // Conservative estimate, not a billing promise. Actual usage replaces it after each response.
 const p=payload as Row;return Math.ceil(new TextEncoder().encode(JSON.stringify(payload)).length/2)+Number(p.max_output_tokens||0)+256;
}
