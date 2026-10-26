export function avatarValid(value:string){
  if(!value)return true;
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match||match[2].length>125000)return false;
  try{
    const bytes=atob(match[2]);
    if(bytes.length>90_000)return false;
    return match[1]==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):match[1]==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
  }catch{return false;}
}
