export type Probe = { ok: boolean; at: number; message: string; label?: string };
export type Service = 'openai' | 'whatsapp';

// Read-only checks: never generate a response or send a WhatsApp message.
export async function probeConnection(service: Service, token: string, target: string, version: string, request = fetch): Promise<Probe> {
  const at = Date.now();
  if (!token) return {ok:false, at, message:'Adicione a credencial antes de testar a conexão.'};
  if (service === 'whatsapp' && !/^\d{1,40}$/.test(target)) return {ok:false, at, message:'Salve o identificador do número na Meta antes de testar.'};
  if (service === 'openai' && !/^[a-zA-Z0-9._-]{1,100}$/.test(target)) return {ok:false, at, message:'Salve um identificador de modelo válido.'};
  if (service === 'whatsapp' && !/^v\d+\.\d+$/.test(version)) return {ok:false, at, message:'Confira a versão da API Meta.'};
  try {
    const url = service === 'openai'
      ? `https://api.openai.com/v1/models/${encodeURIComponent(target)}`
      : `https://graph.facebook.com/${version}/${target}?fields=id,display_phone_number,verified_name`;
    // Keep the request init compatible with the Cloudflare runtime used by Sites.
    // Both probe URLs are fixed, so a custom redirect policy is unnecessary here.
    const response = await request(url, {headers:{Authorization:`Bearer ${token}`}, signal:AbortSignal.timeout(20000)});
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? 'A credencial foi recusada ou não possui a permissão necessária.'
        : response.status === 429 ? 'Limite de consultas atingido. Aguarde e tente novamente.'
        : service === 'openai' && response.status === 404 ? 'Este modelo não está disponível para a chave informada. Confira o identificador e o acesso da conta.'
        : service === 'whatsapp' && response.status === 400 ? 'Confira o identificador do número, a versão da API e as permissões da conta Meta.'
        : 'O serviço não confirmou a conexão. Tente novamente.';
      return {ok:false, at, message};
    }
    const result = await response.json() as Record<string,unknown>;
    if (result.id !== target) return {ok:false, at, message:'O serviço retornou um identificador diferente do configurado.'};
    return {ok:true, at, message:service === 'openai'
      ? 'Acesso ao modelo confirmado. Faça um teste interno para validar a resposta do assistente.'
      : 'Número consultado na Meta. O recebimento e o envio de mensagens ainda exigem validação.',
      label:service === 'openai' ? target : String(result.display_phone_number || target).slice(0,80)};
  } catch (error) {
    const detail = error instanceof Error
      ? {name:error.name, message:error.message.split(token).join('[REDACTED]').slice(0,240)}
      : {name:'UnknownError', message:'unknown'};
    console.error('integration_probe_failed', JSON.stringify({service,...detail}));
    return {ok:false, at, message:'A hospedagem não conseguiu concluir a conexão com o serviço. Tente novamente; se persistir, consulte o diagnóstico técnico.'};
  }
}

export type Step = {id:string; label:string; done:boolean; detail:string; page:string};
export function summarizeReadiness(steps: Step[]) {
  return {steps, completed:steps.filter(s=>s.done).length, total:steps.length, ready:steps.length>0 && steps.every(s=>s.done)};
}
