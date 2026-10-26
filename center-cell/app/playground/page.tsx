import {redirect} from 'next/navigation';
import {currentUser} from '../../lib/server/app-auth';
import CeciPlayground from './playground';
import './playground.css';
import './whatsapp-phone.css';
import './automatic-theme.css';
export const dynamic='force-dynamic';
export const metadata={title:'Playground da Ceci · Center Cell'};
export default async function Page(){
 const user=await currentUser();
 if(!user)redirect('/login');
 if(user.mustChangePassword)redirect('/conta');
 if(user.role!=='admin')redirect('/atendente');
 return <CeciPlayground/>;
}
