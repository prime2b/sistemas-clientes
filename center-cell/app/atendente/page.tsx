import {currentUser} from '../../lib/server/app-auth';
import {attendantFor} from '../../lib/server/roles';
import AttendantWorkspace from './workspace';
import BrandLogo from '../brand-logo';
import {redirect} from 'next/navigation';

export const dynamic='force-dynamic';
export const metadata={title:'Atendimentos · Center Cell'};
export default async function AttendantPage(){
  const user=await currentUser();
  if(!user)redirect('/login');
  if(user.mustChangePassword)redirect('/conta');
  const attendant=await attendantFor(user);
  if(!attendant)return <main className="access-denied"><BrandLogo className="access-logo" height={56}/><h1>Acesso não liberado</h1><p>O administrador precisa cadastrar este e-mail como atendente e liberar o acesso ao site.</p></main>;
  if((await (await import('../../lib/server/core')).config()).sharedInbox)redirect('/');
  return <AttendantWorkspace name={attendant.name} initialUser={user}/>;
}
