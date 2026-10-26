'use client';
import {useEffect,useState} from 'react';
import {Check,Loader2,Plus,Search,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {toast} from 'sonner';

type Line={productId:number;name:string;quantity:number};
type Quote={id:string;name:string;profile:string;conversation_id:string;data:string};
type Product={id:number;name:string;stock:number|null;canQuote:boolean};

export default function QuoteEditor({quote,onClose,onSaved}:{quote:Quote|null;onClose:()=>void;onSaved:(value:Record<string,unknown>)=>Promise<void>}){
  const [name,setName]=useState(''),[profile,setProfile]=useState('lojista'),[lines,setLines]=useState<Line[]>([]),[search,setSearch]=useState(''),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
  useEffect(()=>{
    if(!quote)return;
    const draft=JSON.parse(quote.data) as {lines:Line[]};
    setName(quote.name);setProfile(quote.profile);setLines(draft.lines.map(line=>({productId:line.productId,name:line.name,quantity:line.quantity})));setSearch('');setProducts([]);
  },[quote]);
  useEffect(()=>{
    if(!quote)return;
    let active=true;
    const timer=setTimeout(async()=>{
      setLoading(true);
      try{
        const response=await fetch('/api/manage?search='+encodeURIComponent(search)+'&profile='+profile,{cache:'no-store'});
        const data=await response.json() as {items?:Product[];error?:string};
        if(!response.ok)throw new Error(data.error||'Não foi possível buscar os produtos.');
        if(active)setProducts((data.items||[]).slice(0,12));
      }catch(error){if(active)toast.error((error as Error).message);}finally{if(active)setLoading(false);}
    },300);
    return()=>{active=false;clearTimeout(timer);};
  },[quote,search,profile]);
  async function save(){
    if(!quote||!name.trim()||!lines.length)return;
    setSaving(true);
    try{
      const response=await fetch('/api/manage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'editQuote',id:quote.id,name:name.trim(),profile,items:lines.map(line=>({productId:line.productId,quantity:line.quantity}))})});
      const result=await response.json() as {error?:string}&Record<string,unknown>;
      if(!response.ok)throw new Error(result.error||'Não foi possível atualizar o orçamento.');
      await onSaved(result);
      onClose();
      toast.success('Nova versão do orçamento salva com os valores atuais.');
    }catch(error){toast.error((error as Error).message);}finally{setSaving(false);}
  }
  return <Dialog open={!!quote} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="cc-quote-editor max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Editar orçamento</DialogTitle><DialogDescription>Altere os itens e quantidades. Ao salvar, consultaremos preço e estoque novamente e criaremos uma nova versão.</DialogDescription></DialogHeader>
    <div className="cc-quote-editor-fields"><label>Cliente<Input value={name} maxLength={100} onChange={event=>setName(event.target.value)}/></label><label>Perfil comercial<Select value={profile} onValueChange={setProfile}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="lojista">Lojista / assistência</SelectItem><SelectItem value="consumidor_final">Consumidor final</SelectItem></SelectContent></Select></label></div>
    <div className="cc-quote-editor-items"><h3>Itens do orçamento</h3>{lines.map(line=><div className="cc-quote-editor-line" key={line.productId}><span><strong>{line.name}</strong><small>Cód. {line.productId}</small></span><label>Quantidade<Input type="number" min={1} max={10000} aria-label={'Quantidade de '+line.name} value={line.quantity} onChange={event=>setLines(previous=>previous.map(item=>item.productId===line.productId?{...item,quantity:Math.min(10000,Math.max(1,Number(event.target.value)||1))}:item))}/></label><button type="button" aria-label={'Remover '+line.name} onClick={()=>setLines(previous=>previous.filter(item=>item.productId!==line.productId))}><Trash2 size={16}/></button></div>)}{!lines.length&&<p>Adicione pelo menos um produto para continuar.</p>}</div>
    <div className="cc-quote-editor-search"><label htmlFor="cc-quote-product-search">Adicionar produto</label><div><Search size={17}/><Input id="cc-quote-product-search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar produto ou modelo"/></div><div className="cc-quote-editor-results">{loading?<p>Buscando…</p>:products.map(product=><div key={product.id}><span><strong>{product.name}</strong><small>Cód. {product.id} · {product.stock??'—'} em estoque</small></span><Button type="button" size="sm" variant="outline" disabled={!product.canQuote||lines.some(line=>line.productId===product.id)||lines.length>=30} onClick={()=>setLines(previous=>[...previous,{productId:product.id,name:product.name,quantity:1}])}>{lines.some(line=>line.productId===product.id)?<Check size={15}/>:<Plus size={15}/>} {lines.some(line=>line.productId===product.id)?'Incluído':'Adicionar'}</Button></div>)}</div></div>
    <p className="cc-quote-editor-note">O orçamento atualizado não é enviado automaticamente. Mensagens já enviadas continuam no histórico do atendimento.</p>
    <div className="cc-quote-editor-footer"><Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button disabled={saving||!name.trim()||!lines.length} onClick={()=>void save()}>{saving?<Loader2 size={16} className="spin"/>:<Check size={16}/>} Salvar nova versão</Button></div>
  </DialogContent></Dialog>;
}
