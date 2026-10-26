"""Local Worker check for account sessions, profile updates, and attendant isolation."""
import base64,glob,hashlib,json,os,sqlite3,subprocess,tempfile,time,urllib.error,urllib.request

PORT=8793
ORIGIN=f'http://127.0.0.1:{PORT}'
DB=next(path for path in glob.glob('.wrangler/auth-qa/v3/d1/miniflare-D1DatabaseObject/*.sqlite') if not path.endswith('metadata.sqlite'))
PASSWORD='LocalOnlyAdmin123!'
SALT='0123456789abcdef0123456789abcdef'
HASH=hashlib.pbkdf2_hmac('sha256',PASSWORD.encode(),bytes.fromhex(SALT),600_000).hex()
with sqlite3.connect(DB) as db:
    db.execute('DELETE FROM app_sessions')
    db.execute("DELETE FROM app_users WHERE role='attendant'")
    db.execute("INSERT OR REPLACE INTO app_users (id,role,slot,username,email,display_name,password_hash,salt,active,must_change_password,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",('test-admin','admin',None,'test-admin','admin@example.test','Administrador Teste',HASH,SALT,1,1,0,0))

def call(path,body=None,cookie='',origin=None):
    headers={'Content-Type':'application/json'}
    if cookie: headers['Cookie']=cookie
    if origin: headers['Origin']=origin
    req=urllib.request.Request(ORIGIN+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=20) as response:
            return response.status,json.load(response),response.headers.get('Set-Cookie','')
    except urllib.error.HTTPError as error:
        try: payload=json.load(error)
        except: payload={}
        return error.code,payload,error.headers.get('Set-Cookie','')

def page(path,cookie=''):
    req=urllib.request.Request(ORIGIN+path,headers={'Cookie':cookie})
    try:
        with urllib.request.urlopen(req,timeout=20) as response:return response.status,response.geturl()
    except urllib.error.HTTPError as error:return error.code,error.geturl()

with tempfile.TemporaryFile() as output:
    proc=subprocess.Popen(['node','node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--ip','127.0.0.1','--port',str(PORT),'--persist-to','.wrangler/auth-qa','--inspector-port','0'],env={**os.environ,'CLOUDFLARE_CF_FETCH_ENABLED':'false','WRANGLER_SEND_METRICS':'false'},stdout=output,stderr=output)
    try:
        for _ in range(40):
            try: status,_,_=call('/api/auth');break
            except Exception:time.sleep(.5)
        else:raise RuntimeError('Worker did not start')
        assert status==200
        assert call('/api/manage')[0]==401
        assert page('/')[1].endswith('/login')
        assert page('/atendente')[1].endswith('/login')
        assert call('/api/auth',{'action':'login','identifier':'test-admin','password':'wrong'})[0]==401
        status,data,header=call('/api/auth',{'action':'login','identifier':'test-admin','password':PASSWORD})
        assert status==200 and data['redirect']=='/conta',(status,data)
        assert 'Secure' in header and 'HttpOnly' in header and 'SameSite=Lax' in header
        admin_cookie=header.split(';')[0]
        assert page('/conta',admin_cookie)[0]==200
        assert call('/api/manage',cookie=admin_cookie)[0]==403
        assert call('/api/profile',{'action':'password','currentPassword':PASSWORD,'newPassword':'NewLocalAdmin123!'},admin_cookie)[0]==200
        assert page('/',admin_cookie)[0]==200
        assert call('/api/profile',{'action':'profile','displayName':'Admin QA','email':'admin@example.test','phone':'11999999999','avatar':''},admin_cookie)[0]==200
        assert call('/api/profile',cookie=admin_cookie)[1]['user']['displayName']=='Admin QA'
        assert call('/api/admin/users',cookie=admin_cookie)[1]['slots'][0]['account'] is None
        account={'action':'saveAttendant','slot':1,'displayName':'Ana QA','username':'ana.qa','email':'ana@example.test','active':True,'password':'LocalOnlyAgent123!'}
        assert call('/api/admin/users',account,admin_cookie)[0]==200
        assert call('/api/admin/users',cookie=admin_cookie)[1]['slots'][0]['account']['username']=='ana.qa'
        avatar='data:image/png;base64,'+base64.b64encode(b'\x89PNG\r\n\x1a\n'+b'avatar-test').decode()
        assert call('/api/admin/users',{**account,'password':'','avatar':'data:image/svg+xml;base64,PHN2Zz4='},admin_cookie)[0]==400
        assert call('/api/admin/users',{**account,'password':'','avatar':avatar},admin_cookie)[0]==200
        assert call('/api/admin/users',cookie=admin_cookie)[1]['slots'][0]['account']['avatar']==avatar
        assert call('/api/admin/users',{**account,'password':'','avatar':''},admin_cookie)[0]==200
        assert call('/api/admin/users',cookie=admin_cookie)[1]['slots'][0]['account']['avatar']==''
        assert call('/api/auth',{'action':'login','identifier':'ana.qa','password':'LocalOnlyAgent123!'})[1]['redirect']=='/conta'
        status,data,header=call('/api/auth',{'action':'login','identifier':'ana.qa','password':'LocalOnlyAgent123!'})
        agent_cookie=header.split(';')[0]
        assert call('/api/manage',cookie=agent_cookie)[0]==403
        assert call('/api/attendant',cookie=agent_cookie)[0]==403
        assert call('/api/profile',{'action':'password','currentPassword':'LocalOnlyAgent123!','newPassword':'NewLocalAgent123!'},agent_cookie)[0]==200
        assert page('/atendente',agent_cookie)[0]==200
        assert call('/api/admin/users',cookie=agent_cookie)[0]==403
        assert call('/api/attendant',cookie=agent_cookie)[0]==200
        assert call('/api/profile',{'action':'profile','displayName':'Ana Personalizada','email':'ana@example.test','phone':'','avatar':'data:image/svg+xml;base64,PHN2Zz4='},agent_cookie)[0]==400
        assert call('/api/profile',{'action':'profile','displayName':'Ana Personalizada','email':'ana@example.test','phone':'','avatar':avatar},agent_cookie)[0]==200
        agent_profile=call('/api/profile',cookie=agent_cookie)[1]['user']
        assert agent_profile['displayName']=='Ana Personalizada' and agent_profile['avatar']==avatar
        assert call('/api/admin/users',{'action':'revokeSessions','slot':1},admin_cookie)[0]==200
        assert call('/api/attendant',cookie=agent_cookie)[0]==401
        assert call('/api/auth',{'action':'logout'},admin_cookie)[0]==200
        assert call('/api/manage',cookie=admin_cookie)[0]==401
        print('PASS: app login, password change, profiles, attendant provisioning and isolation, session revocation')
    finally:
        proc.terminate()
        try:proc.wait(timeout=5)
        except:proc.kill()
