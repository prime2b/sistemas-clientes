'use client';
import {ArrowUpRight,Check,FlaskConical} from 'lucide-react';
import type {AgentValidation} from '../lib/integrations-view';
export default function CeciValidation({config,validation}:{config:Record<string,string>;validation?:AgentValidation;onRefresh:()=>Promise<unknown>}){
 const validated=!!validation?.validated;
 const at=validation?.at?new Date(validation.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):null;
 return <div className="ix-validation">{validated?<><p className="ix-success" role="status"><Check size={14}/> Resposta validada no playground{at?' · '+at:''}</p><p className="ix-hint">{validation?.model?'Modelo utilizado: '+validation.model+(validation.mode==='economic'?' · teste econômico.': ' · modelo de produção.'):'Validação registrada para a configuração atual da Ceci.'} Os resultados e as aprovações dos cenários estão disponíveis no playground.</p></>:<p className="ix-hint">Teste o atendimento completo com {config.name}: produtos, preços reais, orçamentos e encaminhamento simulado. O playground funciona sem conectar o WhatsApp e sem ativar a produção.</p>}<a href="/playground" className="cc-upload-button" style={{width:'fit-content',marginTop:12}}><FlaskConical size={17}/> {validated?'Revisar testes no playground':'Abrir playground da Ceci'} <ArrowUpRight size={16}/></a>{!validated&&<p className="ix-hint" style={{marginTop:12}}>A validação de conexão não substitui a aprovação dos cenários de atendimento no playground.</p>}</div>;
}
