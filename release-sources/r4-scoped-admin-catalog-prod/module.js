(function installScopedMemberCatalog(root, document) {
  "use strict";
  const rpc = "tn_r4_prod_admin_standing_catalog";
  const api = "https://cnympiwrwgouuvhaivbc.supabase.co";
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const flagsClosed = row => row?.public === false && row.saleEnabled === false &&
    row.paymentEnabled === false && row.membershipEnabled === false;
  const branchSetup = document.getElementById("dashboardView");
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
  branchSetup.prepend(panel);

  let ctx;
  const journalKey = "tennis-note-standing-catalog-pending-operation";
  const journalPrefix = journalKey + ":";
  function sessionState(client) {
    try {
      const storage = root.localStorage.getItem(client.authPersistenceKey) === "session"
        ? root.sessionStorage : root.localStorage;
      const session = JSON.parse(storage.getItem(client.authStorageKey) || "null");
      const token = session?.access_token?.split(".")[1];
      if (!token) return null;
      const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(root.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
      return uuid.test(claims.session_id) && uuid.test(claims.sub) && (!session.user?.id || claims.sub === session.user.id) &&
        Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now()
        ? {id:claims.session_id,token:session.access_token} : null;
    } catch { return null; }
  }
  const current = c => ctx === c && c.session === sessionState(c.client)?.id;
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
    const session = sessionState(c.client);
    if (ctx !== c || c.session !== session?.id) throw Error("scope_changed");
    const branch = action === "scope" ? null : c.branch;
    // 이 전용 호출은 현재 저장소만 읽고, 로그인 저장·갱신·다른 저장소 복원을 하지 않는다.
    const response = await root.fetch(api + "/rest/v1/rpc/" + rpc, {
      method:"POST",redirect:"error",cache:"no-store",credentials:"omit",
      headers:{apikey:c.key,Authorization:"Bearer "+session.token,"Content-Type":"application/json"},
      body:JSON.stringify({p_action:action,p_branch:branch,p_payload:payload}),
      signal:AbortSignal.timeout(12000),
    });
    if (!current(c)) throw Error("scope_changed");
    if (!response.ok) {
      const details = await response.json().catch(() => null);
      throw Object.assign(Error("catalog_request_failed"),{status:response.status,code:details?.code});
    }
    const result = await response.json();
    if (!current(c)) throw Error("scope_changed");
    return result;
  }
  const denied = e => e?.code === "42501" || e?.status === 401 || e?.status === 403 ||
    /r4_member_catalog_denied|scope_changed/i.test(e?.message ?? "");
  function scopeValid(scope, branch) {
    return scope?.standing === true && uuid.test(scope.branchId) &&
      typeof scope.branchName === "string" && !!scope.branchName &&
      (scope.verification === null ||
        (uuid.test(scope.verification?.draft) && uuid.test(scope.verification?.registration) &&
          scope.verification.draft !== scope.verification.registration)) &&
      (!branch || branch === scope.branchId);
  }
  function pending() {
    const keys = Object.keys(root.localStorage).filter(key => key.startsWith(journalPrefix));
    if (keys.length > 32) throw Error("operation_journal_invalid");
    return keys.map(key => {
      const value = JSON.parse(root.localStorage.getItem(key));
      if (!["save","register"].includes(value?.action) || !uuid.test(value.key) ||
        key !== journalPrefix + value.key) throw Error("operation_journal_invalid");
      return value;
    });
  }
  function clearPending(key) {
    if (pending().some(value => value.key === key)) root.localStorage.removeItem(journalPrefix + key);
  }
  function reconcilePending(c, rows) {
    for (const p of pending()) {
      if (rows.some(r => (p.action === "save" ? r.draftId : r.registrationId) === p.key)) clearPending(p.key);
    }
    c.uncertain = pending().length > 0;
    if (c.uncertain) status.textContent = "이전 저장 결과를 확인할 수 없습니다. 확인되기 전에는 새로 저장할 수 없습니다.";
  }
  function scheduleScopeCheck(c) {
    c.timer = root.setTimeout(async () => {
      if (ctx !== c) return;
      if (!current(c)) { close(); return; }
      if (!c.busy) {
        try {
          const scope = await call(c, "scope");
          if (!scopeValid(scope, c.branch)) { if (ctx === c) close(); return; }
          c.verification = scope.verification;
        } catch { if (ctx === c) close(); return; }
      }
      if (ctx === c) scheduleScopeCheck(c);
    }, 60000);
  }
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
      else if (!c.verification || c.verification.draft === item.draftId) {
        const button = make("button", "내부 등록");
        button.className = "ghost-button";
        button.type = "button";
        button.addEventListener("click", () => {
          if (current(c) && !c.busy && !c.uncertain) {
            void write(c, "register", { operationId: c.verification?.registration || root.crypto.randomUUID(), draftId: item.draftId, terms });
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
    try {
      if (!root.navigator.locks?.request) throw Error("operation_lock_unavailable");
      await root.navigator.locks.request(journalKey,{mode:"exclusive",ifAvailable:true},async lock=>{
        if (!current(c)) return;
        if (!lock) {
          status.textContent = "다른 탭에서 저장 결과를 확인 중입니다.";
          return;
        }
        await writeLocked(c,action,payload);
      });
    } catch {
      if (current(c)) status.textContent = "저장 보호를 사용할 수 없어 요청하지 않았습니다.";
    } finally {
      if (current(c)) busy(c,false);
    }
  }
  async function writeLocked(c, action, payload) {
    try {
      if (pending().length) throw Error("operation_journal_busy");
      root.localStorage.setItem(journalPrefix + payload.operationId, JSON.stringify({action,key:payload.operationId}));
      if (!pending().some(p => p.key === payload.operationId)) throw Error("operation_journal_busy");
    } catch {
      c.uncertain = true;
      status.textContent = "이전 작업 상태를 확인할 수 없어 저장하지 않았습니다.";
      return;
    }
    status.textContent = "저장 결과를 확인하는 중입니다.";
    const desiredId = payload.draftId || payload.operationId;
    const desiredTerms = payload.terms || payload;
    const committed = rows => rows.some(r => r.draftId === desiredId && sameTerms(r.terms, desiredTerms)
      && (action !== "register" || r.registrationId === payload.operationId));
    let acknowledged = false;
    try {
      const saved = await call(c, action, payload);
      acknowledged = true;
      if (!flagsClosed(saved)) { close(); return; }
      if (!committed(await read(c))) throw Error("readback_missing");
      clearPending(payload.operationId);
      status.textContent = action === "save" ? "비공개 초안을 저장했습니다." : "내부 등록을 완료했습니다.";
      if (action === "save") form.reset();
    } catch (e) {
      if (ctx !== c) return;
      if (!current(c) || denied(e)) {
        if (!acknowledged && e?.code === "42501") clearPending(payload.operationId);
        close();
        return;
      }
      // On uncertain response, one read-back only. Never send another write automatically.
      try {
        if (!committed(await read(c))) throw Error("readback_missing");
        clearPending(payload.operationId);
        status.textContent = action === "save" ? "저장된 초안을 확인했습니다." : "내부 등록 결과를 확인했습니다.";
        if (action === "save") form.reset();
      } catch (readError) {
        if (ctx !== c) return;
        if (!current(c) || denied(readError)) { close(); return; }
        c.uncertain = true;
        status.textContent = "결과를 확인할 수 없습니다. 다시 저장하지 말고 목록부터 확인해 주세요.";
      }
    }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const c = ctx;
    if (!c || !current(c) || c.busy || c.uncertain || !form.reportValidity()) return;
    const data = new FormData(form), name = String(data.get("name")).trim();
    if (!name) { status.textContent = "상품명을 입력해 주세요."; return; }
    const terms = Object.fromEntries(fields.map(([key]) => [key, key === "name" ? name : Number(data.get(key))]));
    void write(c, "save", { operationId: c.verification?.draft || root.crypto.randomUUID(), ...terms });
  });
  root.addEventListener("storage", () => { if (ctx && !current(ctx)) close(); });
  root.addEventListener("pageshow", () => { if (ctx && !current(ctx)) close(); });
  root.TennisNoteR4ScopedMemberCatalog = Object.freeze({
    async refresh({ allowed, client }) {
      const config = client?.loadConfig?.() ?? {};
      const production = root.location.origin === "https://tennisnote-admin.pages.dev" &&
        config.environment === "production" &&
        config.supabaseUrl === api &&
        config.projectFingerprint === "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a";
      const session = production && allowed && sessionState(client)?.id;
      if (session && ctx?.client === client && ctx.session === session && current(ctx)) return;
      close();
      if (!session || typeof config.supabasePublishableKey !== "string" || !config.supabasePublishableKey) return;
      const c = ctx = { client, session, key:config.supabasePublishableKey };
      try {
        const scope = await call(c, "scope");
        if (!scopeValid(scope)) throw Error("invalid_scope");
        c.branch = scope.branchId;
        c.verification = scope.verification;
        reconcilePending(c, await read(c));
        if (!current(c)) return;
        title.textContent = scope.branchName + " 비공개 상품";
        panel.hidden = false;
        busy(c, false);
        scheduleScopeCheck(c);
      } catch { if (ctx === c) close(); }
    },
  });
})(window, document);
