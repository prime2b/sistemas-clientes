import {openingChoices,seedNumber,mentionsTestModel,type TestProduct,type OpeningVariant} from './playground-products.ts';
import {matchesCatalogRequest} from './server/ceci-catalog.ts';
import {confirmsPurchase} from './ceci-purchase.ts';
export type AutoScenario={id:string;title:string;detail:string;goal:string;opening:string;query?:string;kind:'quote'|'catalog'|'edit'|'models'|'handoff'|'missing'|'natural';steps:string[];productContext?:TestProduct;secondProductContext?:TestProduct;fromBeginning?:boolean;completeSale?:boolean;teamUnavailable?:boolean;unavailableReason?:string;openingVariant?:OpeningVariant};
export const autoScenarios:AutoScenario[]=[
 {id:'first-contact',title:'Conversa natural',detail:'Começa com “Oi”. A Ceci descobre a necessidade e conduz até a compra.',kind:'natural',fromBeginning:true,opening:'Oi',goal:'Começar apenas com uma abertura. Deixar a Ceci descobrir a peça, o modelo e o perfil de compra ao longo da conversa; escolher uma opção real, cotar duas unidades e confirmar a compra.',steps:['Primeiro contato','Descobrir peça, modelo e perfil','Consultar e apresentar opções','Escolher produto','Orçar duas unidades','Encaminhar com contexto']},
 {id:'handoff-wait',title:'Equipe indisponível',detail:'Orçamento aceito aguarda na fila, sem anunciar uma atendente disponível.',kind:'quote',teamUnavailable:true,completeSale:true,opening:'',goal:'Escolher uma opção real, cotar duas unidades e confirmar a compra. A equipe estará indisponível: aguardar sem inventar conclusão.',steps:['Cotar e confirmar','Encaminhar para a fila','Aguardar disponibilidade']},
 {id:'quote',title:'Cotação completa',detail:'Buscar, escolher, cotar e avançar para compra.',kind:'quote',opening:'',goal:'Escolher um produto realmente apresentado, cotar duas unidades e só então confirmar que quer comprar.',steps:['Encontrar produtos','Selecionar duas unidades','Conferir orçamento','Confirmar compra','Encaminhamento simulado']},
 {id:'fragments',title:'Pedido em partes',detail:'Informações separadas, sem perder contexto.',kind:'quote',opening:'',goal:'Informar a peça, o modelo e o perfil de lojista em mensagens separadas, conforme as perguntas. Depois escolher, cotar duas unidades e confirmar a compra.',steps:['Entender peça','Identificar modelo e perfil','Selecionar produto','Cotar','Encaminhar']},
 {id:'catalog',title:'Todos os produtos',detail:'Conferir a lista completa e seus cards.',kind:'catalog',opening:'',goal:'Pedir todas as opções da peça e modelo escolhidos no catálogo. Se faltar parte da lista, pedir para continuar. Encerrar somente quando a listagem estiver completa.',steps:['Consultar catálogo','Listar todos os SKUs','Conferir cards e páginas']},
 {id:'selection',title:'Escolha por referência',detail:'Entender “a segunda”, nome e código.',kind:'quote',opening:'',goal:'Escolher a segunda opção disponível (ou a única disponível), dizendo primeiro a posição na lista. Se necessário, esclarecer usando o código realmente apresentado. Pedir duas unidades, conferir e confirmar compra.',steps:['Listar opções','Escolher por posição','Confirmar SKU','Cotar duas unidades','Encaminhar']},
 {id:'edit',title:'Alterar orçamento',detail:'Trocar quantidades sem perder o pedido.',kind:'edit',opening:'',goal:'Escolher uma opção disponível, pedir duas unidades; depois que houver orçamento pedir três; depois que houver novo orçamento retirar uma unidade, terminando com duas. Não confirmar compra antes das alterações.',steps:['Selecionar produto','Orçar duas unidades','Mudar para três','Retirar uma','Conferir total final']},
 {id:'models',title:'Modelos parecidos',detail:'Separar modelos e variantes reais, inclusive 4G e 5G.',kind:'models',opening:'',goal:'Pedir opções de um modelo e depois mudar explicitamente para o segundo modelo indicado no teste. Pedir todas as opções do segundo e não aceitar que tratem os modelos como iguais.',steps:['Consultar primeiro modelo','Mudar explicitamente para o segundo','Conferir modelo e variante da nova lista']},
 {id:'typos',title:'Abreviações e digitação',detail:'Encontrar a peça apesar de erros no pedido.',kind:'quote',opening:'',goal:'Escrever abreviações e pequenos erros no pedido. Esclarecer o modelo se perguntado, selecionar um produto real, cotar duas unidades e confirmar compra.',steps:['Interpretar pedido','Encontrar produtos','Selecionar','Cotar','Encaminhar']},
 {id:'missing',title:'Produto não localizado',detail:'Ampliar a busca sem inventar disponibilidade.',kind:'missing',opening:'Sou lojista. Preciso de uma tela do celular Modelo ZZQ987 inexistente, vocês têm?',goal:'Pedir uma tela do modelo fictício ZZQ987. Reafirmar o modelo se solicitado. Você não tem foto nem código. Não trocar para outro modelo. Aceitar esclarecimento de não localizado ou encaminhamento.',steps:['Buscar termo','Ampliar busca','Explicar limitação ou encaminhar']},
 {id:'complaint',title:'Reclamação e garantia',detail:'Acolhimento e contexto para a equipe.',kind:'handoff',opening:'Comprei uma peça com vocês e ela veio com defeito. Estou bem chateado e preciso acionar a garantia.',goal:'Relatar defeito na peça recebida. Informar que foi comprada ontem, que você tem comprovante e quer resolver com a equipe. Não comprar outra peça.',steps:['Entender reclamação','Acolher sem humor','Encaminhar com resumo']},
 {id:'natural',title:'Mudar de ideia e retomar',detail:'Preservar contexto numa conversa com hesitação.',kind:'natural',opening:'Oi, tudo bem? Tô olhando umas peças pra minha assistência.',goal:'Pedir a peça escolhida para o teste; após as opções dizer que vai pensar; depois retomar a primeira opção disponível, pedir duas unidades, conferir orçamento e confirmar compra. Não repetir saudações.',steps:['Conversar','Pedir peça','Mudar de ideia','Retomar opção','Cotar e encaminhar']}
];
export function materializeScenario(base:AutoScenario,selection:{product:TestProduct;pair?:TestProduct}|null,variant:OpeningVariant='auto',seed=''):AutoScenario{
 if(base.kind==='missing')return {...base};
 if(base.kind==='handoff')return selection?{...base,productContext:selection.product,opening:`Comprei ${selection.product.part} para ${selection.product.model} com vocês e veio com defeito. Estou bem chateado e preciso acionar a garantia.`,goal:base.goal+` A peça com defeito é ${selection.product.query}. Você precisa de garantia, sem fazer nova compra.`}:{...base};
 if(!selection)return {...base,unavailableReason:base.kind==='models'?'Não há dois modelos parecidos da mesma peça no catálogo para esta seleção.':'Não há peças e modelos identificados no catálogo para esta seleção.'};
 const p=selection.product,second=selection.pair,product=p.part+' para '+p.model;
 let opening=base.opening;
 if(base.id==='quote'||base.id==='handoff-wait')opening=`Sou lojista. Quero saber os valores de ${product}.`;
 if(base.id==='fragments')opening=`Oi, preciso de ${p.part==='conector'?'um':'uma'} ${p.part}.`;
 if(base.id==='catalog')opening=`Sou lojista. Liste todas as opções de ${product} com os valores, por favor.`;
 if(base.id==='selection')opening=`Sou lojista. Quais opções de ${product} vocês têm?`;
 if(base.id==='edit')opening=`Sou lojista. Preciso de duas unidades de ${product}. Quais opções tem?`;
 if(base.id==='models')opening=`Sou lojista. Quero opções de ${product}.`;
 if(base.id==='typos'){const model=p.model.replace(/iPhone/i,'iphne').replace(/Samsung/i,'samsng').replace(/Galaxy/i,'galaxi').replace(/Moto\b/i,'mto').replace(/Redmi/i,'redm');opening=`sou lojista, tem ${p.part} pra ${model}? qto ta?`;}
 if(base.fromBeginning){const choices=Object.keys(openingChoices) as (keyof typeof openingChoices)[];const chosen=variant==='auto'?choices[seedNumber(seed)%choices.length]:variant;opening=openingChoices[chosen];}
 const privateContext=`CONTEXTO RESERVADO DO CLIENTE: você possui uma assistência técnica e é lojista. Sua necessidade é ${product}. ${['catalog','models'].includes(base.kind)?'O objetivo é consultar opções, sem fechar pedido nesta rotina.':'A quantidade final desejada é de duas unidades.'} ${base.kind==='models'?'Consulte primeiro esse modelo e depois o segundo especificado abaixo.':'A necessidade é fixa; não troque de modelo ou peça.'} Só selecione um SKU depois de a Ceci apresentá-lo e confirmar disponibilidade. Não use o código de exemplo do catálogo para antecipar a escolha.`;
 const gradual=base.fromBeginning?'Na primeira mensagem envie SOMENTE a abertura definida. Depois responda à Ceci como um cliente novo. Não entregue peça, modelo e perfil juntos: revele cada um em turnos diferentes, respondendo o que foi perguntado. Se a Ceci perguntar como ajudar, conte primeiro somente a peça. Informe o modelo quando ela perguntar; diga que compra para sua assistência quando perguntado. Informe quantidade na etapa de escolha ou quando solicitado. Uma dúvida simples pode ser qual opção tem menor valor; não exija ficha técnica nem explicações sem dados. Não mude de ideia, reclame ou acrescente outro item nesta rotina. Não avalie nem ensine a Ceci.':'';
 return {...base,completeSale:base.completeSale??['quote','natural'].includes(base.kind),steps:['quote','natural'].includes(base.kind)&&!base.teamUnavailable?[...base.steps,'Receber no painel da atendente','Combinar entrega e pagamento','Concluir venda simulada']:base.steps,opening,query:p.query,productContext:p,secondProductContext:second,openingVariant:variant,goal:[privateContext,base.goal,second?`SEGUNDA NECESSIDADE: ${second.part} para ${second.model}. Só depois da primeira lista peça explicitamente esse segundo modelo, usando o nome completo. Não aceite itens exclusivos do primeiro modelo.`:'',gradual].filter(Boolean).join('\n')};
}
/** Freeze the request used in each execution; old reports keep their original definitions. */
export function scenarioForCase(item:Record<string,any>):AutoScenario{
 if(item.scenarioSnapshot)return item.scenarioSnapshot;
 const base=autoScenarios.find(s=>s.id===item.scenario)!;
 // Versions before the product sampler used this exact request in every commercial scenario.
 if(!base||base.id==='first-contact'||['handoff','missing'].includes(base.kind))return base;
 const legacy:TestProduct={key:'legacy:iphone-12:tela',brand:'Apple',model:'iPhone 12',modelSlug:'iphone-12',part:'tela',query:'tela iphone 12',exampleId:0,exampleName:'',network:''};
 return materializeScenario(base,{product:legacy,...(base.kind==='models'?{pair:{...legacy,key:'legacy:iphone-12-pro:tela',model:'iPhone 12 Pro',modelSlug:'iphone-12-pro',query:'tela iphone 12 pro'}}:{})});
}
export const autoScenario=(id:string)=>autoScenarios.find(s=>s.id===id);
export type Evidence={id:string;kind:string;at:number;target?:number;data:any};
export type Criterion={id:string;label:string;status:'pass'|'fail'|'review'|'na';critical:boolean;detail:string;messageIds:string[]};
const foldText=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Detect identical orders regenerated after acceptance even when wording and IDs vary. */
export function quoteConfirmationLoops(messages:any[]){
 const loops:any[]=[];let previous:{message:any;card:any}|undefined;
 const signature=(card:any)=>JSON.stringify([card.items.map((p:any)=>[p.productId,p.quantity,p.unitCents,p.totalCents]).sort((a:any,b:any)=>a[0]-b[0]),card.totalCents]);
 for(const [index,message] of messages.entries()){
  if(message.role!=='assistant')continue;
  let card;try{card=typeof message.card_data==='string'?JSON.parse(message.card_data||'null'):message.card_data;}catch{continue;}
  if(card?.type!=='quote'||!Array.isArray(card.items))continue;
  const before=messages.slice(0,index),source=before.filter(m=>m.role==='user').at(-1),lastAssistant=source?before.slice(0,before.indexOf(source)).filter(m=>m.role==='assistant').at(-1):null;
  if(previous&&source&&messages.indexOf(source)>messages.indexOf(previous.message)&&confirmsPurchase(source.body,lastAssistant?.body||'')&&signature(previous.card)===signature(card))loops.push(message);
  previous={message,card};
 }
 return loops;
}
export function repeatedConversation(messages:any[]){const last=messages.filter(m=>m.role==='assistant').map(m=>String(m.body).trim().toLowerCase().replace(/\s+/g,' '));return quoteConfirmationLoops(messages).length>0||last.length>=3&&new Set(last.slice(-3)).size===1;}
export function modelText(response:any){return (response.output||[]).flatMap((o:any)=>o.type==='message'?(o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text):[]).join('\n');}
export function evaluateAutomatic(scene:AutoScenario,messages:any[],events:Evidence[],finished:boolean){
 const checks:Criterion[]=[];const add=(id:string,label:string,status:Criterion['status'],critical:boolean,detail:string,ids:string[]=[])=>checks.push({id,label,status,critical,detail,messageIds:ids});
 const answers=messages.filter(m=>m.role==='assistant');
 const cards=answers.flatMap(m=>{try{const c=typeof m.card_data==='string'?JSON.parse(m.card_data||'null'):m.card_data;return c?[{message:m,card:c}]:[]}catch{return []}});
 const listed=cards.filter(x=>['products','catalog'].includes(x.card.type)),quotes=cards.filter(x=>x.card.type==='quote');
 const ids=(items:any[])=>items.map(x=>x.message.id);
 add('response','Ceci respondeu',answers.length?'pass':finished?'fail':'review',true,answers.length?`${answers.length} mensagens da Ceci registradas.`:'Ainda sem resposta.',answers.slice(0,1).map(m=>m.id));
 const unverified=cards.filter(({message,card})=>{
  const types=card.type==='quote'?['prepare']:['catalog','inspect'];
  const sourceUser=messages.slice(0,messages.indexOf(message)).filter(m=>m.role==='user').at(-1);
  return !events.some(e=>(!sourceUser?.seq||e.target===sourceUser.seq)&&types.includes(e.kind)&&e.at<=message.created+1500&&Number(e.data.checkedAt)>0&&Number(e.data.checkedAt)<=message.created+1500&&message.created-Number(e.data.checkedAt)<60000&&card.items.every((p:any)=>{
   const source=(e.data.items||e.data.lines||[]).find((q:any)=>q.productId===p.productId);
   return source&&source.name===p.name&&source.unitCents===p.unitCents&&(card.type!=='quote'||source.quantity===p.quantity)&&(card.type==='quote'||source.stock===p.stock);
  }));
 });
 add('source','Produtos e valores com consulta registrada',unverified.length?'fail':cards.length?'pass':'na',true,unverified.length?'Um card não corresponde às consultas registradas neste atendimento.':cards.length?'SKUs, nomes, valores e quantidades correspondem às consultas registradas.':'Nenhum card transacional apresentado.',ids(unverified.length?unverified:cards));
 const rawPrices=answers.filter(m=>!cards.some(c=>c.message===m)&&/R\$\s*\d|\b\d+[,.]\d{2}\s*reais?\b/i.test(m.body));
 add('raw-prices','Valores apresentados com evidência estruturada',rawPrices.length?'fail':'pass',true,rawPrices.length?'Há valor monetário em resposta sem card ou consulta vinculada.':'Nenhum preço solto sem card foi identificado.',rawPrices.map(m=>m.id));
 const unconfirmed=listed.filter(({card})=>card.items.some((p:any)=>p.status==='unconfirmed'));
 add('confirmed-values','Preços e estoque confirmados para as opções disponíveis',unconfirmed.length?'review':listed.length?'pass':'na',false,unconfirmed.length?'O ERP não confirmou valor ou estoque de algumas opções. Revise os dados antes de aprovar.':'As opções sem estoque permanecem identificadas como indisponíveis.',ids(unconfirmed));
 const badMath=quotes.filter(({card})=>card.items.some((p:any)=>!Number.isSafeInteger(p.unitCents)||p.unitCents<=0||!Number.isSafeInteger(p.quantity)||p.quantity<1||p.totalCents!==p.unitCents*p.quantity)||card.totalCents!==card.items.reduce((n:number,p:any)=>n+p.totalCents,0));
 add('math','Cálculo do orçamento',badMath.length?'fail':quotes.length?'pass':'na',true,badMath.length?'Total ou subtotal divergente.':quotes.length?'Quantidades × valores unitários e soma dos itens conferidos.':'Nenhum orçamento apresentado.',ids(badMath.length?badMath:quotes));
 const handoff=messages.find(m=>m.role==='note'&&m.body.startsWith('Encaminhamento automático:'));
 const purchase=handoff?.body.includes('Compra confirmada após cotação');
 if(purchase){const before=messages.slice(0,messages.indexOf(handoff));const user=before.filter(m=>m.role==='user').at(-1);const precedingQuote=quotes.filter(q=>messages.indexOf(q.message)<messages.indexOf(user)).at(-1);const lastAssistant=user?before.slice(0,before.indexOf(user)).filter(m=>m.role==='assistant').at(-1):null;const confirmed=!!user&&confirmsPurchase(user.body,lastAssistant?.body||'');
 add('consent','Compra somente após cotação e confirmação',precedingQuote&&confirmed?'pass':'fail',true,precedingQuote&&confirmed?'Orçamento apresentado antes da confirmação do cliente.':'Não foi encontrada cotação anterior ou confirmação explícita.',[...(user?[user.id]:[]),handoff.id]);}
 const commercial=['quote','edit','natural'].includes(scene.kind);
 if(commercial){add('products','Produtos apresentados em cards',listed.length?'pass':finished?'fail':'review',true,listed.length?`${new Set(listed.flatMap(x=>x.card.items.map((p:any)=>p.productId))).size} SKUs apresentados.`:'Nenhum produto apresentado.',ids(listed));add('quote','Orçamento apresentado',quotes.length?'pass':finished?'fail':'review',true,quotes.length?'Orçamento encontrado na conversa.':'Objetivo ainda não concluído.',ids(quotes));}
 if(['quote','natural'].includes(scene.kind)){const last=quotes.at(-1);const qty=last?.card.items.reduce((n:number,p:any)=>n+p.quantity,0);add('final-quantity','Quantidade final de duas unidades',qty===2?'pass':finished?'fail':'review',true,last?`Quantidade final: ${qty}.`:'Sem orçamento final.',last?[last.message.id]:[]);}
 if(['quote','natural'].includes(scene.kind))add('handoff','Encaminhamento após compra',purchase?'pass':finished?'fail':'review',true,purchase?'Compra encaminhada em simulação.':'Sem encaminhamento de compra registrado.',handoff?[handoff.id]:[]);
 if(scene.kind==='catalog'){
 const catalogs=events.filter(e=>e.kind==='catalog'&&e.data.items?.length);const missing=catalogs.flatMap(e=>(e.data.items||[]).filter((p:any)=>!listed.some(x=>x.message.created>=e.at-1500&&x.card.items.some((q:any)=>q.productId===p.productId))));
 add('complete','Todos os resultados consultados foram apresentados',catalogs.length&&!missing.length?'pass':finished?'fail':'review',true,catalogs.length?`${new Set(missing.map((p:any)=>p.productId)).size} SKUs consultados sem card correspondente.`:'Sem consulta completa registrada.',ids(listed));
 const groups=listed.filter(x=>x.card.type==='catalog');const incomplete=groups.some(x=>new Set(groups.filter(y=>y.card.checkedAt===x.card.checkedAt&&y.card.total===x.card.total).map(y=>y.card.part)).size!==x.card.parts);
 add('pages','Paginação completa',incomplete?'fail':groups.length?'pass':'review',true,incomplete?'Há uma página de cards ausente.':'Partes da listagem conferidas.',ids(groups));}
 if(scene.kind==='edit'){const counts=quotes.map(q=>q.card.items.reduce((n:number,p:any)=>n+p.quantity,0));let pos=0;for(const n of counts)if(n===[2,3,2][pos])pos++;
 add('edits','Sequência de quantidades: 2 → 3 → 2',pos>=3?'pass':finished?'fail':'review',true,`Quantidades apresentadas: ${counts.join(' → ')||'nenhuma'}.`,ids(quotes));const unique=new Set(quotes.flatMap(q=>q.card.items.map((p:any)=>p.productId)));add('same-item','Preservar o SKU nas alterações',unique.size===1?'pass':unique.size>1?'fail':'review',true,'O teste altera somente a quantidade do mesmo produto.',ids(quotes));}
 if(scene.kind==='models'){const target=scene.secondProductContext;const turn=messages.findIndex(m=>m.role==='user'&&(target?mentionsTestModel(m.body,target)&&(!target.network||new RegExp('\\b'+target.network+'\\b','i').test(m.body)):/12\s*pro/i.test(m.body))&&!m.body.includes('Depois vou'));const after=listed.filter(x=>messages.indexOf(x.message)>turn&&turn>=0);const wrong=after.filter(x=>x.card.items.some((p:any)=>target?!matchesCatalogRequest(target.query,p.name):!/iphone\s*12\s*pro\b/i.test(p.name)||/pro\s*max/i.test(p.name)));
 add('variant','Separação do segundo modelo e variante',wrong.length?'fail':after.length?'pass':finished?'fail':'review',true,wrong.length?'A lista após a mudança contém outra variante.':`Conferência após pedido explícito de ${target?.model||'iPhone 12 Pro'}.`,ids(after));}
 if(scene.fromBeginning){const user=messages.filter(m=>m.role==='user'),first=user[0];add('opening','Primeiro contato sem pedido pronto',first?.body===scene.opening?'pass':finished?'review':'review',false,`Abertura escolhida: “${scene.opening}”. A Ceci recebe somente essa mensagem no início.`,first?[first.id]:[]);
 const p=scene.productContext;const partAt=p?user.findIndex(m=>foldText(m.body).includes(foldText(p.part))||(p.part==='tela'&&/frontal|display/i.test(m.body))):-1;const modelAt=p?user.findIndex(m=>mentionsTestModel(m.body,p)):-1;const profileAt=user.findIndex(m=>/lojista|(?:minha|pra|para|uma)\s+(?:a\s+)?assist[eê]ncia|revenda|minha\s+loja/i.test(m.body));
 const gradual=partAt>0&&modelAt>0&&profileAt>=0&&new Set([partAt,modelAt,profileAt]).size===3;
 add('discovery','Peça, modelo e perfil revelados em etapas',gradual?'pass':'review',false,gradual?'O cliente revelou as informações em mensagens distintas.':'Confira a validade da simulação: informações ausentes ou entregues juntas não comprovam a descoberta gradual.',[partAt,modelAt,profileAt].filter(i=>i>=0).map(i=>user[i].id));}
 if(scene.kind==='handoff')add('service-handoff','Garantia encaminhada com resumo',handoff&&/Resumo:\s*\S/.test(handoff.body)?'pass':finished?'fail':'review',true,handoff?'Resumo interno disponível.':'Sem encaminhamento registrado.',handoff?[handoff.id]:[]);
 if(scene.kind==='missing'){const searches=events.filter(e=>['search','catalog'].includes(e.kind));add('expanded','Busca ampliada antes da conclusão',new Set(searches.map(e=>e.data.query)).size>=2?'pass':finished?'review':'review',false,'Confira sinônimos e tentativas no registro de consultas.');add('no-fabrication','Não oferecer produto para modelo inexistente',cards.length?'fail':searches.length?'pass':'review',true,cards.length?'Foi apresentado produto para o modelo fictício.':'Nenhum produto inventado foi apresentado.');}
 const quoteLoops=quoteConfirmationLoops(messages);
 add('quote-loop','Confirmação avança sem recriar o mesmo orçamento',quoteLoops.length?'fail':quotes.length?'pass':'na',true,quoteLoops.length?'O cliente confirmou a compra, mas a Ceci recriou uma cotação idêntica.':'Compara itens, quantidades e valores após a confirmação, independentemente do ID e do texto.',quoteLoops.map(m=>m.id));
 add('loop','Ausência de repetição circular',repeatedConversation(messages)?'fail':answers.length?'pass':'review',false,'Detecta respostas repetidas e recriação do mesmo orçamento após a confirmação.');
 return checks;
}
export function automaticVerdict(checks:Criterion[],quality:any){if(checks.some(c=>c.critical&&c.status==='fail'))return 'failed';if(checks.some(c=>c.status==='fail')||quality?.result==='fail')return 'failed';if(!quality||quality.result!=='pass'||checks.some(c=>c.status==='review'))return 'inconclusive';return 'passed';}
