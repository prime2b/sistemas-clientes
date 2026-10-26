const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

const STOP_WORDS = new Set([
  'a','ao','aos','as','com','da','das','de','do','dos','e','em','na','nas','no','nos',
  'o','os','para','por','pra','pro','um','uma','uns','umas','preciso','quero','tem','vocês','voces'
]);

const ALIASES:Record<string,string[]> = {
  frontal:['frontal','display','tela','lcd','oled','amoled','touch','touchscreen','modulo'],
  display:['display','frontal','tela','lcd','oled','amoled','touch','touchscreen','modulo'],
  tela:['tela','frontal','display','lcd','oled','amoled','touch','touchscreen','modulo'],
  touch:['touch','touchscreen','frontal','display','tela'],
  bateria:['bateria','battery'],
  conector:['conector','dock','centro de carga','flex de carga','flex'],
  dock:['dock','conector','centro de carga','flex de carga'],
  carga:['carga','carregamento','charger','dock','centro de carga','flex de carga'],
  carregador:['carregador','charger','fonte','carga'],
  tampa:['tampa','carcaca','traseira','vidro traseiro'],
  traseira:['traseira','tampa','carcaca','vidro traseiro'],
  camera:['camera','cam','selfie'],
  selfie:['selfie','camera frontal','camera'],
  iphone:['iphone','apple'],
  motorola:['motorola','moto'],
  samsung:['samsung','galaxy'],
  xiaomi:['xiaomi','redmi','poco'],
  pelicula:['pelicula','vidro'],
  altofalante:['altofalante','speaker','campainha','buzzer'],
  campainha:['campainha','buzzer','altofalante externo','speaker'],
  buzzer:['buzzer','campainha','altofalante externo','speaker'],
  auricular:['auricular','altofalante auricular','altofalante','speaker'],
  biometria:['biometria','sensor digital','leitor digital','leitor de digital'],
  microfone:['microfone','mic'],
  flex:['flex','cabo flexivel'],
  pm:['pm','pro max','promax']
};

const normalizedAliases=Object.fromEntries(Object.entries(ALIASES).map(([key,values])=>[
  key,[...new Set(values.map(value=>normalize(value)))]
]));

export type ProductSearchPlan = {raw:string;tokens:string[];groups:string[][]};

export function productSearchPlan(query:string):ProductSearchPlan {
  const raw=normalize(query)
    .replace(/([a-z])([0-9])/g,'$1 $2')
    .replace(/([0-9])([a-z])/g,'$1 $2')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\b([45])\s+g\b/g,'$1g')
    .trim();
  const tokens=[...new Set(raw.split(/\s+/).filter(token=>token&&token.length<=40&&!STOP_WORDS.has(token)))].slice(0,8);
  const groups=tokens.map(token=>normalizedAliases[token]||[token]);
  return {raw,tokens,groups};
}

export function productSearchScore(name:string,category:string,plan:ProductSearchPlan){
  const text=` ${normalize(name)} ${normalize(category)} `;
  let matchedGroups=0;
  let score=0;
  for(const group of plan.groups){
    const matches=group.filter(term=>text.includes(term));
    if(matches.length){
      matchedGroups++;
      score+=100+Math.max(...matches.map(term=>term.length));
      if(matches.includes(group[0]))score+=20;
    }
  }
  if(plan.tokens.length&&text.includes(plan.tokens.join(' ')))score+=250;
  if(/^\s*(frontal|display|tela|lcd|oled|amoled)\b/.test(text))score+=15;
  return {score,matchedGroups};
}

export function minimumMatchedGroups(plan:ProductSearchPlan){
  if(plan.groups.length<=2)return plan.groups.length;
  return plan.groups.length-1;
}

export function sqlLike(value:string){return `%${value.replace(/[%_]/g,'')}%`;}
