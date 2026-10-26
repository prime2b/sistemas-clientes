import type {CSSProperties} from 'react';

type Props={variant?:'light'|'dark'|'mark';height?:number;className?:string;style?:CSSProperties};
export default function BrandLogo({variant='light',height=56,className='',style}:Props){
  if(variant==='mark')return <img className={className} src="/brand/logo-mark-96.png" width={height} height={height} alt="Center Cell Eletrônicos" style={style}/>;
  const asset=variant==='dark'?'logo-centercell-dark-640':'logo-centercell-light-640';
  return <picture className={className} style={style}><source type="image/webp" srcSet={`/brand/${asset}.webp`}/><img src={`/brand/${asset}.png`} width="640" height="368" alt="Center Cell Eletrônicos" style={{height,width:'auto',maxWidth:'100%'}}/></picture>;
}
