import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {root, manifest, sha, normalize, canonicalRelease, restore} = require("./helpers/r3-effective-port.cjs");
const read = file => normalize(fs.readFileSync(path.join(root, file), "utf8"));
const candidateSource = file => canonicalRelease(file,read(file),JSON.parse(read("app/release.json")).version);
const scope = {branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const payload = () => ({ok:true,calculationVersion:"r3_effective_settlement_v2",scope:{...scope},sourceFingerprint:"a".repeat(64),confirmationReady:false,
  totals:{totalSettlementAmount:50,revenueAmount:100,settledSessions:1,settledMinutes:40,paymentCount:1},
  sourceManifest:{tickets:[{id:"synthetic-ticket",userId:"synthetic-user"}]},
  lines:[{sourceTicketId:"synthetic-ticket",sourcePaymentId:"synthetic-payment",settlementAmount:50,settledSessions:1,settledMinutes:40,totalSessions:5,netAmount:100,calculationComponents:[]}]});
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
  for(const e of manifest.functions){const source=read(e.target);const fn=source.match(new RegExp("(?:async )?function "+e.name+"\\([\\s\\S]*?\\n\\}"))[0];assert.equal(sha(fn),e.projectedSha256,e.name)}
  assert.equal(sha(read("app/shared/tennisnote-settlement-adjustment.js")),manifest.sharedCanonicalSha256);
  assert(!read("app/admin/views/billing.js").includes("renderMonthlySettlementConfirmation("));
  assert(!read("app/tennis-note-coach-app/views/settlement.js").includes("renderCoachSettlementReconciliation("));
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
