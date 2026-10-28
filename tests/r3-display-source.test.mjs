import {execFileSync} from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import * as a from "../scripts/check_r3_display_source_admission.mjs";

// 실제 검토된 파일 bytes + 가상 Git graph. ref/index/object write와 이전 업무검사 실행은 없다.
const id=n=>n.toString(16).padStart(40,"0");
const baseline=new Map();
const baseRead=p=>{if(!baseline.has(p))baseline.set(p,a.IO.blob(a.BASE,p));return baseline.get(p);};
let frozenCorrection;
function correctionParent() {
 return frozenCorrection??=Object.fromEntries([...a.PATHS,...a.METADATA].map(p=>[p,a.IO.blob(a.CORRECTION_BASE,p)]));
}
function fixture(version=a.BASE_VERSION) {
 const nodes=new Map();
 const contents=Object.fromEntries(a.PATHS.map(p=>[p,a.read(p)]));
 for(const p of a.METADATA) contents[p]=baseRead(p);
 const profiles={
  "1.0.562":a.profileFor(a.CORRECTION_BASE,a.IO),
  "1.0.563":{version:"1.0.563",appSurfaceVersion:"1.0.563",releaseId:"2026.10.28.02",deployedAt:"2026-10-28T12:01:00+09:00",memberCache:"tennis-note-member-pwa-v596",coachCache:"tennis-note-coach-mode-v569"}
 };
 function add(n,parents,v=a.BASE_VERSION,source=contents){
  const c={...source};
  if(v!==a.BASE_VERSION) for(const p of a.METADATA)c[p]=a.expectedMetadata(p,baseRead(p),profiles[v]);
  nodes.set(id(n),{parents,c,v});return id(n);
 }
 const feature=add(1,[a.BASE]);
 let head=feature;
 if(version!==a.BASE_VERSION){head=add(2,[a.CORRECTION_BASE],"1.0.562");if(version==="1.0.563")head=add(3,[head],"1.0.563");}
 const source=ref=>ref===a.CORRECTION_BASE?correctionParent():nodes.get(ref).c;
 const io={
  tree:ref=>ref===a.CORRECTION_BASE?a.CORRECTION_BASE_TREE:ref===a.BASE?a.BASE_TREE:Object.values(a.TARGETS).find(v=>v[0]===ref)?.[1]||
     a.hash(JSON.stringify(nodes.get(ref).c)),
  parents:ref=>nodes.get(ref).parents,
  blob:(ref,p)=>ref===a.BASE?baseRead(p):source(ref)[p],
  mode:()=> "100644",
  changes:ref=>[...a.PATHS,...(nodes.get(ref).v===a.BASE_VERSION?[]:a.METADATA),...(nodes.get(ref).extra||[])]
     .map(p=>[a.NEW_PATHS.includes(p)?"A":"M",p]),
  delta:(base,ref)=>{
    const before=source(base),after=source(ref);
    return [...new Set([...Object.keys(before),...Object.keys(after),...(nodes.get(ref).extra||[])])]
      .filter(p=>before[p]!==after[p] || nodes.get(ref).extra?.includes(p))
      .map(p=>[!(p in after)?"D":!(p in before)?"A":"M",p]);
  }
 };
 const target=version==="1.0.563"?"dev":"main";
 const c={repo:a.REPOSITORY,headRepo:a.REPOSITORY,attempt:"1",event:"pull_request",
   target,base:a.TARGETS[target][0],head,checkout:head,workflow:a.WORKFLOW_NAMES[0],ref:"refs/pull/1/merge"};
 return {io,nodes,head,feature,c,add,profiles};
}
const isPublic=a.BASE_VERSION!=="display";
const released=()=>fixture(isPublic?"1.0.562":a.BASE_VERSION);
function manualFixture() {
 const f=fixture("1.0.563");
 const env={GITHUB_REPOSITORY:a.REPOSITORY,GITHUB_RUN_ATTEMPT:"1",GITHUB_EVENT_NAME:"workflow_dispatch",
   GITHUB_WORKFLOW:a.WORKFLOW_NAMES[1],GITHUB_SHA:f.head,GITHUB_REF:a.DEV_CANDIDATE_REF,GITHUB_REF_TYPE:"branch",
   TENNISNOTE_CANDIDATE_SHA:f.head,GITHUB_WORKFLOW_REF:a.DEV_WORKFLOW_REF,TENNISNOTE_WORKFLOW_REF:a.DEV_WORKFLOW_REF};
 const event={inputs:{candidate_sha:f.head}};
 return {...f,env,event,c:a.eventContext(env,event,f.head)};
}
test("01 exact reviewed source and old whole-tree exclusion",()=>{
 const f=fixture();assert.equal(a.proveFeature(f.head,f.io).newDatabaseRuns,0);
 assert.equal(a.PATHS.length,9);
 assert.equal(a.hash(a.read(a.UI)),a.PINS[a.UI]);
});
test("02 PR actual head and synthetic merge preserve exact payload",()=>{
 const f=released();assert.equal(a.proveEvent(f.c,f.io).displayOnly,true);
 const merge=f.add(4,[f.c.base,f.head],f.nodes.get(f.head).v,f.nodes.get(f.head).c);
 assert.equal(a.proveEvent({...f.c,checkout:merge},f.io).tree,f.io.tree(f.head));
});
test("03 main squash and normal merge both admit same reviewed bytes",()=>{
 const f=released(),v=f.nodes.get(f.head).v;
 for(const parents of [[f.c.base],[f.c.base,f.head]]){
  const head=f.add(parents.length+5,parents,v,f.nodes.get(f.head).c);
  assert.equal(a.proveEvent({...f.c,event:"push",head,checkout:head,ref:"refs/heads/main"},f.io).tree,f.io.tree(f.head));
 }
});
test("04 fork drift workflow rerun and manual dispatch reject",()=>{
 const f=released();
 for(const change of [{headRepo:"other/repo"},{base:id(99)},{attempt:"2"},{workflow:"unknown"},{event:"workflow_dispatch"},{repo:"other/repo"}])
  assert.throws(()=>a.proveEvent({...f.c,...change},f.io));
});
test("05 every pinned product guard test and source rejects one-byte drift",()=>{
 const f=fixture();
 for(const p of [...Object.keys(a.PINS),a.SELF,a.TEST]){
  const old=f.nodes.get(f.head).c[p];f.nodes.get(f.head).c[p]=old+"\n// drift";
  assert.throws(()=>a.proveTree(f.head,f.io));f.nodes.get(f.head).c[p]=old;
 }
});
test("06 unreviewed SQL math role and missing path are HOLD without reading them",()=>{
 for(const path of ["supabase/unreviewed.sql","app/unreviewed-math.js","app/unreviewed-role.js"]){
  const f=fixture();f.nodes.get(f.head).extra=[path];
  assert.throws(()=>a.proveTree(f.head,f.io),/EXACT_SCOPE/);
 }
 const f=fixture(),old=f.io.changes;f.io.changes=r=>old(r).slice(1);
 assert.throws(()=>a.proveTree(f.head,f.io),/EXACT_SCOPE/);
});
test("07 symlink and changed base tree reject",()=>{
 const f=fixture();
 assert.throws(()=>a.proveTree(f.head,{...f.io,mode:()=>"120000"}),/REGULAR/);
 assert.throws(()=>a.proveTree(f.head,{...f.io,tree:r=>r===a.BASE?"changed":f.io.tree(r)}),/BASE_TREE/);
});
test("08 merge extra payload and parent drift reject",()=>{
 const f=released(),m=f.add(9,[f.c.base,f.head],f.nodes.get(f.head).v,f.nodes.get(f.head).c);
 f.nodes.get(m).c[a.UI]+="\n";
 assert.throws(()=>a.proveEvent({...f.c,checkout:m},f.io),/PR_MERGE_TREE/);
 f.nodes.get(f.head).parents=[id(98)];
 assert.throws(()=>a.proveFeature(f.head,f.io));
});
test("09 collectors use the new path and preserve untouched workflow bytes",()=>{
 for(const p of a.WORKFLOWS)assert.equal(a.read(p),a.expectedWorkflow(p,a.IO.blob(a.BASE,p)));
 const ci=a.read(".github/workflows/tennisnote-public-ci.yml");
 assert.equal(ci.split("run: node --test "+a.TEST).length-1,1);
 assert.equal(ci.split("if: steps.display.outputs.scoped != 'true'").length-1,2);
 assert.equal(ci.split('"scripts/check_r3_display*"').length-1,2);
 const dev=a.read(".github/workflows/deploy-cloudflare-pages-dev.yml");
 assert.match(dev,/python scripts\/check_r3_display_dev_deployment\.py/);
 assert.match(dev,/python scripts\/check_r3_dev_deployment\.py --source-only/);
 assert.match(dev,/python scripts\/check_r3_dev_deployment\.py --live-preflight/);
});

test("10 DEV563 chain and dev squash; lower PROD562 remains identical product",()=>{
 const f=fixture("1.0.563");
 const before=a.proveEvent(f.c,f.io);
 const m=f.add(10,[f.c.base],"1.0.563",f.nodes.get(f.head).c);
 assert.equal(a.proveEvent({...f.c,event:"push",head:m,checkout:m,ref:"refs/heads/dev"},f.io).tree,before.tree);
 assert.equal(f.nodes.get(f.head).c[a.UI],f.nodes.get(id(2)).c[a.UI]);
 const lower=fixture("1.0.562");
 assert.throws(()=>a.proveEvent({...lower.c,target:"dev",base:a.TARGETS.dev[0]},lower.io),/PR_RELEASE/);
});
test("11 metadata drift native fields and cache mismatch reject",()=>{
 for(const [p,change] of [
  ["app/release.json",s=>s.replace('"version": "1.0.562"','"version": "1.0.564"')],
  ["app/shared/tennisnote-release.js",s=>s+"\n// unexpected native policy"],
  ["app/tennis-note-coach-app/service-worker.js",s=>s.replace("v568","v999")],
  ["app/tennis-note-member-app/app.js",s=>s+"\n// unexpected product change"]]){
  const f=released();f.nodes.get(f.head).c[p]=change(f.nodes.get(f.head).c[p]);
  assert.throws(()=>a.proveTree(f.head,f.io));
 }
});
test("12 planned release templates equal existing bump tool in memory; zero files applied",()=>{
 const f=released(),expected={};
 const before=Object.fromEntries(a.METADATA.map(name=>[name,a.hash(readFileSync(resolve(a.ROOT,name)))]));
 assert.notEqual(JSON.parse(a.read("app/release.json")).version,a.BASE_VERSION,"released checkout required");
 for(const [version,p] of Object.entries(f.profiles)){
  expected[version]=Object.fromEntries(a.METADATA.map(name=>[name,a.expectedMetadata(name,a.IO.blob(a.BASE,name),p)]));
 }
 const script=[
 "import json,sys,subprocess; from pathlib import Path; from unittest.mock import patch",
 "sys.path.insert(0,'scripts'); import bump_release as b",
 "payload=json.load(sys.stdin); expected=payload['expected']; base=payload['base']",
 "names=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'--','app'],text=True,encoding='utf-8').splitlines()",
 "names=[n for n in names if Path(n).suffix in {'.html','.js'} or n=='app/release.json']",
 "assert names and all(n.startswith('app/') and '..' not in Path(n).parts for n in names)",
 "batch=subprocess.check_output(['git','cat-file','--batch'],input=''.join(base+':'+n+'\\n' for n in names).encode('utf-8')); offset=0; frozen={}",
 "for name in names:",
 " end=batch.index(b'\\n',offset); header=batch[offset:end].split(); assert len(header)==3 and header[1]==b'blob'",
 " size=int(header[2]); start=end+1; frozen[b.ROOT/name]=batch[start:start+size].decode('utf-8').replace('\\r\\n','\\n'); offset=start+size; assert batch[offset:offset+1]==b'\\n'; offset+=1",
 "assert offset==len(batch) and json.loads(frozen[b.RELEASE_JSON])['version']=='1.0.561'",
 "def prohibit_io(event,args):",
 " if event=='open' or event.startswith(('socket.','subprocess.')) or event in {'os.remove','os.rename','os.mkdir','os.rmdir'}: raise AssertionError('PLANNER_IO_FORBIDDEN')",
 "sys.addaudithook(prohibit_io)",
 "for version, files in expected.items():",
 " p=json.loads(files['app/release.json']); plans={}; direct=[]; callbacks=[]",
 " def frozen_read(path,*args,**kwargs):",
 "  assert path in frozen and not args and kwargs=={'encoding':'utf-8'},'UNFROZEN_READ'; direct.append(path); return frozen[path]",
 " def frozen_glob(path,pattern,*args,**kwargs):",
 "  assert path==b.APP and pattern in {'*','*.js'} and not args and not kwargs,'UNFROZEN_ENUMERATION'; return iter(p for p in frozen if pattern=='*' or p.suffix=='.js')",
 " def frozen_is_file(path):",
 "  assert path in frozen,'UNFROZEN_FILE'; return True",
 " def read(path):",
 "  callbacks.append(path); return plans[path] if path in plans else path.read_text(encoding='utf-8')",
 " with patch.object(Path,'read_text',frozen_read),patch.object(Path,'rglob',frozen_glob),patch.object(Path,'is_file',frozen_is_file):",
 "  for path,text,_ in [b.plan_release_json('1.0.561',version,p['releaseId'],p['deployedAt']), b.plan_release_js('1.0.561',version,p['releaseId'],p['deployedAt'])]: plans[path]=text",
 "  for fn in [b.plan_version_queries,b.plan_app_literals]:",
 "   for path,text,_ in fn('1.0.561',version,read): plans[path]=text",
 "  floor=(594,567) if version=='1.0.562' else (595,568)",
 "  for path,text,*_ in b.plan_cache_names(read,*floor): plans[path]=text",
 " assert direct[:2]==[b.RELEASE_JSON,b.RELEASE_JS] and set(callbacks)=={p for p in frozen if p.suffix in {'.html','.js'}}",
 " actual={str(path.relative_to(b.ROOT)).replace(chr(92),'/'):text for path,text in plans.items()}",
 " assert actual==files,'OFFICIAL_BUMP_TEMPLATE_MISMATCH'",
 "print('METADATA_TEMPLATE_PARITY_2_PASS')"
 ].join("\n");
 assert.equal(execFileSync("python",["-X","utf8","-B","-c",script],{
   cwd:a.ROOT,input:JSON.stringify({base:a.BASE,expected}),encoding:"utf8"}).trim(),"METADATA_TEMPLATE_PARITY_2_PASS");
 assert.deepEqual(Object.fromEntries(a.METADATA.map(name=>[name,a.hash(readFileSync(resolve(a.ROOT,name)))])),before);
});
test("13 new DEV collector context and source-build guards precede runtime reads",()=>{
 const script=[
 "import importlib.util; from pathlib import Path",
 "spec=importlib.util.spec_from_file_location('display','scripts/check_r3_display_dev_deployment.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
 "env={'GITHUB_REPOSITORY':'leisurewang0827/tennis-note-public','GITHUB_EVENT_NAME':'push','GITHUB_REF':'refs/heads/dev','GITHUB_RUN_ATTEMPT':'1','GITHUB_WORKFLOW':'Deploy Tennis Note development sites','TENNISNOTE_WORKFLOW_REF':'leisurewang0827/tennis-note-public/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/dev','TENNISNOTE_ENVIRONMENT':'development','TENNISNOTE_PAYMENTS_ENABLED':'false','TENNISNOTE_PAYMENT_MODE':'disabled','TENNISNOTE_ALLOWED_PAYMENT_METHODS':'','TENNISNOTE_BANK_TRANSFER_ENABLED':'false','GITHUB_SHA':'a'*40}",
 "proof={'contract':'r3-reviewed-display-source/1','event':'push','version':'1.0.563','head':'a'*40,'release':{'version':'1.0.563'}}",
 "calls=[]",
 "class Guard:",
 " def verify_current_live_candidate(self,*args): calls.append('runtime')",
 " def verify_current_live_target(self,c,*args): assert c['floors']['development']['source']=='007ec7a58d2ea123f8a1f6774efeb50e1975590c'; calls.append('rollback'); return 'safe'",
 "ui=Path('app/shared/tennisnote-settlement-adjustment.js').read_bytes()",
 "assert m.preflight(env,proof,Guard(),lambda p:ui)=='safe'; assert calls==['runtime','rollback']; calls.clear()",
 "for k,v in [('GITHUB_RUN_ATTEMPT','2'),('TENNISNOTE_ENVIRONMENT','production'),('GITHUB_REF','refs/heads/main')]:",
 " e=dict(env); e[k]=v",
 " try: m.preflight(e,proof,Guard(),lambda p:(_ for _ in ()).throw(AssertionError('unexpected read'))); raise AssertionError('admitted')",
 " except RuntimeError: pass",
 " assert not calls",
 "try: m.preflight(env,proof,Guard(),lambda p:b'changed'); raise AssertionError('admitted')",
 "except RuntimeError: pass",
 "assert not calls",
 "import sys; sys.path.insert(0,'scripts'); import check_r3_dev_deployment as existing",
 "existing.current_account_ready=lambda *a:None",
 "existing.rollback_proof=lambda *a:{'commit_sha':'b'*40}",
 "def fixed_get(account,token,path):",
 " if 'deployments?' in path: return {'result':[]}",
 " name=path.split('/')[-1]; domain=existing.EXPECTED_PROJECT_DOMAINS[name]",
 " return {'result':{'name':name,'production_branch':'dev','subdomain':domain,'domains':[domain]}}",
 "existing.cloudflare_get=fixed_get",
 "c={'floors':{'development':{'source':'007ec7a58d2ea123f8a1f6774efeb50e1975590c'}}}",
 "try: existing.verify_current_live_target(c,'','',''); raise AssertionError('wrong rollback source admitted')",
 "except RuntimeError as error: assert 'frozen DEV baseline' in str(error)",
 "print('DEV_COLLECTOR_OFFLINE_6_PASS')"
 ].join("\n");
 assert.equal(execFileSync("python",["-X","utf8","-B","-c",script],{cwd:a.ROOT,encoding:"utf8"}).trim(),"DEV_COLLECTOR_OFFLINE_6_PASS");
});

test("14 exact DEV563 QA child admits head and equal synthetic merge; base advance rejects",()=>{
 const f=fixture("1.0.563"),base=id(2);
 const c={...f.c,target:a.PRODUCTION_CANDIDATE_BRANCH,headRef:a.DEV_CANDIDATE_BRANCH,base};
 assert.equal(a.proveEvent(c,f.io).admissionRoute,"qa563-child");
 const merge=f.add(20,[base,f.head],"1.0.563",f.nodes.get(f.head).c);
 assert.equal(a.proveEvent({...c,checkout:merge},f.io).tree,f.io.tree(f.head));
 const advanced=f.add(21,[base],"1.0.562",f.nodes.get(base).c);
 for(const patch of [{base:advanced},{base:f.feature},{headRef:"dev"},{target:"unknown"},
   {headRepo:"other/repo"},{workflow:a.WORKFLOW_NAMES[1]},{attempt:"2"}])
   assert.throws(()=>a.proveEvent({...c,...patch},f.io));
 const wrong=f.add(22,[f.head,base],"1.0.563",f.nodes.get(f.head).c);
 assert.throws(()=>a.proveEvent({...c,checkout:wrong},f.io),/PR_MERGE_TREE/);
 f.nodes.get(merge).c[a.UI]+="\n// unexpected merge content";
 assert.throws(()=>a.proveEvent({...c,checkout:merge},f.io),/PR_MERGE_TREE/);
 assert.throws(()=>a.proveEvent({...c,head:base,checkout:base,base:a.CORRECTION_BASE},f.io),/QA_RELEASE_SEQUENCE/);
 // QA 자식은 main PR/병합 후보가 아니다. 운영562 대상 브랜치를563으로 대체할 수 없다.
 assert.throws(()=>a.proveEvent({...c,target:"main",base:a.TARGETS.main[0]},f.io),/PR_RELEASE_PROFILE/);
 const main=f.add(23,[a.TARGETS.main[0]],"1.0.563",f.nodes.get(f.head).c);
 assert.throws(()=>a.proveEvent({...c,event:"push",target:"main",base:a.TARGETS.main[0],
   head:main,checkout:main,ref:"refs/heads/main"},f.io),/PUSH_RELEASE_PROFILE/);
});

test("15 manual DEV563 binds input environment checkout and workflow identity before source reads",()=>{
 const f=manualFixture(),proof=a.proveEvent(f.c,f.io);
 assert.equal(proof.admissionRoute,"dev563-manual");
 assert.equal(proof.checkout,f.head);assert.equal(proof.version,"1.0.563");
 for(const patch of [
   {repo:"other/repo"},{attempt:"2"},{workflow:a.WORKFLOW_NAMES[0]},
   {ref:"refs/heads/dev"},{ref:"refs/heads/main"},{refType:"tag"},{target:a.PRODUCTION_CANDIDATE_BRANCH},
   {checkout:id(90)},{githubSha:id(90)},{candidateInput:id(90)},{candidateSha:id(90)},
   {candidateInput:undefined},{candidateSha:undefined},{workflowRef:a.DEV_WORKFLOW_REF+"-drift"},
   {declaredWorkflowRef:a.DEV_WORKFLOW_REF+"-drift"}]) {
   const noReads=new Proxy({}, {get(){throw Error("UNEXPECTED_SOURCE_READ");}});
   assert.throws(()=>a.proveEvent({...f.c,...patch},noReads),/EVENT_IDENTITY|MANUAL_DEV_CONTEXT/);
 }
 const p=id(2);
 assert.throws(()=>a.proveEvent({...f.c,head:p,checkout:p,githubSha:p,candidateInput:p,candidateSha:p},f.io),/MANUAL_DEV563_REQUIRED/);
 f.nodes.get(f.head).parents=[f.feature];
 assert.throws(()=>a.proveEvent(f.c,f.io),/METADATA_SEQUENCE_REQUIRED/);
});

test("16 manual DEV wrapper preserves payments-off source-build and exact007 rollback order offline",()=>{
 const f=manualFixture();
 const env={...f.env,TENNISNOTE_ENVIRONMENT:"development",TENNISNOTE_PAYMENTS_ENABLED:"false",
   TENNISNOTE_PAYMENT_MODE:"disabled",TENNISNOTE_ALLOWED_PAYMENT_METHODS:"",TENNISNOTE_BANK_TRANSFER_ENABLED:"false"};
 const proof={contract:"r3-reviewed-display-source/1",...a.proveEvent(f.c,f.io)};
 const script=String.raw`
import importlib.util, json, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('display','scripts/check_r3_display_dev_deployment.py')
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
env,proof=json.load(sys.stdin)
ui=Path('app/shared/tennisnote-settlement-adjustment.js').read_bytes()
calls=[]
def read(name):
 calls.append(name)
 return ui
class Guard:
 def verify_current_live_candidate(self,c,sha,member,admin):
  assert sha==proof['head'] and c['release']==proof['release']
  assert c['successorBase']=='007ec7a58d2ea123f8a1f6774efeb50e1975590c'
  assert [member.as_posix(),admin.as_posix()]==['dist/member-dev','dist/admin-dev']
  calls.append('runtime/project/payment/release/cache')
 def verify_current_live_target(self,c,*unused):
  assert c['floors']=={'development':{'source':'007ec7a58d2ea123f8a1f6774efeb50e1975590c'}}
  calls.append('target/exact007-rollback'); return 'safe'
assert m.preflight(env,proof,Guard(),read)=='safe'
assert calls==['app/'+m.UI,'dist/member-dev/'+m.UI,'dist/admin-dev/'+m.UI,'runtime/project/payment/release/cache','target/exact007-rollback']
calls.clear()
env_changes=[('GITHUB_REF','refs/heads/dev'),('GITHUB_REF','refs/heads/main'),('GITHUB_REF_TYPE','tag'),
 ('GITHUB_SHA','b'*40),('TENNISNOTE_CANDIDATE_SHA','b'*40),('GITHUB_WORKFLOW_REF','wrong'),
 ('TENNISNOTE_WORKFLOW_REF','wrong'),('GITHUB_RUN_ATTEMPT','2'),('GITHUB_EVENT_NAME','pull_request'),
 ('GITHUB_REPOSITORY','other/repo'),('GITHUB_WORKFLOW','other'),('TENNISNOTE_ENVIRONMENT','production'),
 ('TENNISNOTE_PAYMENTS_ENABLED','true'),('TENNISNOTE_PAYMENT_MODE','multi'),
 ('TENNISNOTE_ALLOWED_PAYMENT_METHODS','card'),('TENNISNOTE_BANK_TRANSFER_ENABLED','true')]
proof_changes=[('admissionRoute','ordinary'),('checkout','b'*40),('ref','refs/heads/dev'),
 ('head','b'*40),('event','push'),('version','1.0.562'),('contract','unknown')]
for kind,changes in [('env',env_changes),('proof',proof_changes)]:
 for k,v in changes:
  e,p=dict(env),dict(proof)
  (e if kind=='env' else p)[k]=v
  try: m.preflight(e,p,Guard(),read); raise AssertionError('admitted')
  except RuntimeError: pass
  assert not calls, 'read before context admission'
for changed in ['app/'+m.UI,'dist/member-dev/'+m.UI,'dist/admin-dev/'+m.UI]:
 try: m.preflight(env,proof,Guard(),lambda name:b'changed' if name==changed else ui); raise AssertionError('admitted')
 except RuntimeError: pass
 assert not calls
class RuntimeMismatch(Guard):
 def verify_current_live_candidate(self,*unused): raise RuntimeError('runtime fingerprint mismatch')
try: m.preflight(env,proof,RuntimeMismatch(),lambda name:ui); raise AssertionError('admitted')
except RuntimeError: pass
assert not calls, 'target lookup after rejected runtime'
print('MANUAL_DEV_OFFLINE_28_PASS')
`;
 assert.equal(execFileSync("python",["-X","utf8","-B","-c",script],{
   cwd:a.ROOT,input:JSON.stringify([env,proof]),encoding:"utf8"}).trim(),"MANUAL_DEV_OFFLINE_28_PASS");
});

test("17 workflow exact-child routing preserves old refs fixed projects permissions and collection",()=>{
 const dev=a.read(a.WORKFLOWS[1]),before=a.IO.blob(a.BASE,a.WORKFLOWS[1]);
 assert.equal(dev,a.expectedWorkflow(a.WORKFLOWS[1],before));
 const exact="github.event_name == 'workflow_dispatch' && github.ref == '"+a.DEV_CANDIDATE_REF+"'";
 const historical="github.event_name == 'workflow_dispatch' && github.ref != '"+a.DEV_CANDIDATE_REF+"'";
 assert.equal(dev.split("if: "+historical).length-1,2);
 assert.equal(dev.split("run: node "+a.SELF+" --dev-source").length-1,1);
 assert.ok(dev.indexOf("if: "+exact)<dev.indexOf("- name: Build isolated development sites"));
 assert.ok(dev.includes("if: github.event_name == 'push' || ("+exact+")"));
 assert.ok(dev.indexOf("run: python "+a.DEV_GUARD)<dev.indexOf("- name: Deploy member development PWA"));
 const boundary=s=>s.slice(0,s.indexOf("    steps:"));
 assert.equal(boundary(dev),boundary(before));
 const deploy=s=>s.slice(s.indexOf("      - name: Deploy member development PWA"));
 assert.equal(deploy(dev),deploy(before));
 assert.match(deploy(dev),/--project-name=tennisnote-app-dev --branch=dev/);
 assert.match(deploy(dev),/--project-name=tennisnote-admin-dev --branch=dev/);
 assert.equal(a.read(a.WORKFLOWS[0]),a.expectedWorkflow(a.WORKFLOWS[0],a.IO.blob(a.BASE,a.WORKFLOWS[0])));
 assert.match(a.read(a.WORKFLOWS[0]),/pull_request:\n    paths:/);
});

test("18 hosted event mapper binds actual QA and manual fields; changed source remains sealed",()=>{
 const f=manualFixture();
 assert.equal(a.proveEvent(a.eventContext(f.env,f.event,f.head),f.io).admissionRoute,"dev563-manual");
 const merge=f.add(30,[id(2),f.head],"1.0.563",f.nodes.get(f.head).c);
 const env={...f.env,GITHUB_EVENT_NAME:"pull_request",GITHUB_WORKFLOW:a.WORKFLOW_NAMES[0],
   GITHUB_SHA:merge,GITHUB_REF:"refs/pull/999/merge"};
 const event={pull_request:{head:{sha:f.head,ref:a.DEV_CANDIDATE_BRANCH,repo:{full_name:a.REPOSITORY}},
   base:{ref:a.PRODUCTION_CANDIDATE_BRANCH,sha:id(2)}}};
 assert.equal(a.proveEvent(a.eventContext(env,event,merge),f.io).tree,f.io.tree(f.head));
 for(const field of ["candidate_sha"]){
   assert.throws(()=>a.proveEvent(a.eventContext(f.env,{inputs:{[field]:id(90)}},f.head),f.io),/MANUAL_DEV_CONTEXT/);
 }
 for(const p of [a.SELF,a.TEST,a.DEV_GUARD,a.WORKFLOWS[1]]) {
   const node=f.nodes.get(f.head),original=node.c[p];node.c[p]=original+"\n// one-byte drift";
   assert.throws(()=>a.proveEvent(f.c,f.io),/ADMISSION_SOURCE_CHANGED|ADMISSION_TEST_CHANGED|REVIEWED_SOURCE_CHANGED|WORKFLOW_CHANGED/);
   node.c[p]=original;
 }
});

test("19 correction C exact2 and D metadata-only13 use frozen P without repinning old seals",()=>{
 const f=fixture("1.0.563"),c=id(2),blob=f.io.blob,oldSealReads=[];
 f.io.blob=(ref,name)=>{
   if(ref===a.CORRECTION_BASE && a.CORRECTION_PATHS.includes(name)){
     oldSealReads.push(name);throw Error("HISTORICAL_SEAL_RECHECK_FORBIDDEN");
   }
   return blob(ref,name);
 };
 assert.equal(a.proveFeature(c,f.io).sourceRoute,"correction562");
 assert.equal(a.proveFeature(f.head,f.io).sourceRoute,"dev563-metadata-child");
 assert.deepEqual(f.io.delta(a.CORRECTION_BASE,c).map(r=>r[1]).sort(),a.CORRECTION_PATHS);
 assert.deepEqual(f.io.delta(c,f.head).map(r=>r[1]).sort(),a.METADATA);
 assert.deepEqual(oldSealReads,[]);
 for(const name of a.METADATA)assert.equal(f.nodes.get(c).c[name],correctionParent()[name]);
 for(const name of a.PATHS)assert.equal(f.nodes.get(c).c[name],f.nodes.get(f.head).c[name]);
 for(const name of a.CORRECTION_PATHS)assert.notEqual(f.nodes.get(c).c[name],correctionParent()[name]);
 assert.equal(a.IO.tree(a.CORRECTION_BASE),a.CORRECTION_BASE_TREE);
 assert.equal(a.hash(f.nodes.get(f.head).c[a.UI]),a.PINS[a.UI]);
});

test("20 correction C main562 and exact D QA manual source routing pass in memory",()=>{
 const f=manualFixture(),c=id(2);
 const main={...f.c,event:"pull_request",workflow:a.WORKFLOW_NAMES[0],headRepo:a.REPOSITORY,
   target:"main",base:a.TARGETS.main[0],head:c,checkout:c};
 assert.equal(a.proveEvent(main,f.io).version,"1.0.562");
 const qa={...main,head:f.head,checkout:f.head,target:a.PRODUCTION_CANDIDATE_BRANCH,
   base:c,headRef:a.DEV_CANDIDATE_BRANCH};
 assert.equal(a.proveEvent(qa,f.io).admissionRoute,"qa563-child");
 const merge=f.add(31,[c,f.head],"1.0.563",f.nodes.get(f.head).c);
 assert.equal(a.proveEvent({...qa,checkout:merge},f.io).tree,f.io.tree(f.head));
 assert.equal(a.proveEvent(f.c,f.io).admissionRoute,"dev563-manual");
 assert.equal(a.proveEvent(f.c,f.io).correction,c);
});

test("21 correction wrong P tree parent and duplicate parent all reject",()=>{
 const f=released();
 assert.throws(()=>a.proveFeature(f.head,{...f.io,tree:r=>r===a.CORRECTION_BASE?"changed":f.io.tree(r)}),/CORRECTION_BASE_TREE_DRIFT/);
 for(const parents of [[a.BASE],[f.feature],[id(91)],[a.CORRECTION_BASE,a.CORRECTION_BASE]]){
   f.nodes.get(f.head).parents=parents;
   assert.throws(()=>a.proveFeature(f.head,f.io),/CORRECTION_DIRECT_PARENT_REQUIRED|FEATURE_SINGLE_PARENT_REQUIRED/);
 }
});

test("22 correction extra missing renamed nonregular path rejects before unknown body read",()=>{
 for(const name of ["supabase/not-owned.sql","app/not-owned.js","tests/not-owned.test.js"]){
   const f=released(),blob=f.io.blob;f.nodes.get(f.head).extra=[name];
   f.io.blob=(r,p)=>{assert.notEqual(p,name,"unknown file body was read");return blob(r,p);};
   assert.throws(()=>a.proveFeature(f.head,f.io),/EXACT_SCOPE_REQUIRED/);
 }
 const f=released(),delta=f.io.delta;
 for(const change of [rows=>rows.slice(1),rows=>[...rows,["M","app/not-owned.js"]],
   rows=>rows.map((r,i)=>i===0?["A",r[1]]:r),rows=>rows.map((r,i)=>i===0?["D",r[1]]:r),
   rows=>rows.map((r,i)=>i===0?["R100",r[1],"renamed"]:r)]){
   assert.throws(()=>a.proveFeature(f.head,{...f.io,delta:(b,r)=>change(delta(b,r))}),/EXACT_CHILD_SCOPE_REQUIRED|CHILD_FILE_KIND_CHANGED/);
 }
 assert.throws(()=>a.proveFeature(f.head,{...f.io,mode:()=>"120000"}),/REGULAR_FILE_REQUIRED/);
});

test("23 correction metadata drift and one-byte source native cache drift reject",()=>{
 const f=released(),node=f.nodes.get(f.head);
 const p={...f.profiles["1.0.562"],deployedAt:"2026-10-28T12:10:00+09:00"};
 for(const name of a.METADATA)node.c[name]=a.expectedMetadata(name,baseRead(name),p);
 assert.throws(()=>a.proveFeature(f.head,f.io),/EXACT_CHILD_SCOPE_REQUIRED|CORRECTION_METADATA_CHANGED/);
 for(const version of ["1.0.562","1.0.563"]){
   const x=fixture(version),n=x.nodes.get(x.head);
   for(const name of [...a.CORRECTION_PATHS,a.UI,"app/shared/tennisnote-release.js",
     "app/tennis-note-member-app/service-worker.js","app/release.json"]){
     const original=n.c[name];n.c[name]=original+" ";
     assert.throws(()=>a.proveFeature(x.head,x.io),/ADMISSION_SOURCE_CHANGED|ADMISSION_TEST_CHANGED|REVIEWED_SOURCE_CHANGED|METADATA_ONLY_REQUIRED/);
     n.c[name]=original;
   }
 }
});

test("24 direct combined D arbitrary correction chains and extra D source changes reject",()=>{
 const f=fixture("1.0.563"),c=id(2);
 f.nodes.get(f.head).parents=[a.CORRECTION_BASE];
 assert.throws(()=>a.proveFeature(f.head,f.io),/DEV_CORRECTION_PARENT_REQUIRED/);
 const extraC=f.add(40,[c],"1.0.562",f.nodes.get(c).c);
 assert.throws(()=>a.proveFeature(extraC,f.io),/CORRECTION_DIRECT_PARENT_REQUIRED/);
 f.nodes.get(f.head).parents=[extraC];
 assert.throws(()=>a.proveFeature(f.head,f.io),/CORRECTION_DIRECT_PARENT_REQUIRED/);
 f.nodes.get(f.head).parents=[c];
 const extraD=f.add(41,[f.head],"1.0.563",f.nodes.get(f.head).c);
 assert.throws(()=>a.proveFeature(extraD,f.io),/METADATA_SEQUENCE_REQUIRED/);
 const delta=f.io.delta;
 assert.throws(()=>a.proveFeature(f.head,{...f.io,delta:(b,r)=>r===f.head?[...delta(b,r),["M",a.TEST]]:delta(b,r)}),/EXACT_CHILD_SCOPE_REQUIRED/);
});

test("25 correction event negatives reject QA drift manual mismatch and all563 main routes",()=>{
 const f=manualFixture(),c=id(2);
 const qa={...f.c,event:"pull_request",workflow:a.WORKFLOW_NAMES[0],headRepo:a.REPOSITORY,
   target:a.PRODUCTION_CANDIDATE_BRANCH,headRef:a.DEV_CANDIDATE_BRANCH,base:c};
 for(const patch of [{base:a.CORRECTION_BASE},{headRef:"dev"},{attempt:"2"},{workflow:a.WORKFLOW_NAMES[1]}])
   assert.throws(()=>a.proveEvent({...qa,...patch},f.io));
 for(const patch of [{candidateInput:id(90)},{candidateSha:id(90)},{checkout:id(90)},
   {githubSha:id(90)},{ref:"refs/heads/dev"},{refType:"tag"},{workflowRef:a.DEV_WORKFLOW_REF+"-bad"},
   {declaredWorkflowRef:a.DEV_WORKFLOW_REF+"-bad"},{attempt:"2"}]){
   const noReads=new Proxy({}, {get(){throw Error("UNEXPECTED_SOURCE_READ");}});
   assert.throws(()=>a.proveEvent({...f.c,...patch},noReads),/EVENT_IDENTITY|MANUAL_DEV_CONTEXT/);
 }
 assert.throws(()=>a.proveEvent({...qa,target:"main",base:a.TARGETS.main[0]},f.io),/PR_RELEASE_PROFILE/);
 const main=f.add(42,[a.TARGETS.main[0]],"1.0.563",f.nodes.get(f.head).c);
 assert.throws(()=>a.proveEvent({...qa,event:"push",target:"main",base:a.TARGETS.main[0],
   head:main,checkout:main,ref:"refs/heads/main"},f.io),/PUSH_RELEASE_PROFILE/);
});
