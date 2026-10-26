"""Integration smoke test for the local Worker with app-owned sessions."""
import subprocess,os,time,json,urllib.request,urllib.error,tempfile,glob,sqlite3,hashlib,uuid
port=8792
origin=f'http://127.0.0.1:{port}'
password='LocalOnlyAdmin123!'
salt='0123456789abcdef0123456789abcdef'
password_hash=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600_000).hex()
db_path=next(path for path in glob.glob('.wrangler/auth-qa/v3/d1/miniflare-D1DatabaseObject/*.sqlite') if not path.endswith('metadata.sqlite'))
with sqlite3.connect(db_path) as db:
    db.execute('UPDATE app_users SET password_hash=?,salt=?,must_change_password=0,active=1 WHERE username=?',(password_hash,salt,'test-admin'))
admin_cookie=''
def request(body=None,authenticated=True,extra=None,path='/api/manage'):
    h={'Content-Type':'application/json'}
    if authenticated and admin_cookie:h['Cookie']=admin_cookie
    h.update(extra or {})
    req=urllib.request.Request(origin+path,data=json.dumps(body).encode() if body else None,headers=h)
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        try:value=json.load(e)
        except:value={}
        return e.code,value
def raw(path,body=None,cookie=''):
    req=urllib.request.Request(origin+path,data=json.dumps(body).encode() if body else None,headers={'Content-Type':'application/json',**({'Cookie':cookie} if cookie else {})})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:return r.status,json.load(r),r.headers.get('Set-Cookie','')
    except urllib.error.HTTPError as e:
        try:value=json.load(e)
        except:value={}
        return e.code,value,e.headers.get('Set-Cookie','')
def page(path,cookie=''):
    req=urllib.request.Request(origin+path,headers={'Cookie':cookie})
    try:
        with urllib.request.urlopen(req,timeout=20) as response:return response.status,response.geturl()
    except urllib.error.HTTPError as error:return error.code,error.geturl()
with tempfile.TemporaryFile() as output:
    proc=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',str(port),'--persist-to','.wrangler/auth-qa','--inspector-port','0'],env={**os.environ,'CLOUDFLARE_CF_FETCH_ENABLED':'false','WRANGLER_SEND_METRICS':'false'},stdout=output,stderr=output)
    try:
        for i in range(40):
            try:
                status,data=request(authenticated=False)
                break
            except Exception: time.sleep(.5)
        else: raise RuntimeError('Local Worker did not start')
        assert status==401,(status,data)
        status,_,cookie=raw('/api/auth',{'action':'login','identifier':'test-admin','password':password})
        assert status==200
        admin_cookie=cookie.split(';')[0]
        assert page('/',admin_cookie)[0]==200
        status,data=request();assert status==200,(status,data)
        catalog_fixture=[(900001,'FRONTAL IPHONE 13/IPHONE 14 OLED',3,129.90),(900002,'CAPA IPHONE 14 SPACE',12,39.90),(900003,'BATERIA SAMSUNG A25 ORIGINAL',0,79.90)]
        with sqlite3.connect(db_path) as local_db:
            for pid,name,stock,price in catalog_fixture:
                product_data={'id':pid,'nome':name,'quantidade':stock,'valorVenda':price,'valorVenda2':price+10,'produtoDisponibilidadeId':1,'excluido':False,'snExibirCatalogo':True,'snAcessorio':1,'tipoProdutoId':51875}
                local_db.execute('INSERT OR REPLACE INTO products (id,name,search,category,data,synced,type,brand,models,variant,display_name,enriched) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)',(pid,name,name.lower(),'ACESSÓRIO',json.dumps(product_data),int(time.time()*1000),'outros','Outras','[]','',''))
        status,result=request({'action':'enrichCatalog'});assert status==200 and result['remaining']==0,(status,result)
        status,meta=request(path='/api/manage?catalog=meta');assert status==200,(status,meta)
        assert any(m['slug']=='iphone-13' for m in meta['models']) and any(m['slug']=='iphone-14' for m in meta['models']),meta
        status,search_result=request(path='/api/manage?catalog=results&search=iphone%2014&model=iphone-14&stockOnly=true&profile=lojista');assert status==200,(status,search_result)
        assert search_result['total']>=2 and {'telas','capas'}.issubset({p['type'] for p in search_result['previews']}),search_result
        status,group=request(path='/api/manage?catalog=results&search=iphone%2014&model=iphone-14&type=telas&profile=lojista');assert status==200 and group['total']>=1 and group['items'][0]['id']==900001,(status,group)
        status,low=request(path='/api/manage?catalog=results&lowOnly=true&type=telas&profile=lojista');assert status==200 and any(p['id']==900001 for p in low['items']),(status,low)
        status,prices=request(path='/api/manage?catalog=prices&ids=900001&profile=consumidor_final');assert status==200 and prices['items'][0]['priceCents']==13990,(status,prices)
        status,result=request({'action':'catalogActivity','kind':'search','value':'iphone 14'});assert status==200,result
        cfg=data['config'];assert cfg['enabled'] is False
        assert len(cfg['team'])==3 and len(set(cfg['team']))==3,cfg['team']
        status,result=request({'action':'saveAttendant','slot':1,'displayName':'Ana QA','username':'ana.qa','email':'ana@example.test','active':True,'password':'LocalOnlyAgent123!'},path='/api/admin/users');assert status==200,result
        status,_,cookie=raw('/api/auth',{'action':'login','identifier':'ana.qa','password':'LocalOnlyAgent123!'})
        agent_cookie=cookie.split(';')[0]
        assert raw('/api/profile',{'action':'password','currentPassword':'LocalOnlyAgent123!','newPassword':'NewLocalAgent123!'},agent_cookie)[0]==200
        agent_headers={'Cookie':agent_cookie}
        status,result=request(path='/api/manage',authenticated=False,extra=agent_headers);assert status==403,result
        status,result=request(path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200 and result['attendant']['name']==cfg['team'][0],result
        status,result=request({'action':'secret','key':'OPENAI_API_KEY','value':'not-allowed'},path='/api/manage',authenticated=False,extra=agent_headers);assert status==403,result
        assert 'MERCADOPHONE_API_KEY' in data['secrets']
        assert not data['whatsappReady']
        assert data['activation']['ready'] is False
        assert data['activation']['total']==6
        assert not any(step['done'] for step in data['activation']['steps'] if step['id'] in ['openai','internal','whatsapp','receiver'])
        for service in ['openai','whatsapp']:
            status,result=request({'action':'testConnection','service':service})
            assert status==200 and result['ok'] is False and 'credencial' in result['message'],result
            assert 'fingerprint' not in result
        status,result=request({'action':'testConnection','service':'openai'},authenticated=False);assert status==401
        status,result=request({'action':'testConnection','service':'unknown'});assert status==400,(status,result)
        status,result=request({'action':'testConnection','service':'openai'},extra={'Origin':'https://evil.example'});assert status==403
        status,checkpoint=request({'action':'beginSync'});assert status==200 and checkpoint.get('page')==0 and checkpoint.get('complete') is False,(status,checkpoint)
        status,same=request({'action':'beginSync'});assert status==200 and same['runId']==checkpoint['runId'],same
        status,result=request({'action':'sync','runId':checkpoint['runId'],'page':1});assert status==400 and 'MercadoPhone' in result['error'],result
        status,current=request();assert current['sync']['runId']==checkpoint['runId'] and current['sync']['page']==0 and current['sync']['error'],current['sync']
        status,restarted=request({'action':'beginSync','restart':True});assert status==200 and restarted['runId']!=checkpoint['runId'],restarted
        status,result=request({'action':'sync','runId':checkpoint['runId'],'page':1});assert status==400 and 'outra aba' in result['error'],result
        status,result=request({'action':'config','config':{**cfg,'enabled':True}});assert status==409
        status,result=request();assert not result['config']['enabled']
        assert 'fingerprint' not in json.dumps(result['activation'])
        status,result=request({'action':'createConversation','name':'QA interno','profile':'lojista'});assert status==200,result
        cid=result['id']
        status,result=request({'action':'message','id':cid,'body':'Olá, preciso de uma peça.','role':'user'});assert status==200 and 'warning' in result,result
        status,result=request(path='/api/manage?messages='+cid);assert result['messages'][0]['body']=='Olá, preciso de uma peça.'
        status,result=request({'action':'routeConversation','id':cid,'reason':'compra_confirmada'});assert status==200 and result['assigned'] in cfg['team'],result
        status,result=request({'action':'conversation','id':cid,'status':'human','profile':'lojista','assigned':cfg['team'][0],'notes':'Contato da atendente'},path='/api/manage');assert status==200,result
        status,result=request(path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200 and any(c['id']==cid for c in result['conversations']),result
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert status==200 and len(result['messages'])>=1,result
        quote_message_id=str(uuid.uuid4())
        card={'type':'quote','intro':'Segue o orçamento:','id':str(uuid.uuid4()),'checkedAt':int(time.time()*1000),'status':'awaiting','items':[{'productId':101,'name':'Produto de teste','quantity':1,'unitCents':12300,'totalCents':12300}],'totalCents':12300}
        with sqlite3.connect(db_path) as local_db:
            local_db.execute('INSERT INTO messages (id,conversation_id,role,body,status,card_data,created) VALUES (?,?,?,?,?,?,?)',(quote_message_id,cid,'assistant','Orçamento de teste','saved',json.dumps(card),int(time.time()*1000)))
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert status==200 and any(m['id']==quote_message_id and json.loads(m['card_data'])['status']=='awaiting' for m in result['messages']),result
        status,result=request({'action':'approveQuote','id':cid,'messageId':quote_message_id},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert any(m['id']==quote_message_id and json.loads(m['card_data'])['status']=='approved' for m in result['messages']),result
        status,result=request({'action':'message','id':cid,'body':'Atendimento individual','role':'agent'},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert status==200,result
        agent_message=next(m['id'] for m in result['messages'] if m['body']=='Atendimento individual')
        status,result=request({'action':'archiveConversation','id':cid,'archive':True},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request(path='/api/attendant',authenticated=False,extra=agent_headers);assert next(c for c in result['conversations'] if c['id']==cid)['archived_at']>0,result
        status,result=request({'action':'archiveConversation','id':cid,'archive':False},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request({'action':'deleteMessage','id':cid,'messageId':agent_message},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert all(m['id']!=agent_message for m in result['messages']),result
        status,result=request({'action':'deleteMessage','id':cid,'messageId':agent_message},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==404,result
        status,result=request({'action':'update','id':cid,'name':'QA interno','profile':'lojista','notes':'Cliente atendido','status':'human'},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==200,result
        status,result=request({'action':'conversation','id':cid,'status':'human','profile':'lojista','assigned':cfg['team'][1],'notes':'Outra atendente'},path='/api/manage');assert status==200,result
        status,result=request(path='/api/attendant?messages='+cid,authenticated=False,extra=agent_headers);assert status==404,result
        status,result=request({'action':'approveQuote','id':cid,'messageId':quote_message_id},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==404,result
        status,result=request({'action':'message','id':cid,'body':'Não autorizada','role':'agent'},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==404,result
        status,result=request({'action':'archiveConversation','id':cid,'archive':True},path='/api/attendant',authenticated=False,extra=agent_headers);assert status==404,result
        status,result=request({'action':'conversation','id':cid,'status':'human','profile':'lojista','assigned':'Comercial','notes':'Confirmar modelo completo'});assert status==200,result
        status,result=request({'action':'message','id':cid,'body':'Qual é o modelo do aparelho?','role':'agent'});assert status==200,result
        status,result=request({'action':'conversation','id':cid,'status':'closed','profile':'lojista','assigned':'Comercial','notes':'Confirmado'});assert status==200,result
        status,result=request({'action':'message','id':cid,'body':'Não deve ser enviada','role':'agent'});assert status==409,result
        status,result=request({'action':'config','config':cfg},extra={'Origin':'https://evil.example'});assert status==403,result
        status,result=request({'action':'config','config':cfg,'automationIntent':True});assert status==200,result
        status,result=request();assert result['ceciPaused'] is True,result
        status,result=request({'action':'config','config':cfg});assert status==200,result
        status,result=request();assert result['ceciPaused'] is True,result
        status,result=request({'action':'quote','items':[{'productId':1,'quantity':-1}],'profile':'lojista','name':'QA'});assert status==400,(status,result)
        test_quote_id=str(uuid.uuid4())
        with sqlite3.connect(db_path) as local_db:
            local_db.execute('INSERT INTO quotes (id,name,profile,conversation_id,data,total,created) VALUES (?,?,?,?,?,?,?)',(test_quote_id,'Cliente QA','lojista',cid,json.dumps({'lines':[{'productId':101,'name':'Produto de teste','quantity':1,'unitCents':12300,'totalCents':12300}],'totalCents':12300,'checkedAt':int(time.time()*1000)}),12300,int(time.time()*1000)))
        status,result=request();assert status==200 and any(q['id']==test_quote_id for q in result['quotes']),result
        status,result=request({'action':'editQuote','id':test_quote_id,'name':'Cliente QA','profile':'lojista','items':[{'productId':101,'quantity':2}]});assert status==400 and 'MercadoPhone' in result['error'],result
        status,result=request();assert any(q['id']==test_quote_id for q in result['quotes']),result
        status,result=request({'action':'deleteQuote','id':test_quote_id});assert status==200,result
        status,result=request();assert all(q['id']!=test_quote_id for q in result['quotes']),result
        with sqlite3.connect(db_path) as local_db:
            assert local_db.execute('SELECT deleted_at FROM quotes WHERE id=?',(test_quote_id,)).fetchone()[0]>0
            assert local_db.execute('SELECT COUNT(*) FROM messages WHERE id=?',(quote_message_id,)).fetchone()[0]==1
        status,result=request({'action':'deleteQuote','id':test_quote_id});assert status==404,result
        status,result=request({'action':'config','config':{**cfg,'name':'Assistente QA'}});assert status==200,result
        status,result=request();assert result['config']['name']=='Assistente QA'
        request({'action':'config','config':cfg})
        status,result=request(path='/api/whatsapp');assert status==403
        status,result=request({'test':True},path='/api/whatsapp');assert status==503
        print('PASS: auth, persistence, attendant access, archive/restore, message deletion, explicit Ceci pause, human takeover, CSRF, catalog checks, and activation prerequisites')
    except BaseException:
        output.seek(0)
        print(output.read().decode(errors='replace')[-8000:])
        raise
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except: proc.kill()
