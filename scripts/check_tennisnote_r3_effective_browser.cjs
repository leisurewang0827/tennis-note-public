/* 실제 public index/module 실행. 합성 transport만 허용, hosted/Auth/write 0. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {root} = require("../tests/helpers/r3-effective-port.cjs");
require("../tests/helpers/release-freeze-mechanical.cjs").verifyCurrent(root);
// Historical absence and current canonical response UI are separate source stages.
const historical = require("../tests/helpers/legacy-integrated-source.cjs");
const historicalCoachHtml = historical.read("app/tennis-note-coach-app/index.html");
for (const id of ["coachSettlementReconciliationForm", "coachSettlementReconciliationSubmit", "coachSettlementReconciliationReason"]) assert(!historicalCoachHtml.includes('id="'+id+'"'), "historical coach response DOM absence");
const historicalCoachData = historical.read("app/tennis-note-coach-app/data/sync.js");
const historicalHistory = historicalCoachData.slice(historicalCoachData.indexOf("const coachSettlementHistory ="));
for (const name of ["tn_coach_respond_monthly_settlement_confirmation", "tn_admin_confirm_monthly_settlement_snapshot", "tn_admin_create_monthly_settlement_snapshot", "saveSnapshot("]) assert(!historicalHistory.includes(name), "historical coach financial/write absence");
const {chromium,webkit} = require("playwright");
const base="http://127.0.0.1:8773";
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
function fixtureConfig(coach) {
  return `window.TennisNoteConfig={}; window.__r3Rpc=[];
  const bootstrapReads=new Set(["tn_schedule_v2_coach_workspace","tn_visible_one_day_bookings","tn_schedule_v2_coach_member_roster","tn_schedule_v2_operation_days_between","tn_schedule_revision_snapshot"]);
  const fixtureClient={readiness:()=>({ready:${coach}}),getSession:()=>(${coach}?{access_token:"synthetic-only"}:null),ensureSession:async()=>({access_token:"synthetic-only"}),consumeOAuthRedirect:async()=>{},isOnline:()=>false,
    selectCurrentProfile:async()=>({user:{id:"synthetic-auth"},profile:{id:"synthetic-profile",name:"합성 코치",role:"coach",status:"active"},coachRole:{id:"synthetic-role",branch_id:"synthetic-branch",status:"approved"}}),
    selectRows:async()=>[],rpc:async(name,args)=>{window.__r3Rpc.push({name,args}); if(name==="tn_coach_settlement_scope_v2"||name==="tn_admin_preview_monthly_settlement_snapshot")return window.__r3Payload(args);if(name==="tn_coach_monthly_settlement_reconciliation_state")return window.__r3History(args);if(name==="tn_admin_monthly_settlement_scope_state")return window.__r3AdminHistory(args);if(bootstrapReads.has(name)||name==="tn_admin_monthly_settlement_payment_state"||name==="tn_coach_monthly_settlement_payment_state")return [];throw Error("unapproved fixture RPC")},
    invokeFunction:async()=>{throw Error("fixture write forbidden")}};
  window.__r3Payload=args=>({ok:true,calculationVersion:"r3_effective_settlement_v2",scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},sourceFingerprint:"a".repeat(64),confirmationReady:false,
    totals:{totalSettlementAmount:50,revenueAmount:100,settledSessions:1,settledMinutes:40,paymentCount:1},sourceManifest:{tickets:[{id:"synthetic-ticket",userId:"synthetic-user"}]},
    lines:[{sourceTicketId:"synthetic-ticket",sourcePaymentId:"synthetic-payment",settlementAmount:50,settledSessions:1,settledMinutes:40,totalSessions:5,netAmount:100,calculationComponents:[]}]});
  Object.defineProperty(window,"TennisNoteDataClient",{get:()=>fixtureClient,set:()=>{},configurable:true});`;
}
async function assertAdminUnlockCache(page) {
  return page.evaluate(async () => {
    let checks = 0, renders = 0;
    const check = (value, reason) => { if (!value) throw Error("unlock cache: " + reason); checks++; };
    const client = window.TennisNoteDataClient, calls = [], expiry = [];
    const saved = { render: renderAdminView, ensure: ensureAdminViewData, payments: loadServerPaymentsIntoBilling,
      branch: activeOperationBranchId, coaches: operationBranchCoaches, timeout: window.setTimeout,
      rpc: client.rpc, session: client.getSession, readiness: client.readiness };
    let token = "synthetic-session", ready = true, validPin = true;
    try {
      client.readiness = () => ({ ready }); client.getSession = () => token ? { access_token: token } : null;
      client.rpc = async name => { calls.push(name); if (name !== "tn_admin_verify_security_pin") throw Error("automatic RPC forbidden"); return validPin; };
      window.activeOperationBranchId = () => "synthetic-branch";
      window.operationBranchCoaches = () => [{ name: "합성 코치", serverRoleId: "synthetic-role", branchId: "synthetic-branch", status: "active" }];
      window.ensureAdminViewData = async () => false;
      window.loadServerPaymentsIntoBilling = () => true;
      window.renderAdminView = view => { renders++; renderAdminSettlementHistory(); rememberAdminViewRender(view); };
      window.setTimeout = (fn, delay, ...args) => {
        if (fn === reconcileAdminBillingLockUi) { expiry.push(fn); return 0; }
        return saved.timeout.call(window, fn, delay, ...args);
      };
      const select = document.querySelector("#adminSettlementHistoryCoach"), button = document.querySelector("#adminSettlementHistoryRead");
      const reset = () => {
        calls.length = 0; renders = 0; expiry.length = 0; token = "synthetic-session"; ready = true; validPin = true;
        adminImportAuthState.profile = { id: "synthetic-admin", role: "admin" }; adminImportAuthState.user = { id: "synthetic-auth" };
        Object.assign(adminLockSettings, { enabled: true, pinHash: "", legacyPin: "", pinConfigured: true, timeoutMinutes: 10, lockedViews: ["billing"] });
        Object.assign(adminLockSession, { unlockedUntil: 0, pendingView: "billing", pendingAction: "", afterUnlock: null });
        resetAdminSettlementHistory(); adminSettlementHistory.coachRoleId = "synthetic-role";
        state.billingMonth = "2099-01"; state.view = "dashboard"; adminViewRenderCache.clear();
        document.querySelector("#adminPinInput").value = "synthetic-pin";
      };
      const onlyPin = () => calls.length === 1 && calls[0] === "tn_admin_verify_security_pin";
      reset(); renderAdminSettlementHistory(); rememberAdminViewRender("billing");
      check(select.disabled, "pre-unlock locked"); await confirmAdminUnlock();
      check(isAdminUnlocked() && !select.disabled && !button.disabled, "cached unlock controls enabled");
      check(renders === 0 && onlyPin(), "cached normal PIN one; auto-read/full-render zero");
      check(expiry.length === 1, "one expiration reconciliation scheduled");
      adminLockSession.unlockedUntil = 0; expiry[0]();
      check(select.disabled && button.disabled && onlyPin(), "expiration fails closed without read");
      reset(); await confirmAdminUnlock();
      check(renders === 1 && !button.disabled && onlyPin(), "cold cache unchanged single render");
      reset(); state.view = "billing"; adminLockSession.pendingView = "";
      let callbacks = 0; adminLockSession.afterUnlock = () => { callbacks++; };
      renderAdminSettlementHistory(); await confirmAdminUnlock();
      check(callbacks === 1 && renders === 0 && !button.disabled && onlyPin(), "same-view callback reconciled once");
      for (const denied of ["logout", "role", "profile", "readiness", "loading"]) {
        reset(); state.view = "billing"; adminLockSession.unlockedUntil = Date.now() + 600000;
        renderAdminSettlementHistory(); rememberAdminViewRender("billing");
        if (denied === "logout") token = "";
        if (denied === "role") adminImportAuthState.profile.role = "member";
        if (denied === "profile") adminImportAuthState.profile = null;
        if (denied === "readiness") ready = false;
        if (denied === "loading") adminSettlementHistory.loading = true;
        setView("billing", { skipLock: true });
        check(select.disabled && button.disabled && calls.length === 0, denied + " cached navigation fail-closed " + JSON.stringify({selectDisabled:select.disabled,readDisabled:button.disabled,rpcNames:calls}));
      }
      // 코치의 별도 시간표 진입은 기존 workspace 조회를 시작합니다.
      // 여기서는 실제 코치 권한 판정의 정산 영역 재조정 자체를 격리 검사합니다.
      reset(); state.view = "billing"; adminLockSession.unlockedUntil = Date.now() + 600000;
      adminImportAuthState.profile.role = "coach"; reconcileAdminBillingLockUi();
      check(select.disabled && button.disabled && calls.length === 0, "coach history reconciliation RPC zero");
      reset(); validPin = false; await confirmAdminUnlock();
      check(!isAdminUnlocked() && expiry.length === 0 && onlyPin(), "failed PIN no unlock/replay");
      reset(); state.view = "billing"; adminLockSession.unlockedUntil = Date.now() + 600000;
      adminSettlementHistory.coachRoleId = ""; reconcileAdminBillingLockUi();
      check(!select.disabled && button.disabled && calls.length === 0, "no exact coach read remains disabled");
      const primary = document.querySelector("#monthlySettlementPrimaryAction");
      check(primary && primary.disabled && primary.getAttribute("aria-disabled") === "true", "current write control disabled without exact scope");
      primary.click(); await confirmMonthlySettlementSnapshot();
      check(calls.length === 0, "current disabled click and actual caller write RPC0");
      setView("billing", { skipLock: true });
      renderOperationsLoginGate();
      document.querySelectorAll("#billingView details").forEach(details => { details.open = true; });
      return { checks, actualModularEntry: true, historyAutoRpc: 0, writes: 0 };
    } finally {
      window.renderAdminView = saved.render; window.ensureAdminViewData = saved.ensure;
      window.loadServerPaymentsIntoBilling = saved.payments; window.activeOperationBranchId = saved.branch;
      window.operationBranchCoaches = saved.coaches; window.setTimeout = saved.timeout;
      client.rpc = saved.rpc; client.getSession = saved.session; client.readiness = saved.readiness;
    }
  });
}
async function assertAdminConfirmation(page) {
  return page.evaluate(async () => {
    let checks=0,cases=0,calls=[],pending=[],mode="normal",token,role,approved,branch,ready,settled=false;
    const check=(ok,name)=>{if(!ok)throw Error("confirmation current: "+name);checks++;};
    const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
    const original={descriptor:Object.getOwnPropertyDescriptor(window,"TennisNoteDataClient"),branch:activeOperationBranchId,
      coaches:operationBranchCoaches,role:operationsRole,approval:adminApprovalReady,access:operationsAccessReady,
      locked:isAdminViewLocked,unlocked:isAdminUnlocked,pin:adminPinNeedsSetup};
    const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
    const snapshot=()=>({snapshotId:"synthetic-snapshot",scope:{...scope},revision:1,status:"calculated",calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:50}});
    const confirmed=()=>({ok:true,state:"CONFIRMED",scope:{...scope},snapshot:snapshot(),confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
    const writes=()=>calls.filter(c=>/tn_admin_(create|confirm)_monthly_settlement_snapshot/.test(c.name));
    const client={readiness:()=>({ready}),getSession:()=>token?{access_token:token}:null,rpc:async(name,args)=>{
      // Payment-ledger read is separate and never a financial/write fixture.
      if(name==="tn_admin_monthly_settlement_payment_state")return null;
      calls.push({name,args});
      if(name==="tn_admin_create_monthly_settlement_snapshot"){
        if(mode==="hold-create")return new Promise(resolve=>pending.push(resolve));return snapshot();
      }
      if(name==="tn_admin_confirm_monthly_settlement_snapshot"){
        settled=true;if(mode==="lost-confirm")throw Error("synthetic response lost");return confirmed();
      }
      if(name==="tn_admin_monthly_settlement_scope_state")return settled?confirmed():{ok:true,state:"EMPTY",scope:{...scope},snapshot:null,confirmation:null,reconciliation:null};
      throw Error("unapproved synthetic RPC");
    }};
    const primary=document.querySelector("#monthlySettlementPrimaryAction");
    const reset=()=>{
      calls=[];pending=[];mode="normal";settled=false;token="synthetic-session";role="admin";approved=true;branch=scope.branchId;ready=true;
      state.view="billing";state.billingMonth="2099-01";
      adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};adminImportAuthState.user={id:"synthetic-auth"};
      Object.defineProperty(window,"TennisNoteDataClient",{get:()=>client,configurable:true});
      resetAdminSettlementHistory();const c=adminSettlementHistory;c.coachRoleId=scope.coachRoleId;
      c.preview=window.__r3Payload({target_branch_id:scope.branchId,target_coach_role_id:scope.coachRoleId,target_month:scope.settlementMonth});
      c.scopeState={ok:true,state:"EMPTY",scope:{...scope},snapshot:null,confirmation:null,reconciliation:null,snapshotWriterCapability:{contractVersion:"r3_snapshot_writer_capability_v1",writesEnabled:true}};
      c.status="READY";c.key=c.loadedSignature=adminSettlementHistoryScopeKey();c.sessionToken=token;c.profileId="synthetic-admin";
      c.writerRequest=c.request;c.continuationIsCurrent=adminSettlementHistoryContinuation();
    };
    try{
      window.activeOperationBranchId=()=>branch;
      window.operationBranchCoaches=()=>[{serverRoleId:scope.coachRoleId,branchId:branch,name:"합성 코치",status:"active"}];
      window.operationsRole=()=>role;window.adminApprovalReady=()=>approved;
      window.operationsAccessReady=()=>ready;window.isAdminViewLocked=()=>false;window.isAdminUnlocked=()=>true;window.adminPinNeedsSetup=()=>false;
      document.querySelector("#operationsLoginGate").hidden=true;document.querySelector("#adminAppShell").hidden=false;
      document.querySelector("#adminBrandSplash").hidden=true;document.querySelector("#billingView").hidden=false;
      document.querySelectorAll(".view").forEach(el=>el.classList.toggle("is-active",el.id==="billingView"));
      document.querySelector("#adminSettlementHistory").closest("details").open=true;
      for(const denied of ["capability-off","capability-missing","capability-version","role","profile-role","approval","session","auth","profile","branch","month","coach","duplicate-coach","request","owner","scope","preview","loading","submitting","confirmed"]){
        reset();const c=adminSettlementHistory;
        if(denied==="capability-off")c.scopeState.snapshotWriterCapability.writesEnabled=false;
        if(denied==="capability-missing")delete c.scopeState.snapshotWriterCapability;
        if(denied==="capability-version")c.scopeState.snapshotWriterCapability.contractVersion="unknown";
        if(denied==="role")role="coach";if(denied==="profile-role")adminImportAuthState.profile.role="member";
        if(denied==="approval")approved=false;if(denied==="session")token="";
        if(denied==="auth")adminImportAuthState.user=null;if(denied==="profile")adminImportAuthState.profile=null;
        if(denied==="branch")branch="other";if(denied==="month")state.billingMonth="2099-13";if(denied==="coach")c.coachRoleId="";
        if(denied==="duplicate-coach")window.operationBranchCoaches=()=>[1,2].map(()=>({serverRoleId:scope.coachRoleId,branchId:branch,status:"active"}));
        if(denied==="request")c.request++;if(denied==="owner")adminImportAuthState.user.id="other-auth";
        if(denied==="scope")c.loadedSignature="other";if(denied==="preview")c.preview.scope.coachRoleId="other";
        if(denied==="loading")c.loading=true;if(denied==="submitting")c.submitting=true;
        if(denied==="confirmed"){c.status="CONFIRMED";c.scopeState=confirmed();c.value=confirmed();}
        renderAdminSettlementHistory();check(primary.disabled&&primary.getAttribute("aria-disabled")==="true",denied+" actual disabled/aria");
        primary.click();await confirmMonthlySettlementSnapshot();await tick();check(writes().length===0,denied+" actual DOM/caller write RPC0");cases++;
        window.operationBranchCoaches=()=>[{serverRoleId:scope.coachRoleId,branchId:branch,name:"합성 코치",status:"active"}];
      }
      for(const changed of ["owner","request","scope","capability"]){
        reset();mode="hold-create";renderAdminSettlementHistory();primary.click();primary.click();
        check(writes().length===1&&pending.length===1,"duplicate in-flight physical create1");
        check(primary.disabled&&primary.textContent==="월 정산 확정 중","busy disabled wording");
        if(changed==="owner")adminImportAuthState.user.id="other";if(changed==="request")adminSettlementHistory.request++;
        if(changed==="scope")state.billingMonth="2099-02";if(changed==="capability")adminSettlementHistory.scopeState.snapshotWriterCapability.writesEnabled=false;
        pending[0](snapshot());await tick();await tick();check(writes().length===1,"stale completion cannot send next confirmation "+changed);cases++;
      }
      for(const kind of ["normal","existing-snapshot","lost-confirm"]){
        reset();mode=kind;if(kind==="existing-snapshot")adminSettlementHistory.scopeState={...adminSettlementHistory.scopeState,state:"CALCULATED",snapshot:snapshot()};
        renderAdminSettlementHistory();check(!primary.disabled&&primary.getAttribute("aria-disabled")==="false"&&primary.textContent==="월 정산 확정","authorized exact current action");
        primary.click();primary.click();await tick();await tick();
        const c=adminSettlementHistory;check(c.status==="CONFIRMED"&&c.value.snapshot.snapshotId==="synthetic-snapshot"&&c.value.confirmation.confirmationId==="synthetic-confirmation","exact synthetic confirm/readback "+kind);
        check(writes().filter(r=>r.name.includes("create")).length===(kind==="existing-snapshot"?0:1)&&writes().filter(r=>r.name.includes("confirm")).length===1,"logical operation physical writes1 "+kind);
        check(calls.some(r=>r.name==="tn_admin_monthly_settlement_scope_state"),"server readback required");
        check(primary.disabled&&primary.textContent==="월 정산 확정 완료","terminal action disabled");
        check(document.querySelector("#adminSettlementHistoryMessage").textContent.includes("실제 송금이 아닙니다"),"confirmation is not payout");
        const before=writes().length;primary.click();await confirmMonthlySettlementSnapshot();check(writes().length===before,"terminal duplicate write RPC0");cases++;
      }
      // Lost response without confirmed readback may be retried with SAME keys, not a second logical operation.
      reset();mode="hold-create";const work=confirmMonthlySettlementSnapshot();const keys=[adminSettlementHistory.snapshotOperationKey,adminSettlementHistory.confirmationOperationKey];
      pending[0](snapshot());await work;check(keys[0]&&keys[1]&&new Set(writes().map(r=>r.args.target_operation_key)).size===2,"create/confirm distinct stable keys");
      check(monthlySettlementEnsureOperationKeys(scope,adminSettlementHistory.preview).snapshot===keys[0],"same source preserves operation key");cases++;
      check(calls.every(r=>r.args.target_branch_id===scope.branchId&&r.args.target_coach_role_id===scope.coachRoleId&&r.args.target_month===scope.settlementMonth),"exact args source scope");
      return{checks,authorityCases:cases,actualDomAndCaller:true,syntheticConfirmation:true,hostedWrites:0};
    }finally{
      Object.defineProperty(window,"TennisNoteDataClient",original.descriptor);
      window.activeOperationBranchId=original.branch;window.operationBranchCoaches=original.coaches;window.operationsRole=original.role;
      window.adminApprovalReady=original.approval;window.operationsAccessReady=original.access;window.isAdminViewLocked=original.locked;window.isAdminUnlocked=original.unlocked;window.adminPinNeedsSetup=original.pin;
    }
  });
}
async function assertAdminPreviewIdentityFence(page) {
  return page.evaluate(async () => {
    let checks=0,cases=0,calls=[],pending=[],token="",role="admin",admitted=true,branch="";
    const check=(value,name)=>{if(!value)throw Error("preview identity: "+name);checks++;};
    const original={descriptor:Object.getOwnPropertyDescriptor(window,"TennisNoteDataClient"),branch:activeOperationBranchId,
      coaches:operationBranchCoaches,approval:adminApprovalReady,role:operationsRole};
    let client;
    const coach={name:"합성 코치",serverRoleId:"synthetic-role",branchId:"synthetic-branch"};
    const reset=()=>{
      calls=[];pending=[];token="synthetic-session-A";role="admin";admitted=true;branch="synthetic-branch";
      state.view="billing";state.billingMonth="2099-01";state.settlementPage=0;
      adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};adminImportAuthState.user={id:"synthetic-auth"};
      coach.branchId=branch;
      client={getSession:()=>token?{access_token:token}:null,rpc:(name,args)=>{
        check(name==="tn_coach_settlement_scope_v2","read RPC only");calls.push(args);
        return new Promise((resolve,reject)=>pending.push({resolve,reject,args}));
      }};
      Object.assign(effectiveSettlementPreview,{signature:"",loading:false,results:[],context:null,error:""});
      effectiveSettlementPreview.requestId++;
    };
    const change=kind=>{
      if(kind==="role")role="member";
      if(kind==="profile")adminImportAuthState.profile.id="other-profile";
      if(kind==="authUser")adminImportAuthState.user.id="other-auth";
      if(kind==="logout")token="";
      if(kind==="session")token="synthetic-session-B";
      if(kind==="client")client={...client};
      if(kind==="admission")admitted=false;
      if(kind==="branch")branch="other-branch";
      if(kind==="month")state.billingMonth="2099-02";
    };
    const start=()=>refreshEffectiveSettlementPreview(effectiveSettlementPreviewSignature());
    const resolve=item=>item.resolve(window.__r3Payload(item.args));
    try {
      Object.defineProperty(window,"TennisNoteDataClient",{get:()=>client,configurable:true});
      window.activeOperationBranchId=()=>branch;window.operationBranchCoaches=()=>[coach];
      window.operationsRole=()=>role;window.adminApprovalReady=()=>admitted&&role==="admin";
      document.querySelector("#operationsLoginGate").hidden=true;document.querySelector("#adminAppShell").hidden=false;
      document.querySelector("#adminBrandSplash").hidden=true;document.querySelector("#billingView").hidden=false;
      document.querySelectorAll(".view").forEach(el=>el.classList.toggle("is-active",el.id==="billingView"));
      document.querySelector("#coachSettlementSummary").closest("details").open=true;
      for(const kind of ["role","profile","authUser","logout","session","client","admission","branch","month"]){
        for(const error of [false,true]){
          reset();const request=start();change(kind);
          if(error)pending[0].reject(Error("synthetic obsolete error"));else resolve(pending[0]);await request;
          check(calls.length===1&&effectiveSettlementPreview.results.length===0&&!effectiveSettlementPreview.loading,
            "stale response cleared, no retry "+kind);check(Boolean(effectiveSettlementPreview.error),"stale safe error");cases++;
          // 이전 응답 자체는 재시도하지 않습니다. 다음 명시적 render의 복구 조회는 별도 계약입니다.
          renderCoachSettlementPreview();
          if(calls.length===2){resolve(pending[1]);await new Promise(done=>setTimeout(done,0));}
        }
      }
      for(const kind of ["role","profile","authUser","logout","session","client","admission"]){
        reset();const request=start();resolve(pending[0]);await request;change(kind);renderCoachSettlementPreview();
        check(calls.length===1&&effectiveSettlementPreview.results.length===0,"cache context "+kind);cases++;
      }
      for(const kind of ["role","logout","admission","missingProfile","missingAuth"]){
        reset();if(kind==="missingProfile")adminImportAuthState.profile=null;else if(kind==="missingAuth")adminImportAuthState.user=null;else change(kind);
        await start();check(calls.length===0&&effectiveSettlementPreview.results.length===0,"preflight RPC0 "+kind);cases++;
      }
      for(const olderError of [false,true]){
        reset();const older=start(),newer=start();const first=pending[0],second=pending[1];
        if(olderError)first.reject(Error("synthetic older"));else resolve(first);await older;
        check(effectiveSettlementPreview.loading&&effectiveSettlementPreview.results.length===0,"old cannot clear new loading");
        resolve(second);await newer;check(effectiveSettlementPreview.results[0].value.estimatedSettlement===50&&!effectiveSettlementPreview.error,"newer owns result");cases++;
        reset();const prior=start();change("profile");change("authUser");const current=start();
        resolve(pending[1]);await current;if(olderError)pending[0].reject(Error("synthetic old actor"));else resolve(pending[0]);await prior;
        check(effectiveSettlementPreview.results.length===1&&!effectiveSettlementPreview.error,"new actor owns result");cases++;
      }
      reset();const stable=start();resolve(pending[0]);await stable;renderCoachSettlementPreview();
      check(calls.length===1&&effectiveSettlementPreview.results[0].value.estimatedSettlement===50,"stable cache preserved");
      check(!effectiveSettlementPreview.signature.includes(token)&&!document.body.textContent.includes(token),"credential memory only");cases++;
      check(!document.querySelector("#coachSettlementSummary img, #coachSettlementPreviewRows script"),"safe markup");
      return {checks,identityCases:cases,actualModularFunctions:true,writeRpc:0};
    } finally {
      Object.defineProperty(window,"TennisNoteDataClient",original.descriptor);
      window.activeOperationBranchId=original.branch;window.operationBranchCoaches=original.coaches;
      window.adminApprovalReady=original.approval;window.operationsRole=original.role;
    }
  });
}

async function assertAdminPreviewRecovery(page) {
  return page.evaluate(async () => {
    let checks=0,cases=0,calls=[],pending=[],token,role,admitted,branch,client;
    const check=(ok,label)=>{if(!ok)throw Error("preview recovery: "+label);checks++;};
    const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
    const original={descriptor:Object.getOwnPropertyDescriptor(window,"TennisNoteDataClient"),
      branch:activeOperationBranchId,coaches:operationBranchCoaches,approval:adminApprovalReady,role:operationsRole};
    const reset=()=>{
      calls=[];pending=[];token="synthetic-session";role="admin";admitted=true;branch="synthetic-branch";
      state.view="billing";state.billingMonth="2099-01";
      adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};adminImportAuthState.user={id:"synthetic-auth"};
      client={getSession:()=>token?{access_token:token}:null,rpc:(name,args)=>{
        check(name==="tn_coach_settlement_scope_v2","existing read RPC only");calls.push(args);
        return new Promise((resolve,reject)=>pending.push({resolve,reject,args}));}};
      Object.assign(effectiveSettlementPreview,{signature:"",context:null,error:"",results:[],loading:false});
      effectiveSettlementPreview.requestId++;
    };
    const resolve=item=>item.resolve(window.__r3Payload(item.args));
    try {
      Object.defineProperty(window,"TennisNoteDataClient",{get:()=>client,configurable:true});
      window.activeOperationBranchId=()=>branch;
      window.operationBranchCoaches=()=>[{name:"합성 코치",serverRoleId:"synthetic-role",branchId:branch}];
      window.operationsRole=()=>role;window.adminApprovalReady=()=>admitted&&role==="admin";
      document.querySelector("#operationsLoginGate").hidden=true;document.querySelector("#adminAppShell").hidden=false;
      document.querySelector("#adminBrandSplash").hidden=true;document.querySelector("#billingView").hidden=false;
      document.querySelectorAll(".view").forEach(el=>el.classList.toggle("is-active",el.id==="billingView"));
      document.querySelector("#coachSettlementSummary").closest("details").open=true;
      for(const kind of ["session","profile","auth","role","admission","client"]){
        reset();const originalClient=client;
        if(kind==="session")token="";if(kind==="profile")adminImportAuthState.profile=null;
        if(kind==="auth")adminImportAuthState.user=null;if(kind==="role")role="member";
        if(kind==="admission")admitted=false;if(kind==="client")client=null;
        renderCoachSettlementPreview();await tick();
        check(calls.length===0&&effectiveSettlementPreview.context===null&&!!effectiveSettlementPreview.error,"invalid RPC0 "+kind);
        token="synthetic-session";role="admin";admitted=true;client=originalClient;
        adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};adminImportAuthState.user={id:"synthetic-auth"};
        renderCoachSettlementPreview();renderCoachSettlementPreview();renderCoachSettlementPreview();
        check(calls.length===1&&effectiveSettlementPreview.loading&&!effectiveSettlementPreview.error,"recovery one request "+kind);
        resolve(pending[0]);await tick();
        check(effectiveSettlementPreview.results[0]?.value.estimatedSettlement===50&&!effectiveSettlementPreview.loading,"current result "+kind);
        check(document.querySelector("#coachSettlementSummary").textContent.includes("50"),"actual current summary "+kind);
        renderCoachSettlementPreview();renderCoachSettlementPreview();check(calls.length===1,"cache no loop "+kind);cases++;
      }
      reset();renderCoachSettlementPreview();pending[0].reject(Error("synthetic server error"));await tick();
      renderCoachSettlementPreview();renderCoachSettlementPreview();renderCoachSettlementPreview();
      check(calls.length===1&&effectiveSettlementPreview.results[0]?.error&&!!effectiveSettlementPreview.context,"ordinary server error no loop");cases++;
      for(const olderError of [false,true]){
        reset();token="";renderCoachSettlementPreview();await tick();token="synthetic-session";renderCoachSettlementPreview();
        const old=pending[0];state.billingMonth="2099-02";renderCoachSettlementPreview();
        check(calls.length===2&&effectiveSettlementPreview.loading,"new scope owns request");resolve(pending[1]);await tick();
        if(olderError)old.reject(Error("synthetic obsolete"));else resolve(old);await tick();
        check(effectiveSettlementPreview.results[0]?.value.estimatedSettlement===50&&!effectiveSettlementPreview.error
          &&!effectiveSettlementPreview.loading,"old success/error discarded");
        renderCoachSettlementPreview();check(calls.length===2,"recovery replay query zero");cases++;
      }
      check(!document.body.textContent.includes(token)&&!effectiveSettlementPreview.signature.includes(token),"credential memory only");
      return {checks,identityCases:cases,actualModularRecovery:true,writeRpc:0};
    } finally {
      Object.defineProperty(window,"TennisNoteDataClient",original.descriptor);
      window.activeOperationBranchId=original.branch;window.operationBranchCoaches=original.coaches;
      window.adminApprovalReady=original.approval;window.operationsRole=original.role;
    }
  });
}

async function runFixture(page,surface){
  return page.evaluate(async surface=>{
    let checks=0;const check=(value,reason)=>{if(!value)throw Error(reason);checks++};
    if(surface==="admin"){
      // 앞선 신원/복구 시나리오의 캐시는 이 독립 entry 검사의 입력이 아닙니다.
      // 원래의 RPC 1회 및 금액·권한 단언은 그대로 유지합니다.
      Object.assign(effectiveSettlementPreview,{signature:"",loading:false,results:[],context:null,error:""});
      effectiveSettlementPreview.requestId++;
      window.activeOperationBranchId=()=>"synthetic-branch";
      window.operationBranchCoaches=()=>[{name:'합성 코치 <img src=x onerror="throw 1">',branchId:"synthetic-branch",serverRoleId:"synthetic-role"}];
      window.adminApprovalReady=()=>true;
      window.isAdminViewLocked=()=>false;
      window.isAdminUnlocked=()=>false;
      window.adminPinNeedsSetup=()=>false;
      adminImportAuthState.profile={id:"synthetic-admin",role:"admin"};
      adminImportAuthState.user={id:"synthetic-auth"};
      window.TennisNoteDataClient.getSession=()=>({access_token:"synthetic-only"});
      window.__r3AdminHistory=args=>({ok:true,state:"CONFIRMED",scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_monthly_settlement_v1",sourceFingerprint:"b".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
      state.view="billing";state.billingMonth="2099-01";state.settlementPage=0;
      // 합성 transport 권한은 실제 로그인 증거가 아니다. 실제 shell만 fixture에서 연다.
      document.querySelector("#operationsLoginGate").hidden=true;
      document.querySelector("#adminAppShell").hidden=false;
      document.querySelector("#adminBrandSplash").hidden=true;
      tickets.splice(0,tickets.length,{id:"synthetic-ticket",serverTicketId:"synthetic-ticket",member:"합성 회원 <script>throw 1</script>"});expiredTickets.splice(0);adminLiveDataState.settlementTickets=[];
      document.querySelectorAll(".view").forEach(el=>{el.classList.toggle("is-active",el.id==="billingView")});
      document.querySelector("#billingView").hidden=false;
      document.querySelector("#coachSettlementSummary").closest("details").open=true;
      const signature=effectiveSettlementPreviewSignature();
      const original=window.refreshEffectiveSettlementPreview;let entries=0;
      window.refreshEffectiveSettlementPreview=(...args)=>{entries++;return original(...args)};
      renderCoachSettlementPreview();
      await new Promise(resolve=>setTimeout(resolve,0));
      check(entries===1,"actual admin view enters data module");
      check(effectiveSettlementPreview.results[0].value.estimatedSettlement===50,"admin exact server amount");
      check(effectiveSettlementPreview.results[0].value.settledMinutes===40,"group logical time 40 not 80");
      check(document.querySelector("#coachSettlementSummary").textContent.includes("미리보기"),"gate OFF not confirmed");
      check(!document.querySelector("#coachSettlementSummary img"),"coach XSS escaped");
      check(!document.querySelector("#coachSettlementPreviewRows script"),"member XSS escaped");
      check(billingSettlementApprovalMarkup({status:"paid",ticketId:"synthetic-ticket"}).includes("월 정산"),"linked payment row no independent amount formula");
      check(billingSettlementApprovalMarkup({status:"paid"}).includes("회원권 연결 후 계산"),"unlinked payment repair HOLD preserved");
      const client=window.TennisNoteDataClient,old=client.rpc;client.rpc=async()=>{throw Error("settlement_hold_refund")};
      await refreshEffectiveSettlementPreview(signature);
      check(document.querySelector("#coachSettlementSummary").textContent.includes("확인 필요"),"admin HOLD not zero");
      client.rpc=old;await refreshEffectiveSettlementPreview(signature);
      const select=document.querySelector("#adminSettlementHistoryCoach"),button=document.querySelector("#adminSettlementHistoryRead"),details=document.querySelector("#adminSettlementHistoryDetails");
      select.value="synthetic-role";select.dispatchEvent(new Event("change",{bubbles:true}));
      check(!button.disabled,"actual binding selects exact role");
      const before=window.__r3Rpc.filter(row=>row.name==="tn_admin_monthly_settlement_scope_state").length;
      button.click();button.click();await new Promise(resolve=>setTimeout(resolve,0));
      check(window.__r3Rpc.filter(row=>row.name==="tn_admin_monthly_settlement_scope_state").length===before+1,"one read through actual button/listener; duplicate zero");
      check(details.textContent.includes("37원")&&details.textContent.includes("기존 v1"),"admin immutable history same as coach fixture");
      check(effectiveSettlementPreview.results[0].value.estimatedSettlement===50,"confirmed history never overwrites estimate");
      const adminHistory=window.__r3AdminHistory;
      window.__r3AdminHistory=args=>({...adminHistory(args),reconciliation:{reconciliationId:"synthetic-response",status:"DISPUTED",reason:"적용기간 확인 요청 ".repeat(12).trim(),responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}});
      await refreshAdminSettlementHistory();
      check(adminSettlementHistory.value?.reconciliation?.status==="DISPUTED", "current caller dispute exact readback (no boolean-return contract)");
      check(details.textContent.includes("이의 접수")&&!details.querySelector("img,script"),"read-only reason safe DOM");
      window.isAdminViewLocked=()=>true;renderAdminSettlementHistory();
      check(button.disabled&&details.hidden&&details.childElementCount===0,"PIN lock erases history and disables read");
      window.isAdminViewLocked=()=>false;renderAdminSettlementHistory();
      await refreshAdminSettlementHistory();
      check(adminSettlementHistory.value?.snapshot?.snapshotId==="synthetic-snapshot", "current caller unlock exact recovery");
    }else{
      check(Boolean(window.__TENNIS_NOTE_COACH_APP_RUNTIME__),"actual coach entry boot");
      window.__r3History=args=>({scope:{branchId:args.target_branch_id,coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month},state:"PENDING",
        snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_monthly_settlement_v1",sourceFingerprint:"b".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},
        confirmation:{confirmationId:"synthetic-confirmation",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
      check(state.coach?.coachRoleId==="synthetic-role"&&state.coach?.branchId==="synthetic-branch","approved fixture exact role branch boot");
      state.settlementMonth="2099-01";selectCoachSettlementMonth("2099-01");
      check(await syncCoachSettlementFromServer(),"actual coach data RPC success");
      check(state.coachSettlement.estimatedSettlement===50,"coach parity with admin amount");
      check(state.coachSettlement.settledMinutes===40,"coach exact minutes");
      check(coachSettlementRowsForMember({name:"회원권별 계산 근거"}).length===0,"no name fallback");
      check(coachSettlementRowsForMember({serverUserId:"synthetic-user"}).length===1,"exact own member");
      openCoachSettlement();
      check(await syncCoachSettlementHistoryFromServer(),"open enters actual history read module");
      const summary=document.querySelector("#coachSettlementReconciliationSummary");
      check(summary.textContent.includes("37원")&&summary.textContent.includes("기존 v1"),"v1 confirmed amount separate from current preview");
      check(state.coachSettlement.estimatedSettlement===50,"history never overwrites current preview");
      const form=document.querySelector("#coachSettlementReconciliationForm"),submit=document.querySelector("#coachSettlementReconciliationSubmit");
      check(form&&!form.hidden&&submit&&submit.disabled&&!form.querySelector('input[name="coachSettlementReconciliationChoice"]:checked'),"current exact PENDING response visible; unselected submit disabled; historical absence checked separately");
      const writesBefore=window.__r3Rpc.length;submit.click();await new Promise(resolve=>setTimeout(resolve,0));
      check(window.__r3Rpc.length===writesBefore,"coach disabled current write RPC0");
      const assertResponseBlocked=async label=>{
        check(form.hidden&&submit.disabled,label+" current response hidden/disabled");
        const before=window.__r3Rpc.length;submit.click();await new Promise(resolve=>setTimeout(resolve,0));
        check(window.__r3Rpc.length===before,label+" disabled click response/write RPC0");
      };
      const history=window.__r3History;
      window.__r3History=args=>({...history(args),state:"DISPUTED",reconciliation:{reconciliationId:"synthetic-response",status:"DISPUTED",reason:"적용기간 확인 요청 ".repeat(12).trim(),responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}});
      check(await syncCoachSettlementHistoryFromServer(),"prior dispute read only");
      check(summary.textContent.includes("적용기간 확인 요청")&&!summary.querySelector("img,script"),"prior reason textContent safe");
      await assertResponseBlocked("DISPUTED");
      window.__r3History=args=>({...history(args),state:"ACKNOWLEDGED",reconciliation:{reconciliationId:"synthetic-response",status:"ACKNOWLEDGED",reason:"",responseVersion:"r3_monthly_settlement_coach_reconciliation_v1",respondedAt:"2099-01-01T00:01:00Z"}});
      check(await syncCoachSettlementHistoryFromServer(),"acknowledged terminal read only");
      await assertResponseBlocked("ACKNOWLEDGED");
      window.__r3History=args=>({...history(args),scope:{branchId:"other",coachRoleId:args.target_coach_role_id,settlementMonth:args.target_month}});
      check(await syncCoachSettlementHistoryFromServer()===false&&summary.hidden,"scope mismatch hides old history");
      await assertResponseBlocked("scope mismatch");
      window.__r3History=args=>({...history(args),snapshot:null});
      check(await syncCoachSettlementHistoryFromServer()===false&&summary.hidden,"missing payload hides old history");
      await assertResponseBlocked("missing payload");
      for(const [expected,reason]of [["STALE","settlement_reconciliation_stale"],["CONFLICT","settlement_reconciliation_conflict"],["ERROR","synthetic read error"]]){
        window.__r3History=()=>{throw Error(reason)};
        check(await syncCoachSettlementHistoryFromServer()===false&&coachSettlementHistory.coachSettlementReconciliationUiState===expected,expected+" read error contract");
        await assertResponseBlocked(expected);
      }
      window.__r3History=args=>({scope:history(args).scope,state:"EMPTY",snapshot:null,confirmation:null,reconciliation:null});
      check(await syncCoachSettlementHistoryFromServer()&&summary.hidden,"empty history not fabricated zero");
      check(document.querySelector("#coachSettlementReconciliationMessage").textContent.includes("없습니다"),"empty distinct from preview");
      await assertResponseBlocked("EMPTY");
      window.__r3History=history;
      check(await syncCoachSettlementHistoryFromServer(),"synthetic recovery only after diagnosed payload mismatch");
      const profile=state.liveProfileId;state.liveProfileId="";renderCoachSettlementHistory();
      check(summary.hidden,"missing continuation removes old summary");await assertResponseBlocked("missing continuation");
      state.liveProfileId=profile;check(await syncCoachSettlementHistoryFromServer(),"fixture profile restored after missing-continuation assertion");
      const auth=state.coach.authUserId;state.coach.authUserId="synthetic-auth-stale";renderCoachSettlementHistory();
      check(summary.hidden,"stale continuation removes old summary");await assertResponseBlocked("stale continuation");
      state.coach.authUserId=auth;check(await syncCoachSettlementHistoryFromServer(),"fixture owner restored after stale-continuation assertion");
      const client=window.TennisNoteDataClient,old=client.rpc;client.rpc=async()=>{throw Error("settlement_hold_refund")};
      check(await syncCoachSettlementFromServer()===false,"HOLD fail closed");
      check(document.querySelector("#coachEstimatedSettlement").textContent==="—","coach HOLD not zero");
      check(document.querySelector("#coachSettlementRows").textContent.includes("계산 근거"),"coach visible retry/error");
      client.rpc=old;check(await syncCoachSettlementFromServer(),"diagnosed synthetic recovery once");
      check(document.querySelector("#coachSettlementRule").textContent.includes("미리보기"),"coach confirmation OFF");
    }
    const scopeCalls=window.__r3Rpc.filter(row=>row.name==="tn_coach_settlement_scope_v2");
    check(scopeCalls.length>0&&scopeCalls.every(row=>row.args.target_branch_id==="synthetic-branch"&&row.args.target_coach_role_id==="synthetic-role"),"actual entry spy exact scope RPC");
    const readOnlyRpcNames=new Set(["tn_coach_settlement_scope_v2","tn_admin_preview_monthly_settlement_snapshot","tn_admin_monthly_settlement_scope_state","tn_coach_monthly_settlement_reconciliation_state","tn_admin_monthly_settlement_payment_state","tn_coach_monthly_settlement_payment_state","tn_schedule_v2_coach_workspace","tn_visible_one_day_bookings","tn_schedule_v2_coach_member_roster","tn_schedule_v2_operation_days_between","tn_schedule_revision_snapshot"]);
    check(window.__r3Rpc.every(row=>readOnlyRpcNames.has(row.name)),"write RPC zero; exact current read allowlist (payment-state is read, not payout)");
    return {checks,previewCalls:scopeCalls.length,hostedWrites:0};
  },surface);
}
(async()=>{
  const deadline=setTimeout(()=>{console.error("R3 browser deadline");process.exit(124)},180000);deadline.unref();
  const unlockOnly = process.env.TENNISNOTE_R3_UNLOCK_FOCUSED === "1";
  const fenceOnly = process.env.TENNISNOTE_R3_IDENTITY_FOCUSED === "1";
  const recoveryOnly = process.env.TENNISNOTE_R3_RECOVERY_FOCUSED === "1";
  const confirmationOnly = process.env.TENNISNOTE_R3_CONFIRMATION_FOCUSED === "1";
  let layouts=0,checks=0,identityCases=0;const widths=confirmationOnly?[[390,844],[844,390],[768,1024],[1366,900]]:recoveryOnly?[[390,844],[844,390]]:fenceOnly?[[390,844],[844,390],[768,1024],[1366,900]]:unlockOnly?[[390,844],[768,1024],[1366,900]]:[[320,740],[360,800],[375,812],[390,844],[393,852],[402,874],[412,915],[430,932],[768,1024],[1366,900],[667,375],[844,390],[932,430]];
  try{
    for(const [engine,type] of Object.entries({chromium,webkit})){
      const browser=await type.launch({headless:true,...(engine==="chromium"&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
      try{for(const colorScheme of ["light","dark"])for(const surface of ((unlockOnly||fenceOnly||recoveryOnly)?["admin"]:(process.env.TENNISNOTE_R3_HISTORY_LAYOUT_ONLY === "1" ? ["coach"] : ["admin","coach"]))){
        const context=await browser.newContext({viewport:{width:390,height:844},colorScheme,serviceWorkers:"block"});
        let external=0;await context.route("**/*",route=>{
          const url=new URL(route.request().url());if(url.origin!==base){external++;return route.abort()}
          if(url.pathname.endsWith("config.local.js"))return route.fulfill({contentType:"text/javascript",body:fixtureConfig(surface==="coach")});
          let file=path.resolve(root,"."+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep))return route.fulfill({status:403});
          if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
          if(!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({contentType:mime[path.extname(file)]||"application/octet-stream",body:fs.readFileSync(file)});
        });
        try{
          const page=await context.newPage(),errors=[];page.on("pageerror",error=>errors.push(error.message));
          await page.goto(base+`/app/${surface==="admin"?"admin":"tennis-note-coach-app"}/`,{waitUntil:"domcontentloaded"});
          await page.waitForFunction(surface=>surface==="admin"?typeof renderCoachSettlementPreview==="function"&&typeof state==="object":Boolean(window.__TENNIS_NOTE_COACH_APP_RUNTIME__)&&state.coach?.coachRoleId==="synthetic-role",surface);
          const identityReceipt=recoveryOnly?await assertAdminPreviewRecovery(page):surface==="admin"&&!unlockOnly?await assertAdminPreviewIdentityFence(page):null;
          if(identityReceipt){checks+=identityReceipt.checks;identityCases+=identityReceipt.identityCases;}
          if(fenceOnly||recoveryOnly){
            for(const [width,height]of widths){
              await page.setViewportSize({width,height});
              const geometry=await page.locator("#coachSettlementSummary").evaluate(el=>({visible:!!el.getClientRects().length,width:el.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth-innerWidth}));
              assert(geometry.visible&&geometry.width>100&&geometry.width<=width+1&&geometry.overflow<=1,"preview focused visible/no overflow");
              if(process.env.TENNISNOTE_R3_SCREENSHOT_DIR&&[390,768,1366].includes(width)){
                fs.mkdirSync(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,{recursive:true});await page.locator("#coachSettlementSummary").screenshot({path:path.join(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,`preview-${engine}-${width}-${colorScheme}.png`)});
              }
              layouts++;checks++;
            }
            assert.deepEqual(errors,[],"preview page errors zero");assert.equal(external,0,"preview external requests zero");
            console.log(JSON.stringify({result:"PASS",engine,colorScheme,...identityReceipt,layouts:widths.length,hostedRequests:0,pageErrors:errors.length}));continue;
          }
          const unlockReceipt=surface==="admin"?await assertAdminUnlockCache(page):null;
          if(unlockReceipt) checks+=unlockReceipt.checks;
          const confirmationReceipt=surface==="admin"?await assertAdminConfirmation(page):null;
          if(confirmationReceipt){checks+=confirmationReceipt.checks;console.log(JSON.stringify({result:"PASS",engine,colorScheme,...confirmationReceipt}));}
          if(unlockOnly){
            for(const [width,height]of widths){
              await page.setViewportSize({width,height});
              const geometry=await page.locator("#adminSettlementHistory").evaluate(el=>({width:el.getBoundingClientRect().width,font:parseFloat(getComputedStyle(el.querySelector("select")).fontSize),touch:el.querySelector("button").getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth}));
              assert(geometry.width>100&&geometry.width<=width+1&&geometry.font>=16&&geometry.touch>=44&&geometry.overflow<=1,"unlock focused existing layout "+JSON.stringify({engine,colorScheme,width,height,...geometry}));layouts++;
            }
            assert.deepEqual(errors,[],"unlock focused page errors zero");
            console.log(JSON.stringify({result:"PASS",engine,colorScheme,...unlockReceipt,layouts:widths.length,hostedRequests:0,pageErrors:errors.length}));
            continue;
          }
          const receipt=await runFixture(page,surface);checks+=receipt.checks;
          const target=page.locator(surface==="admin"?"#adminSettlementHistory":"#coachSettlementModal");
          for(const [width,height] of widths){
            await page.setViewportSize({width,height});await target.scrollIntoViewIfNeeded();
            const geometry=await target.evaluate(el=>({visible:!!el.getClientRects().length,width:el.getBoundingClientRect().width,documentOverflow:document.documentElement.scrollWidth-innerWidth}));
            assert(geometry.visible&&geometry.width>100&&geometry.width<=width+1,"actual settlement target visible viewport width");
            assert(geometry.documentOverflow<=1,"page overflow zero");assert.deepEqual(errors,[],"page error zero");
            if(surface==="admin") {
              await page.locator("#adminSettlementHistory").scrollIntoViewIfNeeded();
              const historyGeometry=await page.locator("#adminSettlementHistory").evaluate(el=>{
                const bounds=el.getBoundingClientRect();
                const visible=Array.from(el.querySelectorAll("*")).map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0);
                // WebKit native select의 익명 popup은 부모 scrollWidth에 포함될 수 있습니다.
                // 가시 DOM 경계·본문 scroll·문서 overflow를 모두 검사하고 원시 값도 남깁니다.
                return {overflow:Math.max(0,...visible.map(rect=>Math.max(rect.right-bounds.right,bounds.left-rect.left))),
                  textOverflow:Math.max(0,...Array.from(el.querySelectorAll("p,dl,dd")).map(node=>node.scrollWidth-node.clientWidth)),
                  nativeControlScrollOverflow:el.querySelector(".admin-settlement-history-controls").scrollWidth-el.querySelector(".admin-settlement-history-controls").clientWidth,
                  font:parseFloat(getComputedStyle(el.querySelector("select")).fontSize),touch:el.querySelector("button").getBoundingClientRect().height,visible:!!el.querySelector("dl").getClientRects().length};
              });
              assert(historyGeometry.visible&&historyGeometry.overflow<=1&&historyGeometry.textOverflow<=1,"admin history visible/no overflow "+JSON.stringify({engine,colorScheme,width,height,...historyGeometry}));
              if(historyGeometry.nativeControlScrollOverflow>1) console.log(JSON.stringify({diagnostic:"native-select-intrinsic-scroll",engine,colorScheme,width,height,...historyGeometry}));
              assert(historyGeometry.font>=16&&historyGeometry.touch>=44,"admin history focus/touch contract");checks+=2;
            }
            if(surface==="coach") {
              await page.locator("#coachSettlementReconciliationSummary").scrollIntoViewIfNeeded();
              const historyGeometry=await page.locator("#coachSettlementReconciliationSummary").evaluate(el=>{
                const r=el.getBoundingClientRect(),p=el.closest(".coach-settlement-modal-card"),pr=p.getBoundingClientRect();
                return {visible:!el.hidden&&!!el.getClientRects().length,overflow:el.scrollWidth-el.clientWidth,
                  reachable:r.bottom<=pr.bottom+1&&r.bottom<=innerHeight+1,closeHeight:document.querySelector("button[data-close-coach-settlement]").getBoundingClientRect().height,
                  monthFont:parseFloat(getComputedStyle(document.querySelector("#coachSettlementMonth")).fontSize)};
              });
              assert(historyGeometry.visible&&historyGeometry.reachable,"confirmed summary reachable by sheet scroll to end");
              assert(historyGeometry.overflow<=1,"confirmed history horizontal overflow zero");
              assert(historyGeometry.closeHeight>=44&&historyGeometry.monthFont>=16,"existing close touch and month focus contract "+JSON.stringify({engine,colorScheme,width,height,...historyGeometry}));
              checks+=3;
            }
            if(process.env.TENNISNOTE_R3_SCREENSHOT_DIR&&engine==="chromium"&&[390,768,1366].includes(width)){
              fs.mkdirSync(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,{recursive:true});await target.screenshot({path:path.join(process.env.TENNISNOTE_R3_SCREENSHOT_DIR,`${surface}-${width}-${colorScheme}.png`)});
            }
            layouts++;checks+=3;
          }
          console.log(JSON.stringify({result:"PASS",engine,colorScheme,surface,...receipt,layouts:widths.length,externalBlocked:external,hostedRequests:0,pageErrors:errors.length}));
        }finally{await context.close()}
      }}finally{await browser.close()}
    }
    assert.equal(layouts,confirmationOnly?32:recoveryOnly?8:fenceOnly?16:unlockOnly?12:(process.env.TENNISNOTE_R3_HISTORY_LAYOUT_ONLY === "1"?52:104));console.log(JSON.stringify({result:"PASS",layouts,checks,identityCases,scope:confirmationOnly?"current confirmation focused":recoveryOnly?"same-scope recovery focused":fenceOnly?"preview identity focused":unlockOnly?"unlock focused":"existing R3",actualRoles:"synthetic only",actualDevices:"NOT VERIFIED",themeEvidence:"OS light/dark preference; existing coach light palette unchanged",hostedRequests:0,hostedWrites:0}));
  }finally{clearTimeout(deadline)}
})().catch(error=>{console.error("R3 browser FAIL",error.message);process.exitCode=1});
