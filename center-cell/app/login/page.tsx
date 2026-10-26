import {redirect} from 'next/navigation';
import {currentUser} from '../../lib/server/app-auth';
import LoginForm from './login-form';

export const dynamic='force-dynamic';
export const metadata={title:'Entrar · Center Cell'};
export default async function LoginPage(){
  const user=await currentUser();
  if(user)redirect(user.mustChangePassword?'/conta':user.role==='admin'?'/':'/atendente');
  return <LoginForm/>;
}
