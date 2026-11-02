const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const settings = read("app/admin/views/settings.js");
const billing = read("app/admin/views/billing.js");
const actions = read("app/admin/actions/common.js");
const events = read("app/admin/events/delegated.js");
const monthEvents = read("app/admin/events/billing.js");
const payment = read("app/admin/domain/payment.js");
const section = (text, a, b) => { const start = text.indexOf(a), end = text.indexOf(b, start + a.length); assert.ok(start >= 0 && end > start); return text.slice(start, end); };

test("actual legacy rendering escapes synthetic markup and marks only repair destination", () => {
  const target = { innerHTML: "", insertAdjacentHTML() {} };
  const escapeHtml = (v) => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const source = section(settings, "function dashboardTaskLabel(", "function renderAdminOperations(")
    + section(settings, "function renderAdminOperations(", '  renderDashboardPager("#adminTaskPager"') + " return taskList.innerHTML; }";
  const ctx = { $, escapeHtml, adminLayoutSettings: {dashboardMode:"legacy"}, adminDemoMode:true,
    state:{adminTaskPage:0}, dashboardPageSize:10, dashboardSummaryPaymentReady:()=>true,
    getAdminTasks:()=>[{type:"결제오류",view:"billing",tone:"danger",title:"<script>",detail:'<img onerror="x">',action:"확인"}],
    dashboardOperationalMembers:()=>[], operationBranchCoaches:()=>[], normalizeDashboardPage:()=>0, adminEmptyState:()=>"" };
  function $(selector) { return selector === "#adminTaskList" ? target : null; }
  vm.runInNewContext(source + ";this.renderAdminOperations()", ctx);
  assert.match(target.innerHTML, /&lt;script&gt;/);
  assert.match(target.innerHTML, /&lt;img onerror=&quot;x&quot;&gt;/);
  assert.doesNotMatch(target.innerHTML, /<script>|<img/);
  assert.match(target.innerHTML, /data-billing-repair-context="1"/);
});

test("whole-period context selects only current branch repair rows and preserves original selectors", () => {
  const declaration = section(billing, "  const filteredBillings = adminBillingRepairContext", "  state.billingPage = normalizeDashboardPage");
  const selection = declaration.replace("  const filteredBillings =", "this.result =");
  const rows = [{id:1,branch:"A",paid:true,linked:false,month:"2026-08"},{id:2,branch:"A",paid:true,linked:false,month:"2026-09"},{id:3,branch:"B",paid:true,linked:false},{id:4,branch:"A",paid:true,linked:true}];
  const state = {billingMonth:"2026-07",billingFilter:"action",billingPage:2};
  const ctx = {adminBillingRepairContext:{previousPage:2},state,billingGroups:{action:[{primary:{id:9}}]},
    operationBranchBillings:()=>rows.filter(x=>x.branch==="A"), groupedBillingAttempts:r=>r.map(primary=>({primary})),
    paymentRequiresTicketRepair:item=>item.paid && !item.linked};
  vm.runInNewContext(selection,ctx);
  assert.deepEqual(Array.from(ctx.result,x=>x.primary.id),[1,2]);
  assert.equal(state.billingMonth,"2026-07"); assert.equal(state.billingFilter,"action");
  ctx.operationBranchBillings=()=>[]; vm.runInNewContext(selection,ctx); assert.equal(ctx.result.length,0);
  assert.match(billing,/회원권 연결 확인 · 전체기간 · 읽기 전용/);
  assert.match(billing,/!adminBillingRepairContext && state\.billingInlineIndex/);
  assert.match(billing,/adminBillingRepairContext \? "기존 목록에서 상세 확인"/);
  assert.match(monthEvents,/clearAdminBillingRepairContext\(\)/);
  assert.match(events,/if \(billingFilterButton\) \{\s+clearAdminBillingRepairContext\(\)/);
  assert.match(actions,/view === "billing" && options\.billingRepairContext === true/);
});

test("paid missing pointer is confirmation; genuine failed status remains failure", () => {
  const source = section(payment,"function paymentApprovalDisplay(","function paymentTicketFinalizeRecoveryCode(");
  const ctx = {paymentRequiresTicketRepair:x=>!x.ticketId};
  vm.runInNewContext(source+";this.approval=paymentApprovalDisplay",ctx);
  assert.equal(ctx.approval({status:"paid"}).label,"회원권 연결 확인 필요");
  assert.equal(ctx.approval({status:"failed"}).label,"결제 실패");
});

test("context exit invalidates only billing cache even when page and signature stay equal", () => {
  const common = read("app/admin/domain/common.js");
  const source = section(common, "function adminViewUiSignature(", "function matchesSearch(")
    + section(actions, "function clearAdminBillingRepairContext(", "function setView(");
  const cache = new Map();
  const ctx = { adminViewRenderCache:cache, adminViewRenderRevision:4, adminBillingRepairContext:{previousPage:0},
    state:{billingFilter:"action", billingMonth:"2026-08", billingPage:0, settlementPage:0,rechargePage:0},
    operationsRole:()=>"admin", activeOperationBranchId:()=>"A" };
  vm.runInNewContext(source + ";this.remember=rememberAdminViewRender;this.reuse=canReuseAdminView;this.clear=clearAdminBillingRepairContext;this.signature=adminViewUiSignature",ctx);
  const signature=ctx.signature("billing"); ctx.remember("billing"); cache.set("dashboard",{sentinel:true});
  assert.equal(ctx.reuse("billing"),true); ctx.clear();
  assert.equal(ctx.signature("billing"),signature); assert.equal(ctx.reuse("billing"),false);
  assert.equal(cache.has("dashboard"),true); assert.equal(ctx.state.billingPage,0);
});

test("explicit bank confirmation failure remains a failure for paid without ticket", () => {
  const source = section(payment,"function paymentApprovalDisplay(","function paymentTicketFinalizeRecoveryCode(");
  const ctx = {paymentRequiresTicketRepair:x=>!x.ticketId};
  vm.runInNewContext(source+";this.approval=paymentApprovalDisplay",ctx);
  const result=ctx.approval({status:"paid",ticketId:"",bankTransferState:"confirmation_failed"});
  assert.equal(result.label,"회원권 처리 실패"); assert.equal(result.tone,"danger");
});
