/** Conservative read-ahead only: candidates, never a product choice or price claim. */
export function initialProductQueries(messages:{role:string;body:string}[]){
  const user=messages.filter(m=>m.role==='user');
  const latest=user.at(-1)?.body||'';
  const marker=/\biphones?\b/i.exec(latest);
  if(!marker)return [];
  const parts=[/\bbaterias?\b/i,/\b(?:frontais|frontal|telas?|displays?|m[oó]dulos?)\b/i,/\b(?:conectores?|dock|flex de carga)\b/i,/\b(?:tampas?|vidro traseiro)\b/i];
  let part='';
  for(const message of [...user].reverse().slice(0,5)){
    const match=parts.map(p=>p.exec(message.body)?.[0]).find(Boolean);
    if(match){part=match;break;}
  }
  if(!part)return [];
  const tail=latest.slice(marker.index+marker[0].length);
  const models:string[]=[];
  let remaining=tail.trim();
  while(models.length<6){
    const match=/^(1[0-9]|[6-9]|XR|XS|SE|X)(?:\s+(Pro\s*Max|Pro|Plus|Mini|Max))?\b/i.exec(remaining);
    if(!match)break;
    models.push([match[1],match[2]].filter(Boolean).join(' '));
    remaining=remaining.slice(match[0].length);
    const separator=/^\s*(?:,\s*(?:e\s+)?|e\s+)(?:iphones?\s+)?/i.exec(remaining);
    if(!separator)break;
    remaining=remaining.slice(separator[0].length);
  }
  return [...new Set(models)].slice(0,6).map(model=>`${part} iPhone ${model}`);
}
