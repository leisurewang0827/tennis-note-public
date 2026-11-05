(function installMarketplaceIntegration(root, doc) {
  "use strict";
  const DEV = "https://udjmiezroipctytmztwz.supabase.co";
  const FP = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
  const ORIGINS = new Set(["https://tennisnote-admin-dev.pages.dev", "https://tennisnote-app-dev.pages.dev", "https://r4-marketplace-qa.tennisnote-admin-dev.pages.dev", "https://r4-marketplace-qa.tennisnote-app-dev.pages.dev"]);
  const AUTH = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const STATUS = new Map([
    ["not_submitted", "상품 초안을 저장할 수 있습니다."],
    ["policy_pending", "판매 준비 중입니다."],
    ["verification_pending", "판매자 확인 중입니다."],
    ["needs_review", "추가 확인 중입니다."],
    ["eligible", "판매자 확인 완료"],
  ]);
  const by = id => doc.getElementById(id);
  const seller = by("r4MarketSeller"), buyer = by("r4MarketBuyer");
  if (!seller && !buyer) return;
  let context = null;
  const kindLabel = kind => kind === "business" ? "사업장" : "독립 코치";
  const validKind = kind => kind === "business" || kind === "independent_coach";
  const money = value => Number(value).toLocaleString("ko-KR") + "원";
  const online = client => client.isOnline?.() !== false;
  function environment(client) {
    const cfg = client.loadConfig?.();
    return cfg?.environment === "development" && cfg.supabaseUrl === DEV && cfg.projectFingerprint === FP
      && (ORIGINS.has(root.location.origin)
        || (["localhost", "127.0.0.1"].includes(root.location.hostname)
          && cfg.r4MarketplaceLocalSimulation === true && client.r4LocalAdapter === true));
  }
  const current = ctx => context === ctx && ctx.actor === ctx.client.sessionSubject?.() && environment(ctx.client);
  function closeDetail() {
    const detail = by("r4MarketDetail");
    if (!detail || detail.hidden) return;
    if (typeof root.closeAppSheet === "function") root.closeAppSheet(detail.id);
    else if (!root.TennisNoteBottomSheet?.close?.(detail)) detail.hidden = true;
  }
  function clear() {
    context = null;
    closeDetail();
    for (const element of [seller, buyer, by("r4MarketStartForm"), by("r4MarketDraftForm"), by("r4MarketWorkspaceLabel")]) {
      if (element) element.hidden = true;
    }
    for (const id of ["r4MarketDrafts", "r4MarketWorkspace", "r4MarketCatalog", "r4MarketDetailSummary"]) by(id)?.replaceChildren();
    for (const id of ["r4MarketStartForm", "r4MarketDraftForm"]) by(id)?.reset();
    if (by("r4MarketSearch")) by("r4MarketSearch").value = "";
    if (by("r4MarketDetailTitle")) by("r4MarketDetailTitle").textContent = "상품 상세";
  }
  function message(error) {
    const code = error?.payload?.code || error?.code;
    if (code === "42501") return "이 화면을 볼 권한이 없습니다.";
    if (error?.status === 401 || code === "PGRST301") return "다시 로그인해 주세요.";
    return "불러오지 못했습니다. 다시 확인해 주세요.";
  }
  async function rpc(ctx, name, params = {}) {
    if (!current(ctx)) throw Error("session_changed");
    if (!online(ctx.client)) throw Error("offline");
    return ctx.client.rpc(name, params, AUTH);
  }
  function sellerControls(ctx) {
    const disabled = ctx.busy || !ctx.sellerLoaded || !online(ctx.client);
    for (const item of seller?.querySelectorAll("input, select, button[type=submit]") || []) item.disabled = disabled;
    if (by("r4MarketSellerRefresh")) by("r4MarketSellerRefresh").disabled = ctx.busy;
    const form = by("r4MarketDraftForm");
    if (form) {
      const single = form.elements.kind.value === "single_lesson";
      form.elements.sessions.readOnly = single;
      if (single) form.elements.sessions.value = "1";
    }
  }
  const validProduct = product => UUID.test(product?.id || "") && typeof product.title === "string"
    && Number.isInteger(product.sessions) && product.sessions > 0 && product.sessions <= 100;
  function card(title, subtitle) {
    const li = doc.createElement("li"), heading = doc.createElement("strong"), text = doc.createElement("span");
    li.className = "tn-market-card";
    heading.textContent = title;
    text.textContent = subtitle;
    li.append(heading, text);
    return li;
  }
  async function sellerView(ctx, workspace) {
    const seq = ++ctx.sellerSeq;
    ctx.sellerLoaded = false;
    by("r4MarketDrafts").replaceChildren();
    by("r4MarketDraftForm").hidden = true;
    sellerControls(ctx);
    by("r4MarketSellerStatus").textContent = "상품을 확인하고 있습니다.";
    const still = () => current(ctx) && seq === ctx.sellerSeq && workspace === by("r4MarketWorkspace").value;
    try {
      const result = await rpc(ctx, "tn_r4_marketplace_seller_view", { p_workspace: workspace });
      if (!still()) return;
      if (!STATUS.has(result?.status) || !Array.isArray(result.products)
        || result.products.some(p => !validProduct(p) || !Number.isInteger(p.price) || p.price < 0)) throw Error("invalid_receipt");
      by("r4MarketSellerStatus").textContent = STATUS.get(result.status);
      by("r4MarketDrafts").replaceChildren(...result.products.map(p => card(p.title, money(p.price) + " · " + p.sessions + "회 · 초안")));
      // mayPublish=true 또는 오래된 서버 응답이어도 이 연결 후보는 공개·결제 RPC를 호출하지 않는다.
      by("r4MarketDraftForm").hidden = false;
      ctx.sellerLoaded = true;
    } catch (error) {
      if (still()) by("r4MarketSellerStatus").textContent = online(ctx.client) ? message(error) : "연결 후 다시 확인해 주세요.";
    } finally { if (still()) sellerControls(ctx); }
  }
  async function loadSeller(ctx) {
    const seq = ++ctx.workspaceSeq;
    const still = () => current(ctx) && seq === ctx.workspaceSeq;
    seller.hidden = false;
    ctx.sellerLoaded = false;
    ++ctx.sellerSeq;
    by("r4MarketStartForm").hidden = true;
    by("r4MarketDraftForm").hidden = true;
    by("r4MarketWorkspaceLabel").hidden = true;
    by("r4MarketDrafts").replaceChildren();
    sellerControls(ctx);
    by("r4MarketSellerStatus").textContent = "운영 공간을 확인하고 있습니다.";
    try {
      const rows = await rpc(ctx, "tn_r4_my_seller_workspace_drafts");
      if (!still()) return;
      if (!Array.isArray(rows) || rows.some(w => !UUID.test(w?.id || "") || !validKind(w.kind) || typeof w.display_name !== "string")) throw Error("invalid_receipt");
      const choice = by("r4MarketWorkspace"), previous = choice.value;
      choice.replaceChildren(...rows.map(w => {
        const option = doc.createElement("option");
        option.value = w.id;
        option.textContent = kindLabel(w.kind) + " · " + w.display_name;
        return option;
      }));
      if (rows.some(w => w.id === previous)) choice.value = previous;
      by("r4MarketWorkspaceLabel").hidden = rows.length === 0;
      by("r4MarketStartForm").hidden = rows.length !== 0;
      if (rows.length) await sellerView(ctx, choice.value);
      else {
        ctx.sellerLoaded = true;
        by("r4MarketSellerStatus").textContent = "사업장 또는 독립 코치로 시작하세요.";
        sellerControls(ctx);
      }
    } catch (error) {
      if (still()) by("r4MarketSellerStatus").textContent = online(ctx.client) ? message(error) : "연결 후 다시 확인해 주세요.";
    }
  }
  function detail(ctx, product) {
    if (!current(ctx) || !ctx.catalog.some(p => p.id === product.id)) return;
    by("r4MarketDetailTitle").textContent = product.title;
    const nodes = [];
    for (const [label, value] of [["판매자", product.seller_name], ["가격", money(product.price_krw)], ["이용 횟수", product.sessions + "회"]]) {
      const dt = doc.createElement("dt"), dd = doc.createElement("dd");
      dt.textContent = label; dd.textContent = value; nodes.push(dt, dd);
    }
    by("r4MarketDetailSummary").replaceChildren(...nodes);
    if (typeof root.openAppSheet === "function") root.openAppSheet("r4MarketDetail");
    else if (!root.TennisNoteBottomSheet?.open?.(by("r4MarketDetail"))) by("r4MarketDetail").hidden = false;
  }
  function renderCatalog(ctx) {
    if (!current(ctx)) return;
    const search = by("r4MarketSearch").value.trim().toLocaleLowerCase("ko-KR");
    const rows = ctx.catalog.filter(p => (p.title + " " + p.seller_name).toLocaleLowerCase("ko-KR").includes(search));
    by("r4MarketCatalog").replaceChildren(...rows.map(p => {
      const item = card(p.title, p.seller_name + " · " + money(p.price_krw) + " · " + p.sessions + "회");
      const button = doc.createElement("button"); button.type = "button"; button.className = "small-button";
      button.textContent = "상세"; button.addEventListener("click", () => detail(ctx, p)); item.append(button);
      return item;
    }));
    by("r4MarketBuyerStatus").textContent = rows.length ? "상품 정보를 확인하세요."
      : ctx.catalog.length ? "검색 결과가 없습니다." : "현재 구매할 수 있는 상품이 없습니다.";
  }
  async function loadBuyer(ctx) {
    const seq = ++ctx.catalogSeq;
    buyer.hidden = false;
    ctx.catalog = [];
    closeDetail();
    by("r4MarketCatalog").replaceChildren();
    by("r4MarketBuyerStatus").textContent = "상품을 확인하고 있습니다.";
    by("r4MarketBuyerRefresh").disabled = true;
    try {
      const rows = await rpc(ctx, "tn_r4_marketplace_catalog");
      if (!current(ctx) || ctx.catalogSeq !== seq) return;
      if (!Array.isArray(rows) || rows.some(p => !validProduct(p) || typeof p.seller_name !== "string"
        || !Number.isInteger(p.price_krw) || p.price_krw < 0)) throw Error("invalid_receipt");
      ctx.catalog = rows;
      renderCatalog(ctx);
    } catch (error) {
      if (current(ctx) && ctx.catalogSeq === seq) by("r4MarketBuyerStatus").textContent = online(ctx.client) ? message(error) : "연결 후 다시 확인해 주세요.";
    } finally { if (current(ctx) && ctx.catalogSeq === seq) by("r4MarketBuyerRefresh").disabled = false; }
  }
  const start = by("r4MarketStartForm"), draft = by("r4MarketDraftForm");
  start?.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = context;
    if (!ctx || !current(ctx) || ctx.busy || !ctx.sellerLoaded || start.hidden) return;
    const kind = start.elements.kind.value, name = start.elements.displayName.value.trim();
    if (!validKind(kind) || name.length < 2 || name.length > 100) return;
    ctx.busy = true; sellerControls(ctx);
    try {
      const saved = await rpc(ctx, "tn_r4_start_seller_workspace_draft", { workspace_kind: kind, workspace_name: name });
      if (!current(ctx)) return;
      if (!UUID.test(saved?.id || "") || saved.kind !== kind || saved.displayName !== name || saved.status !== "draft") throw Error("invalid_receipt");
      start.reset(); await loadSeller(ctx);
    } catch { if (current(ctx)) { ctx.sellerLoaded = false; by("r4MarketSellerStatus").textContent = "저장 결과를 먼저 다시 확인해 주세요."; } }
    finally { if (current(ctx)) { ctx.busy = false; sellerControls(ctx); } }
  });
  draft?.elements.kind.addEventListener("change", () => { if (context && current(context)) sellerControls(context); });
  draft?.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = context;
    if (!ctx || !current(ctx) || ctx.busy || !ctx.sellerLoaded || draft.hidden) return;
    const params = { p_workspace: by("r4MarketWorkspace").value, p_kind: draft.elements.kind.value,
      p_title: draft.elements.title.value.trim(), p_price: draft.elements.price.valueAsNumber,
      p_sessions: draft.elements.sessions.valueAsNumber };
    if (!UUID.test(params.p_workspace) || !["single_lesson", "lesson_pass"].includes(params.p_kind)
      || params.p_title.length < 2 || params.p_title.length > 100 || !Number.isInteger(params.p_price)
      || params.p_price < 0 || params.p_price > 10000000 || !Number.isInteger(params.p_sessions)
      || params.p_sessions < 1 || params.p_sessions > 100 || (params.p_kind === "single_lesson" && params.p_sessions !== 1)) return;
    const signature = JSON.stringify(params);
    if (ctx.draftKey?.signature !== signature) ctx.draftKey = { signature, key: root.crypto.randomUUID() };
    ctx.busy = true; sellerControls(ctx);
    try {
      const id = await rpc(ctx, "tn_r4_create_marketplace_draft", { ...params, p_request: ctx.draftKey.key });
      if (!current(ctx)) return;
      if (!UUID.test(id || "")) throw Error("invalid_receipt");
      draft.reset(); ctx.draftKey = null; await sellerView(ctx, params.p_workspace);
    } catch { if (current(ctx)) { ctx.sellerLoaded = false; by("r4MarketSellerStatus").textContent = "저장 결과를 먼저 다시 확인해 주세요."; } }
    finally { if (current(ctx)) { ctx.busy = false; sellerControls(ctx); } }
  });
  by("r4MarketWorkspace")?.addEventListener("change", () => {
    const ctx = context;
    if (!ctx || !current(ctx) || ctx.busy) return;
    draft.reset(); ctx.draftKey = null; void sellerView(ctx, by("r4MarketWorkspace").value);
  });
  by("r4MarketSellerRefresh")?.addEventListener("click", () => { if (context && !context.busy) void loadSeller(context); });
  by("r4MarketBuyerRefresh")?.addEventListener("click", () => { if (context) void loadBuyer(context); });
  by("r4MarketSearch")?.addEventListener("input", () => { if (context) renderCatalog(context); });
  by("r4MarketDetailClose")?.addEventListener("click", closeDetail);
  root.TennisNoteR4Marketplace = Object.freeze({
    isWorkspaceMode: ({ role } = {}) => role === "member" && environment(root.TennisNoteDataClient || {}),
    reset: clear,
    async refresh({ allowed, client } = {}) {
      const actor = allowed === true && environment(client || {}) && client?.sessionSubject?.();
      if (!actor || !client?.rpc) { clear(); return; }
      if (seller) {
        const gate = by("operationsLoginGate");
        const host = gate?.hidden ? by("settingsView") : gate?.querySelector(".operations-login-panel");
        if (host && seller.parentNode !== host) host.append(seller);
      }
      if (context?.actor === actor && context.client === client && context.online === online(client)) return;
      clear();
      const ctx = context = { actor, client, online: online(client), busy: false, sellerLoaded: false,
        workspaceSeq: 0, sellerSeq: 0, catalogSeq: 0, catalog: [], draftKey: null };
      await Promise.all([seller ? loadSeller(ctx) : null, buyer ? loadBuyer(ctx) : null]);
    },
  });
})(window, document);
