"""One scoped development release. No credentials are accepted as command arguments."""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import http.client
from pathlib import Path

from artifact import BASE, FEATURE, OLD, PAGES, PROJECT, NoRedirect, DigestMismatch, need, origin, policy, public_bytes, served, sha, verify_tree

REPO = "leisurewang0827/tennis-note-public"
BRANCH = "codex/dev-normal-app-sealed-20261127"
PREVIEW = "qa-coach-schedule-20261127"
WORKFLOW = ".github/workflows/coach-schedule-sealed-development.yml"
DIR = "release-promotions/coach-schedule-dev/"
SCOPE = {WORKFLOW} | {DIR+n for n in ("artifact.py","manifest.json","promote.py","guard.mjs","test_scope.py")}
RUN = "45973633771"
JOB = "140419854111"
MERGE = "62595be9ee6858bd6d25b4153703dfe88d046bee"
FIRST = "e46e9f046700cd76881d3dae8859d3c2d1d3d6ac"
TREE = "82ccdea1c5ca39718cd3fae8b0fca11a0ccb08c0"
UUID = r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}"


def git(*args):
    return subprocess.check_output(["git",*args],text=True).strip()


def context():
    e=os.environ
    need(e.get("GITHUB_REPOSITORY")==REPO and e.get("GITHUB_REF")=="refs/heads/"+BRANCH
         and e.get("GITHUB_EVENT_NAME")=="push" and e.get("GITHUB_RUN_ATTEMPT")=="1"
         and e.get("GITHUB_WORKFLOW_REF")==REPO+"/"+WORKFLOW+"@refs/heads/"+BRANCH,"release context")
    head=git("rev-parse","HEAD")
    need(head==e.get("GITHUB_SHA") and git("show","-s","--format=%P",head)==FIRST and
         git("show","-s","--format=%P",FIRST)==FEATURE and git("diff","--name-status",FIRST,head)=="M\t"+DIR+"promote.py" and
         git("rev-parse",FEATURE+"^{tree}")==TREE,"candidate provenance")
    rows=git("diff","--name-status",FEATURE,head).splitlines()
    need(set(rows)=={"A\t"+p for p in SCOPE},"candidate scope")
    return head


def log_address(raw):
    u=urllib.parse.urlsplit(raw)
    need(u.scheme=="https" and u.hostname and not u.username and not u.password and u.port in (443,None)
         and not u.fragment and any(u.hostname.endswith(s) for s in (".blob.core.windows.net",".actions.githubusercontent.com")),
         "unexpected GitHub log storage origin")
    return u.hostname,urllib.parse.urlunsplit(("","",u.path,u.query,""))


def job_log():
    # GitHub REST returns a short-lived asset URL. Never log it or forward the GitHub credential.
    conn=http.client.HTTPSConnection("api.github.com",timeout=25)
    try:
        conn.request("GET",f"/repos/{REPO}/actions/jobs/{JOB}/logs",headers={"User-Agent":"TennisNote-release-proof",
            "Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json"})
        r=conn.getresponse()
        need(r.status==302,"GitHub job log redirect unavailable")
        host,target=log_address(r.getheader("Location",""))
    finally: conn.close()
    conn=http.client.HTTPSConnection(host,timeout=25)
    try:
        conn.request("GET",target,headers={"User-Agent":"TennisNote-release-proof","Accept-Encoding":"identity"})
        r=conn.getresponse();need(r.status==200,"GitHub job log download unavailable")
        raw=r.read(16*1024*1024+1)
        need(len(raw)<=16*1024*1024,"oversized GitHub job log")
        return re.sub(r"\x1b\[[0-9;]*m","",raw.decode("utf-8-sig"))
    finally: conn.close()


def github_proof():
    context()
    def api(path):
        return subprocess.check_output(["gh","api","repos/"+REPO+"/"+path],text=True)
    run=json.loads(api("actions/runs/"+RUN)); job=json.loads(api("actions/jobs/"+JOB))
    merge=json.loads(api("git/commits/"+MERGE))
    need(run["head_sha"]==FEATURE and run["run_attempt"]==1 and run["conclusion"]=="failure"
         and run["event"]=="pull_request" and job["head_sha"]==FEATURE and str(job["run_id"])==RUN
         and job["conclusion"]=="failure" and merge["tree"]["sha"]==TREE and
         [p["sha"] for p in merge["parents"]]==["d1a22ea5faf60b9fb97d10e5029ec6027351b759",FEATURE],
         "historical check binding")
    log=job_log()
    markers=["HEAD is now at 62595be9 Merge "+FEATURE,"# tests 627","# pass 624","# fail 0",
             "▶ 배포본 검사","Public PWA CI passed for 1.0.557 / 2026.10.26.01","✔ 전부 통과했습니다.",
             "##[error]The action 'Verify' has timed out after 4 minutes."]
    at=-1
    for marker in markers:
        at=log.find(marker,at+1)
        need(at>=0,"source-check record missing")
    need(sum("##[error]" in l for l in log.splitlines())==1,"additional source error")
    print("PR 241 remains failed/not merged. Original complete verifier output bound to exact tree; new sealed artifact check is separate.")


def cf(suffix="",method="GET"):
    a=os.environ.get("CLOUDFLARE_ACCOUNT_ID","")
    need(re.fullmatch("[0-9a-f]{32}",a) and sha(a.encode())==os.environ.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT"),
         "development account mismatch")
    need(method=="GET" and (suffix=="" or re.fullmatch("/deployments/"+UUID,suffix) or
         suffix in ("/deployments?env=preview&per_page=25","/deployments?env=production&per_page=25"))
         or method=="POST" and suffix=="/deployments/"+OLD+"/rollback","forbidden control plane target")
    tok=os.environ["CLOUDFLARE_API_TOKEN"]
    req=urllib.request.Request("https://api.cloudflare.com/client/v4/accounts/"+a+"/pages/projects/"+PROJECT+suffix,
        method=method,headers={"Authorization":"Bearer "+tok,"Accept":"application/json"})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=25) as r:
        payload=json.load(r)
    need(payload.get("success") is True,"development project API failure")
    return payload["result"]


def identity(d,branch,commit):
    need(isinstance(d,dict) and re.fullmatch(UUID,d.get("id","")) and
         d.get("environment")==("production" if branch=="dev" else "preview") and
         d.get("latest_stage",{}).get("status")=="success" and
         d.get("deployment_trigger",{}).get("metadata",{}).get("commit_hash")==commit and
         d["deployment_trigger"]["metadata"].get("branch")==branch and
         d.get("url")==origin(d["id"][:8]+"."+PAGES), "deployment identity")
    return d["id"]


def canonical():
    project=cf()
    need(project["name"]==PROJECT and project["production_branch"]=="dev" and project["subdomain"]==PAGES,
         "not exact development project")
    return project["canonical_deployment"]


def old():
    need(identity(canonical(),"dev",BASE)==OLD and identity(cf("/deployments/"+OLD),"dev",BASE)==OLD,
         "active development baseline drift")


def publish(branch,head):
    need(branch in ("dev",PREVIEW),"branch mismatch")
    cli=Path(os.environ["RUNNER_TEMP"])/"tn-cli/node_modules/wrangler/wrangler-dist/cli-tennisnote-single.cjs"
    verify_tree(Path("sealed-app"),policy())
    old()
    # Do not inherit GitHub tokens; fixed target, clean cwd, no wrangler config/env files.
    env={k:v for k,v in os.environ.items() if k in ("PATH","HOME","TMPDIR","CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_API_TOKEN")}
    env["WRANGLER_SEND_METRICS"]="false"
    r=subprocess.run(["node",str(cli),"pages","deploy",str(Path("sealed-app").resolve()),
                     "--project-name="+PROJECT,"--branch="+branch,"--commit-hash="+head,
                     "--commit-message=Coach schedule sealed development checkpoint","--commit-dirty=false"],
                     env=env,cwd=os.environ["RUNNER_TEMP"],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
    urls=set(re.findall(rb"https://([0-9a-f]{8})\.tennisnote-app-dev\.pages\.dev\b",r.stdout))
    need(r.returncode==0 and len(urls)==1,"publish outcome unknown; no repeat; inspect deployments")
    prefix=urls.pop().decode(); environment="production" if branch=="dev" else "preview"
    for i in range(8):
        ds=cf("/deployments?env="+environment+"&per_page=25")
        matches=[d for d in ds if d.get("url")==origin(prefix+"."+PAGES)]
        if len(matches)==1 and matches[0].get("latest_stage",{}).get("status")=="success":
            did=identity(matches[0],branch,head)
            need(did.startswith(prefix) and did!=OLD,"wrong deployment"); print(branch,did,flush=True)
            return did
        if i<7: time.sleep(3)
    raise ValueError("published id not confirmed; no repeat")


def rollback_if_ours(new,head):
    need(identity(cf("/deployments/"+OLD),"dev",BASE)==OLD,"rollback not confirmed")
    need(identity(canonical(),"dev",head)==new,"canonical changed; no rollback")
    cf("/deployments/"+OLD+"/rollback","POST")
    old()
    print("restored exact original development deployment",OLD,flush=True)


def alias_check(new,head):
    m=policy()
    try:
        served(PAGES)
    except DigestMismatch as first:
        need(identity(canonical(),"dev",head)==new,"canonical changed; no rollback")
        time.sleep(6)
        want=m["delta"].get(first.path,m["files"][first.path])
        try:
            public_bytes(PAGES,first.path,want,fresh=True)
        except DigestMismatch as second:
            if first.actual==second.actual and second.actual!=m["files"][second.path]:
                rollback_if_ours(new,head)
                raise ValueError("confirmed persistent unexpected alias content; restored") from None
            raise ValueError("alias propagation or mixed reads; no rollback") from None
        served(PAGES)  # recheck whole alias after propagation, no further writes on uncertainty
    need(identity(canonical(),"dev",head)==new,"alias ownership changed; no rollback")


def go():
    head=context()
    preview=publish(PREVIEW,head)
    served(preview[:8]+"."+PAGES)
    new=publish("dev",head)
    need(identity(canonical(),"dev",head)==new,"unknown canonical; no repeat")
    try:
        served(new[:8]+"."+PAGES)
    except DigestMismatch:
        rollback_if_ours(new,head)
        raise
    alias_check(new,head)
    print("PASS preview",preview,"canonical",new,"previous",OLD,flush=True)


if __name__=="__main__":
    if sys.argv[1:]==["history"]: github_proof()
    elif sys.argv[1:]==["publish"]: go()
    else: raise SystemExit("unknown command")
