'use client';
import {ArrowUpRight,FlaskConical} from 'lucide-react';
export default function CeciValidation({config}:{config:Record<string,string>;onRefresh:()=>Promise<unknown>}){
 return <div className="ix-validation"><p className="ix-hint">Teste o atendimento completo com {config.name}: produtos, preços reais, orçamentos e encaminhamento simulado. O playground funciona sem conectar o WhatsApp e sem ativar a produção.</p><a href="/playground" className="cc-upload-button" style={{width:'fit-content',marginTop:12}}><FlaskConical size={17}/> Abrir playground da Ceci <ArrowUpRight size={16}/></a><p className="ix-hint" style={{marginTop:12}}>A validação de conexão não substitui a aprovação dos cenários de atendimento no playground.</p></div>;
}
