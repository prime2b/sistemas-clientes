const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
/** A confirmation accepts an already presented quote; it never changes its items. */
export function confirmsPurchase(text:string,lastAssistant:string,quoteItems?:ReadonlyArray<{quantity:number}>){
 let value=fold(text);const previous=fold(lastAssistant);
 // Questions, conditions, changes and hesitation need their own answer first.
 if(/[?]|\b(?:nao|talvez|depois|pensar|pesquisando|antes|mas|porem|se|caso|quando|desde que|so que|troca\w*|troc\w*|muda\w*|alter\w*|adicion\w*|acrescent\w*|retir\w*|remove\w*|inclu\w*|coloc\w*)\b/.test(value))return false;
 // A reference to the exact quoted quantity is not a change. Only remove a
 // bounded reference such as “das 2 unidades”; other SKUs/attributes stay visible
 // to the whole-message check below. Without a known quote, do not infer quantity.
 const reference=/\s+(?:d[ae]s?|ess[ae]s|est[ae]s|[ao]s)\s+(\d+|uma?|duas?|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+(?:unidades?|pecas?)(?=\s*(?:[,.!;]|$))/;
 const cited=reference.exec(value),words:Record<string,number>={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};
 if(cited&&quoteItems?.length&&quoteItems.every(p=>Number.isSafeInteger(p.quantity)&&p.quantity>0)&&Number(words[cited[1]]||cited[1])===quoteItems.reduce((n,p)=>n+p.quantity,0))value=value.replace(reference,'');
 const action='(?:(?:pode|podemos|vamos|quero|vou|bora|desejo|autorizo)\\s+(?:fechar|comprar|concluir|separar|prosseguir|finalizar)|fechado|fecha pra mim|pode seguir|confirmo(?=\\s+(?:(?:a|o|essa|esse|esta|este)\\s+)?(?:compra|pedido|orcamento)\\b))';
 const subject='(?:\\s+(?:com\\s+)?(?:(?:a|o|essa|esse|esta|este)\\s+)?(?:compra|pedido|orcamento))?';
 const courtesy='(?:\\s+(?:por favor|pra mim|para mim|por aqui|obrigado|obrigada))*[.!\\s]*';
 // Anchor the whole message: “pode fechar com três” or “quero comprar a preta”
 // includes a selection/quantity decision and cannot silently accept the old quote.
 const prefix='(?:(?:sim|isso|ok|certo|confirmo(?: novamente| de novo)?|estou de acordo|de acordo|tudo certo|combinado)\\s+)*';
 const explicit=new RegExp('^'+prefix+action+subject+courtesy+'$');
 const clauses=value.split(/[,.!;]+|\s+e\s+/).map(s=>s.trim()).filter(Boolean);
 const acknowledgment=/^(?:sim|isso|ok|certo|confirmo(?: novamente| de novo)?|estou de acordo|de acordo|tudo certo|combinado|obrigado|obrigada|por favor)$/;
 if(clauses.some(s=>explicit.test(s))&&clauses.every(s=>explicit.test(s)||acknowledgment.test(s)))return true;
 const accepts=/^(?:sim|isso|ok|pode|certo|confirmo(?: novamente| de novo)?|estou de acordo|de acordo)[.!\s]*$/.test(value);
 const invitation=/(?:quer|posso|vamos|podemos|deseja|quiser|confirma|confirmar|confirme).{0,85}(?:fechar|concluir|prosseguir|finalizar|compra|chamar.{0,15}atendente)|(?:finalizar|fechar|concluir|prosseguir).{0,40}(?:me confirme|confirma|confirmar)/.test(previous);
 return accepts&&invitation;
}
