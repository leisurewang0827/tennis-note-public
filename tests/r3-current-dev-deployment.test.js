import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import vm from "node:vm";
import path from "node:path";
import crypto from "node:crypto";
const require=createRequire(import.meta.url),guard=require("./helpers/r3-self-coach.cjs");
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n");

test("현재 DEV successor: source/RAM 정·음성 및 old553 보존; 외부 CLI/DB/HTTP0",()=>{
  const c=JSON.parse(read("tests/fixtures/r3-current-dev-deployment.json"));
  const files=Object.fromEntries(c.paths.map(p=>[p,read(p)]));
  for(const row of guard.plan().metadata.files)files[row.path]=guard.metadataForward(row.path,guard.metadataRestore(row.path,files[row.path]));
  const code=String.raw`import ast,contextlib,copy,hashlib,importlib.util,io,json,os,re,socket,ssl,sys,urllib.request
from pathlib import Path
from unittest.mock import patch
v=json.load(sys.stdin);files=v["files"]
s=importlib.util.spec_from_file_location("current_dev_guard","scripts/check_r3_dev_deployment.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
root=m.ROOT;c=json.loads(files["tests/fixtures/r3-current-dev-deployment.json"]);candidate="a"*40
checks=0;groups=[];raw=files["scripts/check_r3_dev_deployment.py"]
def check(ok,code):
 global checks
 if not ok:raise AssertionError(code)
 checks+=1
def denied(call,code):
 try:call()
 except (RuntimeError,ValueError,OSError,KeyError):check(True,code);return
 raise AssertionError(code)
def no_external(*a,**k):raise AssertionError("external_call_forbidden")
legacy=re.sub(r"# CURRENT_SUCCESSOR_BEGIN\n[\s\S]*?# CURRENT_SUCCESSOR_END\n\n\n","",raw)
legacy=re.sub(r"^    # CURRENT_ROUTE_BEGIN\n[\s\S]*?^    # CURRENT_ROUTE_END\n","",legacy,flags=re.M)
legacy=re.sub(r"^            # CURRENT_SOURCE_ROUTE_BEGIN\n[\s\S]*?^            # CURRENT_SOURCE_ROUTE_END\n","",legacy,flags=re.M)
check(hashlib.sha256(legacy.encode()).hexdigest()==c["legacySourceSha256"],"entire_old553_source_inverse")
check(m.EXPECTED_VERSION=="1.0.553" and m.EXPECTED_BRANCH=="codex/tennisnote-r3-prod-promotion-20261021","old_constants_preserved")
old=dict(event_name="workflow_dispatch",ref="refs/heads/"+m.EXPECTED_BRANCH,ref_type="branch",workflow_ref=m.EXPECTED_WORKFLOW_REF,workflow_name=m.EXPECTED_WORKFLOW_NAME,candidate_sha=candidate,github_sha=candidate,head_sha=candidate)
m.validate_dispatch_context(**old);check(True,"old_route_exact_context_positive")
denied(lambda:m.validate_dispatch_context(**{**old,"ref":"refs/heads/"+m.CURRENT_BRANCH}),"old_route_does_not_expand")
groups.append("old553_whole_source_and_security_preserved")
account="a"*32;account_fp=hashlib.sha256(account.encode()).hexdigest();fake_url="https://synthetic-dev.supabase.co"
env={"GITHUB_EVENT_NAME":"workflow_dispatch","GITHUB_REPOSITORY":m.EXPECTED_REPOSITORY,"GITHUB_REF_TYPE":"branch","GITHUB_REF":"refs/heads/"+m.CURRENT_BRANCH,"TENNISNOTE_WORKFLOW_REF":m.EXPECTED_REPOSITORY+"/"+c["workflow"]+"@refs/heads/"+m.CURRENT_BRANCH,"GITHUB_WORKFLOW":m.EXPECTED_WORKFLOW_NAME,"GITHUB_RUN_ATTEMPT":"1","TENNISNOTE_CANDIDATE_SHA":candidate,"GITHUB_SHA":candidate,"TENNISNOTE_ENVIRONMENT":"development","TENNISNOTE_PAYMENTS_ENABLED":"false","TENNISNOTE_PAYMENT_MODE":"disabled","TENNISNOTE_ALLOWED_PAYMENT_METHODS":"","TENNISNOTE_BANK_TRANSFER_ENABLED":"false","TENNISNOTE_SUPABASE_URL":fake_url,"TENNISNOTE_SUPABASE_PUBLISHABLE_KEY":"synthetic-public-key","EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT":account_fp,"CLOUDFLARE_ACCOUNT_ID":account,"CLOUDFLARE_API_TOKEN":"synthetic-not-live"}
real_project_fp=m.project_fingerprint
check(real_project_fp(fake_url)==hashlib.sha256(b"synthetic-dev").hexdigest(),"actual_fingerprint_algorithm_synthetic")
# Real ref is never read/saved. Unit projection is injected; exact configured
# fingerprint equality and all mismatch branches remain real guard predicates.
project_fp=lambda url:m.EXPECTED_DEV_PROJECT_FINGERPRINT if url==fake_url else real_project_fp(url)
state={"paths":c["paths"][:],"dirty":"","tree":c["baseTree"],"ancestor":True}
vfs={(root/p).resolve():text.encode() for p,text in files.items()};git_files=dict(files)
def git(*args):
 if args==("rev-parse","HEAD"):return candidate
 if args==("rev-parse",m.CURRENT_BASE+"^{tree}"):return state["tree"]
 if args==("merge-base","--is-ancestor",m.CURRENT_BASE,candidate):
  if not state["ancestor"]:raise RuntimeError("synthetic_not_descendant")
  return ""
 if args==("status","--porcelain=v1","-uall"):return state["dirty"]
 if args==("diff","--name-only",m.CURRENT_BASE+".."+candidate):return "\n".join(state["paths"])
 raise AssertionError("unknown_git_read")
def blob(ref,name):
 if ref==candidate:return git_files[name].encode()
 for row in c["floors"].values():
  if ref==row["source"]:
   if name=="app/release.json":return json.dumps({"version":row["version"],"releaseId":row["releaseId"]}).encode()
   role="member" if "member" in name else "coach";prefix="tennis-note-member-pwa-" if role=="member" else "tennis-note-coach-mode-"
   return ('const CACHE_NAME = "'+prefix+'v'+str(row[role])+'";\n').encode()
 raise AssertionError("unknown_git_object")
real_bytes=Path.read_bytes;real_text=Path.read_text;real_symlink=Path.is_symlink
def read_bytes(p):return vfs[p.resolve()] if p.resolve() in vfs else real_bytes(p)
def read_text(p,*a,**k):return read_bytes(p).decode("utf-8")
def source():return m.current_source_preflight()
with patch.dict(os.environ,env,clear=True),patch.object(m,"run_git",git),patch.object(m,"current_git_blob",blob),patch.object(m,"project_fingerprint",project_fp),patch.object(Path,"read_bytes",read_bytes),patch.object(Path,"read_text",read_text),patch.object(m.subprocess,"check_output",no_external),patch.object(urllib.request,"urlopen",no_external),patch.object(urllib.request.OpenerDirector,"open",no_external),patch.object(socket,"create_connection",no_external):
 source();check(True,"physical559_exact34_source_positive");groups.append("physical559_source_and_commit_binding")
 for key,value in {"GITHUB_EVENT_NAME":"push","GITHUB_REPOSITORY":"other/repo","GITHUB_REF_TYPE":"tag","GITHUB_REF":"refs/heads/"+m.CURRENT_BRANCH+"-other","TENNISNOTE_WORKFLOW_REF":"wrong/workflow","GITHUB_WORKFLOW":"wrong","GITHUB_RUN_ATTEMPT":"2","TENNISNOTE_CANDIDATE_SHA":"PENDING","GITHUB_SHA":"b"*40,"TENNISNOTE_ENVIRONMENT":"production","TENNISNOTE_PAYMENTS_ENABLED":"true","TENNISNOTE_PAYMENT_MODE":"multi","TENNISNOTE_ALLOWED_PAYMENT_METHODS":"bank_transfer","TENNISNOTE_BANK_TRANSFER_ENABLED":"true","TENNISNOTE_SUPABASE_URL":"https://synthetic-prod.supabase.co","TENNISNOTE_SUPABASE_PUBLISHABLE_KEY":"","EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT":"0"*64,"CLOUDFLARE_ACCOUNT_ID":"b"*32,"CLOUDFLARE_API_TOKEN":""}.items():
  with patch.dict(os.environ,{key:value}):denied(source,"context_"+key)
 groups.append("exact_context_environment_project_account_denials")
 for paths in (c["paths"][:-1],c["paths"]+[c["paths"][0]],c["paths"]+["app/unknown.js"]):
  state["paths"]=paths;denied(source,"unknown_duplicate_missing_source_path")
 state["paths"]=c["paths"][:]
 for field,value in (("dirty"," M unknown"),("tree","0"*40),("ancestor",False)):
  original=state[field];state[field]=value;denied(source,"genuine_base_clean_or_ancestry");state[field]=original
 file="app/admin/actions/billing.js";p=(root/file).resolve();saved=vfs[p];vfs[p]=saved+b" ";denied(source,"unknown_physical_byte");vfs[p]=saved
 old_git=git_files[file];git_files[file]+=" ";denied(source,"commit_and_physical_differ");git_files[file]=old_git
 p=(root/"app/release.json").resolve();saved=vfs[p];value=json.loads(saved);value["version"]="1.0.558";vfs[p]=json.dumps(value).encode();denied(source,"mixed_metadata_stage");vfs[p]=saved
 with patch.object(Path,"is_symlink",lambda p:p.resolve()==(root/file).resolve() or real_symlink(p)):denied(source,"symlink_scope")
 p=m.CURRENT_CONTRACT_PATH.resolve();saved=vfs[p];vfs[p]=saved+b" ";denied(source,"contract_unknown_byte");vfs[p]=saved
 groups.append("source_path_content_metadata_and_real_ancestry_denials")
 browser={"environment":"development","supabaseUrl":fake_url,"projectFingerprint":m.EXPECTED_DEV_PROJECT_FINGERPRINT,"supabasePublishableKey":"synthetic-public-key"}
 payment={"enabled":False,"mode":"disabled","allowedMethods":[],"bankTransfer":{"enabled":False},"channels":{}}
 member=root/"dist/member-dev";admin=root/"dist/admin-dev"
 def config(b=browser,p=payment):return "window.TENNISNOTE_CONFIG = "+json.dumps(b)+";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = "+json.dumps(p)+";\n"
 for q in (member,admin):
  vfs[(q/"release.json").resolve()]=files["app/release.json"].encode();vfs[(q/"shared/config.local.js").resolve()]=config().encode();vfs[(q/"index.html").resolve()]="개발계 · 실제 결제·푸시 차단".encode()
 vfs[(member/"service-worker.js").resolve()]=files["app/tennis-note-member-app/service-worker.js"].encode();vfs[(member/"tennis-note-coach-app/service-worker.js").resolve()]=files["app/tennis-note-coach-app/service-worker.js"].encode()
 m.verify_current_dev_artifacts(c,member,admin);check(True,"artifact559_runtime_positive")
 for change in ({"environment":"production"},{"projectFingerprint":"0"*64},{"supabaseUrl":"https://synthetic-prod.supabase.co"},{"supabasePublishableKey":""}):
  p=(member/"shared/config.local.js").resolve();vfs[p]=config({**browser,**change}).encode();denied(lambda:m.verify_current_dev_artifacts(c,member,admin),"artifact_runtime_project");vfs[p]=config().encode()
 for change in ({"enabled":True},{"mode":"multi"},{"allowedMethods":["bank_transfer"]},{"bankTransfer":{"enabled":True}},{"channels":{"x":"synthetic"}}):
  p=(member/"shared/config.local.js").resolve();vfs[p]=config(browser,{**payment,**change}).encode();denied(lambda:m.verify_current_dev_artifacts(c,member,admin),"artifact_payment_capability");vfs[p]=config().encode()
 p=(admin/"index.html").resolve();saved=vfs[p];vfs[p]=b"empty";denied(lambda:m.verify_current_dev_artifacts(c,member,admin),"missing_banner");vfs[p]=saved
 groups.append("built_runtime_and_payment_off_contract")
 live=[{"release":{"version":"1.0.557","releaseId":"2026.10.26.01"},"member_cache":592,"coach_cache":565} for _ in range(2)]
 with patch.object(m,"read_live_dev_states",lambda _:copy.deepcopy(live)):
  m.verify_current_live_candidate(c,candidate,member,admin);check(True,"live_floor_positive")
  for change in ({"release":{"version":"1.0.560","releaseId":"2026.10.27.01"}},{"release":{"version":"1.0.559","releaseId":"2026.10.28.01"}},{"member_cache":594},{"coach_cache":567},{"release":{"version":"1.0.559","releaseId":"2026.10.27.01"}}):
   previous=copy.deepcopy(live[0]);live[0].update(change);denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin),"live_floor_or_partial_redeploy");live[0]=previous
 groups.append("live_monotonic_and_partial_redeploy_denials")
 calls=[];bad_project={};bad_rollback={}
 def cloudflare(account_id,token,path):
  calls.append(path);name=path.split("/")[2];domain=m.EXPECTED_PROJECT_DOMAINS[name]
  if "/deployments?" not in path:return {"result":{**dict(name=name,production_branch="dev",subdomain=domain,domains=[domain]),**bad_project}}
  return {"result":[{**dict(id="00000000-0000-4000-8000-000000000001",environment="production",deployment_trigger={"metadata":{"branch":"dev","commit_hash":c["floors"]["development"]["source"]}},latest_stage={"status":"success"},url="https://"+domain,created_on="2099-01-01"),**bad_rollback}]}
 with patch.object(m,"cloudflare_get",cloudflare):
  proof=m.verify_current_live_target(c,account_fp,account,"synthetic-not-live");check(len(proof)==64 and len(calls)==4,"exact_projects_rollback_positive")
  before=len(calls);denied(lambda:m.verify_current_live_target(c,"0"*64,account,"synthetic-not-live"),"wrong_account_before_network");check(len(calls)==before,"wrong_account_no_requests")
  for change in ({"name":"tennisnote-app"},{"production_branch":"main"},{"subdomain":"wrong"},{"domains":["tennisnote-app.pages.dev"]}):
   bad_project.update(change);denied(lambda:m.verify_current_live_target(c,account_fp,account,"synthetic-not-live"),"wrong_project_domain");bad_project.clear()
  for change in ({"latest_stage":{"status":"failure"}},{"deployment_trigger":{"metadata":{"branch":"main","commit_hash":candidate}}},{"url":"http://wrong.invalid"},{"deployment_trigger":{"metadata":{"branch":"dev","commit_hash":"b"*40}}}):
   bad_rollback.update(change);denied(lambda:m.verify_current_live_target(c,account_fp,account,"synthetic-not-live"),"wrong_rollback");bad_rollback.clear()
 groups.append("account_projects_and_exact_prior_dev_rollback")
 with patch.object(sys,"argv",["guard","--source-only"]),contextlib.redirect_stdout(io.StringIO()):check(m.main()==0,"actual_source_only_entry")
 # Fixed dist paths remain virtual. Exercise the real preflight entry without
 # starting a builder, network transport, provider CLI or deployment.
 with patch.object(m,"read_live_dev_states",lambda _:copy.deepcopy(live)),patch.object(m,"cloudflare_get",cloudflare),patch.object(sys,"argv",["guard","--live-preflight"]),contextlib.redirect_stdout(io.StringIO()):check(m.main()==0,"actual_live_entry_selects_current_route")
 groups.append("actual_entry_dispatch_no_external")
 tls_calls=[]
 def tls(*a,**k):tls_calls.append(True);raise ssl.SSLCertVerificationError("synthetic certificate rejection")
 with patch.object(m._LIVE_READ_OPENER,"open",tls),patch.object(m.time,"sleep",no_external):denied(lambda:m._http_read("member_release",candidate),"tls_failure_no_retry")
 check(len(tls_calls)==1,"tls_one_attempt");groups.append("existing_tls_no_retry_preserved")
print(json.dumps({"status":"PASS","checks":checks,"groups":groups,"actualGitCli":0,"actualHttpDb":0,"buildDeploy":0,"fixtureGate":0,"syntheticCandidateOnly":True}))`;
  const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
  const result=JSON.parse(execFileSync(python,["-B","-X","utf8","-c",code],{input:JSON.stringify({files}),encoding:"utf8",maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]}));
  assert.equal(result.status,"PASS");assert.equal(result.groups.length,9);assert.ok(result.checks>=60);assert.equal(result.actualGitCli,0);assert.equal(result.actualHttpDb,0);
});

test("새 DEV guard 직접 연결: physical558/559 + exact guard10, 실제 Git 실행0",()=>{
  const plan=guard.plan(),root=process.cwd(),base=new Map(),original={};
  const digest=s=>crypto.createHash("sha256").update(s.replace(/\r\n/g,"\n")).digest("hex");
  for(const row of [...plan.files,plan.tool]){
    let text=guard.metadataRestore(row.path,read(row.path));
    assert.equal(digest(text),row.afterSha256);
    for(const h of [...row.hunks].reverse()){
      assert.equal(text.split(h.after).length,2);text=text.replace(h.after,h.before);
    }
    assert.equal(digest(text),row.beforeSha256);base.set(row.path,text);
  }
  for(const row of plan.metadata.files)original[row.path]=guard.metadataRestore(row.path,read(row.path));
  const proposed=Object.fromEntries(plan.metadata.files.map(row=>[row.path,guard.metadataForward(row.path,original[row.path])]));
  let actualGitAttempts=0;
  function loaded(overlay){
    const filename=path.join(root,"tests/helpers/r3-self-coach.cjs"),module={exports:{}};
    const fakeFs={...fs,readFileSync(p,...args){const rel=path.relative(root,String(p)).split(path.sep).join("/");return Object.hasOwn(overlay,rel)?overlay[rel]:fs.readFileSync(p,...args);}};
    const customRequire=name=>name==="node:fs"?fakeFs:name==="node:child_process"?{execFileSync(command,args){
      assert.equal(command,"git");assert.equal(args.length,2);assert.equal(args[0],"show");
      const prefix=plan.base+":";assert.ok(args[1].startsWith(prefix));const rel=args[1].slice(prefix.length);
      if(!base.has(rel)){actualGitAttempts++;throw Error("unapproved_git_projection");}return base.get(rel);
    }}:require(name);
    vm.runInNewContext(`(function(require,module,exports,__dirname){${read("tests/helpers/r3-self-coach.cjs")}\n})`,{})(customRequire,module,module.exports,path.dirname(filename));
    return module.exports;
  }
  assert.equal(Object.keys(plan.guardHashes).length,10);
  for(const physical of [original,proposed]){
    loaded(physical).verifyCurrent();
    for(const file of ["scripts/check_r3_dev_deployment.py","tests/fixtures/r3-current-dev-deployment.json","tests/r3-current-dev-deployment.test.js"])
      assert.throws(()=>loaded({...physical,[file]:read(file)+"\n"}).verifyCurrent(),/self_coach_guard_drift/);
  }
  assert.equal(actualGitAttempts,0);
});
