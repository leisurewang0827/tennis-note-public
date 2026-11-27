"""One deploy to the development alias. No retry or second deploy on uncertain response."""
import json, os, re, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path
from build import *
import promote as previous

def context():
    e=os.environ
    need(e.get("GITHUB_REPOSITORY")==previous.REPO and e.get("GITHUB_REF")=="refs/heads/"+BRANCH and
         e.get("GITHUB_RUN_ATTEMPT")=="1" and e.get("GITHUB_EVENT_NAME")=="push" and
         e.get("GITHUB_WORKFLOW_REF")==previous.REPO+"/"+FLOW+"@refs/heads/"+BRANCH,"unexpected workflow")
    head=previous.git("rev-parse","HEAD")
    need(head==e.get("GITHUB_SHA") and previous.git("show","-s","--format=%P",head)==PARENT,"parent drift")
    need(set(previous.git("diff","--name-status",PARENT,head).splitlines())=={"A\t"+p for p in FILES},"scope drift")
    return head

def exact_base():
    need(previous.identity(previous.canonical(),"dev",PARENT)==BASE_ID and
         previous.identity(previous.cf("/deployments/"+BASE_ID),"dev",PARENT)==BASE_ID,"development changed; do not publish")

def route_check(host,path,want,digest=None):
    req=urllib.request.Request(old.origin(host)+path,headers={"Accept-Encoding":"identity","Cache-Control":"no-cache"})
    try: resp=urllib.request.build_opener(old.NoRedirect()).open(req,timeout=20)
    except urllib.error.HTTPError as err:
        need(err.code==want and digest is None,"route status mismatch"); return
    with resp:
        data=resp.read(512*1024+1)
        need(resp.status==want and digest is not None and sha(data)==digest and len(data)<512*1024,"public response differs")
        need("no-store" in resp.headers.get("Cache-Control","") and "frame-ancestors 'none'" in resp.headers.get("Content-Security-Policy",""),"response protection missing")

def go():
    head=context(); root=Path("sealed-app")
    need(verify(root)==os.environ.get("VERIFIED_SEAL"),"verification seal mismatch")
    exact_base()
    cli=Path(os.environ["RUNNER_TEMP"])/"tn-cli/node_modules/wrangler/wrangler-dist/cli-tennisnote-single.cjs"
    env={k:v for k,v in os.environ.items() if k in ("PATH","HOME","TMPDIR","CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_API_TOKEN")}
    env["WRANGLER_SEND_METRICS"]="false"
    result=subprocess.run(["node",str(cli),"pages","deploy",str(root.resolve()),"--project-name=tennisnote-app-dev","--branch=dev",
                           "--commit-hash="+head,"--commit-message=Single designated development coach entry","--commit-dirty=false"],
                          cwd=os.environ["RUNNER_TEMP"],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
    ids=set(re.findall(rb"https://([a-f0-9]{8})\.tennisnote-app-dev\.pages\.dev\b",result.stdout))
    need(result.returncode==0 and len(ids)==1,"publication outcome unknown; do not retry; inspect Pages")
    prefix=ids.pop().decode()
    ident=None
    for i in range(8):
        d=previous.canonical()
        if d.get("id","").startswith(prefix) and d.get("latest_stage",{}).get("status")=="success":
            ident=previous.identity(d,"dev",head); break
        if i<7: time.sleep(3)
    need(ident and ident!=BASE_ID,"canonical not confirmed; no retry")
    print("development baseline",BASE_ID,"canonical",ident,flush=True)
    client=make_client((root/CLIENT).read_bytes(),json.loads((HERE/"tags.json").read_bytes()))
    route_check(prefix+"."+SITE,"/qa-coach-login",404)
    route_check(SITE,"/qa-coach-login",200,sha((HERE/"page.html").read_text("utf8").encode()))
    route_check(SITE,"/qa-coach-login-client.js",200,sha(client))
    m,files=baseline()
    for p in ("index.html","release.json","shared/config.local.js",CLIENT,"tennis-note-coach-app/index.html",*m["delta"]):
        old.public_bytes(SITE,p,files[p],True)
    need(previous.identity(previous.canonical(),"dev",head)==ident,"concurrent publication")
    print("PASS designated development route; normal app unchanged; protected input not exercised by CI")

if __name__=="__main__":
    if sys.argv[1:]==["context"]: context()
    elif sys.argv[1:]==["publish"]: go()
    else: raise SystemExit("invalid stage")
