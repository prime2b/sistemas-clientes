export async function prepareAvatar(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5_000_000)throw new Error('Escolha uma imagem PNG, JPG ou WebP de até 5 MB.');
  const objectUrl=URL.createObjectURL(file);
  try{
    const image=new Image();
    await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Imagem inválida.'));image.src=objectUrl;});
    const canvas=document.createElement('canvas');canvas.width=180;canvas.height=180;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.');
    const side=Math.min(image.width,image.height);
    ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,180,180);
    const encoded=canvas.toDataURL('image/webp',.78);
    if(encoded.length>125000)throw new Error('Foto muito grande. Escolha outra imagem.');
    return encoded;
  }finally{URL.revokeObjectURL(objectUrl);}
}
