import {Headphones} from 'lucide-react';
export default function HandoffSummary({summary}:{summary:string}){
 return <div className="attendant-handoff"><Headphones size={17}/><div><strong>Resumo do encaminhamento</strong><p>{summary}</p></div></div>;
}
