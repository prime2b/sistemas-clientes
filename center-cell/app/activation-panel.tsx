'use client';
import {Check,ChevronRight,Clock,FlaskConical} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
type Activation = {completed:number;total:number;ready:boolean;steps:{id:string;label:string;done:boolean;detail:string;page:string}[]};
export function ActivationPanel({activation,onNavigate,onTest}:{activation:Activation;onNavigate:(page:string)=>void;onTest:()=>void}) {
  return <section className="panel activation-panel" aria-label="Preparação do atendimento">
    <div className="activation-heading"><div><h2>Prepare o atendimento</h2><p>{activation.ready?'As verificações de configuração foram concluídas. Revise os testes antes de ativar o chatbot.':'Conclua as conexões e teste o assistente antes de receber clientes.'}</p></div><span>{activation.completed} de {activation.total} etapas</span></div>
    <Progress value={activation.total?activation.completed/activation.total*100:0} aria-label={`${activation.completed} de ${activation.total} etapas concluídas`}/>
    <div className="activation-steps">{activation.steps.map(step=><div className={'activation-step '+(step.done?'done':'')} key={step.id}><span className="activation-step-icon">{step.done?<Check size={17}/>:<Clock size={17}/>}</span><div><h3>{step.label}</h3><p>{step.detail}</p></div>{!step.done&&step.id!=='receiver'&&<Button size="sm" variant="ghost" aria-label={'Configurar '+step.label} onClick={()=>step.id==='internal'?onTest():onNavigate(step.page)}>{step.id==='internal'?<FlaskConical size={16}/>:<ChevronRight size={16}/>}</Button>}</div>)}</div>
  </section>;
}

export function ConnectionResult({check}:{check?:{ok:boolean;at:number;message:string;label?:string}|null}) {
  if(!check)return <div className="probe-result">Conexão ainda não testada.</div>;
  return <div role="status" className={'probe-result '+(check.ok?'success':'pending')}><strong>{check.ok?'Consulta validada':'Verificação pendente'}{check.label?' · '+check.label:''}</strong><p>{check.message}</p><small>{new Date(check.at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div>;
}
