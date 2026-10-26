import {redirect} from 'next/navigation';
import {currentUser} from '../../lib/server/app-auth';
import AccountPanel from '../account-panel';
import {Toaster} from 'sonner';
import BrandLogo from '../brand-logo';

export const dynamic='force-dynamic';
export const metadata={title:'Minha conta · Center Cell'};
export default async function ContaPage(){
  const user=await currentUser();
  if(!user)redirect('/login');
  return <main className="cc-account-page"><Toaster richColors position="bottom-right"/><header><BrandLogo height={56}/><span>Minha conta</span></header><div className="cc-account-shell"><div><span className="eyebrow">ACESSO À PLATAFORMA</span><h1>{user.mustChangePassword?'Crie sua senha pessoal':'Seu perfil'}</h1><p>{user.mustChangePassword?'Para proteger sua conta, troque a senha inicial antes de acessar o painel.':'Gerencie seus dados e a segurança da sua conta.'}</p></div><AccountPanel initialUser={user} forced={user.mustChangePassword}/></div></main>;
}
