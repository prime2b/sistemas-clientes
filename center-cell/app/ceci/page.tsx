import {redirect} from 'next/navigation';
import {currentUser} from '../../lib/server/app-auth';
import Dashboard from '../workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Configurar Ceci · Center Cell'};
export default async function Page(){const user=await currentUser();if(!user)redirect('/login');if(user.mustChangePassword)redirect('/conta');if(user.role!=='admin')redirect('/atendente');return <Dashboard initialUser={user} initialPage="bot"/>;}
