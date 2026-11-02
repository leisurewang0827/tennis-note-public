const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const catalog = read("app/admin/catalog.js");
const policy = read("app/admin/domain/policy.js");
const settings = read("app/admin/views/settings.js");
const actions = read("app/admin/actions/settings.js");
const html = read("app/admin/index.html");
const common = read("app/admin/views/common.js");
function section(text, start, end) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `missing ${start}`);
  return text.slice(a, b);
}
const context = vm.createContext({});
vm.runInContext(section(catalog, "const adminMenuDefinitions", "const defaultAdminLockSettings")
  + section(read("app/admin/domain/common.js"), "function normalizeLayoutOrder", "function ")
  + section(policy, "function defaultAdminLayoutSettings", "function normalizeAdminLockSettings")
  + "\nthis.normalize = normalizeAdminLayoutSettings;", context);
const groupContext = vm.createContext({});
vm.runInContext(section(settings, "function summarizeAdminTasks", "function renderAdminOperations")
  + "\nthis.summarize = summarizeAdminTasks;", groupContext);

test("legacy selection and required visibility are preserved, unknown keys are rejected", () => {
  const value = context.normalize({ dashboardMode: "legacy", hiddenMenus: ["dashboard", "reports", "unknown"],
    hiddenWidgets: ["tasks", "members", "unknown"], widgetOrder: { metrics: ["metric-payments", "unknown"] } });
  assert.equal(value.dashboardMode, "legacy");
  assert.deepEqual(Array.from(value.hiddenMenus), ["reports"]);
  assert.deepEqual(Array.from(value.hiddenWidgets), ["members"]);
  assert.equal(value.widgetOrder.metrics[0], "metric-payments");
  assert.equal(value.widgetOrder.metrics.length, 4);
  assert.equal(context.normalize({ dashboardMode: "unknown" }).dashboardMode, "summary");
});

test("nine task kinds keep all counts and destinations, with danger preserved", () => {
  const tasks = ["결제오류", "긴급", "보강", "결제확인", "횟수", "쿠폰 일정", "수업기록", "운동노트", "결제요청"]
    .map((type, i) => ({ type, view: i < 2 ? "billing" : "schedule", tone: "warn" }));
  tasks.push({ type: "결제오류", view: "billing", tone: "danger" });
  const groups = groupContext.summarize(tasks);
  assert.equal(groups.length, 9);
  assert.equal(groups.reduce((n, x) => n + x.count, 0), tasks.length);
  assert.equal(groups[0].tone, "danger");
  assert.equal(groups[0].view, "billing");
});

test("summary keeps readiness guard and escapes type, tone and destination", () => {
  assert.match(settings, /summaryMode && !summaryReady/);
  for (const value of ["task.tone", "dashboardTaskLabel(task)", "task.view"]) assert.ok(settings.includes(`escapeHtml(${value})`));
  assert.match(actions, /dashboardMode === "summary"/);
  assert.match(common, /state\.liveScheduleLoaded && !state\.liveScheduleLoading && !summaryFailed/);
  assert.ok(settings.includes("자료를 확인하지 못했습니다"));
  assert.ok(common.includes("자료 확인 실패"));
});

test("metrics and configuration link reuse existing destinations", () => {
  for (const id of ["metric-lessons", "metric-changes", "metric-records", "metric-payments"]) assert.ok(html.includes(`data-dashboard-widget="${id}"`));
  assert.equal((html.match(/<button class="metric-card[^>]+data-jump=/g) || []).length, 4);
  assert.ok(html.includes('<strong id="metricMakeups">—</strong>'));
  for (const target of ["schedule", "notes", "billing"]) assert.ok(html.includes(`data-jump="${target}"`));
  assert.ok(html.includes('data-jump="settings" data-settings-tab="layout"'));
  assert.ok(common.includes('${currentBillingMonth} 조회 자료 기준'));
});

test("first dashboard render applies the chosen layout before drawing tasks", () => {
  const block = section(common, 'if (activeView === "dashboard")', 'if (activeView === "members")');
  assert.ok(block.indexOf("applyAdminLayoutSettings()") >= 0);
  assert.ok(block.indexOf("applyAdminLayoutSettings()") < block.indexOf("renderAdminOperations()"));
});

test("summary uses the full task width and legacy restores existing layout", () => {
  const groups = Object.fromEntries(["metrics", "operations", "lessons", "insights"].map(id => [id, {
    style: {}, hidden: false, append() {}, querySelector() { return null; },
  }]));
  const widgets = Object.fromEntries(["tasks", "members", "coaches", "notices", "reports", "metric-lessons", "metric-changes", "metric-records", "metric-payments"].map(id => [id, { hidden: false }]));
  const dashboard = { classList: { add() {} }, querySelector(selector) {
    const group = selector.match(/^\[data-dashboard-group="([^"]+)"\]$/);
    const widget = selector.match(/^\[data-dashboard-widget="([^"]+)"\]$/);
    return group ? groups[group[1]] : widget ? widgets[widget[1]] : null;
  } };
  const state = { view: "dashboard" };
  const layout = context.normalize({});
  const sandbox = vm.createContext({ adminLayoutSettings: layout, state,
    adminDashboardWidgetDefinitions: { metrics: Object.keys(widgets).filter(x => x.startsWith("metric-")).map(id => ({ id })),
      operations: ["tasks", "members", "coaches"].map(id => ({ id })),
      insights: ["notices", "reports"].map(id => ({ id })) },
    $: selector => selector === "#dashboardView" ? dashboard : null,
  });
  vm.runInContext(section(actions, "function applyAdminLayoutSettings", "function applyAdminLayoutPreset") + "\nthis.apply = applyAdminLayoutSettings;", sandbox);
  sandbox.apply();
  assert.equal(groups.operations.style.gridTemplateColumns, "minmax(0, 1fr)");
  assert.equal(groups.lessons.hidden, true);
  assert.equal(widgets.members.hidden, true);
  assert.equal(widgets.tasks.hidden, false);
  layout.dashboardMode = "legacy";
  sandbox.apply();
  assert.equal(groups.operations.style.gridTemplateColumns, "");
  assert.equal(groups.lessons.hidden, false);
  assert.equal(widgets.members.hidden, false);
});

test("partial-source payment failure never counts as confirmed", () => {
  const c = vm.createContext({ adminDemoMode: false, billings: Array(500).fill({}), serverPaymentSyncState: {
    loaded: true, directLoaded: false, loading: false, tone: "good",
  } });
  vm.runInContext(section(settings, "function dashboardSummaryPaymentReady", "function summarizeAdminTasks")
    + "\nthis.ready = dashboardSummaryPaymentReady;", c);
  assert.equal(c.ready(), false);
  c.serverPaymentSyncState.directLoaded = true;
  c.serverPaymentSyncState.tone = "danger";
  assert.equal(c.ready(), false);
  c.serverPaymentSyncState.tone = "good";
  c.serverPaymentSyncState.loading = true;
  assert.equal(c.ready(), false);
  c.serverPaymentSyncState.loading = false;
  assert.equal(c.ready(), false);
  c.serverPaymentSyncState.summaryVerified = true;
  c.serverPaymentSyncState.directLoaded = false;
  assert.equal(c.ready(), true);
});

test("partial-source summary makes unknown explicit instead of asserting no tasks", () => {
  assert.ok(settings.includes('미확인 자료는 상세에서 확인해 주세요'));
  assert.equal(settings.split('불러온 자료 기준입니다. 자세한 내용은 각 항목에서 확인하세요.').length - 1, 1);
  assert.ok(settings.includes('task.view === "billing" && !summaryPaymentReady'));
  assert.ok(settings.includes(': `${task.count}건`') && !settings.includes('조회 자료 기준 ${task.count}건'));
  assert.ok(common.includes('adminLayoutSettings.dashboardMode !== "summary" || dashboardSummaryPaymentReady()'));
});

test("partial-source metric rendering masks unverified payment and record zeros", () => {
  const fields = Object.fromEntries(["#metricLessons", "#metricMakeups", "#metricNotes", "#metricBilling"].map(id => [id, {
    textContent: "", parentElement: { querySelector: () => ({ textContent: "" }) },
  }]));
  const sync = { loaded: true, directLoaded: false, loading: false, tone: "good" };
  const c = vm.createContext({ adminDemoMode: false, billings: Array(500).fill({}), serverPaymentSyncState: sync,
    adminLayoutSettings: { dashboardMode: "summary" }, state: { liveScheduleLoaded: true, liveScheduleLoading: false, liveScheduleMessage: "", billingMonth: "2026-01" },
    $: id => fields[id] || null, adminRecordGroups: () => ({ pending: [], feedback: [], issue: [] }),
    adminTodayLessonRows: () => [], operationBranchLessons: () => [], operationBranchBillings: () => [],
    pendingLessonChangeApprovals: () => [], groupedBillingAttempts: a => a,
    adminLocalDateKey: () => "2026-01-01", billingOperationalMonthMatches: () => true,
  });
  vm.runInContext(section(settings, "function dashboardSummaryPaymentReady", "function summarizeAdminTasks")
    + section(common, "function renderMetrics", "function renderModePanel") + "\nthis.render = renderMetrics;", c);
  c.render();
  assert.equal(fields["#metricNotes"].textContent, "—");
  assert.equal(fields["#metricBilling"].textContent, "—");
  sync.directLoaded = true;
  c.render();
  assert.equal(fields["#metricBilling"].textContent, "—");
  sync.summaryVerified = true;
  sync.directLoaded = false;
  c.render();
  assert.equal(fields["#metricBilling"].textContent, "0");
  assert.equal(fields["#metricNotes"].textContent, "—");
  sync.tone = "danger";
  c.render();
  assert.equal(fields["#metricBilling"].textContent, "—");
});

test("source-signal distinguishes successful roster, failed fallback and the known limit", async () => {
  const source = read("app/admin/actions/common.js");
  const line = source.split(/\r?\n/).find(x => x.includes('fullAdminAccess ? rosterRows("operationalPayments"'));
  assert.ok(line);
  const expression = line.trim().replace(/,$/, "");
  const run = vm.runInNewContext(`(async (rosterRows, client, fullAdminAccess) => {
    let operationalPaymentsFailed = false;
    const serverPayments = await (${expression});
    return fullAdminAccess && !operationalPaymentsFailed && Array.isArray(serverPayments) && serverPayments.length < 500;
  })`);
  const fromRoster = rows => async (_key, fallback) => rows === null ? fallback() : rows;
  assert.equal(await run(fromRoster([]), {}, true), true);
  assert.equal(await run(fromRoster(Array(499).fill({})), {}, true), true);
  assert.equal(await run(fromRoster(Array(500).fill({})), {}, true), false);
  assert.equal(await run(fromRoster(null), { selectRows: async () => { throw Error("synthetic"); } }, true), false);
  assert.equal(await run(fromRoster(null), { selectRows: async () => [] }, true), true);
  assert.equal(await run(fromRoster([]), {}, false), false);
});

test("source-signal respects success, loading, error and direct result cap", () => {
  const c = vm.createContext({ adminDemoMode: false, billings: [], serverPaymentSyncState: { loaded: true, summaryVerified: true, loading: false, tone: "good" } });
  vm.runInContext(section(settings, "function dashboardSummaryPaymentReady", "function summarizeAdminTasks") + "\nthis.ready = dashboardSummaryPaymentReady;", c);
  assert.equal(c.ready(), true);
  c.serverPaymentSyncState.loading = true; assert.equal(c.ready(), false);
  c.serverPaymentSyncState.loading = false; c.serverPaymentSyncState.tone = "danger"; assert.equal(c.ready(), false);
  c.serverPaymentSyncState.tone = "good"; c.serverPaymentSyncState.summaryVerified = false; assert.equal(c.ready(), false);
  c.serverPaymentSyncState.directLoaded = true; assert.equal(c.ready(), true);
  c.billings = Array(500).fill({}); assert.equal(c.ready(), false);
  c.serverPaymentSyncState.summaryVerified = true; assert.equal(c.ready(), false);
});
