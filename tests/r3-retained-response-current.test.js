// 실제 현재 public 함수와 통신 없는 합성 transport. 역사적 조회 전용 검사는 별도 역변환한다.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const require=createRequire(import.meta.url);
const inverse=require("./helpers/r3-retained-response-port.cjs");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8").replace(/\r\n/g,"\n");
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
function payload(status="PENDING",reason=""){
  return {scope:{...scope},state:status,snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",
    calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),
    totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:50}},
    confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",
      confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},
    reconciliation:status==="PENDING"?null:{reconciliationId:"synthetic-response",status:status.toLowerCase(),
      responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z",reason}};
}
function fixture(){
  const calls=[], c=vm.createContext({state:{dataMode:"live",liveProfileId:"synthetic-profile",
    coach:{role:"coach",authUserId:"synthetic-auth",branchId:scope.branchId,coachRoleId:scope.coachRoleId}},
    window:{},Date,Intl,token:"synthetic-not-a-credential",formatCoachWon:String,
    renderCoachSettlementHistory(){},saveSnapshot(){},$(){return {focus(){}};},
    fetch(){throw Error("external network forbidden");}});
  c.coachSettlementMonth=()=> "2099-01";
  c.response=async()=>payload("ACKNOWLEDGED");
  c.readback=async()=>payload("ACKNOWLEDGED");
  c.window.TennisNoteDataClient={getSession:()=>c.token?{access_token:c.token}:null,rpc:async(name,args)=>{
    calls.push({name,args});return name==="tn_coach_respond_monthly_settlement_confirmation"?c.response(args):c.readback(args);
  }};
  vm.runInContext(read("app/tennis-note-coach-app/domain/settlement.js"),c);
  // 실제 domain 선언 로드 뒤 합성 선택 월을 주입한다. 제품 함수를 미리 덮어쓰지 않는다.
  c.coachSettlementMonth=()=> "2099-01";
  const data=read("app/tennis-note-coach-app/data/sync.js");
  vm.runInContext(data.slice(data.indexOf("const coachSettlementHistory =")),c);
  c.initial=payload();
  vm.runInContext('Object.assign(coachSettlementHistory,{coachSettlementReconciliation:initial,coachSettlementReconciliationUiState:"PENDING",coachSettlementReconciliationChoice:"acknowledged"})',c);
  return {c,calls,value:expr=>vm.runInContext(expr,c)};
}
test("current inverse: exact 18 existing blobs, all one-byte negatives, historical baseline unchanged",()=>{
  const port=inverse.authority();let restored=0;
  for(const row of port.files.filter(x=>x.beforeBlob)){
    const current=read(row.path),result=inverse.restore(row.path,current);
    assert(result.applied,row.path);
    const base=execFileSync("git",["show",port.publicBase+":"+row.path],{cwd:root,encoding:"utf8"}).replace(/\r\n/g,"\n");
    assert.equal(result.text,base,row.path);
    assert.equal(inverse.restore(row.path,base).text,base);
    assert.throws(()=>inverse.restore(row.path,current+" "),/stage drift/);
    restored++;
  }
  assert.equal(restored,18);
  assert.equal(port.privateMain,"be8c227b16603f3cf7de1ba4a4940bae425af07b");
  assert.equal(port.privateTree,"14b8cfb53fd9dd7c9b7d168ed0abd8f71bdecd9d");
  assert.equal(port.migration250Sha256,"62740dd269e708d672f739c01fc22eb83e43ebaa80446a3d0a9da89f443c700e");
  assert.equal(port.candidateCommit,null,"local source evidence must not invent a commit");
});
test("Python alignment uses the same exact inverse, rejects drift, and leaves historical bytes intact",()=>{
  const code=[
    "import json,sys",
    "sys.path.insert(0,'scripts')",
    "import check_tennisnote_dev_prod_alignment as a",
    "p=json.loads((a.ROOT/'tests/fixtures/r3-retained-response-source-authority.json').read_text(encoding='utf-8'))",
    "count=0",
    "for r in p['files']:",
    " if not r['beforeBlob']: continue",
    " source=(a.ROOT/r['path']).read_text(encoding='utf-8')",
    " base=a.run_git('show',p['publicBase']+':'+r['path'],text=False).replace(b'\\r\\n',b'\\n').decode()",
    " assert a.restore_r3_retained_response_base(r['path'],source)==base",
    " assert a.restore_r3_retained_response_base(r['path'],base)==base",
    " try: a.restore_r3_retained_response_base(r['path'],source+' ')",
    " except RuntimeError: pass",
    " else: raise AssertionError('drift accepted')",
    " count+=1",
    "assert count==18",
    "print('EXACT_INVERSE_18_PASS')"
  ].join("\n");
  assert.match(execFileSync(process.platform==="win32"?"python":"python3",["-B","-c",code],{cwd:root,encoding:"utf8"}),/EXACT_INVERSE_18_PASS/);
});

test("current authority binding: merged private source exact; stale SHA/tree/migration fail closed",()=>{
  const file="tests/fixtures/r3-retained-response-source-authority.json",raw=read(file),port=inverse.authority();
  const prior=JSON.parse(execFileSync("git",["show","8358da0fa68ec4963b3e9004fe9f8bb958269d93:"+file],{cwd:root,encoding:"utf8"}));
  const rebound={...port,privateMain:prior.privateMain,privateTree:prior.privateTree,migration250Sha256:prior.migration250Sha256};
  assert.deepEqual(rebound,prior,"only current private identity changes; every historical/product hunk and golden stays exact");
  const stale={privateMain:prior.privateMain,privateTree:prior.privateTree,migration250Sha256:prior.migration250Sha256};
  const target=path.join(root,file),originalRead=fs.readFileSync;
  for(const [field,value] of Object.entries(stale)){
    const before=JSON.stringify(field)+": "+JSON.stringify(port[field]);
    assert.equal(raw.split(before).length,2);
    const changed=raw.replace(before,JSON.stringify(field)+": "+JSON.stringify(value));
    fs.readFileSync=function(p,...args){return path.resolve(String(p))===target?changed:originalRead.call(this,p,...args);};
    try{assert.throws(()=>inverse.authority(),/authority drift/);}
    finally{fs.readFileSync=originalRead;}
  }
  const code=[
    "import json,sys",
    "from pathlib import Path",
    "from unittest.mock import patch",
    "sys.path.insert(0,'scripts')",
    "import check_tennisnote_dev_prod_alignment as a",
    "target=a.ROOT/'tests/fixtures/r3-retained-response-source-authority.json'",
    "raw=target.read_text(encoding='utf8').replace('\\r\\n','\\n')",
    "port=json.loads(raw)",
    "stale="+JSON.stringify(stale),
    "original=Path.read_text",
    "for field,value in stale.items():",
    " before=json.dumps(field)+': '+json.dumps(port[field])",
    " assert raw.count(before)==1",
    " changed=raw.replace(before,json.dumps(field)+': '+json.dumps(value),1)",
    " def read(self,*args,**kwargs): return changed if self==target else original(self,*args,**kwargs)",
    " with patch.object(Path,'read_text',read):",
    "  try: a.restore_r3_retained_response_base('app/admin/index.html','synthetic')",
    "  except RuntimeError as error: assert str(error)=='R3 retained response authority drift'",
    "  else: raise AssertionError('stale current authority accepted')",
    "print('CURRENT_PRIVATE_BINDING_NEGATIVES_3_PASS')"
  ].join("\n");
  assert.match(execFileSync(process.platform==="win32"?"python":"python3",["-B","-c",code],{cwd:root,encoding:"utf8"}),/CURRENT_PRIVATE_BINDING_NEGATIVES_3_PASS/);
});
test("actual current acknowledged response: exact RPC once plus exact server readback",async()=>{
  const f=fixture();assert.equal(await f.c.submitCoachSettlementReconciliation(),true);
  assert.deepEqual(f.calls.map(x=>x.name),["tn_coach_respond_monthly_settlement_confirmation","tn_coach_monthly_settlement_reconciliation_state"]);
  const args=f.calls[0].args;
  assert.equal(args.target_branch_id,scope.branchId);assert.equal(args.target_coach_role_id,scope.coachRoleId);
  assert.equal(args.target_snapshot_id,"synthetic-snapshot");assert.equal(args.expected_snapshot_revision,1);
  assert.match(args.target_operation_key,/^settlement-coach-response:/);
  assert.equal(f.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"ACKNOWLEDGED");
});
test("actual disputed response preserves normalized reason and exact confirmation",async()=>{
  const f=fixture();f.value('coachSettlementHistory.coachSettlementReconciliationChoice="disputed";coachSettlementHistory.coachSettlementReconciliationReason=" 적용기간  확인 요청 ";');
  f.c.response=f.c.readback=async()=>payload("DISPUTED","적용기간 확인 요청");
  assert.equal(await f.c.submitCoachSettlementReconciliation(),true);
  assert.equal(f.calls[0].args.target_reason,"적용기간 확인 요청");assert.equal(f.calls.length,2);
});
test("duplicate submit is blocked while exact first operation is inflight",async()=>{
  const f=fixture();let resolve;f.c.response=()=>new Promise(r=>resolve=r);
  const first=f.c.submitCoachSettlementReconciliation();
  assert.equal(await f.c.submitCoachSettlementReconciliation(),false);assert.equal(f.calls.length,1);
  resolve(payload("ACKNOWLEDGED"));assert.equal(await first,true);assert.equal(f.calls.length,2);
});
test("response loss recovers by readback; unknown outcome never auto-retries the write",async()=>{
  const recovered=fixture();recovered.c.response=async()=>{throw Error("synthetic response loss");};
  assert.equal(await recovered.c.submitCoachSettlementReconciliation(),true);
  assert.equal(recovered.calls.length,2);
  const unknown=fixture();unknown.c.response=unknown.c.readback=async()=>{throw Error("synthetic unavailable");};
  assert.equal(await unknown.c.submitCoachSettlementReconciliation(),false);
  assert.equal(unknown.calls.filter(x=>x.name==="tn_coach_respond_monthly_settlement_confirmation").length,1);
  assert.equal(unknown.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"ERROR");
  assert(unknown.value("coachSettlementHistory.coachSettlementReconciliationOperation.key"));
});
test("only an explicit refresh/retry reuses the retained operation key after unknown outcome",async()=>{
  const f=fixture();f.c.response=f.c.readback=async()=>{throw Error("synthetic unavailable");};
  await f.c.submitCoachSettlementReconciliation();const key=f.calls[0].args.target_operation_key;
  f.c.readback=async()=>payload();assert.equal(await f.c.syncCoachSettlementHistoryFromServer(),true);
  f.c.response=f.c.readback=async()=>payload("ACKNOWLEDGED");
  assert.equal(await f.c.submitCoachSettlementReconciliation(),true);
  assert.equal(f.calls.filter(x=>x.name==="tn_coach_respond_monthly_settlement_confirmation")[1].args.target_operation_key,key);
});
test("missing role/session/exact scope and invalid choice/reason fail closed with RPC zero",async()=>{
  const changes=[f=>f.c.token="",f=>f.c.state.coach.role="admin",f=>f.c.state.coach.authUserId="",
    f=>f.c.state.liveProfileId="",f=>f.c.state.coach.branchId="other",
    f=>f.value('coachSettlementHistory.coachSettlementReconciliationChoice=""'),
    f=>f.value('coachSettlementHistory.coachSettlementReconciliationChoice="disputed";coachSettlementHistory.coachSettlementReconciliationReason="<unsafe>"')];
  for(const mutate of changes){const f=fixture();mutate(f);assert.equal(await f.c.submitCoachSettlementReconciliation(),false);assert.equal(f.calls.length,0);}
});
test("logout/profile/branch/month/session fences suppress late write responses and readback",async()=>{
  for(const mutate of [f=>f.c.token="",f=>f.c.state.liveProfileId="other",
    f=>f.c.state.coach.branchId="other",f=>f.c.coachSettlementMonth=()=>"2099-02",
    f=>f.value("resetCoachSettlementHistory()")]){
    const f=fixture();let resolve;f.c.response=()=>new Promise(r=>resolve=r);
    const promise=f.c.submitCoachSettlementReconciliation();mutate(f);resolve(payload("ACKNOWLEDGED"));
    assert.equal(await promise,false);assert.equal(f.calls.length,1);
  }
});
test("wrong revision/scope readback and already-responded conflict never report success",async()=>{
  const f=fixture();f.c.readback=async()=>({...payload("ACKNOWLEDGED"),scope:{...scope,coachRoleId:"other"}});
  assert.equal(await f.c.submitCoachSettlementReconciliation(),false);
  assert.notEqual(f.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"ACKNOWLEDGED");
  const g=fixture();g.c.response=async()=>{throw Error("settlement_conflict");};
  g.c.readback=async()=>payload("DISPUTED","적용기간 확인 요청");
  assert.equal(await g.c.submitCoachSettlementReconciliation(),false);
  assert.equal(g.value("coachSettlementHistory.coachSettlementReconciliationUiState"),"CONFLICT");
  assert.equal(g.calls.length,2);
});

test("historical admin exact552 stage is object-bound; current and historical drift remain rejected",()=>{
  const port=require("./helpers/renewal-hold-port.cjs"),file="app/admin/index.html";
  const version=JSON.parse(read("app/release.json")).version,current=read(file);
  const baseline=execFileSync("git",["show","636bdb571dab9d67e18725cd101f0fbe452d69d7:"+file],{cwd:root,encoding:"utf8"}).replace(/\r\n/g,"\n");
  assert.equal(inverse.sha(baseline),"73871ce9b81e434ad55d849a3b5400633c98e422f945b75f9982c96b377e6937");
  assert.equal(port.restoreManualPayoutAdminIndex(file,current,version),baseline);
  assert.equal(port.restoreManualPayoutAdminIndex(file,baseline,version),baseline);
  for(const bad of [current+" ",baseline+" ",baseline.replaceAll("1.0.552","1.0.999")]){
    assert.throws(()=>port.restoreBase(file,bad),/drift|stage/);
  }
  assert.equal(JSON.parse(read("app/release.json")).version,version);
});
