"use strict";
// 역사적 inverse 검사와 현재 제품 실행 검사를 명확히 분리한다. 네트워크/DB 호출은 합성 VM에만 있다.
const {test}=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
const legacy=require("./helpers/legacy-integrated-source.cjs");
const integrated=require("./helpers/integrated-feature-release.cjs"),mechanical=require("./helpers/release-freeze-mechanical.cjs");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const extract=(file,name)=>{const found=legacy.raw(file).match(new RegExp("^(?:async )?function "+name+"\\([^]*?^}","m"));assert(found,name);return found[0];};
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const preview=()=>({ok:true,scope:{...scope},calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),
  totals:{totalSettlementAmount:37,paymentCount:1},lines:[]});
const confirmed=()=>({ok:true,state:"CONFIRMED",scope:{...scope},snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",
  calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},
  confirmation:{confirmationId:"synthetic-confirm",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
function admin(){
  const pending=[],c=vm.createContext({window:{},Date,Intl,state:{billingMonth:"2099-01"},adminDemoMode:false,
    adminImportAuthState:{user:{id:"synthetic-auth"},profile:{id:"synthetic-admin",role:"admin"}},
    operationsRole:()=>c.adminImportAuthState.profile?.role,operationsAccessReady:()=>true,adminApprovalReady:()=>true,
    isAdminViewLocked:()=>false,isAdminUnlocked:()=>false,adminPinNeedsSetup:()=>false,
    activeOperationBranchId:()=>scope.branchId,operationBranchCoaches:()=>[{serverRoleId:scope.coachRoleId,branchId:scope.branchId,status:"active"}],
    renderAdminSettlementHistory(){},createAdminOperationKey:prefix=>prefix+":synthetic"});
  vm.runInContext(legacy.raw("app/admin/domain/billing.js")+"\n"+legacy.raw("app/admin/data/billing.js"),c);
  vm.runInContext('adminSettlementHistory.coachRoleId="synthetic-role"',c);
  c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:(name,args)=>new Promise((resolve,reject)=>pending.push({name,args,resolve,reject}))};
  return {c,pending,history:()=>vm.runInContext("adminSettlementHistory",c)};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("CI39 신규: exact current pins and both approved historical inverses reject unknown bytes",()=>{
  assert.equal(legacy.verifyCurrent(),true);
  for(const row of integrated.contract.files){
    const raw=legacy.raw(row.path);assert.throws(()=>legacy.restore(row.path,raw+"\n//unknown"),/candidate drift/);
    if(row.developmentSource===null)assert.equal(legacy.read(row.path),null);
    else assert.equal(legacy.read(row.path),row.developmentSource.replaceAll(legacy.developmentVersion,legacy.currentVersion));
  }
  for(const row of mechanical.contract.files.filter(x=>x.side==="public"))
    assert.throws(()=>legacy.restore(row.path,legacy.raw(row.path)+"\n//unknown"),/candidate drift/);
});
test("CI39 신규: missing production release fixture has reviewed historical blob/hash provenance",()=>{
  const file="tests/fixtures/production-excel-release.json",actual=fs.readFileSync(path.join(legacy.root,file));
  assert.equal(hash(actual),"e90582e923090ce290f54a25ab378c1da86b1a15efadc5ff44d430e93dd0e02c");assert.equal(actual.length,383);
  for(const ref of ["ed89d428b8746d5c2b86ac23faa324d4a3c8381f","e048a85ec59b39dfbaea0cff89d32564bad94157"])
    assert.deepEqual(actual,cp.execFileSync("git",["show",ref+":"+file],{cwd:legacy.root}));
});
test("CI39 신규: current signup captures the same operation key and fences owner, readback, logout",()=>{
  const text=extract("app/tennis-note-member-app/data/auth.js","persistIdentityProfile");
  for(const pattern of [/const signupOperation = signupProfileOperation;/,/const signupOperationKey = signupOperation.key;/,
    /target_operation_key: signupOperationKey/,/signupProfileOperation !== signupOperation \|\| !signupContextCurrent\(\)/,
    /signupContextCurrent\(allowedProfiles, true\)/,/expectedAuthUserId: signupOwner.authId/,/requireSignupReadback: true/,
    /signupOperation.linkedProfileId = result.profile.id/,/readbackGeneration/])assert.match(text,pattern);
  assert.doesNotMatch(text,/localStorage|sessionStorage|console\./);
  assert.equal((text.match(/client\.rpc\("tn_save_my_signup_profile"/g)||[]).length,1);
  const legacyFn=legacy.read("app/tennis-note-member-app/data/auth.js").match(/^async function persistIdentityProfile\([^]*?^}/m)[0];
  assert.match(legacyFn,/target_operation_key: signupProfileOperation.key/);
  // 실행 검사는 기존 signup-profile-integration 및 signup-session-refresh fixture를 그대로 유지한다.
});
test("CI39 신규: current admin preview+scope-state read deduplicates, exact readback and writer OFF",async()=>{
  const s=admin(),first=s.c.refreshAdminSettlementHistory();assert.equal(await s.c.refreshAdminSettlementHistory(),false);
  assert.equal(s.pending.length,1);assert.equal(s.pending[0].name,"tn_admin_preview_monthly_settlement_snapshot");
  s.pending[0].resolve(preview());await tick();assert.equal(s.pending.length,2);
  assert.equal(s.pending[1].name,"tn_admin_monthly_settlement_scope_state");
  assert.equal(s.pending[1].args.expected_source_fingerprint,"a".repeat(64));
  s.pending[1].resolve(confirmed());await first;
  assert.equal(s.history().value.snapshot.totals.totalSettlementAmount,37);assert.equal(s.history().status,"CONFIRMED");
  assert.equal(s.history().loading,false);assert.equal(s.c.adminSettlementWriterAllowed(),false);
  assert.equal(await s.c.confirmMonthlySettlementSnapshot(),false);assert.equal(s.pending.length,2);
});
test("CI39 신규: current admin missing identity/PIN/role/duplicate scope sends zero RPC",async()=>{
  for(const mutate of [c=>c.adminImportAuthState.user=null,c=>c.adminImportAuthState.profile=null,
    c=>c.adminImportAuthState.profile.role="member",c=>c.adminPinNeedsSetup=()=>true,c=>c.isAdminViewLocked=()=>true,
    c=>c.window.TennisNoteDataClient.getSession=()=>null,
    c=>c.operationBranchCoaches=()=>[1,2].map(()=>({serverRoleId:scope.coachRoleId,branchId:scope.branchId}))]){
    const s=admin();mutate(s.c);const work=s.c.refreshAdminSettlementHistory();assert.equal(s.pending.length,0);await work;
    assert.equal(s.history().value,null);assert.equal(s.c.adminSettlementWriterAllowed(),false);
  }
});
test("CI39 신규: current admin invalid month must fail before RPC",async()=>{
  const s=admin();s.c.state.billingMonth="2099-13";const work=s.c.refreshAdminSettlementHistory();
  // 먼저 호출 수를 검사하여 실제 결함이 미완료 합성 promise를 기다리는 것으로 가려지지 않게 한다.
  assert.equal(s.pending.length,0);await work;assert.equal(s.history().value,null);
});
test("CI39 신규: current admin actor/session/client/scope/PIN loss fences both awaits",async()=>{
  const mutations=[c=>c.adminImportAuthState.user.id="other-auth",c=>c.adminImportAuthState.profile.id="other-profile",
    c=>c.adminImportAuthState.profile.role="coach",c=>c.window.TennisNoteDataClient.getSession=()=>null,
    c=>c.window.TennisNoteDataClient={...c.window.TennisNoteDataClient},c=>c.state.billingMonth="2099-02",
    c=>c.activeOperationBranchId=()=>"other",c=>c.isAdminViewLocked=()=>true,c=>c.operationBranchCoaches=()=>[]];
  for(const stage of [0,1])for(const mutate of mutations)for(const failure of [false,true]){
    const s=admin(),work=s.c.refreshAdminSettlementHistory();
    if(stage){s.pending[0].resolve(preview());await tick();assert.equal(s.pending.length,2);}
    mutate(s.c);if(failure)s.pending[stage].reject(Error("synthetic-private-error"));else s.pending[stage].resolve(stage?confirmed():preview());
    await work;assert.equal(s.pending.length,stage+1);assert.equal(s.history().value,null);assert.equal(s.history().preview,null);
    assert.equal(s.history().loading,false);assert.equal(s.c.adminSettlementWriterAllowed(),false);
    assert(!s.history().message.includes("synthetic-private-error"));
  }
});
test("CI39 신규: current coach missing live role/auth or hidden modal fails closed",async()=>{
  for(const kind of ["live","role","auth","profile","hidden"]){
    let calls=0;const state={dataMode:"live",liveProfileId:"synthetic-profile",coach:{authUserId:"synthetic-auth",role:"coach",branchId:scope.branchId,coachRoleId:scope.coachRoleId}};
    const c=vm.createContext({Date,Intl,window:{TennisNoteDataClient:{getSession:()=>({access_token:"synthetic-session"}),rpc:()=>{calls++;}}},
      state,$:()=>({hidden:kind==="hidden"}),renderCoachSettlementHistory(){},formatCoachWon:String});
    vm.runInContext(legacy.raw("app/tennis-note-coach-app/domain/settlement.js")+"\n"+legacy.raw("app/tennis-note-coach-app/data/sync.js"),c);
    vm.runInContext("coachSettlementMonth=()=> '2099-01'",c);
    if(kind==="live")state.dataMode="preview";if(kind==="role")state.coach.role="member";
    if(kind==="auth")state.coach.authUserId="";if(kind==="profile")state.liveProfileId="";
    assert.equal(await c.syncCoachSettlementHistoryFromServer(),false);assert.equal(calls,0);
  }
});
test("CI39 신규: current admin EMPTY/CALCULATED are not confirmed and never auto-write",async()=>{
  for(const state of ["EMPTY","CALCULATED"]){
    const s=admin(),work=s.c.refreshAdminSettlementHistory();s.pending[0].resolve(preview());await tick();
    const value={ok:true,state,scope:{...scope},snapshot:state==="EMPTY"?null:{...confirmed().snapshot,scope:{...scope}},confirmation:null,reconciliation:null};
    s.pending[1].resolve(value);await work;
    assert.equal(s.history().value,null);assert.equal(s.history().scopeState.state,state);assert.equal(s.history().status,"READY");
    assert.equal(s.c.adminSettlementWriterAllowed(),false);assert.equal(s.pending.length,2);assert.equal(s.history().loading,false);
  }
});
test("CI39 신규: current admin failed read clears cache and redacts raw errors",async()=>{
  const s=admin();let work=s.c.refreshAdminSettlementHistory();s.pending[0].resolve(preview());await tick();s.pending[1].resolve(confirmed());await work;
  assert.equal(s.history().status,"CONFIRMED");work=s.c.refreshAdminSettlementHistory();
  assert.equal(s.history().value,null);assert.equal(s.history().preview,null);
  s.pending[2].reject(Error("synthetic-private-error"));await work;
  assert.equal(s.history().status,"ERROR");assert.equal(s.history().value,null);assert.equal(s.history().loading,false);
  assert(!s.history().message.includes("synthetic-private-error"));assert.equal(s.pending.length,3);
});
test("CI39 신규: current admin configured lock accepts unlocked session only",async()=>{
  const s=admin();s.c.isAdminViewLocked=()=>true;
  await s.c.refreshAdminSettlementHistory();assert.equal(s.pending.length,0);assert.equal(s.history().value,null);
  s.c.isAdminUnlocked=()=>true;const work=s.c.refreshAdminSettlementHistory();assert.equal(s.pending.length,1);
  s.pending[0].resolve(preview());await tick();s.pending[1].resolve(confirmed());await work;
  assert.equal(s.history().status,"CONFIRMED");assert.equal(s.pending.length,2);assert.equal(s.c.adminSettlementWriterAllowed(),false);
});
