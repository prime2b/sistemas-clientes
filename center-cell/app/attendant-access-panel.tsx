'use client';
import {useEffect,useState,type ChangeEvent} from 'react';
import {Camera,Copy,KeyRound,ShieldCheck,UserRound,Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {toast} from 'sonner';
import {prepareAvatar} from '../lib/avatar-image';
import {UserAvatar} from './account-panel';

type Account={id:string;slot:number;username:string;email:string;display_name:string;avatar:string;active:number;must_change_password:number;last_login:number;updated:number;sessions:number};
type Slot={slot:number;name:string;account:Account|null};
type Draft={slot:number;displayName:string;username:string;email:string;avatar:string;active:boolean;password:string};
const fromSlot=(slot:Slot):Draft=>({slot:slot.slot,displayName:slot.account?.display_name||slot.name,username:slot.account?.username||'',email:slot.account?.email||'',avatar:slot.account?.avatar||'',active:slot.account?!!slot.account.active:true,password:''});
async function api(body?:Record<string,unknown>){const response=await fetch('/api/admin/users',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const data=await response.json() as {error?:string;slots:Slot[]};if(!response.ok)throw new Error(data.error||'Não foi possível atualizar.');return data;}
function AttendantCard({slot,onSaved}:{slot:Slot;onSaved:()=>Promise<void>}){
  const [draft,setDraft]=useState<Draft>(()=>fromSlot(slot)),[busy,setBusy]=useState(false);
  const account=slot.account;
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;
    try{const avatar=await prepareAvatar(file);setDraft(previous=>({...previous,avatar}));}catch(error){toast.error((error as Error).message);}finally{event.target.value='';}
  }
  function generate(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const random=crypto.getRandomValues(new Uint8Array(18));setDraft(previous=>({...previous,password:'Cc9!'+Array.from(random,b=>alphabet[b%alphabet.length]).join('')}));}
  async function save(){setBusy(true);try{await api({action:'saveAttendant',...draft});await onSaved();setDraft(previous=>({...previous,password:''}));toast.success(account?'Acesso da atendente atualizado.':'Conta criada. Compartilhe a senha temporária por um canal seguro.');}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
  async function revoke(){if(!account)return;setBusy(true);try{await api({action:'revokeSessions',slot:slot.slot});await onSaved();toast.success('Sessões da atendente encerradas.');}catch(error){toast.error((error as Error).message);}finally{setBusy(false);}}
  return <section className="cc-settings-card cc-attendant-card">
    <div className="cc-card-heading"><span className="cc-slot-icon">{draft.avatar?<img src={draft.avatar} alt=""/>:<UserRound size={20}/>}</span><div><h3>Atendente {slot.slot}</h3><p>{account?account.active?'Acesso ativo':'Acesso suspenso':'Conta ainda não criada'}</p></div></div>
    <div className="cc-avatar-editor cc-attendant-avatar-editor">
      <UserAvatar user={{displayName:draft.displayName||`Atendente ${slot.slot}`,avatar:draft.avatar}} size={72}/>
      <div><label className="cc-upload-button"><Camera size={16}/> {draft.avatar?'Trocar foto':'Adicionar foto'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={'Foto da atendente '+slot.slot} onChange={upload}/></label>{draft.avatar&&<button type="button" className="cc-text-button" onClick={()=>setDraft(d=>({...d,avatar:''}))}>Remover foto</button>}<small>PNG, JPG ou WebP até 5 MB. Ajustamos a imagem antes de salvar.</small></div>
    </div>
    <div className="cc-form-grid"><label>Nome de exibição<Input value={draft.displayName} maxLength={60} onChange={e=>setDraft(d=>({...d,displayName:e.target.value}))}/></label><label>Usuário<Input autoComplete="off" value={draft.username} maxLength={40} placeholder="ex.: ana.centercell" onChange={e=>setDraft(d=>({...d,username:e.target.value}))}/></label><label>E-mail<Input type="email" value={draft.email} maxLength={254} placeholder="nome@centercell.com.br" onChange={e=>setDraft(d=>({...d,email:e.target.value}))}/></label><label>{account?'Nova senha temporária (opcional)':'Senha temporária'}<div className="cc-password-generate"><Input type="text" value={draft.password} autoComplete="off" placeholder="12 caracteres ou mais" onChange={e=>setDraft(d=>({...d,password:e.target.value}))}/><button type="button" onClick={generate} aria-label="Gerar senha forte"><KeyRound size={17}/></button><button type="button" disabled={!draft.password} onClick={()=>void navigator.clipboard.writeText(draft.password).then(()=>toast.success('Senha copiada.'))} aria-label="Copiar senha"><Copy size={17}/></button></div></label></div>
    <label className="cc-active-check"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(d=>({...d,active:e.target.checked}))}/> Permitir acesso à plataforma</label>
    <div className="cc-attendant-foot"><Button disabled={busy||!draft.username||!draft.email||(!account&&!draft.password)} onClick={save}>{busy?'Salvando…':account?'Salvar alterações':'Criar conta'}</Button>{account&&<Button variant="outline" disabled={busy||!account.sessions} onClick={revoke}>Encerrar sessões ({account.sessions})</Button>}</div>
    {account&&<small>Último acesso: {account.last_login?new Date(account.last_login).toLocaleString('pt-BR'):'ainda não entrou'} · {account.must_change_password?'Troca de senha pendente':'Senha pessoal definida'}</small>}
  </section>;
}
export default function AttendantAccessPanel({onSaved}:{onSaved?:()=>Promise<unknown>}){
  const [slots,setSlots]=useState<Slot[]>([]),[loading,setLoading]=useState(true);
  async function refresh(){try{const result=await api();setSlots(result.slots);}catch(error){toast.error((error as Error).message);}finally{setLoading(false);}}
  useEffect(()=>{void Promise.resolve().then(refresh);},[]);
  async function refreshAll(){await refresh();await onSaved?.();}
  return <div className="cc-access-area"><div className="cc-section-heading"><Users size={22}/><div><h2>Contas das atendentes</h2><p>Três contas independentes, cada uma com sua própria fila de atendimentos.</p></div></div><div className="cc-attendant-grid">{loading?<p>Carregando acessos…</p>:slots.map(slot=><AttendantCard key={slot.slot+':'+(slot.account?.updated||slot.name)} slot={slot} onSaved={refreshAll}/>)}</div><div className="cc-access-note"><ShieldCheck size={17}/><span>Uma senha redefinida encerra as sessões anteriores. A atendente cria sua senha pessoal no primeiro acesso e vê apenas as conversas atribuídas a ela.</span></div></div>;
}
