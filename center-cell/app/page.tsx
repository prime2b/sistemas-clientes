import Dashboard from './workspace';
import BrandLogo from './brand-logo';
import {currentUser} from '../lib/server/app-auth';
import {attendantFor,isOwner} from '../lib/server/roles';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export const metadata={title:'Atendimento · Center Cell'};
export default async function Page(){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.mustChangePassword)redirect('/conta');
  if(isOwner(user))return <Dashboard initialUser={user}/>;
  if(await attendantFor(user))redirect('/atendente');
  return <main className="access-denied"><BrandLogo className="access-logo" height={56}/><h1>Acesso não liberado</h1><p>Peça à administração da Center Cell para cadastrar seu e-mail e autorizar seu acesso ao painel.</p></main>;
}
