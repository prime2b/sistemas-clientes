import getpass,json,urllib.request,concurrent.futures,pathlib
access=json.loads(getpass.getpass('Source access JSON: '));base=access['url'].rstrip('/')+'/api/pilot/wecharge';headers={'OAI-Sites-Authorization':'Bearer '+access['token']}
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
opener=urllib.request.build_opener(NoRedirect())
def get(url):return json.load(opener.open(urllib.request.Request(url,headers=headers),timeout=40))
data=get(base);points=data['points']
def history(p):return get(base+'?start=2026-10-28&end=2026-10-29&day=2026-10-29&id='+p['id'])
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: histories=list(pool.map(history,points))
pathlib.Path('.qa').mkdir(exist_ok=True);pathlib.Path('.qa/history-export.json').write_text(json.dumps(histories))
print(json.dumps({'points':len(points),'samples':sum(len(h['samples']) for h in histories),'through':data['meta']['lastCaptureAt']}))
