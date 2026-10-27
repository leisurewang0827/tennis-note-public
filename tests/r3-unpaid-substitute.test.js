import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n");
const source=read("app/shared/tennisnote-settlement-adjustment.js");
const context=vm.createContext({window:{crypto:webcrypto},TextEncoder,Uint8Array,Intl});vm.runInContext(source,context);
const api=context.window.TennisNoteSettlementAdjustment,copy=x=>JSON.parse(JSON.stringify(x));
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-coach-b",settlementMonth:"2099-01-01"};
function policy(){
  const session={id:"synthetic-session",lessonId:"synthetic-lesson",substituteAssignmentId:"synthetic-assignment",accountingClass:"branch_substitute_expense",
    groupAccountId:"synthetic-group",coachRoleId:scope.coachRoleId,originalCoachRoleId:"synthetic-coach-a",recipientCoachRoleId:scope.coachRoleId,
    substitutePolicy:"actualCoach",substituteSettlementMode:"hourly",outcome:"completed",lessonDate:"2099-01-01",startTime:"10:00"};
  return {ok:true,scope,calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),confirmationReady:true,
    totals:{totalSettlementAmount:1000,ownSettlementAmount:0,substituteSettlementAmount:1000,substituteSessionCount:1,branchSubstituteExpenseAmount:1000,
      revenueAmount:0,settledSessions:1,settledMinutes:20,paymentCount:0},
    sourceManifest:{substituteContractVersion:"r3_substitute_policy_v2",tickets:[{id:"synthetic-ticket",userId:"synthetic-member",coachRoleId:"synthetic-coach-a"}],sessions:[session],
      assignments:[{id:"synthetic-assignment",lessonId:session.lessonId,branchId:scope.branchId,substituteCoachRoleId:scope.coachRoleId,originalCoachRoleId:"synthetic-coach-a",status:"completed",settlementMode:"hourly"}]},
    lines:[{lineIndex:1,lineKind:"substitute_session",sourceTicketId:"synthetic-ticket",sourceLessonId:session.lessonId,sourceSessionId:session.id,
      sourceSubstituteAssignmentId:session.substituteAssignmentId,settlementAmount:1000,settledSessions:1,settledMinutes:20,totalSessions:5,netAmount:0,
      calculationComponents:{physicalKey:[session.groupAccountId,session.coachRoleId,session.lessonDate,session.startTime].join("|"),accountingClass:session.accountingClass,
        contributions:[{sessionId:session.id,lessonId:session.lessonId,substituteAssignmentId:session.substituteAssignmentId,formula:"hourly"}]}}]};
}
test("실제 public policy-v2: B 지점비용·그룹 물리1회·수업별 none/original 0원 근거",()=>{
  const value=policy(),projected=api.effectiveProjection(value,scope);
  assert.equal(projected.branchSubstituteExpense,1000);assert.match(projected.rows[0].method,/지점 별도 비용/);
  const group=copy(value),second=copy(group.lines[0]),session=copy(group.sourceManifest.sessions[0]);
  session.id="synthetic-session-two";group.sourceManifest.sessions.push(session);
  Object.assign(second,{lineIndex:2,sourceSessionId:session.id,settlementAmount:0,settledSessions:0,settledMinutes:0});
  Object.assign(second.calculationComponents,{duplicateSharedTime:true,contributions:[]});group.lines.push(second);
  assert.equal(api.effectiveProjection(group,scope).substituteSessionCount,1);
  for(const kind of ["none","originalCoach"]){
    const zero=copy(value),s=zero.sourceManifest.sessions[0],line=zero.lines[0];
    Object.assign(s,{recipientCoachRoleId:kind==="none"?null:"synthetic-coach-a",substitutePolicy:kind,
      substituteSettlementMode:kind==="none"?"none":"actual_coach",accountingClass:kind==="none"?"explicit_no_settlement":"original_coach_settlement"});
    zero.sourceManifest.assignments[0].settlementMode=s.substituteSettlementMode;
    Object.assign(zero.totals,{totalSettlementAmount:0,substituteSettlementAmount:0,substituteSessionCount:0,branchSubstituteExpenseAmount:0,settledSessions:0,settledMinutes:0});
    Object.assign(line,{settlementAmount:0,settledSessions:0,settledMinutes:0});
    Object.assign(line.calculationComponents,{accountingClass:s.accountingClass,nonPayableDecision:true,
      nonPayableReason:kind==="none"?"explicit_no_settlement":"recipient_original_coach",contributions:[]});
    assert.match(api.effectiveProjection(zero,scope).rows[0].method,/0원 근거/);
    const bad=copy(zero);bad.lines[0].calculationComponents.nonPayableReason="unknown";
    assert.throws(()=>api.effectiveProjection(bad,scope),/reason_invalid/);
  }
});
test("policy-v2 위조 source/recipient/physical/합계·unknown HOLD는 실제 validator가 거부",()=>{
  for(const mutate of [x=>x.sourceManifest.assignments[0].branchId="other",x=>x.sourceManifest.sessions[0].recipientCoachRoleId="other",
    x=>x.lines[0].sourceLessonId="other",x=>x.totals.branchSubstituteExpenseAmount=999,
    x=>x.lines[0].calculationComponents.physicalKey="",x=>x.sourceManifest.substituteContractVersion="unknown"]){
    const bad=policy();mutate(bad);assert.throws(()=>api.effectiveProjection(bad,scope));
  }
  assert.match(api.effectiveError({message:"settlement_hold_substitute_manual_approval_required"}),/확인 필요/);
});
const snapshot={snapshotId:"synthetic-snapshot",revision:1,sourceFingerprint:"a".repeat(64),totals:{totalSettlementAmount:1000}};
function unpaid(){return {scope,snapshot,adjustment:{version:"r3_unpaid_adjustment_v1",head:null,headFingerprint:"0".repeat(64),originalAmount:1000,finalAmount:1000,
  events:[],response:null,writesEnabled:true,hasAnyPayout:false},payout:{state:"NOT_RECORDED",recordingEnabled:true,events:[],activeRecord:null}};}
test("unpaid 원본+가감 chain·최신head·응답·EMPTY 계약; 임의 최종액/과거응답 거부",()=>{
  const value=unpaid();assert.equal(api.unpaidProjection(value,scope,snapshot),value);
  value.adjustment.events=[{eventId:"synthetic-head",revision:1,deltaAmount:-350,finalAmount:650,reason:"합성 정산 검토",headFingerprint:"b".repeat(64),operationKeyHash:"c".repeat(64)}];
  Object.assign(value.adjustment,{head:"synthetic-head",revision:1,headFingerprint:"b".repeat(64),finalAmount:650,
    response:{status:"acknowledged",reason:null,headFingerprint:"b".repeat(64),operationKeyHash:"d".repeat(64)}});
  assert.equal(api.unpaidProjection(value,scope,snapshot).adjustment.finalAmount,650);
  for(const mutate of [x=>x.adjustment.finalAmount=651,x=>x.adjustment.events[0].deltaAmount=-1001,x=>x.adjustment.response.headFingerprint="e".repeat(64),
    x=>x.scope={...scope,branchId:"other"},x=>x.adjustment.events.push(copy(x.adjustment.events[0])),x=>x.snapshot={...snapshot,revision:2}]){
    const bad=copy(value);mutate(bad);assert.throws(()=>api.unpaidProjection(bad,scope,snapshot));
  }
  const empty=unpaid();empty.state="EMPTY";empty.snapshot=null;empty.adjustment.originalAmount=0;empty.adjustment.finalAmount=0;
  assert.equal(api.unpaidProjection(empty,scope,null),empty);
});
test("새 endpoint 없음만 legacy read; 권한/shape 실패는 fallback RPC0",async()=>{
  const calls=[];const missing={rpc:async(name)=>{calls.push(name);if(name==="tn_monthly_settlement_adjustment_state")throw {payload:{code:"PGRST202"}};return "legacy";}};
  assert.equal(await api.readUnpaidState(missing,scope),"legacy");assert.equal(calls.length,2);
  for(const result of [{payload:{code:"42501"}},null]){
    let count=0;const client={rpc:async()=>{count++;if(result)throw result;return {};}};
    await assert.rejects(()=>api.readUnpaidState(client,scope));assert.equal(count,1);
  }
});

test("새 결합 후보 제품10 exact inverse와 byte/path 음성; 역사 기대값 유지",async()=>{
  const {createRequire}=await import("node:module"),guard=createRequire(import.meta.url)("./helpers/r3-self-coach.cjs");
  guard.verifyCurrent();assert.equal(guard.PRODUCT.length,10);
  const plan=guard.plan();
  for(const [index,row]of plan.files.entries()){
    const proof=guard.mechanical(row,index);assert.equal(guard.restore(row.path,read(row.path)),proof.before);
    assert.throws(()=>guard.restore(row.path,proof.after+" "),/unknown_bytes/);
  }
  assert.throws(()=>guard.resolvePaths([...guard.PRODUCT,"unknown.js"],guard.PRODUCT),/unknown_paths/);
  const {createHash}=await import("node:crypto"),sha=value=>createHash("sha256").update(value).digest("hex");
  assert.equal(sha(source),plan.files.find(x=>x.path==="app/shared/tennisnote-settlement-adjustment.js").afterSha256);
  const block=text=>text.slice(0,text.indexOf("\nhtml[data-tennisnote-surface]"));
  const touch=block(read("app/shared/tennisnote-ui-foundation.css"));assert.match(touch,/min-height: 44px/);
  assert.equal(sha(touch),"cd3839dee1af20335f5a30dc6f178cd6a70b7167b022b1b4bebb07f3720fa6c2");
  const privateRoot=process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
  if(privateRoot){
    assert.equal(source,read(privateRoot+"/90-Dashboard/shared/tennisnote-settlement-adjustment.js"));
    assert.equal(touch,block(read(privateRoot+"/90-Dashboard/shared/tennisnote-ui-foundation.css")));
  }
});

async function metadataBridgeProof(physical=null,stageGuard=null){
  const {createRequire}=await import("node:module"),{execFileSync}=await import("node:child_process"),{createHash}=await import("node:crypto");
  const require=createRequire(import.meta.url),guard=stageGuard||require("./helpers/r3-self-coach.cjs"),selected=require("./helpers/r3-production-selected.cjs");
  const hash=value=>createHash("sha256").update(value).digest("hex"),plan=guard.plan(),prepared=plan.metadata;
  guard.verifyCurrent();assert.equal(plan.files.length,10);assert.equal(prepared.files.length,13);assert.equal(prepared.applyCalls,0);
  const generated={};
  for(const row of prepared.files){
    const original=guard.metadataRestore(row.path,physical?.[row.path]??read(row.path));
    const candidate=guard.metadataForward(row.path,original);generated[row.path]=candidate;
    assert.equal(hash(candidate),row.afterSha256);assert.equal(guard.metadataRestore(row.path,candidate),original);
    assert.equal(guard.restore(row.path,candidate),guard.restore(row.path,original));
    assert.equal(selected.restoreRelease(row.path,candidate),selected.restoreRelease(row.path,original));
    assert.throws(()=>guard.metadataRestore(row.path,candidate+" "),/unknown_bytes/);
  }
  const index="app/admin/index.html",hint="미지급 정산의 가감 조정은 원본 계산과 사유를 보존하고 코치 재확인을 받습니다.";
  assert.ok(guard.metadataRestore(index,generated[index]).includes(hint));assert.ok(!guard.restore(index,generated[index]).includes(hint));
  assert.throws(()=>guard.metadataRestore("app/release.json",generated["app/release.json"].replace('"version": "1.0.559"','"version": "1.0.560"')),/unknown_bytes_or_version/);
  const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
  const code=String.raw`import importlib.util,json,sys,hashlib
s=importlib.util.spec_from_file_location("actual_alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
v=json.load(sys.stdin);result=m.before_selected_release_candidate(v["path"],v["text"].encode())
print(json.dumps({"sha256":hashlib.sha256(result).hexdigest()}))`;
  const proof=JSON.parse(execFileSync(python,["-B","-X","utf8","-c",code],{input:JSON.stringify({path:index,text:generated[index]}),encoding:"utf8",maxBuffer:16*1024*1024,stdio:["pipe","pipe","pipe"]}));
  assert.equal(proof.sha256,hash(selected.restoreRelease(index,generated[index])));
  for(const p of ["tests/fixtures/r3-production-selected-source.json","tests/fixtures/r3-production-selected-release.json"])
    assert.equal(read(p),execFileSync("git",["show",plan.base+":"+p],{encoding:"utf8"}).replace(/\r\n/g,"\n"));
}
test("새 metadata13 bridge 실제 JS/Python 소비자·제품10 합성 및 unknown version/byte 거부",()=>metadataBridgeProof());

async function frozenTimestampProof(physical=null){
  const {createRequire}=await import("node:module"),{execFileSync}=await import("node:child_process");
  const guard=createRequire(import.meta.url)("./helpers/r3-self-coach.cjs");guard.verifyCurrent();
  const code=String.raw`import importlib.util,json,sys,io,contextlib,hashlib,datetime as dt,subprocess
from pathlib import Path
from unittest.mock import patch
c=json.loads(Path("tests/fixtures/r3-self-coach-source.json").read_text());p=c["metadata"]
v=json.load(sys.stdin);physical=v.get("physical") or {r["path"]:Path(r["path"]).read_text(encoding="utf-8") for r in p["files"]}
stage=json.loads(physical["app/release.json"])["version"]
assert stage in (p["old"]["version"],p["proposed"]["version"])
side="beforeSha256" if stage==p["old"]["version"] else "afterSha256"
assert all(hashlib.sha256(physical[r["path"]].encode()).hexdigest()==r[side] for r in p["files"])
restore_code="const f=require('fs'),g=require('./tests/helpers/r3-self-coach.cjs');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(s)).map(([p,t])=>[p,g.metadataRestore(p,t)])))));"
preimage=json.loads(subprocess.check_output(["node","-e",restore_code],input=json.dumps(physical).encode()))
s=importlib.util.spec_from_file_location("actual_frozen_tool","scripts/bump_release.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
real_read=Path.read_text
def preimage_read(q,*args,**kwargs):
 try:name=q.resolve().relative_to(m.ROOT).as_posix()
 except ValueError:return real_read(q,*args,**kwargs)
 return preimage[name] if name in preimage else real_read(q,*args,**kwargs)
captured={};writes=[];original=sys.getprofile()
def profile(frame,event,arg):
 if event=="return" and frame.f_code is m.main.__code__ and arg==0:captured.update(frame.f_locals.get("merged",{}))
def deny_write(*a,**k):writes.append(True);raise AssertionError("metadata_write_forbidden")
base=["bump","--next","--release-id",p["proposed"]["releaseId"],"--member-cache-floor","592","--coach-cache-floor","565","--dry-run"]
try:
 sys.setprofile(profile)
 with patch.object(Path,"read_text",preimage_read),patch.object(sys,"argv",base+["--deployed-at",p["plannedAt"]]),patch.object(Path,"write_text",deny_write),contextlib.redirect_stdout(io.StringIO()):
  assert m.read_current()==(p["old"]["version"],p["old"]["releaseId"])
  assert m.main()==0
finally:sys.setprofile(original)
expected={r["path"]:r["afterSha256"] for r in p["files"]}
actual={q.relative_to(m.ROOT).as_posix():hashlib.sha256(text.encode()).hexdigest() for q,text in captured.items()}
assert actual==expected and len(actual)==13 and not writes
bad=["not-a-time",p["plannedAt"][:19],p["plannedAt"].replace("+09:00","+00:00"),p["plannedAt"].replace("+09:00",".123+09:00"),"2000-01-01T00:00:00+09:00",(dt.datetime.now(m.KST)+dt.timedelta(minutes=1)).replace(microsecond=0).isoformat()]
for value in bad:
 with patch.object(Path,"read_text",preimage_read),patch.object(sys,"argv",base+["--deployed-at",value]),patch.object(Path,"write_text",deny_write),contextlib.redirect_stdout(io.StringIO()):assert m.main()==1
raw=Path("scripts/bump_release.py").read_text(encoding="utf-8")
restored=json.loads(subprocess.check_output(["node","tests/helpers/r3-self-coach.cjs","--restore"],input=json.dumps({"path":"scripts/bump_release.py","text":raw}).encode()))
historical=subprocess.check_output(["git","show",c["base"]+":scripts/bump_release.py"]).decode().replace("\r\n","\n")
assert restored==historical and not writes
print(json.dumps({"exactPlannedFiles":13,"negative":len(bad),"writes":len(writes),"historicalToolUnchanged":True}))`;
  const python=process.env.TENNISNOTE_PYTHON||(process.platform==="win32"?"python":"python3");
  const proof=JSON.parse(execFileSync(python,["-B","-X","utf8","-c",code],{input:JSON.stringify({physical}),encoding:"utf8",maxBuffer:16*1024*1024,stdio:["pipe","pipe","pipe"]}));
  assert.deepEqual(proof,{exactPlannedFiles:13,negative:6,writes:0,historicalToolUnchanged:true});
}
test("새 frozen timestamp 공식 CLI13 재현·시각 음성·도구 역변환; apply0",()=>frozenTimestampProof());

test("새 physical558/559 stage 영향: 실제 JS/Python 소비자와 공식 CLI preimage 및 mixed 거부",async()=>{
  const {createRequire}=await import("node:module"),path=await import("node:path"),{fileURLToPath}=await import("node:url");
  const require=createRequire(import.meta.url),guard=require("./helpers/r3-self-coach.cjs"),root=fileURLToPath(new URL("../",import.meta.url));
  const helper=fileURLToPath(new URL("./helpers/r3-self-coach.cjs",import.meta.url)),originals={},planned={};
  for(const row of guard.plan().metadata.files){originals[row.path]=guard.metadataRestore(row.path,read(row.path));planned[row.path]=guard.metadataForward(row.path,originals[row.path]);}
  const stageGuard=physical=>{
    const virtualFs=Object.create(fs);virtualFs.readFileSync=(file,options)=>{
      const name=path.relative(root,String(file)).split(path.sep).join("/");
      return Object.hasOwn(physical,name)?(options?physical[name]:Buffer.from(physical[name])):fs.readFileSync(file,options);
    };
    const module={exports:{}},localRequire=name=>name==="node:fs"?virtualFs:require(name);
    vm.runInNewContext(fs.readFileSync(helper,"utf8"),{require:localRequire,module,exports:module.exports,__dirname:path.dirname(helper),process,Buffer,console});return module.exports;
  };
  for(const physical of [originals,planned]){
    const current=stageGuard(physical);current.verifyCurrent();
    await metadataBridgeProof(physical,current);await frozenTimestampProof(physical);
  }
  const mixed={...originals,"app/release.json":planned["app/release.json"]};assert.throws(()=>stageGuard(mixed).verifyCurrent(),/mixed_or_unknown_stage/);
  const unknown={...planned,"app/release.json":planned["app/release.json"].replace("1.0.559","1.0.560")};assert.throws(()=>stageGuard(unknown).verifyCurrent(),/metadata_not_admitted/);
});
test("공개 실제 entry/동작은 private 권위에서 포트, 모든 제품 host mount/read 연결 존재",()=>{
  for(const [p,marker]of [["app/admin/actions/billing.js","tn_admin_confirm_substitute_policy_decision"],["app/admin/data/billing.js","tn_admin_list_substitute_manual_candidates"],
    ["app/admin/views/billing.js","mountUnpaidDetail"],["app/tennis-note-coach-app/views/settlement.js","mountUnpaidDetail"],
    ["app/tennis-note-coach-app/data/sync.js","readUnpaidState"]])assert.ok(read(p).includes(marker),p);
  assert.match(read("app/admin/actions/billing.js"),/if \(adminMonthlySettlementWrite\.payoutState\?\.adjustment\?\.head\) return false/);
  const root=process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
  if(root){
    assert.equal(source,read(root+"/90-Dashboard/shared/tennisnote-settlement-adjustment.js"));
    const fn=(text,name)=>text.match(new RegExp("^(?:async )?function "+name+"\\([^\\n]*\\)\\s*\\{[\\s\\S]*?^\\}","m"))?.[0];
    const privateAdmin=read(root+"/90-Dashboard/tennis-note-prototype/app.js");
    for(const name of ["r3SubstituteDecisionCandidate","r3SubstituteDecisionCandidates","validatedR3SubstituteDecisionCandidates","refreshEffectiveSettlementPreview"])
      assert.equal(fn(read("app/admin/data/billing.js"),name),fn(privateAdmin,name));
    for(const name of ["previewR3SubstituteDecision","confirmR3SubstituteDecision"])
      assert.equal(fn(read("app/admin/actions/billing.js"),name),fn(privateAdmin,name));
  }
});
