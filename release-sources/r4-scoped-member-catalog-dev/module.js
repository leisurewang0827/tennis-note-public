(function installScopedMemberCatalog(root, document) {
  "use strict";
  const rpc = "tn_r4_dev_member_private_catalog";
  const auth = Object.freeze({ requireCurrentSession: true, retryAuth: false });
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const flagsClosed = row => row?.public === false && row.saleEnabled === false &&
    row.paymentEnabled === false && row.membershipEnabled === false;
  const branchSetup = document.getElementById("r4Onboarding");
  if (!branchSetup) return;
  const make = (tag, value) => {
    const node = document.createElement(tag);
    if (value) node.textContent = value;
    return node;
  };
  const panel = make("section"), title = make("h2"), status = make("p"), list = make("ul");
  panel.id = "r4ScopedMemberCatalog";
  panel.className = "tn-market-panel";
  panel.hidden = true;
  title.id = "r4ScopedMemberCatalogTitle";
  panel.setAttribute("aria-labelledby", title.id);
  status.setAttribute("role", "status");
  const form = make("form"), save = make("button", "비공개 초안 저장");
  form.className = "operations-password-login-form";
  list.className = "tn-market-list";
  save.type = "submit";
  save.className = "primary-button";
  const fields = [
    ["name", "상품명"], ["sessions", "횟수", 1, 2147483647], ["minutes", "수업 시간 (분)", 1, 2147483647],
    ["days", "유효 기간 (일)", 1, 2147483647], ["price", "금액 (원)", 0, Number.MAX_SAFE_INTEGER],
  ];
  for (const [key, label, min, max] of fields) {
    const wrap = make("label", label), input = make("input");
    input.name = key;
    input.required = true;
    if (key === "name") input.maxLength = 100;
    else Object.assign(input, { type: "number", min, max, step: 1, inputMode: "numeric" });
    wrap.append(input);
    form.append(wrap);
  }
  form.append(save);
  const head = make("header"), note = make("p", "이 지점에서만 쓸 수 있습니다. 공개·결제·회원권 발급은 되지 않습니다.");
  head.className = "tn-market-heading";
  head.append(title);
  note.className = "tn-market-note";
  panel.append(head, note, form, list, status);
  branchSetup.after(panel);

  let ctx;
  function sessionKey(client) {
    try {
      const stores = root.localStorage.getItem(client.authPersistenceKey) === "session"
        ? [root.sessionStorage] : [root.localStorage, root.sessionStorage];
      const session = stores.map(store => JSON.parse(store.getItem(client.authStorageKey) || "null"))
        .find(candidate => candidate?.access_token);
      const token = session?.access_token?.split(".")[1];
      if (!token) return null;
      const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(root.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
      return uuid.test(claims.session_id) && uuid.test(claims.sub) && (!session.user?.id || claims.sub === session.user.id) &&
        Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now() ? claims.session_id : null;
    } catch { return null; }
  }
  const current = c => ctx === c && c.session === sessionKey(c.client) && performance.now() < c.until;
  function close() {
    root.clearTimeout(ctx?.timer);
    ctx = undefined;
    panel.hidden = true;
    title.textContent = status.textContent = "";
    list.replaceChildren();
    form.reset();
  }
  function busy(c, active) {
    c.busy = active;
    for (const field of panel.querySelectorAll("button,input")) field.disabled = active || Boolean(c.uncertain);
  }
  async function call(c, action, payload = {}) {
    if (!current(c)) throw Error("scope_changed");
    const branch = action === "scope" ? null : c.branch;
    const response = await c.client.rpc(rpc, { p_action: action, p_branch: branch, p_payload: payload }, auth);
    if (!current(c)) throw Error("scope_changed");
    return response;
  }
  const denied = e => e?.code === "42501" || e?.status === 401 || e?.status === 403 ||
    /r4_member_catalog_denied|scope_changed/i.test(e?.message ?? "");
  function sameTerms(a, b) { return fields.every(([key]) => a?.[key] === b?.[key]); }
  async function read(c) {
    const rows = await call(c, "list");
    if (!Array.isArray(rows) || rows.some(row => !flagsClosed(row) || !uuid.test(row.draftId) ||
      (row.registrationId !== null && !uuid.test(row.registrationId)) ||
      typeof row.terms?.name !== "string" || fields.slice(1).some(([k]) => !Number.isSafeInteger(row.terms[k])))) throw Error("unsafe_result");
    list.replaceChildren();
    for (const item of rows) {
      const terms = item.terms;
      const li = make("li");
      li.className = "tn-market-card";
      li.append(make("strong", terms.name), make("span", `${terms.sessions}회 · ${terms.minutes}분 · ${terms.days}일 · ${terms.price.toLocaleString("ko-KR")}원`));
      if (item.registrationId) li.append(make("span", " · 내부 등록 완료"));
      else {
        const button = make("button", "내부 등록");
        button.className = "ghost-button";
        button.type = "button";
        button.addEventListener("click", () => {
          if (current(c) && !c.busy && !c.uncertain) {
            void write(c, "register", { operationId: root.crypto.randomUUID(), draftId: item.draftId, terms });
          }
        });
        li.append(button);
      }
      list.append(li);
    }
    return rows;
  }
  async function write(c, action, payload) {
    if (!current(c) || c.busy || c.uncertain) return;
    busy(c, true);
    status.textContent = "저장 결과를 확인하는 중입니다.";
    const desiredId = payload.draftId || payload.operationId;
    const desiredTerms = payload.terms || payload;
    const committed = rows => rows.some(r => r.draftId === desiredId && sameTerms(r.terms, desiredTerms)
      && (action !== "register" || r.registrationId));
    try {
      const saved = await call(c, action, payload);
      if (!flagsClosed(saved)) { close(); return; }
      if (!committed(await read(c))) throw Error("readback_missing");
      status.textContent = action === "save" ? "비공개 초안을 저장했습니다." : "내부 등록을 완료했습니다.";
      if (action === "save") form.reset();
    } catch (e) {
      if (ctx !== c) return;
      if (!current(c) || denied(e)) { close(); return; }
      // On uncertain response, one read-back only. Never send another write automatically.
      try {
        if (!committed(await read(c))) throw Error("readback_missing");
        status.textContent = action === "save" ? "저장된 초안을 확인했습니다." : "내부 등록 결과를 확인했습니다.";
        if (action === "save") form.reset();
      } catch (readError) {
        if (ctx !== c) return;
        if (!current(c) || denied(readError)) { close(); return; }
        c.uncertain = true;
        status.textContent = "결과를 확인할 수 없습니다. 다시 저장하지 말고 목록부터 확인해 주세요.";
      }
    } finally {
      if (current(c)) busy(c, false);
    }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const c = ctx;
    if (!c || !current(c) || c.busy || c.uncertain || !form.reportValidity()) return;
    const data = new FormData(form), name = String(data.get("name")).trim();
    if (!name) { status.textContent = "상품명을 입력해 주세요."; return; }
    const terms = Object.fromEntries(fields.map(([key]) => [key, key === "name" ? name : Number(data.get(key))]));
    void write(c, "save", { operationId: root.crypto.randomUUID(), ...terms });
  });
  root.addEventListener("storage", () => { if (ctx && !current(ctx)) close(); });
  root.addEventListener("pageshow", () => { if (ctx && !current(ctx)) close(); });
  root.TennisNoteR4ScopedMemberCatalog = Object.freeze({
    async refresh({ allowed, client }) {
      const config = client?.loadConfig?.() ?? {};
      const dev = root.location.origin === "https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev" &&
        config.environment === "development" &&
        config.supabaseUrl === "https://udjmiezroipctytmztwz.supabase.co" &&
        config.projectFingerprint === "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
      const session = dev && allowed && sessionKey(client);
      if (session && ctx?.client === client && ctx.session === session && current(ctx)) return;
      close();
      if (!session || !client?.rpc) return;
      const started = performance.now();
      const c = ctx = { client, session, until: started + 10000 };
      try {
        const scope = await call(c, "scope");
        if (!uuid.test(scope?.branchId) || typeof scope.branchName !== "string" || !scope.branchName ||
          !Number.isSafeInteger(scope.remainingMs) || scope.remainingMs < 1 || scope.remainingMs > 1800000) throw Error("invalid_scope");
        c.branch = scope.branchId;
        c.until = started + scope.remainingMs;
        if (!current(c)) throw Error("expired_scope");
        c.timer = root.setTimeout(() => { if (ctx === c) close(); }, c.until - performance.now());
        await read(c);
        title.textContent = scope.branchName + " 비공개 상품";
        panel.hidden = false;
        busy(c, false);
      } catch { if (ctx === c) close(); }
    },
  });
})(window, document);
