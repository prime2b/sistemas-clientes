'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,Eye,EyeOff,LockKeyhole} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import BrandLogo from '../brand-logo';

export default function LoginForm(){
  const [identifier,setIdentifier]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');
    try{
      const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',identifier,password})});
      const result=await response.json() as {error?:string;redirect:string};
      if(!response.ok)throw new Error(result.error||'Não foi possível entrar.');
      window.location.assign(result.redirect);
    }catch(reason){setError((reason as Error).message);setBusy(false);}
  }
  return <main className="cc-login">
    <div className="cc-login-shell">
      <section className="cc-login-cover" aria-label="Center Cell">
        <BrandLogo height={62}/>
        <div className="cc-login-intro">
          <span>Central de atendimento</span>
          <h1>Uma conversa.<br/>Toda a operação conectada.</h1>
          <p>Cotações com a Ceci, histórico compartilhado e atendimento humano no mesmo número.</p>
        </div>
        <small>Center Cell Distribuidora</small>
      </section>
      <section className="cc-login-form" aria-labelledby="login-title">
        <div className="cc-login-card">
          <div className="cc-login-mobile-brand"><BrandLogo variant="dark" height={52}/></div>
          <span className="cc-login-access"><LockKeyhole size={14}/> Acesso à plataforma</span>
          <h2 id="login-title">Entrar na central</h2>
          <p>Bem-vindo de volta. Acesse com sua conta.</p>
          <form onSubmit={submit} aria-busy={busy}>
            <label htmlFor="login-identifier">Usuário ou e-mail
              <Input id="login-identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus value={identifier} onChange={event=>setIdentifier(event.target.value)} required placeholder="Digite seu usuário ou e-mail" aria-invalid={!!error} aria-describedby={error?'login-error':undefined}/>
            </label>
            <label htmlFor="login-password">Senha
              <div className="cc-password-input">
                <Input id="login-password" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required placeholder="Digite sua senha" aria-invalid={!!error} aria-describedby={error?'login-error':undefined}/>
                <button type="button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar senha':'Mostrar senha'} aria-pressed={show}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
              </div>
            </label>
            {error&&<div id="login-error" className="cc-auth-error" role="alert">{error}</div>}
            <Button type="submit" disabled={busy||!identifier.trim()||!password} className="w-full">{busy?'Entrando…':<>Entrar <ArrowRight size={16}/></>}</Button>
          </form>
          <div className="cc-login-help"><strong>Esqueceu sua senha?</strong><span>Peça ao administrador para redefinir seu acesso.</span></div>
        </div>
      </section>
    </div>
  </main>;
}
