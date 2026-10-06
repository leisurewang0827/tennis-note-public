import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
const require = createRequire(import.meta.url);
const {root,manifest,sha,restore} = require("./helpers/r3-admin-history-port.cjs");
const read = file => fs.readFileSync(path.join(root,file),"utf8").replace(/\r\n/g,"\n");
const scope = {branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
function payload(version="r3_monthly_settlement_v1",response=null) {
  return {ok:true,state:"CONFIRMED",scope:{...scope},snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:version,sourceFingerprint:"a".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:response};
}
function context() {
  const c = vm.createContext({window:{},state:{billingMonth:"2099-01"},adminDemoMode:false,adminImportAuthState:{profile:{id:"synthetic-admin",role:"admin"}},Date,Intl,
    operationsRole(){return c.adminImportAuthState.profile?.role},operationsAccessReady:()=>true,adminApprovalReady:()=>true,isAdminViewLocked:()=>false,isAdminUnlocked:()=>false,adminPinNeedsSetup:()=>false,
    activeOperationBranchId:()=>scope.branchId,operationBranchCoaches:()=>[{serverRoleId:scope.coachRoleId,branchId:scope.branchId,status:"active"}],renderAdminSettlementHistory(){}});
  vm.runInContext(read("app/admin/domain/billing.js"),c);
  vm.runInContext(read("app/admin/data/billing.js"),c);
  vm.runInContext(`adminSettlementHistory.coachRoleId="${scope.coachRoleId}"`,c);
  c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-only"}),rpc:async()=>payload()};
  return c;
}
test("admin history exact canonical validators/read RPC and baseline inverse",()=>{
  const version=JSON.parse(read("app/release.json")).version;
  for(const entry of manifest.files) { const current=read(entry.path);assert.equal(sha(restore(entry.path,current).replaceAll(version,manifest.publicVersion)),entry.baseSha256);assert.throws(()=>restore(entry.path,current+"// drift")); }
  for(const entry of manifest.functions) {
    assert.equal(sha(entry.privateSource),entry.privateSha256);
    let projected=entry.privateSource;for(const [before,after] of entry.transforms) projected=projected.replaceAll(before,after);
    assert.equal(sha(projected),entry.projectedSha256);assert(read(entry.target).includes(projected));
  }
});
test("administrator and coach share immutable v1/v2 totals, revision and response contracts",()=>{
  const c=context();
  for(const version of ["r3_monthly_settlement_v1","r3_effective_settlement_v2"]) for(const status of ["PENDING","ACKNOWLEDGED","DISPUTED"]) {
    const response=status==="PENDING"?null:{reconciliationId:"synthetic-response",status,reason:status==="DISPUTED"?"적용기간 확인 요청":"",responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"};
    const value=payload(version,response);
    assert(c.adminSettlementHistoryPayloadIsExact(value,scope));
    const coach=vm.createContext({state:{},Date});vm.runInContext(read("app/tennis-note-coach-app/domain/settlement.js"),coach);
    assert(coach.coachSettlementReconciliationPayloadIsExact({...value,state:status},scope));
    assert.equal(value.snapshot.totals.settledMinutes,40);assert.equal(value.snapshot.totals.totalSettlementAmount,37);
  }
});
test("invalid scope/revision/version/totals/time/reason never becomes confirmed or zero",()=>{
  const c=context();
  const changes=[v=>v.ok=false,v=>v.scope.branchId="other",v=>v.scope.coachRoleId="other",v=>v.scope.settlementMonth="2099-02-01",v=>v.snapshot.calculationVersion="unknown",v=>v.snapshot.revision=0,v=>v.snapshot.sourceFingerprint="bad",v=>v.snapshot.totals.totalSettlementAmount=NaN,v=>v.confirmation.confirmedAt="bad",v=>v.confirmation.status="pending",v=>v.reconciliation={status:"DISPUTED",reason:"<script>unsafe</script>"}];
  for(const change of changes) {const value=payload();change(value);assert.equal(c.adminSettlementHistoryPayloadIsExact(value,scope),false);}
});
test("single inflight exact read, no financial write or persistence",async()=>{
  const c=context(),calls=[];let resolve;
  c.window.TennisNoteDataClient.rpc=(name,args)=>{calls.push({name,args});return new Promise(r=>resolve=r)};
  const first=c.refreshAdminSettlementHistory();assert.equal(await c.refreshAdminSettlementHistory(),false);
  assert.equal(calls.length,1);assert.equal(calls[0].name,"tn_admin_monthly_settlement_scope_state");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{target_branch_id:scope.branchId,target_coach_role_id:scope.coachRoleId,target_month:scope.settlementMonth,expected_source_fingerprint:""});
  resolve(payload());assert.equal(await first,true);assert.equal(vm.runInContext("adminSettlementHistory.value.snapshot.totals.totalSettlementAmount",c),37);
  const data=read("app/admin/data/billing.js").slice(read("app/admin/data/billing.js").indexOf("// 확정 이력"));
  for(const forbidden of ["tn_admin_confirm_monthly_settlement_snapshot","tn_admin_create_monthly_settlement_snapshot","tn_coach_respond_monthly_settlement_confirmation","saveSnapshot(","localStorage"]) assert(!data.includes(forbidden));
});
test("month/branch/profile/session/PIN/role changes fence late results and discard stale history",async()=>{
  for(const mutate of [c=>c.state.billingMonth="2099-02",c=>c.activeOperationBranchId=()=>"other",c=>c.adminImportAuthState.profile.id="other",c=>c.adminImportAuthState.profile.role="coach",c=>c.window.TennisNoteDataClient.getSession=()=>null,c=>c.isAdminViewLocked=()=>true,c=>c.operationBranchCoaches=()=>[]]) {
    const c=context();let resolve;c.window.TennisNoteDataClient.rpc=()=>new Promise(r=>resolve=r);
    const first=c.refreshAdminSettlementHistory();mutate(c);resolve(payload());assert.equal(await first,false);
    assert.equal(vm.runInContext("adminSettlementHistory.value",c),null);assert.equal(vm.runInContext("adminSettlementHistory.loading",c),false);
  }
});
test("missing identity, duplicate role, PIN, invalid month and non-admin: RPC zero",async()=>{
  for(const mutate of [c=>c.adminImportAuthState.profile=null,c=>c.adminImportAuthState.profile.role="member",c=>c.isAdminViewLocked=()=>true,c=>c.adminPinNeedsSetup=()=>true,c=>c.state.billingMonth="2099-13",c=>c.window.TennisNoteDataClient.getSession=()=>null,c=>c.operationBranchCoaches=()=>[1,2].map(()=>({serverRoleId:scope.coachRoleId,branchId:scope.branchId}))]) {
    const c=context();let calls=0;mutate(c);c.window.TennisNoteDataClient.rpc=()=>{calls++};assert.equal(await c.refreshAdminSettlementHistory(),false);assert.equal(calls,0);
  }
});
test("configured protected view allows existing unlocked session, not a permanent lock",async()=>{
  const c=context();c.isAdminViewLocked=()=>true;c.isAdminUnlocked=()=>true;assert(await c.refreshAdminSettlementHistory());
  c.isAdminUnlocked=()=>false;assert.equal(await c.refreshAdminSettlementHistory(),false);
  const logout=read("app/admin/actions/report.js").match(/async function signOutAdminImport\([\s\S]*?\n\}/)[0];
  assert(logout.includes("resetAdminSettlementHistory();"));assert(logout.includes("renderAdminSettlementHistory();"));
});
test("EMPTY/CALCULATED remain separate; failed reads remove cached history and redact raw error",async()=>{
  const c=context();assert(await c.refreshAdminSettlementHistory());
  for(const state of ["EMPTY","CALCULATED"]) {c.window.TennisNoteDataClient.rpc=async()=>({ok:true,state,scope,snapshot:state==="EMPTY"?null:{},confirmation:null,reconciliation:null});assert(await c.refreshAdminSettlementHistory());assert.equal(vm.runInContext("adminSettlementHistory.value",c),null);}
  c.window.TennisNoteDataClient.rpc=async()=>{throw Error("private-value forbidden")};assert.equal(await c.refreshAdminSettlementHistory(),false);assert(!vm.runInContext("adminSettlementHistory.message",c).includes("private-value"));
});
