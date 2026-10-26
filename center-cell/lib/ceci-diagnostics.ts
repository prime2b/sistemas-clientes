export function ceciDiagnostic(reason:string){
  const messages:Record<string,string>={
    TEST_TOKEN_BUDGET:'O limite de tokens do teste não comporta a próxima chamada. O progresso foi preservado. Ajuste os limites em um novo teste ou revise este resultado; nenhum modelo mais caro foi acionado.',
    CECI_MODEL_QUOTA:'A API de IA está sem cota disponível. Confira os créditos e limites do projeto na OpenAI antes de tentar novamente.',
    CECI_MODEL_CREDITS:'O saldo de créditos da API de IA foi esgotado. Adicione créditos na conta OpenAI usada por esta chave antes de retomar.',
    CECI_MODEL_SPEND:'A conta ou projeto atingiu o limite de gastos da API. Revise os limites na OpenAI antes de retomar.',
    CECI_MODEL_USAGE:'A organização atingiu o limite mensal de uso da API. Confira o limite aprovado na OpenAI.',
    CECI_MODEL_LIMIT:'A API recusou a solicitação com HTTP 429, sem identificar um limite temporário. Confira os detalhes do diagnóstico antes de repetir.',
    CECI_MODEL_RATE_LIMIT:'A API de IA atingiu um limite temporário de requisições. Aguarde e use Retomar resposta.',
    CECI_MODEL_AUTH:'A credencial da OpenAI foi recusada. Atualize a chave em Integrações.',
    CECI_MODEL_ACCESS:'O modelo não está disponível para este projeto ou chave. Confira o modelo em Integrações.',
    CECI_MODEL_REQUEST:'A API rejeitou os parâmetros da conversa. Revise o modelo configurado e o acesso a ferramentas.',
    CECI_MODEL_TEMPORARY:'A API de IA retornou uma falha temporária ou um limite. Teste o acesso e tente retomar. Uma nova tentativa mostrará a classificação detalhada.',
    CECI_MODEL_UNAVAILABLE:'A API não autorizou a resposta. Confira a chave e o acesso ao modelo em Integrações.',
    CECI_MODEL_NETWORK:'Não foi possível alcançar a API de IA. O contexto foi preservado para uma nova tentativa.',
    CECI_TIMEOUT:'A resposta ultrapassou o tempo desta tentativa. Retome para continuar com o contexto salvo.',
    timeout:'A resposta ultrapassou o tempo desta tentativa. Retome para continuar com o contexto salvo.',
    CECI_TOOL_LIMIT:'A agente chegou ao limite de etapas desta tentativa. Confira as instruções e retome o atendimento.'
  };
  return messages[reason]||'O atendimento foi interrompido. O contexto foi preservado; tente retomar ou consulte as conexões.';
}
export function modelFailure(status:number,code='',type=''){
  const known:Record<string,string>={insufficient_quota:'CECI_MODEL_QUOTA',credit_balance_exhausted:'CECI_MODEL_CREDITS',organization_spend_limit_exceeded:'CECI_MODEL_SPEND',project_spend_limit_exceeded:'CECI_MODEL_SPEND',organization_usage_limit_exceeded:'CECI_MODEL_USAGE',rate_limit_exceeded:'CECI_MODEL_RATE_LIMIT',slow_down:'CECI_MODEL_RATE_LIMIT'};
  if(known[code])return known[code];
  if(type==='insufficient_quota')return 'CECI_MODEL_QUOTA';
  if(status===429)return type==='rate_limit_error'?'CECI_MODEL_RATE_LIMIT':'CECI_MODEL_LIMIT';
  if(status===401)return 'CECI_MODEL_AUTH';
  if(status===403||status===404)return 'CECI_MODEL_ACCESS';
  return status>=500?'CECI_MODEL_TEMPORARY':'CECI_MODEL_REQUEST';
}
