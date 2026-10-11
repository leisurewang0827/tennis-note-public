import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {root, manifest, sha, normalize, canonicalRelease, restore} = require("./helpers/r3-effective-port.cjs");
const read = file => normalize(fs.readFileSync(path.join(root, file), "utf8"));
const legacyRead = file => require("./helpers/legacy-integrated-source.cjs").read(file);
const candidateSource = file => canonicalRelease(file,legacyRead(file),JSON.parse(read("app/release.json")).version);
const scope = {branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const payload = () => ({ok:true,calculationVersion:"r3_effective_settlement_v2",scope:{...scope},sourceFingerprint:"a".repeat(64),confirmationReady:false,
  totals:{totalSettlementAmount:50,revenueAmount:100,settledSessions:1,settledMinutes:40,paymentCount:1},
  sourceManifest:{tickets:[{id:"synthetic-ticket",userId:"synthetic-user"}]},
  lines:[{sourceTicketId:"synthetic-ticket",sourcePaymentId:"synthetic-payment",settlementAmount:50,settledSessions:1,settledMinutes:40,totalSessions:5,netAmount:100,calculationComponents:[]}]});
const fencePort = require("./helpers/r3-admin-history-port.cjs");
function previewContext() {
  const pending = [], dom = new Map();
  const c = vm.createContext({window:{},state:{view:"billing",billingMonth:"2099-01",settlementPage:0},adminDemoMode:false,
    renderAdminSettlementHistory(){},
    adminImportAuthState:{profile:{id:"synthetic-admin",role:"admin"},user:{id:"synthetic-auth"}},
    token:"synthetic-session",admitted:true,branch:scope.branchId,
    activeOperationBranchId:()=>c.branch,operationBranchCoaches:()=>[{serverRoleId:scope.coachRoleId,branchId:c.branch,name:"합성 코치"}],
    effectiveSettlementPreviewSignature:()=>JSON.stringify([c.branch,c.state.billingMonth]),
    operationsRole:()=>c.adminImportAuthState.profile?.role,adminApprovalReady:()=>c.admitted,
    $:selector=>{if(!dom.has(selector))dom.set(selector,{innerHTML:"",textContent:""});return dom.get(selector);},
    money:{format:n=>String(n)},tickets:[],expiredTickets:[],adminLiveDataState:{settlementTickets:[]},
    billingPageSize:10,normalizeDashboardPage:()=>0,renderDashboardPager(){},escapeHtml:s=>String(s)});
  c.window.TennisNoteDataClient={getSession:()=>c.token?{access_token:c.token}:null,rpc:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"),c);
  const source=read("app/admin/data/billing.js");
  vm.runInContext(source.match(/^const effectiveSettlementPreview = .*;$/m)[0],c);
  for(const e of fencePort.previewFenceManifest.functions){
    const fn=read(e.target).match(new RegExp("^(?:async )?function "+e.name+"\\([\\s\\S]*?^}","m"))[0];vm.runInContext(fn,c);
  }
  vm.runInContext(read("app/admin/views/billing.js").match(/^function renderCoachSettlementPreview\([\s\S]*?^}/m)[0],c);
  return {c,pending,preview:()=>vm.runInContext("effectiveSettlementPreview",c)};
}

test("같은 범위 신원 복구는 exactly-one 재조회, 일반 오류 자동 루프0",async()=>{
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  for(const kind of ["session","profile","auth","role","admission","client"]){
    const s=previewContext(),c=s.c,client=c.window.TennisNoteDataClient;
    const profile=c.adminImportAuthState.profile,user=c.adminImportAuthState.user;
    if(kind==="session")c.token="";
    if(kind==="profile")c.adminImportAuthState.profile=null;
    if(kind==="auth")c.adminImportAuthState.user=null;
    if(kind==="role")profile.role="member";
    if(kind==="admission")c.admitted=false;
    if(kind==="client")c.window.TennisNoteDataClient=null;
    c.renderCoachSettlementPreview();await tick();assert.equal(s.pending.length,0);assert(s.preview().error);
    c.token="synthetic-session";profile.role="admin";c.adminImportAuthState.profile=profile;
    c.adminImportAuthState.user=user;c.admitted=true;c.window.TennisNoteDataClient=client;
    c.renderCoachSettlementPreview();c.renderCoachSettlementPreview();c.renderCoachSettlementPreview();
    assert.equal(s.pending.length,1,kind);assert.equal(s.preview().loading,true);assert.equal(s.preview().error,"");
    s.pending[0].resolve(payload());await tick();assert.equal(s.preview().results[0].value.estimatedSettlement,50);
    c.renderCoachSettlementPreview();assert.equal(s.pending.length,1);
    const ordinary=c.refreshEffectiveSettlementPreview(c.effectiveSettlementPreviewSignature());
    s.pending[1].reject(Error("synthetic server unavailable"));await ordinary;
    c.renderCoachSettlementPreview();c.renderCoachSettlementPreview();assert.equal(s.pending.length,2);
    assert.equal(s.preview().results.length,1);assert(s.preview().results[0].error);
  }
});

test("복구 재조회 중 범위 변경·응답 역순에도 새 결과 소유권 유지",async()=>{
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  for(const failure of [false,true]){
    const s=previewContext(),c=s.c;c.token="";c.renderCoachSettlementPreview();await tick();
    c.token="synthetic-session";c.renderCoachSettlementPreview();const old=s.pending[0];
    c.state.billingMonth="2099-02";c.renderCoachSettlementPreview();assert.equal(s.pending.length,2);
    const newer=payload();newer.scope.settlementMonth="2099-02-01";s.pending[1].resolve(newer);await tick();
    if(failure)old.reject(Error("synthetic obsolete error"));else old.resolve(payload());await tick();
    assert.equal(s.preview().loading,false);assert.equal(s.preview().error,"");
    assert.equal(s.preview().results[0].value.estimatedSettlement,50);c.renderCoachSettlementPreview();assert.equal(s.pending.length,2);
  }
});
test("공개 계정 보호 exact source/outer inverse, 기존 golden/hash는 그대로",()=>{
  for(const item of fencePort.previewFenceManifest.functions){
    const fn=legacyRead(item.target).match(new RegExp("^(?:async )?function "+item.name+"\\([\\s\\S]*?^}","m"))[0];
    assert.equal(sha(fn),item.projectedSha256,item.name);
    assert.equal(sha(fn.replaceAll("escapeHtml(","escapeHtmlText(")),item.privateSha256,item.name);
  }
  for(const entry of fencePort.previewFenceManifest.files){
    const source=legacyRead(entry.path);assert.equal(sha(fencePort.restorePreviewIdentityFence(entry.path,source)),entry.baseSha256);
    for(const drift of [source+"\n",source.replace(entry.hunks[0].after,""),source.replace(entry.hunks[0].after,()=>entry.hunks[0].after+entry.hunks[0].after)]){
      assert.throws(()=>fencePort.restorePreviewIdentityFence(entry.path,drift),/candidate drift/);
    }
  }
  assert.equal(fencePort.previewFenceManifest.preservedCall,"renderAdminSettlementHistory");
  assert(read("app/admin/views/billing.js").includes("renderAdminSettlementHistory();"));
});
test("공개 미리보기 actor/session/client/scope 변경 후 성공·오류 응답은 폐기",async()=>{
  const changes=[c=>c.adminImportAuthState.profile.role="member",c=>c.adminImportAuthState.profile.id="other-profile",
    c=>c.adminImportAuthState.user.id="other-auth",c=>c.token="",c=>c.token="other-session",
    c=>c.window.TennisNoteDataClient={...c.window.TennisNoteDataClient},c=>c.admitted=false,
    c=>c.branch="other-branch",c=>c.state.billingMonth="2099-02"];
  for(const change of changes)for(const error of [false,true]){
    const s=previewContext(),p=s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());change(s.c);
    if(error)s.pending[0].reject(Error("synthetic old error"));else s.pending[0].resolve(payload());await p;
    assert.equal(s.preview().results.length,0);assert.equal(s.preview().loading,false);assert(s.preview().error);
  }
});
test("initial identity 없음 RPC0, 역순·다른 계정 소유권·cache 재검사",async()=>{
  for(const change of [c=>c.token="",c=>c.adminImportAuthState.profile=null,c=>c.adminImportAuthState.user=null,c=>c.admitted=false]){
    const s=previewContext();change(s.c);await s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());assert.equal(s.pending.length,0);
  }
  const s=previewContext(),a=s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
  const b=s.c.refreshEffectiveSettlementPreview(s.c.effectiveSettlementPreviewSignature());
  s.pending[1].resolve(payload());await b;s.pending[0].reject(Error("synthetic obsolete"));await a;
  assert.equal(s.preview().results[0].value.estimatedSettlement,50);assert.equal(s.preview().error,"");
  s.c.token="new-session";s.c.renderEffectiveSettlementPreview();assert.equal(s.preview().results.length,0);
  assert(!s.preview().signature.includes(s.c.token));
});
function context() {
  const c = vm.createContext({window:{},state:{coach:{branchId:scope.branchId,coachRoleId:scope.coachRoleId}},Date,Intl,
    renderCoachSettlement(){},saveSnapshot(){},formatCoachWon:value=>String(value)});
  vm.runInContext(read("app/shared/tennisnote-settlement-adjustment.js"),c);
  vm.runInContext(read("app/tennis-note-coach-app/domain/settlement.js"),c);
  vm.runInContext("coachSettlementMonth=()=> '2099-01'",c);
  vm.runInContext(read("app/tennis-note-coach-app/data/sync.js"),c);
  return c;
}
test("R3 원본 projection: 함수·파일 해시 및 모든 기존 golden 역변환",()=>{
  assert.equal(manifest.mode,"read-only-preview-no-confirmation-ui");
  for(const e of manifest.files){const source=candidateSource(e.path);const base=restore(e.path,source);assert.equal(base===null?e.new:sha(base)===e.baseSha256,true,e.path)}
  // Verify the exact history layer first, then the unchanged prior function hashes.
  for(const e of manifest.functions){const source=require("./helpers/r3-history-port.cjs").restore(e.target,legacyRead(e.target));const fn=source.match(new RegExp("(?:async )?function "+e.name+"\\([\\s\\S]*?\\n\\}"))[0];assert.equal(sha(fn),e.projectedSha256,e.name)}
  assert.equal(sha(read("app/shared/tennisnote-settlement-adjustment.js")),manifest.sharedCanonicalSha256);
  assert(!legacyRead("app/admin/views/billing.js").includes("renderMonthlySettlementConfirmation("));
  assert(!legacyRead("app/tennis-note-coach-app/views/settlement.js").includes("renderCoachSettlementReconciliation("));
});
test("동일 서버 금액·20+20 실제 40분·확정 OFF·회원 exact identity만",()=>{
  const c=context(),p=c.window.TennisNoteSettlementAdjustment.effectiveProjection(payload(),scope);
  assert.equal(p.estimatedSettlement,50);assert.equal(p.settledMinutes,40);assert.equal(p.confirmationReady,false);
  c.state.coachSettlement=p;
  assert.equal(c.coachSettlementRowsForMember({serverUserId:"synthetic-user"}).length,1);
  assert.equal(c.coachSettlementRowsForMember({serverUserId:"other-user",name:"회원권별 계산 근거"}).length,0);
  assert.equal(c.coachSettlementRowsForMember({name:"회원권별 계산 근거"}).length,0);
  assert.match(c.coachSettlementRuleLabel(p),/미리보기/);
});
test("scope/version/hash/합계/ticket invalid는 fail closed, HOLD/잠금/권한 오류는 0원 아님",()=>{
  const c=context(),m=c.window.TennisNoteSettlementAdjustment;
  for(const mutate of [p=>p.scope.branchId="other",p=>p.scope.coachRoleId="other",p=>p.scope.settlementMonth="2099-02-01",p=>p.calculationVersion="v1",p=>p.sourceFingerprint="bad",p=>p.totals.totalSettlementAmount=51,p=>p.totals.paymentCount=-1,p=>p.lines[0].sourceTicketId="other"]){const p=payload();mutate(p);assert.throws(()=>m.effectiveProjection(p,scope))}
  assert.match(m.effectiveError({message:"settlement_hold_refund"}),/임의 금액/);
  assert.match(m.effectiveError({message:"55P03 lock timeout"}),/변경 중/);
  assert.match(m.effectiveError({message:"forbidden"}),/권한/);
});
test("실제 coach data module: 응답 역순·scope 변경·HOLD·재시도 stale 금액 0",async()=>{
  const c=context(),pending=[];c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-only"}),rpc:(name,args)=>{
    assert.equal(name,"tn_coach_settlement_scope_v2");assert.equal(args.target_branch_id,scope.branchId);assert.equal(args.target_coach_role_id,scope.coachRoleId);
    return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  const first=c.syncCoachSettlementFromServer(),second=c.syncCoachSettlementFromServer();
  pending[1].resolve(payload());assert.equal(await second,true);
  const old=payload();old.totals.totalSettlementAmount=9;old.lines[0].settlementAmount=9;pending[0].resolve(old);assert.equal(await first,false);assert.equal(c.state.coachSettlement.estimatedSettlement,50);
  const fail=c.syncCoachSettlementFromServer();pending[2].reject(Error("settlement_hold_refund"));assert.equal(await fail,false);assert.equal(c.state.coachSettlement,null);assert.match(c.state.coachSettlementError,/확인 필요/);
  const shifted=c.syncCoachSettlementFromServer();c.state.coach.coachRoleId="other-role";pending[3].resolve(payload());assert.equal(await shifted,false);assert.equal(c.state.coachSettlement,null);
});
