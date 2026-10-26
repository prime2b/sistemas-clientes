const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
/** A confirmation accepts an already presented quote; it never changes its items. */
export function confirmsPurchase(text:string,lastAssistant:string){
 const value=fold(text),previous=fold(lastAssistant);
 // Questions, conditions, changes and hesitation need their own answer first.
 if(/[?]|\b(?:nao|talvez|depois|pensar|pesquisando|antes|mas|porem|se|caso|quando|desde que|so que|troca\w*|troc\w*|muda\w*|alter\w*|adicion\w*|acrescent\w*|retir\w*|remove\w*|inclu\w*|coloc\w*)\b/.test(value))return false;
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
