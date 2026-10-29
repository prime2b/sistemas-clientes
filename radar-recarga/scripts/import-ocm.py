"""Import official OCM country export. No API key or invented location data.
Usage: python scripts/import-ocm.py /path/to/ocm-export
"""
import json,sys,pathlib,subprocess,unicodedata,datetime,re,collections,struct,zipfile
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(__file__).resolve().parents[1]/'public/data'; out.mkdir(exist_ok=True)
ref=json.loads((root/'data/referencedata.json').read_text())
lookup={k:{v['ID']:v for v in ref[k]} for k in ['ConnectionTypes','Operators','StatusTypes','UsageTypes','DataProviders']}
def norm(s):return ''.join(c for c in unicodedata.normalize('NFD',s or '') if unicodedata.category(c)!='Mn').lower().strip()
states={'AC':'Acre','AL':'Alagoas','AP':'Amapá','AM':'Amazonas','BA':'Bahia','CE':'Ceará','DF':'Distrito Federal','ES':'Espírito Santo','GO':'Goiás','MA':'Maranhão','MT':'Mato Grosso','MS':'Mato Grosso do Sul','MG':'Minas Gerais','PA':'Pará','PB':'Paraíba','PR':'Paraná','PE':'Pernambuco','PI':'Piauí','RJ':'Rio de Janeiro','RN':'Rio Grande do Norte','RS':'Rio Grande do Sul','RO':'Rondônia','RR':'Roraima','SC':'Santa Catarina','SP':'São Paulo','SE':'Sergipe','TO':'Tocantins'}
def uf(raw):
 n=norm(raw);simple=re.sub(r'[^a-z ]','',n).strip()
 for code,name in states.items():
  if simple in [code.lower(),norm(name),'estado de '+norm(name),norm(name)+' '+code.lower()]:return code
 return 'ND'
def clean(s):return re.sub(r'<[^>]*>','',str(s or '')).strip()
# Read the official IBGE 2023 state boundaries when supplied. Only missing/unrecognized UF is derived.
def read_states(path):
 z=zipfile.ZipFile(path);dbf=z.read(next(n for n in z.namelist() if n.endswith('.dbf')));count=struct.unpack_from('<I',dbf,4)[0];header,record=struct.unpack_from('<HH',dbf,8);fields=[];pos=32
 while dbf[pos]!=13:
  f=dbf[pos:pos+32];fields.append((f[:11].split(b'\0')[0].decode(),f[16]));pos+=32
 rows=[]
 for i in range(count):
  row=dbf[header+i*record:header+(i+1)*record];offset=1;values={}
  for name,size in fields:values[name]=row[offset:offset+size].decode('utf-8',errors='replace').strip();offset+=size
  rows.append(values)
 shp=z.read(next(n for n in z.namelist() if n.endswith('.shp')));offset=100;geometries=[];index=0
 while offset<len(shp):
  size=struct.unpack_from('>i',shp,offset+4)[0]*2;b=shp[offset+8:offset+8+size];offset+=8+size
  if struct.unpack_from('<i',b)[0]!=5:index+=1;continue
  bbox=struct.unpack_from('<dddd',b,4);parts,npoints=struct.unpack_from('<ii',b,36);starts=list(struct.unpack_from('<'+'i'*parts,b,44))+[npoints];start=44+parts*4;pts=list(struct.iter_unpack('<dd',b[start:start+npoints*16]));rings=[pts[starts[j]:starts[j+1]] for j in range(parts)];geometries.append((rows[index]['SIGLA_UF'],bbox,rings));index+=1
 return geometries
def point_in_ring(x,y,ring):
 inside=False;xj,yj=ring[-1]
 for xi,yi in ring:
  if ((yi>y)!=(yj>y)) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:inside=not inside
  xj,yj=xi,yi
 return inside
geo=read_states(sys.argv[2]) if len(sys.argv)>2 else []
def geo_uf(lng,lat):
 for code,(xmin,ymin,xmax,ymax),rings in geo:
  if not(xmin<=lng<=xmax and ymin<=lat<=ymax):continue
  inside=False
  for ring in rings:
   if point_in_ring(lng,lat,ring):inside=not inside
  if inside:return code
 return 'ND'
points=[];rejected=collections.Counter()

for file in sorted((root/'data/BR').glob('*.json')):
 p=json.loads(file.read_text());a=p.get('AddressInfo') or {};lat=a.get('Latitude');lng=a.get('Longitude');provider=lookup['DataProviders'].get(p.get('DataProviderID'),{})
 if not isinstance(lat,(int,float)) or not isinstance(lng,(int,float)) or not(-35<=lat<=6 and -74<=lng<=-34):rejected['coordinates']+=1;continue
 if p.get('DataProviderID')!=1 and not provider.get('IsOpenDataLicensed'):rejected['license']+=1;continue
 if p.get('SubmissionStatusTypeID') not in [100,200]:rejected['submission']+=1;continue
 state_uf=uf(a.get('StateOrProvince'));uf_source='ocm'
 if state_uf=='ND' and geo:
  state_uf=geo_uf(lng,lat);uf_source='geometry-ibge' if state_uf!='ND' else 'unknown'
 connections=[]
 for c in p.get('Connections',[]):
  ct=lookup['ConnectionTypes'].get(c.get('ConnectionTypeID'),{})
  connections.append({'type':clean(ct.get('Title')) or 'Não informado','typeId':c.get('ConnectionTypeID'),'power':c.get('PowerKW'),'quantity':c.get('Quantity'),'status':clean(lookup['StatusTypes'].get(c.get('StatusTypeID'),{}).get('Title'))})
 operator=lookup['Operators'].get(p.get('OperatorID'),{});status=lookup['StatusTypes'].get(p.get('StatusTypeID'),{});usage=lookup['UsageTypes'].get(p.get('UsageTypeID'),{})
 points.append({'id':p['ID'],'name':clean(a.get('Title')) or 'Eletroposto OCM '+str(p['ID']),'address':clean(a.get('AddressLine1')),'address2':clean(a.get('AddressLine2')),'city':clean(a.get('Town')) or 'Município não informado','state':clean(a.get('StateOrProvince')),'uf':state_uf,'ufSource':uf_source,'postcode':clean(a.get('Postcode')),'lat':lat,'lng':lng,'operator':clean(operator.get('Title')) or 'Operador não informado','operatorId':p.get('OperatorID'),'connections':connections,'numberOfPoints':p.get('NumberOfPoints'),'status':clean(status.get('Title')) or 'Não informado','isOperational':status.get('IsOperational'),'usage':clean(usage.get('Title')) or 'Não informado','usageCost':clean(p.get('UsageCost')),'access':clean(a.get('AccessComments')),'updatedAt':p.get('DateLastStatusUpdate'),'verifiedAt':p.get('DateLastVerified'),'providerId':p.get('DataProviderID'),'provider':clean(provider.get('Title')) or 'Open Charge Map contributors','license':clean(provider.get('License')) or 'Creative Commons Attribution 4.0 International (CC BY 4.0)','providerURL':provider.get('WebsiteURL'),'ocmURL':'https://openchargemap.org/site/poi/details/'+str(p['ID'])})
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip();date=subprocess.check_output(['git','show','-s','--format=%cI','HEAD'],cwd=root,text=True).strip()
meta={'source':'Open Charge Map','repository':'https://github.com/openchargemap/ocm-export','sourceCommit':commit,'sourceDate':date,'importedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceDescription':'Exportação pública oficial; cadastro de locais, sem ocupação ao vivo.','scope':'BR','total':len(points),'states':states,'countsByUF':dict(collections.Counter(p['uf'] for p in points)),'excluded':dict(rejected),'ufBoundarySource':'https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2023/Brasil/BR_UF_2023.zip' if geo else None,'ufDerivedCount':sum(p['ufSource']=='geometry-ibge' for p in points)}
(out/'ocm-br.json').write_text(json.dumps({'meta':meta,'points':points},ensure_ascii=False,separators=(',',':')))
print(json.dumps(meta,ensure_ascii=False,indent=2));print('size',(out/'ocm-br.json').stat().st_size)

# Lightweight local territorial fallback, simplified from the same official IBGE boundaries.
def distance_sq(p,a,b):
 x,y=p;ax,ay=a;bx,by=b;dx=bx-ax;dy=by-ay;t=0 if dx==dy==0 else max(0,min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return (x-ax-t*dx)**2+(y-ay-t*dy)**2
def simplify(line,tolerance=.012):
 if len(line)<=4:return line
 a,b=line[0],line[-1];dist,index=max((distance_sq(p,a,b),i) for i,p in enumerate(line[1:-1],1))
 if dist>tolerance*tolerance:return simplify(line[:index+1],tolerance)[:-1]+simplify(line[index:],tolerance)
 return [a,b]
features=[]
for code,bbox,rings in geo:
 polygons=[]
 for ring in rings:
  area=sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))/2
  reduced=simplify(ring[:-1]);reduced=reduced+[reduced[0]]
  if len(reduced)<4:continue
  reduced=[[round(x,5),round(y,5)] for x,y in reduced]
  if area<0 or not polygons:polygons.append([reduced])
  else:polygons[-1].append(reduced)
 if polygons:features.append({'type':'Feature','properties':{'uf':code,'name':states[code]},'geometry':{'type':'MultiPolygon','coordinates':polygons}})
if features:
 (out/'br-uf-ibge.geojson').write_text(json.dumps({'type':'FeatureCollection','source':'IBGE · Malha territorial 2023, simplificada para visualização','sourceURL':meta['ufBoundarySource'],'features':features},ensure_ascii=False,separators=(',',':')))
 print('territorial fallback',len(features),'states',(out/'br-uf-ibge.geojson').stat().st_size,'bytes')
