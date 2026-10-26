'use client';
import {useState} from 'react';

export default function ContactAvatar({conversation,className='cx-avatar'}:{conversation:Record<string,any>;className?:string}){
  const [loaded,setLoaded]=useState(false);
  const name=String(conversation.name||conversation.phone||'?');
  const initials=name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  return <span className={className+' cx-contact-avatar'} aria-label={`Foto de ${name}`}>
    {initials}
    {conversation.channel==='whatsapp_web'&&<img src={'/api/chat-avatar?id='+encodeURIComponent(conversation.id)} alt="" loading="lazy" referrerPolicy="no-referrer" className={loaded?'loaded':''} onLoad={()=>setLoaded(true)} onError={()=>setLoaded(false)}/>}
  </span>;
}
