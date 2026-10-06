import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {root,manifest,sha,restore}=require("./helpers/r3-history-port.cjs");
const read=file=>fs.readFileSync(path.join(root,file),"utf8").replace(/\r\n/g,"\n");
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
function payload(version="r3_monthly_settlement_v1",remoteState="PENDING") {
  return {scope:{...scope},state:remoteState,snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:version,sourceFingerprint:"a".repeat(64),
    totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:50}},
    confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},
    reconciliation:remoteState==="PENDING"?null:{reconciliationId:"synthetic-response",status:remoteState,responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z",reason:remoteState==="DISPUTED"?"적용기간 확인 요청":""}};
}
function context(){
  const c=vm.createContext({window:{},state:{liveProfileId:"synthetic-profile",coach:{branchId:scope.branchId,coachRoleId:scope.coachRoleId}},Date,Intl,
    renderCoachSettlementHistory(){},formatCoachWon:String});
  vm.runInContext(read("app/tennis-note-coach-app/domain/settlement.js"),c);
  vm.runInContext("coachSettlementMonth=()=> '2099-01'",c);
  vm.runInContext(read("app/tennis-note-coach-app/data/sync.js"),c);
  return c;
}
test("history source extraction: canonical validators/read RPC and exact inverse layer",()=>{
  assert.equal(manifest.mode,"coach-confirmed-history-read-only");
  for(const e of manifest.files){const s=read(e.path),v=JSON.parse(read("app/release.json")).version;assert.equal(sha(restore(e.path,s).replaceAll(v,manifest.publicVersion)),e.baseSha256,e.path);assert.throws(()=>restore(e.path,s+"// drift"))}
  for(const e of manifest.functions){
    const m=read(e.target).match(new RegExp("(?:async )?function "+e.name+"\\([\\s\\S]*?\\n\\}"));
    assert(m,e.name);assert.equal(sha(m[0]),e.projectedSha256,e.name);
    assert.equal(sha(e.privateSource),e.privateSha256,e.name);
    let source=e.privateSource;
    for(const h of e.transforms){assert.equal(source.split(h.before).length,2,e.name);source=source.replace(h.before,()=>h.after)}
    assert.equal(source,m[0],e.name);
  }
});
test("history exact v1/v2, confirmed revision and prior response are distinct from preview",()=>{
  const c=context();
  for(const v of ["r3_monthly_settlement_v1","r3_effective_settlement_v2"])for(const status of ["PENDING","ACKNOWLEDGED","DISPUTED"])
    assert.equal(c.coachSettlementReconciliationPayloadIsExact(payload(v,status),scope),true);
  assert(c.coachSettlementReconciliationPayloadIsExact({scope,state:"EMPTY",snapshot:null,confirmation:null,reconciliation:null},scope));
  assert(!c.coachSettlementReconciliationPayloadIsExact({...payload(),state:"EMPTY"},scope));
});
test("history wrong scope/version/revision/totals/time/reason fail closed",()=>{
  const c=context();
  const changes=[p=>p.scope.branchId="other",p=>p.scope.coachRoleId="other",p=>p.scope.settlementMonth="2099-02-01",p=>p.snapshot.calculationVersion="unknown",p=>p.snapshot.revision=0,p=>p.snapshot.sourceFingerprint="bad",p=>p.snapshot.totals.totalSettlementAmount=NaN,p=>p.snapshot.totals.settledMinutes=-1,p=>p.confirmation.status="pending",p=>p.confirmation.confirmedAt="bad",p=>p.reconciliation={status:"ACKNOWLEDGED"}];
  for(const change of changes){const p=payload();change(p);assert.equal(c.coachSettlementReconciliationPayloadIsExact(p,scope),false)}
  const p=payload(undefined,"DISPUTED");p.reconciliation.reason='<img src=x onerror="attack">';assert.equal(c.coachSettlementReconciliationPayloadIsExact(p,scope),false);
});
test("actual data module deduplicates inflight reads; immutable history never persisted",async()=>{
  const c=context(),calls=[];let resolve;
  c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:(name,args)=>{calls.push({name,args});return new Promise(r=>resolve=r)}};
  const first=c.syncCoachSettlementHistoryFromServer(),second=c.syncCoachSettlementHistoryFromServer();
  assert.equal(calls.length,1);assert.equal(calls[0].name,"tn_coach_monthly_settlement_reconciliation_state");assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{target_branch_id:scope.branchId,target_coach_role_id:scope.coachRoleId,target_month:scope.settlementMonth});
  resolve(payload());assert.equal(await first,true);assert.equal(await second,true);
  assert.equal(vm.runInContext("coachSettlementHistory.coachSettlementReconciliation.snapshot.totals.totalSettlementAmount",c),50);
  assert(!Object.keys(c.state).some(k=>k.includes("Reconciliation")));
});
test("logout/profile/month/branch/session loss fence late history results",async()=>{
  for(const mutate of [c=>c.resetCoachSettlementHistory(),c=>c.state.liveProfileId="other-profile",c=>c.state.coach.branchId="other",c=>c.state.coach.coachRoleId="other",c=>vm.runInContext("coachSettlementMonth=()=> '2099-02'",c),c=>c.window.TennisNoteDataClient.getSession=()=>null]){
    const c=context();let resolve;c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:()=>new Promise(r=>resolve=r)};
    const p=c.syncCoachSettlementHistoryFromServer();mutate(c);resolve(payload());assert.equal(await p,false);
    assert.equal(vm.runInContext("coachSettlementHistory.coachSettlementReconciliation",c),null);
    assert.equal(vm.runInContext("coachSettlementHistory.coachSettlementReconciliationLoading",c),false);
  }
});
test("new month wins over old response; read error/invalid do not become zero or expose raw error",async()=>{
  const c=context(),pending=[];c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic"}),rpc:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
  const old=c.syncCoachSettlementHistoryFromServer();c.resetCoachSettlementHistory();const current=c.syncCoachSettlementHistoryFromServer();pending[1].resolve(payload());assert(await current);pending[0].resolve({...payload(),state:"EMPTY",snapshot:null,confirmation:null});assert.equal(await old,false);
  const bad=c.syncCoachSettlementHistoryFromServer();pending[2].reject(Error("private-details forbidden"));assert.equal(await bad,false);
  assert.equal(vm.runInContext("coachSettlementHistory.coachSettlementReconciliation",c),null);
  assert(!vm.runInContext("coachSettlementHistory.coachSettlementReconciliationMessage",c).includes("private-details"));
});
test("no credentials means RPC zero; no response form or financial write entry",async()=>{
  const c=context();let calls=0;c.window.TennisNoteDataClient={getSession:()=>null,rpc:()=>{calls++}};
  assert.equal(await c.syncCoachSettlementHistoryFromServer(),false);assert.equal(calls,0);
  const html=read("app/tennis-note-coach-app/index.html"),view=read("app/tennis-note-coach-app/views/settlement.js");
  for(const id of ["coachSettlementReconciliationForm","coachSettlementReconciliationSubmit","coachSettlementReconciliationReason"])assert(!html.includes('id="'+id+'"'));
  assert(!view.includes("innerHTML = `${"));
  const data=read("app/tennis-note-coach-app/data/sync.js");const part=data.slice(data.indexOf("const coachSettlementHistory ="));
  for(const name of ["tn_coach_respond_monthly_settlement_confirmation","tn_admin_confirm_monthly_settlement_snapshot","tn_admin_create_monthly_settlement_snapshot","saveSnapshot("])assert(!part.includes(name));
});
