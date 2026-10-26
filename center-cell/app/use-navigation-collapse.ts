'use client';
import {useCallback,useEffect,useState} from 'react';

const key='centercell:menu-collapsed';

export function useNavigationCollapse(userId='default'){
  const [collapsed,setCollapsed]=useState(false);
  const storageKey=key+':'+userId;
  useEffect(()=>{try{const saved=localStorage.getItem(storageKey);setCollapsed(saved===null?window.innerWidth<1280:saved==='true');}catch{setCollapsed(window.innerWidth<1280);}},[storageKey]);
  const change=useCallback((value:boolean)=>{setCollapsed(value);try{localStorage.setItem(storageKey,String(value));}catch{/* Preferência apenas nesta sessão. */}},[storageKey]);
  return [collapsed,change] as const;
}
