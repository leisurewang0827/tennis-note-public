import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium, webkit } = createRequire(import.meta.url)("playwright");

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const between = (source, start, end = "") => {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `source marker: ${start}`);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.ok(!end || to !== -1, `end marker: ${end}`);
  return source.slice(from, to === -1 ? source.length : to);
};
const adminActions = between(read("app/admin/actions/billing.js"), "// R3 monthly snapshot writer.");
const adminView = between(read("app/admin/views/billing.js"), "function renderAdminR3SettlementWriter()");
const adminEvents = read("app/admin/events/billing.js");
const adminHtml = between(read("app/admin/index.html"), '<section id="adminSettlementHistory"', "</section>") + "</section>";
const coachDomain = read("app/tennis-note-coach-app/domain/settlement.js");
const coachExactValidator = between(coachDomain, "function coachSettlementReconciliationScopeMatches", "function coachSettlementReconciliationErrorContract");
const adminPayoutRefresh = between(adminActions, "async function refreshAdminMonthlySettlementPayoutState()", "function adminR3EnsurePayoutOperation");

const adminHarness = `
const state={billingMonth:"2026-09"};
const adminImportAuthState={profile:{id:"synthetic-admin"}};
const adminSettlementHistory={coachRoleId:"coach-role",key:"",loading:false,value:null,message:""};
const adminMonthlySettlementWrite={requestId:0,status:"EMPTY",loading:false,submitting:false,message:"계산 결과를 먼저 확인해 주세요.",preview:null,scopeState:null,signature:"",snapshotOperationKey:"",confirmationOperationKey:"",payoutState:null,payoutReadValid:false,payoutLoading:false,payoutSubmitting:false,payoutRequestId:0,payoutOperationSignature:"",payoutOperationKey:"",payoutReverseOperationSignature:"",payoutReverseOperationKey:"",payoutMessage:"",payoutUncertain:false};
let operationNumber=0;
const $=selector=>document.querySelector(selector); const $$=selector=>Array.from(document.querySelectorAll(selector));
const money=new Intl.NumberFormat("en-US");
function activeOperationBranchId(){return "synthetic-branch"}
function adminSettlementHistoryScope(){return {branchId:activeOperationBranchId(),coachRoleId:adminSettlementHistory.coachRoleId,settlementMonth:state.billingMonth+"-01"}}
function adminSettlementHistoryCoaches(){return [{serverRoleId:"coach-role",name:"합성 코치"}]}
function adminSettlementHistoryScopeKey(scope=adminSettlementHistoryScope()){return [scope.branchId,scope.coachRoleId,scope.settlementMonth].join(":")}
function adminSettlementHistoryAccessReady(){return true}
function operationsRole(){return "admin"}
function adminApprovalReady(){return true}
function adminLocalDateKey(){return "2026-09-30"}
function createAdminOperationKey(prefix){operationNumber+=1;return prefix+"-synthetic-"+operationNumber}
function renderAdminSettlementHistory(){renderAdminR3SettlementWriter()}
function normalizeAdminHistoryReason(value){return String(value||"")}
const calls=[]; let confirmed=false; let activeRecord=null; let events=[];
const scope=adminSettlementHistoryScope();
const sourceFingerprint="a".repeat(64);
const snapshot={snapshotId:"synthetic-snapshot",revision:2,sourceFingerprint,scope,totals:{paymentCount:1,ticketCount:1,lessonCount:1,sessionCount:1,settledSessions:1,settledMinutes:60,totalSettlementAmount:50000}};
const confirmation={confirmationId:"synthetic-confirmation",status:"confirmed"};
function baseState(){return {state:confirmed?"CONFIRMED":"EMPTY",scope,snapshot:confirmed?snapshot:null,confirmation:confirmed?confirmation:null,reconciliation:confirmed?{status:"acknowledged"}:null}}
window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==="tn_admin_preview_monthly_settlement_snapshot") return {scope,sourceFingerprint,totals:snapshot.totals,lines:[{}]};
  if(name==="tn_admin_monthly_settlement_scope_state") return baseState();
  if(name==="tn_admin_create_monthly_settlement_snapshot") return snapshot;
  if(name==="tn_admin_confirm_monthly_settlement_snapshot"){confirmed=true;return {...baseState(),payout:undefined}}
  if(name==="tn_monthly_settlement_payout_state") return {...baseState(),payout:{state:activeRecord?"RECORDED":events.length?"REVERSED":"NOT_RECORDED",recordingEnabled:true,activeRecord,events:events.map(event=>({...event,reversed:event.eventType==="payout_recorded"&&events.some(candidate=>candidate.eventType==="payout_record_reversed"&&candidate.reversalOfEventId===event.eventId)}))}};
  if(name==="tn_admin_record_monthly_settlement_payout"){
    const event={eventId:"synthetic-record",eventType:"payout_recorded",snapshotId:snapshot.snapshotId,snapshotRevision:snapshot.revision,sourceFingerprint,operationKeyHash:"a".repeat(64),amount:50000,paidOn:args.target_paid_on,paymentMethod:args.target_payment_method,reversed:false};
    events.push(event);activeRecord={...event};return {payoutEventId:event.eventId};
  }
  if(name==="tn_admin_reverse_monthly_settlement_payout"){
    const event={eventId:"synthetic-reversal",eventType:"payout_record_reversed",snapshotId:activeRecord.snapshotId,snapshotRevision:activeRecord.snapshotRevision,sourceFingerprint,operationKeyHash:"a".repeat(64),amount:activeRecord.amount,reversalOfEventId:activeRecord.eventId,reason:args.target_reason};
    events.push(event);activeRecord=null;return {payoutEventId:event.eventId};
  }
  throw Error("unexpected-rpc:"+name);
}};
function renderBilling(){ } function renderCoachSettlementPreview(){ } function saveSnapshot(){ }
function openOnsitePaymentModal(){} function closeOnsitePaymentModal(){} function syncOnsitePaymentSourceTickets(){}
function syncOnsitePaymentCoaches(){} function updateOnsitePaymentAmount(){} function syncOnsitePaymentScheduleChoice(){}
function submitOnsitePayment(){} function confirmRefundFromModal(){} function confirmPaymentCancelFromModal(){}
function closePaymentCancelModal(){} function closeRefundModal(){} function cancelManualRefundRequestFromModal(){}
function rejectMemberRefundRequestFromModal(){} function reconcileRefundFromModal(){} function downloadSettlementCsv(){}
`;

async function exerciseAdmin(browserType) {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(4000);
    await page.setContent(adminHtml);
    await page.addScriptTag({ content: `${adminHarness}\n${adminActions}\n${adminView}\n${adminEvents}\nbindBillingEvents();` });
    await page.evaluate(() => { const option = document.createElement("option"); option.value = "coach-role"; option.textContent = "합성 코치"; $("#adminSettlementHistoryCoach").append(option); });
    await page.locator("#adminSettlementHistoryCoach").selectOption("coach-role");
    await page.evaluate(() => renderAdminR3SettlementWriter());
    const beforePreview = await page.evaluate(() => ({ role: adminSettlementHistory.coachRoleId, scope: adminSettlementHistoryScope(), ready: adminSettlementHistoryAccessReady(), token: Boolean(window.TennisNoteDataClient?.getSession?.()?.access_token), profile: adminImportAuthState.profile?.id, coachCount: adminSettlementHistoryCoaches().length, disabled: $("#adminR3SettlementPreview").disabled }));
    assert.equal(beforePreview.disabled, false, JSON.stringify(beforePreview));
    await page.locator("#adminR3SettlementPreview").click();
    await page.waitForFunction(() => adminMonthlySettlementWrite.status === "READY");
    await page.locator("#adminR3SettlementConfirm").click();
    await page.waitForFunction(() => adminMonthlySettlementWrite.status === "CONFIRMED" && adminMonthlySettlementWrite.payoutReadValid);
    assert.equal(await page.locator("#adminR3PayoutRecord").isDisabled(), false);
    assert.equal(await page.locator("#adminR3PayoutReverse").isDisabled(), true);

    await page.locator("#adminR3PayoutDetails > summary").click();
    await page.locator("#adminR3PayoutDate").fill("2026-09-30");
    await page.locator("#adminR3PayoutMethod").selectOption("bank_transfer");
    await page.evaluate(() => {
      window.__releaseHash = null;
      window.__operationHashStarted = false;
      window.__operationHashGate = new Promise(resolve => { window.__releaseHash = resolve; });
      adminR3PayoutOperationHash = async () => { window.__operationHashStarted = true; await window.__operationHashGate; return "a".repeat(64); };
    });
    await page.locator("#adminR3PayoutRecord").click();
    await page.waitForFunction(() => window.__operationHashStarted);
    assert.equal(await page.locator("#adminR3PayoutRecord").isDisabled(), true);
    await page.evaluate(() => void recordAdminMonthlySettlementPayout());
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === "tn_admin_record_monthly_settlement_payout").length), 0);
    assert.equal(await page.evaluate(() => adminMonthlySettlementWrite.payoutSubmitting), true);
    await page.evaluate(() => window.__releaseHash());
    await page.waitForFunction(() => !adminMonthlySettlementWrite.payoutSubmitting && Boolean(adminMonthlySettlementWrite.payoutState?.payout?.activeRecord));
    assert.equal(await page.locator("#adminR3PayoutRecord").isDisabled(), true);
    await page.locator("#adminR3PayoutReverseReason").selectOption("wrong_date");
    assert.equal(await page.locator("#adminR3PayoutReverse").isDisabled(), false);
    await page.evaluate(() => {
      window.__releaseReverseHash = null;
      window.__reverseHashStarted = false;
      window.__reverseHashGate = new Promise(resolve => { window.__releaseReverseHash = resolve; });
      adminR3PayoutOperationHash = async () => { window.__reverseHashStarted = true; await window.__reverseHashGate; return "a".repeat(64); };
    });
    await page.locator("#adminR3PayoutReverse").click();
    await page.waitForFunction(() => window.__reverseHashStarted);
    assert.equal(await page.locator("#adminR3PayoutReverse").isDisabled(), true);
    await page.evaluate(() => void reverseAdminMonthlySettlementPayout());
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === "tn_admin_reverse_monthly_settlement_payout").length), 0);
    await page.evaluate(() => window.__releaseReverseHash());
    await page.waitForFunction(() => !adminMonthlySettlementWrite.payoutSubmitting && adminMonthlySettlementWrite.payoutState?.payout?.activeRecord === null);
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === "tn_admin_confirm_monthly_settlement_snapshot").length), 1);
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === "tn_admin_record_monthly_settlement_payout").length), 1);
    assert.equal(await page.evaluate(() => calls.filter(call => call.name === "tn_admin_reverse_monthly_settlement_payout").length), 1);
    assert.equal(await page.evaluate(() => calls.some(call => /transfer|refund/i.test(call.name))), false);
    assert.match(await page.locator("#adminR3PayoutMessage").innerText(), /환불|금융 거래/);
    assert.match(await page.locator("#adminR3PayoutReadback").innerText(), /월별 보존 이력[\s\S]*정정 완료[\s\S]*정정 기록/);
    assert.equal(await page.evaluate(() => adminR3PayoutEventMatchesSnapshot({snapshotId:"synthetic-snapshot",snapshotRevision:2,sourceFingerprint:"a".repeat(64)},snapshot)), true);
    assert.equal(await page.evaluate(() => adminR3PayoutEventMatchesSnapshot({snapshotId:"synthetic-snapshot",snapshotRevision:1,sourceFingerprint:"b".repeat(64)},snapshot)), false);
  } finally { await browser.close(); }
}

test("공개 관리자 모듈: 계산본·수동기록·정정의 실제 DOM/RPC 연결을 Chromium과 WebKit에서 확인", async () => {
  await exerciseAdmin(chromium);
  await exerciseAdmin(webkit);
  const eventSource = read("app/admin/events/billing.js");
  for (const id of ["adminR3SettlementPreview", "adminR3SettlementConfirm", "adminR3PayoutRecord", "adminR3PayoutReverse"]) assert.match(eventSource, new RegExp(`#${id}.*`));
});

test("기존 공개 관리자·코치 modular entry가 실제 검증한 모듈을 로드하고 새 메뉴는 만들지 않음", () => {
  const admin = read("app/admin/index.html");
  const coach = read("app/tennis-note-coach-app/index.html");
  for (const path of ["./events/billing.js", "./views/billing.js", "./data/billing.js", "./actions/billing.js"]) assert.ok(admin.includes(path));
  assert.match(coach, /data\/sync\.js/);
  assert.match(coach, /views\/settlement\.js/);
  assert.equal((admin.match(/id="adminSettlementHistory"/g) || []).length, 1);
  assert.equal((coach.match(/id="coachSettlementReconciliation"/g) || []).length, 1);
});

test("공개 코치 모듈은 실제 SQL 응답 계약을 검증하고 자기 범위 불일치는 버림", async () => {
  const sync = read("app/tennis-note-coach-app/data/sync.js");
  const view = read("app/tennis-note-coach-app/views/settlement.js");
  const syncPart = between(sync, "const coachSettlementHistory =");
  const viewPart = between(view, "function renderCoachSettlementHistory()");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const coachHtml = between(read("app/tennis-note-coach-app/index.html"), '<section id="coachSettlementReconciliation"', "</section>") + "</section>";
    await page.setContent(coachHtml);
    await page.addScriptTag({ content: `
      let coachSettlementHistoryPending=null;
      const state={liveProfileId:"synthetic-coach",coach:{branchId:"synthetic-branch",coachRoleId:"synthetic-role"}};
      const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2026-09-01"};
      function coachSettlementReconciliationScope(){return scope}
      function coachSettlementReconciliationScopeSignature(value=scope){return [value.branchId,value.coachRoleId,value.settlementMonth].join(":")}
      ${coachExactValidator}
      function coachSettlementReconciliationErrorContract(){return {state:"ERROR",message:"read failed"}}
      function coachSettlementReconciliationStateLabel(value){return value}
      function coachSettlementReconciliationDefaultMessage(){return "기본 상태"}
      function coachSettlementReconciliationTimeLabel(){return "2026. 9. 30."}
      function formatCoachWon(value){return Number(value).toLocaleString("ko-KR")+"원"}
      const $=selector=>document.querySelector(selector);
      function renderCoachSettlementHistory(){ }
      const calls=[]; const base={ok:true,state:"ACKNOWLEDGED",scope,snapshot:{snapshotId:"synthetic-snapshot",revision:2,sourceFingerprint:"b".repeat(64),status:"calculated",calculationVersion:"r3_effective_settlement_v2",totals:{paymentCount:1,ticketCount:1,lessonCount:1,sessionCount:1,substituteSessionCount:0,revenueAmount:50000,refundedAmount:0,settlementBaseAmount:50000,settledSessions:2,settledMinutes:80,ownSettlementAmount:50000,substituteSettlementAmount:0,totalSettlementAmount:50000}},confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2026-09-30T09:00:00Z"},reconciliation:{reconciliationId:"synthetic-reconciliation",status:"ACKNOWLEDGED",reason:"",responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2026-09-30T09:05:00Z"}};
      let wrongScope=false;
      const client={getSession:()=>({access_token:"synthetic-session"}),rpc:async(name,args)=>{calls.push({name,args});if(name==="tn_coach_monthly_settlement_reconciliation_state")return base;if(name==="tn_monthly_settlement_payout_state"){const result={...base,payout:{state:"RECORDED",recordingEnabled:true,activeRecord:{eventId:"synthetic-record",snapshotId:base.snapshot.snapshotId,snapshotRevision:2,sourceFingerprint:base.snapshot.sourceFingerprint,amount:50000,paidOn:"2026-09-30",paymentMethod:"bank_transfer"},events:[]}};if(wrongScope)result.scope={...scope,coachRoleId:"other-role"};return result}throw Error("unexpected:"+name)}};
      window.TennisNoteDataClient=client;
      ` + syncPart + "\n" + viewPart + `
      coachSettlementHistory.coachSettlementReconciliationRequestId=0;
    ` });
    await page.evaluate(() => syncCoachSettlementHistoryFromServer());
    assert.equal(await page.evaluate(() => coachSettlementReconciliationPayloadIsExact(base, scope)), true);
    assert.equal(await page.evaluate(() => coachSettlementReconciliationPayloadIsExact({ ...base, scope: { ...scope, coachRoleId: "other-role" } }, scope)), false);
    assert.deepEqual(await page.evaluate(() => calls.map(call => call.name)), ["tn_coach_monthly_settlement_reconciliation_state", "tn_monthly_settlement_payout_state"]);
    assert.equal(await page.evaluate(() => coachSettlementHistory.coachSettlementPayoutState.payout.activeRecord.amount), 50000);
    await page.evaluate(() => renderCoachSettlementHistory());
    assert.match(await page.locator("#coachSettlementReconciliationSummary").innerText(), /수동 지급 기록/);
    assert.match(await page.locator("#coachSettlementReconciliationSummary").innerText(), /실제 송금 여부는 별도 확인/);
    assert.equal(await page.evaluate(() => calls.some(call => /record|reverse|confirm/i.test(call.name))), false);

    await page.evaluate(async () => {
      resetCoachSettlementHistory(); wrongScope=true;
      await syncCoachSettlementHistoryFromServer();
    });
    assert.equal(await page.evaluate(() => coachSettlementHistory.coachSettlementPayoutState), null);
    assert.match(await page.evaluate(() => coachSettlementHistory.coachSettlementPayoutMessage), /확인하지 못했습니다/);
  } finally { await browser.close(); }
});

test("관리자 payout 늦은 readback은 client·profile·role·잠금·승인 문맥이 바뀌면 수용하지 않음", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent("<main></main>");
    await page.addScriptTag({ content: `
      const env={role:"admin",profileId:"synthetic-admin",access:true,approval:true,unlocked:true,exactCoach:true};
      const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2026-09-01"};
      const expected={snapshotId:"synthetic-snapshot",revision:2,sourceFingerprint:"c".repeat(64)};
      const state={snapshot:expected};
      const adminMonthlySettlementWrite={status:"CONFIRMED",scopeState:state,payoutRequestId:0,payoutLoading:false,payoutState:{marker:"prior"},payoutReadValid:false,payoutMessage:""};
      const adminImportAuthState={profile:{id:env.profileId}};
      function adminSettlementHistoryScope(){return scope}
      function adminSettlementHistoryScopeKey(value=scope){return [value.branchId,value.coachRoleId,value.settlementMonth].join(":")}
      function adminSettlementHistoryCoaches(){return env.exactCoach?[{serverRoleId:scope.coachRoleId}]:[]}
      function adminSettlementHistoryAccessReady(){return env.access&&env.unlocked}
      function adminApprovalReady(){return env.approval}
      function operationsRole(){return env.role}
      function adminR3SettlementSnapshot(value){return value?.snapshot||null}
      function adminR3PayoutBaseMatches(){return true}
      function renderAdminSettlementHistory(){}
      let releaseRpc;
      const pendingRpc=new Promise(resolve=>{releaseRpc=resolve});
      window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:()=>pendingRpc};
      ` + adminPayoutRefresh + `
      window.beginRefresh=()=>{window.refreshPromise=refreshAdminMonthlySettlementPayoutState();return true};
    ` });
    for (const drift of ["client", "profile", "role", "lock", "approval", "coach"]) {
      await page.evaluate(async () => {
        adminMonthlySettlementWrite.status="CONFIRMED";
        adminMonthlySettlementWrite.scopeState={snapshot:{snapshotId:"synthetic-snapshot",revision:2,sourceFingerprint:"c".repeat(64)}};
        adminMonthlySettlementWrite.payoutState={marker:"prior"};
        adminMonthlySettlementWrite.payoutReadValid=false;
        adminMonthlySettlementWrite.payoutLoading=false;
        window.rpcPending=new Promise(resolve=>{window.releaseRpc=resolve});
        window.TennisNoteDataClient.rpc=()=>window.rpcPending;
        window.beginRefresh();
      });
      await page.waitForFunction(() => typeof window.releaseRpc === "function");
      await page.evaluate(driftKind => {
        if (driftKind==="client") window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-session"}),rpc:()=>Promise.resolve(null)};
        if (driftKind==="profile") adminImportAuthState.profile.id="different-profile";
        if (driftKind==="role") env.role="coach";
        if (driftKind==="lock") env.unlocked=false;
        if (driftKind==="approval") env.approval=false;
        if (driftKind==="coach") env.exactCoach=false;
        window.releaseRpc({scope,snapshot:{snapshotId:"synthetic-snapshot",revision:2,sourceFingerprint:"c".repeat(64)},payout:{state:"NOT_RECORDED",recordingEnabled:true,activeRecord:null,events:[]}});
      }, drift);
      await page.evaluate(() => window.refreshPromise);
      assert.deepEqual(await page.evaluate(() => ({ state:adminMonthlySettlementWrite.payoutState, valid:adminMonthlySettlementWrite.payoutReadValid })), {state:{marker:"prior"},valid:false}, drift);
      await page.evaluate(() => {
        env.role="admin"; env.profileId="synthetic-admin"; adminImportAuthState.profile.id=env.profileId;
        env.access=true; env.approval=true; env.unlocked=true; env.exactCoach=true;
      });
    }
  } finally { await browser.close(); }
});

test("관리자 확정 이력 안내는 수동 기록 가능성과 실제 송금 미실행을 구분", () => {
  const source = read("app/admin/data/billing.js");
  assert.match(source, /계산본 확정과 수동 지급 기록은 가능하지만 실제 송금은 하지 않습니다/);
  assert.doesNotMatch(source, /현재 예상 정산과 구분되며 이 화면에서 확정·지급하지 않습니다/);
});
