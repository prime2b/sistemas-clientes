'use client';
import {Check,Clock,RefreshCw,Pause} from 'lucide-react';
import {Button} from '@/components/ui/button';
type State = {runId?:string;complete?:boolean;page?:number;received?:number;at?:number;error?:string};
export function CatalogSyncStatus({state,running,pausing,hasCatalog,busy,onPause,onResume,onRestart}:{state?:State|null;running:boolean;pausing:boolean;hasCatalog:boolean;busy:boolean;onPause:()=>void;onResume:()=>void;onRestart:()=>void}) {
  if(!state?.runId)return null;
  return <section className={'catalog-sync-status '+(state.complete?'complete':'')} aria-live="polite">
    <div className="sync-status-icon">{state.complete?<Check size={21}/>:running?<RefreshCw className="spin" size={21}/>:<Clock size={21}/>}</div>
    <div className="sync-status-content"><h2>{state.complete?'Catálogo atualizado':running?pausing?'Pausando após esta página…':'Atualizando catálogo…':'Atualização aguardando continuação'}</h2>
      <p>{state.received||0} produtos recebidos · {state.page||0} páginas concluídas{state.complete&&state.at?' · '+new Date(state.at).toLocaleString('pt-BR'):''}</p>
      {!state.complete&&<p>{state.error||'O progresso fica salvo mesmo se você sair desta página.'} {hasCatalog?'O catálogo anterior continua disponível até concluir.':'Os produtos aparecerão quando a sincronização terminar.'}</p>}
    </div>
    {!state.complete&&<div className="sync-status-actions">{running?<Button variant="outline" onClick={onPause} disabled={pausing}><Pause size={15}/>{pausing?'Pausando…':'Pausar'}</Button>:<><Button onClick={onResume} disabled={busy}><RefreshCw size={15}/> Retomar</Button><Button variant="ghost" onClick={onRestart} disabled={busy}>Reiniciar leitura</Button></>}</div>}
  </section>;
}
