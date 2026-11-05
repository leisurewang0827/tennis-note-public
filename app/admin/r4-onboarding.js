(function installProductionWorkspace(root) {
  "use strict";
  const config = root.TennisNoteDataClient?.loadConfig?.() || root.TENNISNOTE_CONFIG || {};
  const production = config.environment === "production"
    && config.supabaseUrl === "https://cnympiwrwgouuvhaivbc.supabase.co"
    && config.projectFingerprint === "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a"
    && root.location.origin === "https://tennisnote-admin.pages.dev";
  root.TennisNoteR4ExistingAccount = Object.freeze({
    isProductionTarget: () => production,
    isWorkspaceMode({ role } = {}) {
      return production && (role === "member" || new URLSearchParams(root.location.search).get("r4Workspace") === "1");
    },
    // 신규 일반 계정은 기존 온보딩 영역을 사용한다. 기존 관리자·코치 메뉴를 확장하지 않는다.
    refreshEntry() {},
  });
})(window);

(function installR4Onboarding(root, document) {
  const byId = id => document.getElementById(id);
  const panel = byId("r4Onboarding"), title = byId("r4OnboardingTitle");
  const form = byId("r4ApplicationForm"), list = byId("r4ApplicationList");
  const reload = byId("r4ApplicationRefresh"), status = byId("r4ApplicationStatus");
  if (![panel, title, form, list, reload, status].every(Boolean)) return;
  const message = byId("operationsLoginMessage");
  const button = form.querySelector('button[type="submit"]');
  const auth = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  const config = root.TennisNoteDataClient?.loadConfig?.() || root.TENNISNOTE_CONFIG || {};
  const seoulProduction = root.TennisNoteR4ExistingAccount?.isProductionTarget?.() === true;
  const selfServeApi = seoulProduction
    ? { state: "tn_r4_prod_my_selfserve_branch", create: "tn_r4_prod_create_selfserve_branch" }
    : null;
  const labels = { pending: "심사 대기", approved: "승인", rejected: "반려" };
  const id = value => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  let session = null;
  const current = ctx => session === ctx && ctx.actor === ctx.client.sessionSubject?.();
  const call = (ctx, name, args = {}) => {
    if (!selfServeApi) throw Error("r4_environment_mismatch");
    if (!current(ctx)) throw Error("r4_session_changed");
    return ctx.client.rpc(name, args, auth);
  };
  const busy = (ctx, flag) => {
    ctx.busy = flag;
    reload.disabled = flag;
    for (const control of list.querySelectorAll("button")) control.disabled = flag;
    button.disabled = flag || ctx.mode !== "applicant" || !ctx.canSubmit;
  };
  function action(text, handler, primary = false) {
    const control = document.createElement("button");
    control.type = "button";
    control.className = primary ? "primary-button" : "ghost-button";
    control.textContent = text;
    control.addEventListener("click", handler);
    return control;
  }
  async function load(ctx) {
    if (!selfServeApi) throw Error("r4_environment_mismatch");
    if (!root.TennisNoteR4PhoneVerification) throw Error("r4_phone_module_missing");
    const admission = await call(ctx, selfServeApi.state);
    if (!current(ctx)) return;
    if (admission?.identityVerificationEnabled !== true) root.TennisNoteR4PhoneVerification.reset();
    const verified = admission?.identityVerificationEnabled !== true || await root.TennisNoteR4PhoneVerification.refresh({
      client: ctx.client,
      readAdmission: () => call(ctx, selfServeApi.state),
      onVerified: () => current(ctx) && run(ctx, () => load(ctx), "인증 상태를 확인할 수 없습니다."),
    });
    if (!current(ctx)) return;
    if (!verified) {
      ctx.canSubmit = false;
      ctx.approvedBranches = new Set();
      title.textContent = "내 지점";
      panel.hidden = false;
      form.hidden = true;
      list.replaceChildren();
      if (message) message.hidden = true;
      return;
    }
    let rows;
    try {
      rows = await call(ctx, "tn_r4_pending_branch_applications");
      if (!Array.isArray(rows)) throw Error("r4_invalid_review_list");
      ctx.mode = "reviewer";
    } catch (error) {
      if (!current(ctx)) return;
      if ((error?.payload?.code || error?.code) !== "42501") throw error;
      rows = await call(ctx, "tn_r4_my_branch_applications");
      if (!Array.isArray(rows)) throw Error("r4_invalid_application_list");
      ctx.mode = "applicant";
    }
    if (!current(ctx)) return;
    ctx.selfServe = null;
    ctx.selfServeOff = false;
    if (ctx.mode === "applicant") {
      try {
        const state = admission;
        ctx.selfServeOff = state?.available === false && !id(state.branchId) && state.paymentEnabled === false && rows.length === 0;
        if (state?.paymentEnabled === false && (state.available === true || id(state.branchId))) ctx.selfServe=state;
      } catch { /* 기존 신청 흐름은 그대로 유지한다. */ }
    }
    if (!current(ctx)) return;
    ctx.canSubmit = ctx.mode === "applicant" && !ctx.selfServeOff && !ctx.selfServe?.branchId && !rows.some(row => row.status === "pending");
    title.textContent = ctx.mode === "reviewer" ? "지점 신청 심사" : ctx.selfServe ? "내 지점" : "지점 신청";
    button.textContent = ctx.selfServe?.available ? "내 지점 만들기" : "지점 신청";
    form.hidden = !ctx.canSubmit;
    panel.hidden = false;
    if (message) message.hidden = true;
    const items = rows.filter(row => id(row.application_id) && typeof row.branch_name === "string");
    ctx.approvedBranches = new Set(ctx.mode === "applicant" ? items
      .filter(row => row.status === "approved" && id(row.branch_id)).map(row => row.branch_id) : []);
    list.replaceChildren();
    for (const row of items) {
      const item = document.createElement("p");
      if (ctx.mode === "reviewer") {
        item.textContent = `${row.organization_name} · ${row.branch_name} `;
        item.append(action("승인", () => decide(ctx, row, "approve"), true),
          action("반려", () => decide(ctx, row, "reject")));
      } else {
        item.textContent = `${row.branch_name} · ${labels[row.status] || "상태 확인 필요"} `;
        if (row.status === "approved" && id(row.branch_id)) {
          item.append(action("내 지점 열기", () => open(ctx, row)));
        }
      }
      list.append(item);
    }
    if (id(ctx.selfServe?.branchId) && typeof ctx.selfServe.name === "string") {
      const branchId=ctx.selfServe.branchId;
      ctx.approvedBranches.add(branchId);
      const item=document.createElement("p");
      item.textContent=ctx.selfServe.name+" · 운영 관리 · 앱 결제 OFF ";
      item.append(action("내 지점 열기",()=>open(ctx,{branch_id:branchId,selfServe:true})));
      list.prepend(item);
    }
    if (!list.children.length) list.textContent = ctx.selfServeOff ? "지점 개설을 준비 중입니다." : ctx.mode === "reviewer" ? "대기 중인 신청이 없습니다." : "신청 내역이 없습니다.";
  }
  async function run(ctx, work, fallback) {
    if (!current(ctx) || ctx.busy) return;
    busy(ctx, true);
    status.textContent = "확인 중입니다.";
    try {
      const note = await work();
      if (current(ctx)) status.textContent = note || "";
    } catch {
      if (current(ctx)) {
        // Unknown write outcome: require an explicit status refresh, not an automatic retry.
        ctx.canSubmit = false;
        ctx.approvedBranches = new Set();
        list.replaceChildren();
        panel.hidden = false;
        status.textContent = fallback;
      }
    } finally {
      if (current(ctx)) busy(ctx, false);
    }
  }
  function decide(ctx, row, decision) {
    if (ctx.mode !== "reviewer") return;
    const expected = decision === "approve" ? "approved" : "rejected";
    return run(ctx, async () => {
      const result = await call(ctx, "tn_r4_review_branch_application", { application_id: row.application_id, decision });
      if (result?.status !== expected || (expected === "approved" && !id(result.branchId))) throw Error("r4_review_receipt");
      await load(ctx);
      return expected === "approved" ? "지점 신청을 승인했습니다." : "지점 신청을 반려했습니다.";
    }, "처리 결과를 확인할 수 없습니다. 상태를 새로 확인해 주세요.");
  }
  function open(ctx, row) {
    return run(ctx, async () => {
      const workspace = row.selfServe && seoulProduction ? root.TennisNoteR4SelfserveClient.forBranch(ctx.client, row.branch_id) : ctx.client;
      const result = await workspace.rpc("tn_r4_open_my_branch", { target_branch: row.branch_id }, auth);
      if (!current(ctx)) return;
      if (result?.branchId !== row.branch_id || result.paymentEnabled !== false) throw Error("r4_open_receipt");
      if (row.selfServe) {
        root.TennisNoteR4BranchAdminWrites?.refresh?.({ allowed: true, client: workspace });
        root.TennisNoteR4BranchOperations?.refresh?.({ allowed: true, client: workspace });
      }
      const opened = await root.TennisNoteR4BranchHours?.refresh?.({
        allowed: true, client: workspace, openBranchId: row.branch_id,
      });
      if (opened !== true) throw Error("r4_workspace_unavailable");
      return row.selfServe ? "내 지점을 열었습니다." : "승인된 지점을 열었습니다.";
    }, "지점을 열 수 없습니다. 상태를 새로 확인해 주세요.");
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const ctx = session;
    if (!ctx || ctx.mode !== "applicant" || !ctx.canSubmit) return;
    const organization = form.elements.organization.value.trim(), branch = form.elements.branch.value.trim();
    if ([organization, branch].some(value => value.length < 2 || value.length > 100)) return;
    return run(ctx, async () => {
      if (ctx.selfServe?.available) {
        const key=ctx.createKey?.org===organization && ctx.createKey?.branch===branch ? ctx.createKey.key : root.crypto.randomUUID();
        ctx.createKey={org:organization,branch,key};
        const created=await call(ctx,selfServeApi.create,{p_organization:organization,p_branch:branch,p_operation:key});
        if (created?.status!=="created" || !id(created.branchId) || created.paymentEnabled!==false) throw Error("r4_create_receipt");
        if (current(ctx)) form.reset();
        await load(ctx);
        if (ctx.selfServe?.branchId!==created.branchId) throw Error("r4_create_readback");
        return "지점을 만들었습니다. 내 지점 열기를 눌러 운영을 시작하세요.";
      }
      const result = await call(ctx, "tn_r4_submit_branch_application", { organization_name: organization, branch_name: branch });
      if (result?.status !== "pending" || !id(result.applicationId)) throw Error("r4_application_receipt");
      if (current(ctx)) form.reset();
      await load(ctx);
      return "신청을 접수했습니다. 승인 후 내 지점을 열 수 있습니다.";
    }, "신청 결과를 확인할 수 없습니다. 다시 신청하기 전에 상태를 새로 확인해 주세요.");
  });
  reload.addEventListener("click", () => {
    const ctx = session;
    if (ctx) return run(ctx, () => load(ctx), "신청 상태를 조회할 수 없습니다.");
  });
  root.TennisNoteR4Onboarding = Object.freeze({
    ownsApprovedBranch(branchId) {
      return Boolean(session && current(session) && session.approvedBranches?.has(branchId));
    },
    refresh({ allowed, client }) {
      const actor = allowed && client?.sessionSubject?.();
      if (actor && session?.actor === actor && session.client === client) return;
      if (session && message && byId("r4BranchHoursPanel")?.hidden !== false) message.hidden = false;
      root.TennisNoteR4PhoneVerification?.reset();
      session = null;
      panel.hidden = true;
      title.textContent = "지점 신청";
      form.hidden = true;
      form.reset();
      list.replaceChildren();
      status.textContent = "";
      if (!actor || !client?.rpc) return;
      const ctx = session = { actor, client, busy: false, mode: "", canSubmit: false };
      return run(ctx, () => load(ctx), "신청 상태를 조회할 수 없습니다.");
    },
  });
})(window, document);
