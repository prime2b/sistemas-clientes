'use client';
import {useEffect,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';

type Tip={label:string;left:number;top:number};

export default function CompactNavTooltip({navRef,compact}: {navRef:RefObject<HTMLElement|null>;compact:boolean}){
  const [tip,setTip]=useState<Tip|null>(null);

  useEffect(()=>{
    const nav=navRef.current;
    if(!compact||!nav){return}
    const show=(target:EventTarget|null)=>{
      const item=target instanceof Element?target.closest<HTMLElement>('[data-tip]'):null;
      if(!item||!nav.contains(item)){setTip(null);return}
      const label=item.dataset.tip;
      if(!label){setTip(null);return}
      const rect=item.getBoundingClientRect();
      setTip({label:label+(item.dataset.shortcut?`  ${item.dataset.shortcut}`:''),left:rect.right+13,top:rect.top+rect.height/2});
    };
    const enter=(event:Event)=>show(event.target);
    const leave=(event:Event)=>{
      const next=(event as PointerEvent|FocusEvent).relatedTarget;
      if(next instanceof Element&&next.closest('[data-tip]')=== (event.target instanceof Element?event.target.closest('[data-tip]'):null))return;
      setTip(null);
    };
    const dismiss=()=>setTip(null);
    nav.addEventListener('pointerover',enter);
    nav.addEventListener('pointerout',leave);
    nav.addEventListener('focusin',enter);
    nav.addEventListener('focusout',leave);
    nav.addEventListener('scroll',dismiss);
    window.addEventListener('resize',dismiss);
    return()=>{
      nav.removeEventListener('pointerover',enter);
      nav.removeEventListener('pointerout',leave);
      nav.removeEventListener('focusin',enter);
      nav.removeEventListener('focusout',leave);
      nav.removeEventListener('scroll',dismiss);
      window.removeEventListener('resize',dismiss);
    };
  },[compact,navRef]);

  return compact&&tip?createPortal(<div className="cc-nav-tooltip" role="tooltip" style={{left:tip.left,top:tip.top}}>{tip.label}</div>,document.body):null;
}
