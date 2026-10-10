import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import inverse from "./helpers/r3-manual-ledger-release.cjs";
const read = path => fs.readFileSync(path,"utf8").replace(/\r\n/g,"\n");
const extract = (text,name) => {
  const match = text.match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}","m"));
  assert(match,name); return match[0];
};

test("data callbacks retain exact RPC allowlists and pre-call identity fence", () => {
  let ready = true, calls = [];
  const context = vm.createContext({adminManualSettlementLedgerReady:()=>ready,coachManualSettlementLedgerReady:()=>ready,
    window:{TennisNoteDataClient:{rpc:(name,payload)=>{calls.push({name,payload});return payload;}}}});
  vm.runInContext(extract(read("app/admin/data/billing.js"),"adminManualSettlementLedgerRpc") + "\n" +
    extract(read("app/tennis-note-coach-app/data/sync.js"),"coachManualSettlementLedgerRpc"), context);
  for (const name of ["tn_admin_monthly_settlement_payment_state","tn_admin_record_monthly_settlement_manual_payment","tn_admin_append_monthly_settlement_payment_adjustment"]) {
    const payload={operationKey:"synthetic-operation",scope:"exact-synthetic"};
    assert.equal(context.adminManualSettlementLedgerRpc(name,payload),payload);
  }
  context.coachManualSettlementLedgerRpc("tn_coach_monthly_settlement_payment_state",{});
  assert.equal(calls.length,4);
  assert.throws(()=>context.coachManualSettlementLedgerRpc("tn_admin_record_monthly_settlement_manual_payment",{}),/denied/);
  assert.throws(()=>context.adminManualSettlementLedgerRpc("unapproved",{}),/denied/);
  ready=false;
  assert.throws(()=>context.adminManualSettlementLedgerRpc("tn_admin_monthly_settlement_payment_state",{}),/denied/);
  assert.throws(()=>context.coachManualSettlementLedgerRpc("tn_coach_monthly_settlement_payment_state",{}),/denied/);
  assert.equal(calls.length,4);
  assert.match(read("app/admin/views/billing.js"),/rpc: adminManualSettlementLedgerRpc/);
  assert.match(read("app/tennis-note-coach-app/views/settlement.js"),/rpc: coachManualSettlementLedgerRpc/);
});

test("legacy .at undefined: empty, terminal, voided and mismatched leaf semantics unchanged", () => {
  const context=vm.createContext({window:{}});
  vm.runInContext("Array.prototype.at=undefined;",context);
  vm.runInContext(read("app/shared/tennisnote-manual-settlement-ledger.js"),context);
  const ledger=context.window.TennisNoteManualSettlementLedger;
  const scope={confirmationId:"synthetic-confirm",snapshotId:"synthetic-snapshot",branchId:"synthetic-branch",coachRoleId:"synthetic-coach",
    sourceFingerprint:"a".repeat(64),month:"2099-01-01",snapshotRevision:1,calculationVersion:"r3_monthly_settlement_v1"};
  const value={...scope,settlementMonth:scope.month,ok:true,version:"r3_manual_ledger_state_v1",financialMovement:false,
    confirmedOwedAmount:1,owedAdjustmentTotal:0,currentOwedAmount:1,recordedPaidAmount:0,paymentDifference:1,
    records:[],events:[],eventCount:0,leafId:null,currentPaymentRecord:null};
  assert.equal(ledger.exactState(value,scope),true);
  value.records=[{id:"synthetic-record",sequence:1,amount:1,voided:false,supersedesPaymentRecordId:null}];
  value.leafId="synthetic-record";value.recordedPaidAmount=1;value.paymentDifference=0;
  value.currentPaymentRecord={id:value.leafId,amount:1,sequence:1,status:"manual_payment_recorded"};
  assert.equal(ledger.exactState(value,scope),true);
  value.records[0].voided=true;value.currentPaymentRecord=null;value.recordedPaidAmount=0;value.paymentDifference=1;
  assert.equal(ledger.exactState(value,scope),true);
  value.leafId="wrong-synthetic";assert.equal(ledger.exactState(value,scope),false);
});

test("all programmatic and click logout paths clear ledger before first asynchronous work", async () => {
  let resets=0,renders=0,signouts=0,returns=0,resolvePush;
  const context=vm.createContext({state:{coach:{coachRoleId:"synthetic"}},coachSettlementSelection:{},
    resetCoachSettlementHistory:()=>{resets++;},renderCoachSettlementHistory:()=>{renders++;},
    currentCoachPushDeviceId:()=>"synthetic-device",setCoachPushNotificationState:()=>{},
    returnToMemberEntry:()=>{returns++;},window:{TennisNoteDataClient:{getSession:()=>({access_token:"synthetic-memory-only"}),
      rpc:()=>new Promise(resolve=>{resolvePush=resolve;}),signOut:async()=>{signouts++;}}}});
  vm.runInContext(extract(read("app/tennis-note-coach-app/data/auth.js"),"logoutCoach") + "\n" +
    extract(read("app/tennis-note-coach-app/data/push.js"),"disableNativeCoachPushForLogout"),context);
  for (let pass=0;pass<2;pass++) {
    context.state.coach={coachRoleId:"synthetic"};
    const action=pass===0?context.logoutCoach:context.logoutCoach.bind(null);
    const work=action();
    assert.equal(context.state.coach,null);assert.equal(resets,pass+1);assert.equal(renders,pass+1);
    assert.equal(signouts,pass);resolvePush(null);await work;
  }
  assert.equal(signouts,2);assert.equal(returns,2);
  assert.match(read("app/tennis-note-coach-app/events/account.js"),/addEventListener\('click', logoutCoach\)/);
});

test("exact 18-path inverse rejects unknown addition and changed approved bytes", () => {
  inverse.validateAll();
  const added=inverse.contract.products.filter(row=>row.status==="A");
  assert.equal(added.length,2);
  for(const row of added) {
    assert.equal(inverse.restoreCandidate(row.path,read(row.path)),null);
    assert.throws(()=>inverse.restoreCandidate(row.path,read(row.path)+"//drift"),/candidate drift/);
  }
  assert.throws(()=>inverse.assertAddedAbsentAt(inverse.contract.publicBase,"app/shared/unapproved.js"),/unapproved/);
  const modified=inverse.contract.products.find(row=>row.status==="M");
  assert.throws(()=>inverse.restoreCandidate(modified.path,read(modified.path)+"//drift"),/candidate drift/);
});
