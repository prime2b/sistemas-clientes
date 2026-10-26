import Dashboard from '../../workspace';
import {currentUser} from '../../../lib/server/app-auth';
import {attendantFor,isOwner} from '../../../lib/server/roles';
import {notFound,redirect} from 'next/navigation';

export const dynamic='force-dynamic';
export const metadata={title:'Integrações · Center Cell'};
export default async function Page({params}:{params:Promise<{service:string}>}){
  const {service}=await params;
  if(!['whatsapp','mercadophone','openai'].includes(service))notFound();
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.mustChangePassword)redirect('/conta');
  if(isOwner(user))return <Dashboard initialUser={user} initialPage="integrations" initialIntegration={service as 'whatsapp'|'mercadophone'|'openai'}/>;
  if(await attendantFor(user))redirect('/atendente');
  redirect('/');
}
