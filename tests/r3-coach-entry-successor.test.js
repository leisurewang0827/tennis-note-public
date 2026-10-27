import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import vm from "node:vm";
const require=createRequire(import.meta.url),s=require("./helpers/r3-coach-entry-successor.cjs");
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n"),hash=x=>createHash("sha256").update(x).digest("hex");
const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
const py=(code,input)=>JSON.parse(execFileSync(python,["-B","-X","utf8","-c",code],{input:JSON.stringify(input),encoding:"utf8",maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]}));

test("561 새 층: 실제559 원본 전체bytes·metadata13·호출1·기존inverse 연결·한byte 거부",()=>{
  const c=s.verifyCurrent(),old=require("./helpers/r3-self-coach.cjs");
  assert.equal(c.files.filter(r=>r.kind==="metadata").length,13);
  assert.equal(c.files.filter(r=>r.kind==="product").length,1);
  for(const row of c.files){
    const actual=read(row.path),before=s.restore(row.path,actual);
    assert.equal(hash(before),row.beforeSha256);assert.equal(s.transform(row,before,true),actual);
    assert.throws(()=>s.restore(row.path,actual+" "),/source_bytes/);
  }
  const p="app/tennis-note-coach-app/views/settlement.js",before=s.restore(p,read(p));
  assert.equal(read(p),before.replace("  renderCoachSettlementReconciliation();","  renderCoachSettlementHistory();"));
  old.verifyCurrent();
  const selected=require("./helpers/r3-production-selected.cjs");
  assert.equal(selected.restoreRelease(p,read(p)),selected.restoreRelease(p,before));
  assert.throws(()=>old.restore(p,read(p)+" "),/unknown_bytes/);
  const contract=s.deploymentContract();
  assert.equal(contract.release.version,"1.0.561");assert.equal(contract.appFiles.length,22);
  assert.equal(contract.paths.length,38);assert.equal(new Set(contract.paths).size,38);
  assert.throws(()=>old.resolvePaths([...contract.paths,"unknown.js"],contract.paths),/unknown_paths/);
  // 어떤 역사적 fixture/seal/golden도 새 기대값으로 다시 고정하지 않는다.
  for(const p of ["tests/fixtures/r3-self-coach-source.json","tests/fixtures/r3-current-dev-deployment.json","tests/fixtures/r3-production-selected-source.json","tests/fixtures/r3-production-selected-release.json"]){
    assert.equal(read(p),execFileSync("git",["show",s.BASE+":"+p],{encoding:"utf8"}).replace(/\r\n/g,"\n"));
  }
});

test("561 공식 planner 재구성·native metadata 보존·추가 apply0",()=>{
  const c=s.plan(),files=Object.fromEntries(c.files.filter(r=>r.kind==="metadata").map(r=>[r.path,{before:s.restore(r.path,read(r.path)),after:read(r.path)}]));
  const result=py(String.raw`import importlib.util,json,sys
from pathlib import Path
from unittest.mock import patch
v=json.load(sys.stdin);files=v['files'];s=importlib.util.spec_from_file_location('bump','scripts/bump_release.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
real=Path.read_text;merged={};counts={};writes=[]
def original(p,*a,**k):
 try:name=p.resolve().relative_to(m.ROOT).as_posix()
 except ValueError:return real(p,*a,**k)
 return files[name]['before'] if name in files else real(p,*a,**k)
def read(p):
 if p not in merged:merged[p]=original(p,encoding='utf-8')
 return merged[p]
def absorb(rows):
 for p,t,n in rows:merged[p]=t;counts[p]=counts.get(p,0)+n
def deny(*a,**k):writes.append(True);raise AssertionError('write_forbidden')
with patch.object(Path,'read_text',original),patch.object(Path,'write_text',deny):
 absorb([m.plan_release_json('1.0.559','1.0.561',v['release']['releaseId'],v['release']['deployedAt'])])
 absorb([m.plan_release_js('1.0.559','1.0.561',v['release']['releaseId'],v['release']['deployedAt'])])
 absorb(m.plan_version_queries('1.0.559','1.0.561',read));absorb(m.plan_app_literals('1.0.559','1.0.561',read))
 absorb([(p,t,n) for p,t,n,b,a in m.plan_cache_names(read)])
result={p.relative_to(m.ROOT).as_posix():t for p,t in merged.items() if counts.get(p)}
assert result=={p:r['after'] for p,r in files.items()} and len(result)==13 and not writes
assert json.loads(files['app/release.json']['before'])['nativePlatforms']==json.loads(files['app/release.json']['after'])['nativePlatforms']
before=files['app/shared/tennisnote-release.js']['before'];after=files['app/shared/tennisnote-release.js']['after']
assert before[before.index('nativeShell:'):]==after[after.index('nativeShell:'):]
print(json.dumps({'metadataFiles':len(result),'replacements':sum(counts.values()),'writes':len(writes),'nativePreserved':True}))`,{files,release:c.release});
  assert.deepEqual(result,{metadataFiles:13,replacements:374,writes:0,nativePreserved:true});
});

test("561 실제 DEV preflight: fresh PROD보다앞섬·member/admin일치·rollback/TLS/runtime 차단",()=>{
  const c=s.deploymentContract();
  const result=py(String.raw`import copy,hashlib,importlib.util,io,json,os,socket,ssl,sys,urllib.request,contextlib
from pathlib import Path
from unittest.mock import patch
c=json.load(sys.stdin);s=importlib.util.spec_from_file_location('gate','scripts/check_r3_dev_deployment.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
checks=0;reads=[];candidate='a'*40
def check(ok):
 global checks
 assert ok;checks+=1
def denied(call):
 try:call()
 except (RuntimeError,ValueError,OSError,KeyError):check(True);return
 raise AssertionError('expected_fail_closed')
def no_external(*a,**k):raise AssertionError('external_forbidden')
dev=[{'release':{'version':'1.0.557','releaseId':'2026.10.26.01','deployedAt':'synthetic'},'member_cache':592,'coach_cache':565} for _ in range(2)]
prod=[{'version':'1.0.558','releaseId':'2026.10.26.02','deployedAt':'synthetic'} for _ in range(2)]
browser={'environment':'development','supabaseUrl':'https://synthetic-dev.supabase.co','projectFingerprint':m.EXPECTED_DEV_PROJECT_FINGERPRINT,'supabasePublishableKey':'synthetic-public'}
payment={'enabled':False,'mode':'disabled','allowedMethods':[],'bankTransfer':{'enabled':False},'channels':{}}
root=m.ROOT;member=root/'dist/member-dev';admin=root/'dist/admin-dev';vfs={};rb=Path.read_bytes;rt=Path.read_text
def config():return 'window.TENNISNOTE_CONFIG = '+json.dumps(browser)+';\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = '+json.dumps(payment)+';\n'
def reset():
 for q in (member,admin):
  vfs[(q/'release.json').resolve()]=json.dumps(c['release']).encode();vfs[(q/'shared/config.local.js').resolve()]=config().encode();vfs[(q/'index.html').resolve()]='개발계 · 실제 결제·푸시 차단'.encode()
 vfs[(member/'service-worker.js').resolve()]=b'const CACHE_NAME = "tennis-note-member-pwa-v594";'
 vfs[(member/'tennis-note-coach-app/service-worker.js').resolve()]=b'const CACHE_NAME = "tennis-note-coach-mode-v567";'
def read_bytes(p):return vfs[p.resolve()] if p.resolve() in vfs else rb(p)
def read_text(p,*a,**k):return read_bytes(p).decode()
def http(role,sha):
 check(sha==candidate);reads.append(role)
 return copy.deepcopy({'member_release':dev[0]['release'],'admin_release':dev[1]['release'],'member_worker':'const CACHE_NAME = "tennis-note-member-pwa-v592";','coach_worker':'const CACHE_NAME = "tennis-note-coach-mode-v565";','production_member_release':prod[0],'production_admin_release':prod[1]}[role])
reset()
with patch.object(Path,'read_bytes',read_bytes),patch.object(Path,'read_text',read_text),patch.object(m,'project_fingerprint',lambda u:m.EXPECTED_DEV_PROJECT_FINGERPRINT if u==browser['supabaseUrl'] else ''),patch.object(m,'_http_read',http),patch.object(socket,'create_connection',no_external),patch.object(m.subprocess,'check_output',no_external):
 m.verify_current_live_candidate(c,candidate,member,admin);check(len(reads)==6)
 for version in ('1.0.561','1.0.562'):
  old=copy.deepcopy(prod)
  for r in prod:r['version']=version
  denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));prod[:]=old
 for target in (dev,prod):
  item=target[1]['release'] if target is dev else target[1];original=item['releaseId'];item['releaseId']='2026.10.27.99'
  denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));item['releaseId']=original
 for key,value in (('member_cache',595),('coach_cache',568)):
  original=dev[0][key];dev[0][key]=value
  denied(lambda:m.verify_monotonic_release(c['release'],594,567,dev));dev[0][key]=original
 prior=copy.deepcopy(dev)
 for r in dev:r['release']['version']='1.0.562'
 denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));dev[:]=prior
 for key,value in (('environment','production'),('projectFingerprint','0'*64)):
  old=browser[key];browser[key]=value;reset();denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));browser[key]=old;reset()
 for key,value in (('enabled',True),('mode','multi'),('allowedMethods',['bank_transfer'])):
  old=payment[key];payment[key]=value;reset();denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));payment[key]=old;reset()
 original=vfs[(admin/'release.json').resolve()];vfs[(admin/'release.json').resolve()]=b'{}'
 denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin));vfs[(admin/'release.json').resolve()]=original
 with patch.object(m,'_http_read',side_effect=RuntimeError('read_failed')):denied(lambda:m.verify_current_live_candidate(c,candidate,member,admin))
# TLS 오류는1회로 종료. 새 PROD endpoint도 기존 검증 transport를 사용한다.
calls=[]
def tls(*a,**k):calls.append(True);raise ssl.SSLCertVerificationError('synthetic')
with patch.object(m._LIVE_READ_OPENER,'open',tls),patch.object(m.time,'sleep',no_external):denied(lambda:m.read_live_production_releases(candidate))
check(len(calls)==1)
# 실제 source-only 진입점이561 successor를 선택하는지 확인한다.
routes=[]
with patch.object(m,'load_coach_entry_successor',lambda:copy.deepcopy(c)),patch.object(m,'validate_current_context',lambda contract,head:routes.append(('context',contract['successorBase'])) or candidate),patch.object(m,'verify_current_source',lambda sha,contract:routes.append(('source',sha))),patch.object(m,'run_git',lambda *a:candidate):
 check(m.current_source_preflight()['release']['version']=='1.0.561');check(len(routes)==2)
check(m.LIVE_READ_ENDPOINTS['production_member_release'][0]=='https://tennisnote-app.pages.dev')
print(json.dumps({'checks':checks,'tlsAttempts':len(calls),'liveHttpDb':0,'routes':len(routes)}))`,c);
  // DEV releaseId 불일치는 PROD 조회2개 전에 차단되므로 실제 점검은52개다.
  assert.equal(result.checks,52);assert.equal(result.tlsAttempts,1);assert.equal(result.liveHttpDb,0);assert.equal(result.routes,2);
});

test("과거 검사 연결은 입력 projection만 변경: 원본 assertions/테스트 수 유지",()=>{
  for(const p of ["tests/r3-self-coach.test.js","tests/r3-unpaid-substitute.test.js","tests/r3-current-dev-deployment.test.js"]){
    const actual=read(p),old=s.restore(p,actual);
    assert.deepEqual(actual.match(/assert\.[^\n]+/g),old.match(/assert\.[^\n]+/g));
    assert.deepEqual(actual.match(/^test\([^\n]+/gm),old.match(/^test\([^\n]+/gm));
  }
  // 과거 tests를 실행하지 않고 새 Python read-bridge 자체만 실제 호출한다.
  const text=read("tests/r3-self-coach.test.js"),start=text.indexOf("function py("),end=text.indexOf('\n}\n',start)+2;
  const ctx=vm.createContext({successor:s,python,execFileSync,JSON,root:process.cwd()});vm.runInContext(text.slice(start,end)+"\nthis.bridge=py;",ctx);
  const result=ctx.bridge("import json,hashlib\nfrom pathlib import Path\nprint(json.dumps({'version':json.loads(Path('app/release.json').read_text())['version'],'hash':hashlib.sha256(Path('app/release.json').read_bytes()).hexdigest()}))");
  const row=s.plan().files.find(r=>r.path==="app/release.json");
  assert.equal(result.version,"1.0.559");assert.equal(result.hash,row.beforeSha256);
  assert.equal(JSON.parse(read("app/release.json")).version,"1.0.561");
});

test("561 실제 source gate: cd5 ancestry/tree·exact38 paths·commit/physical/app bytes와 drift 차단",()=>{
  const c=s.deploymentContract(),files=Object.fromEntries(c.paths.map(p=>[p,read(p)]));
  const result=py(String.raw`import copy,importlib.util,json,socket,sys
from pathlib import Path
from unittest.mock import patch
v=json.load(sys.stdin);c=v['c'];files=v['files'];s=importlib.util.spec_from_file_location('gate','scripts/check_r3_dev_deployment.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
candidate='a'*40;state={'head':candidate,'paths':c['paths'][:],'dirty':'','ancestor':True,'successorAncestor':True,'baseTree':c['baseTree'],'successorTree':c['successorTree'],'symlink':None};checks=0;calls=[]
root=m.ROOT;vfs={(root/p).resolve():text.encode() for p,text in files.items()};committed=dict(files)
def check(ok):
 global checks
 assert ok;checks+=1
def denied():
 try:m.verify_current_source(candidate,c)
 except (RuntimeError,ValueError,OSError,KeyError):check(True);return
 raise AssertionError('expected_source_rejection')
def git(*a):
 calls.append(a)
 if a==('rev-parse','HEAD'):return state['head']
 if a==('status','--porcelain=v1','-uall'):return state['dirty']
 if a==('diff','--name-only',m.CURRENT_BASE+'..'+candidate):return '\n'.join(state['paths'])
 if a==('rev-parse',m.CURRENT_BASE+'^{tree}'):return state['baseTree']
 if a==('rev-parse',c['successorBase']+'^{tree}'):return state['successorTree']
 if a in (('merge-base','--is-ancestor',m.CURRENT_BASE,candidate),('merge-base','--is-ancestor',c['successorBase'],candidate)):
  if not state['ancestor' if a[2]==m.CURRENT_BASE else 'successorAncestor']:raise RuntimeError('not_ancestor')
  return ''
 raise AssertionError('unlisted_git')
def blob(ref,name):
 if ref==candidate:return committed[name].encode()
 for r in c['floors'].values():
  if ref==r['source']:
   if name=='app/release.json':return json.dumps({'version':r['version'],'releaseId':r['releaseId']}).encode()
   if name=='app/tennis-note-member-app/service-worker.js':return ('const CACHE_NAME = "tennis-note-member-pwa-v'+str(r['member'])+'";').encode()
   if name=='app/tennis-note-coach-app/service-worker.js':return ('const CACHE_NAME = "tennis-note-coach-mode-v'+str(r['coach'])+'";').encode()
 raise AssertionError('unlisted_blob')
def read_bytes(p):
 if p.resolve() not in vfs:raise AssertionError('unlisted_read')
 return vfs[p.resolve()]
def no_external(*a,**k):raise AssertionError('external_forbidden')
with patch.object(m,'run_git',git),patch.object(m,'current_git_blob',blob),patch.object(Path,'read_bytes',read_bytes),patch.object(Path,'read_text',lambda p,*a,**k:read_bytes(p).decode()),patch.object(Path,'is_symlink',lambda p:p.resolve()==state['symlink']),patch.object(m.subprocess,'check_output',no_external),patch.object(socket,'create_connection',no_external):
 m.verify_current_source(candidate,c);check(('merge-base','--is-ancestor',c['successorBase'],candidate) in calls)
 for key,value in (('head','b'*40),('dirty',' M unknown'),('ancestor',False),('successorAncestor',False),('baseTree','0'*40),('successorTree','0'*40)):
  old=state[key];state[key]=value;denied();state[key]=old
 for paths in (c['paths'][:-1],c['paths']+[c['paths'][0]],c['paths']+['app/unknown.js']):
  state['paths']=paths;denied()
 state['paths']=c['paths'][:]
 p='app/tennis-note-coach-app/views/settlement.js';q=(root/p).resolve();old=vfs[q]
 vfs[q]=old+b' ';denied();vfs[q]=old
 committed[p]+=' ';denied();vfs[q]=old+b' ';denied();vfs[q]=old;committed[p]=files[p]
 state['symlink']=q;denied();state['symlink']=None
 q=(root/'app/release.json').resolve();old=vfs[q];bad=json.loads(old);bad['version']='1.0.559';vfs[q]=json.dumps(bad).encode();denied();vfs[q]=old
 m.verify_current_source(candidate,c);check(True)
print(json.dumps({'checks':checks,'actualGitHttpDb':0,'paths':len(c['paths'])}))`,{c,files});
  assert.equal(result.paths,38);assert.ok(result.checks>=16);assert.equal(result.actualGitHttpDb,0);
});
