(function installInternalCatalogIssueDev(root, document) {
  "use strict";
  const devApi = "https://udjmiezroipctytmztwz.supabase.co";
  const devFingerprint = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const create = (tag, text) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  };
  function auth(client) {
    try {
      const store = root.localStorage.getItem(client.authPersistenceKey) === "session" ? root.sessionStorage : root.localStorage;
      const token = JSON.parse(store.getItem(client.authStorageKey) || "null")?.access_token;
      if (typeof token !== "string") return null;
      const segment = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(root.atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, "=")));
      return uuid.test(claims.sub) && uuid.test(claims.session_id) && Number.isFinite(claims.exp) &&
        claims.exp * 1000 > Date.now() ? {token, id: claims.session_id, sub:claims.sub} : null;
    } catch { return null; }
  }
  function mount({target, member, branch, client}) {
    const cfg = client?.loadConfig?.();
    if (!["https://tennisnote-admin-dev.pages.dev","https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev"].includes(root.location.origin)
      || cfg?.environment !== "development" || cfg.supabaseUrl !== devApi || cfg.projectFingerprint !== devFingerprint
      || typeof cfg.supabasePublishableKey !== "string" || !cfg.supabasePublishableKey || !uuid.test(member) || !uuid.test(branch)) return;
    const initial = auth(client);
    const form = target?.querySelector("#memberManagementForm");
    if (!initial || !form || target.querySelector("[data-r4-internal-issue]")) return;
    const panel = create("details");
    panel.dataset.r4InternalIssue = "";
    panel.className = "member-management-rule";
    panel.hidden = true;
    const summary = create("summary", "내부 상품으로 등록");
    const note = create("p", "개인권 0원 · 결제와 고정 시간표는 만들지 않습니다.");
    const label = create("label", "내부 상품 ");
    const select = create("select");
    const button = create("button", "0원 개인권 발급");
    const status = create("p");
    status.setAttribute("role", "status");
    button.type = "button";
    button.className = "small-button";
    button.disabled = true;
    label.append(select);
    panel.append(summary, note, label, button, status);
    form.before(panel);
    const current = () => {
      const a = auth(client);
      return panel.isConnected && form.isConnected && a?.id === initial.id && a?.sub === initial.sub ? a : null;
    };
    async function call(action, registration = null, operation = null) {
      const a = current();
      if (!a) throw Error("scope_changed");
      const response = await root.fetch(devApi+"/rest/v1/rpc/tn_r4_dev_issue_private_catalog",{
        method:"POST",redirect:"error",cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(10000),
        headers:{apikey:cfg.supabasePublishableKey,Authorization:"Bearer "+a.token,"Content-Type":"application/json"},
        body:JSON.stringify({p_action:action,p_branch:branch,p_member:member,p_registration:registration,p_operation:operation}),
      });
      if (!response.ok) throw Error("catalog_request_failed");
      const data = await response.json();
      if (!current()) throw Error("scope_changed");
      return data;
    }
    const rows = new Map();
    let working = false;
    const validReceipt = (r, item) => r?.registrationId === item.id && uuid.test(r.ticketId) && r.price === 0 &&
      r.public === false && r.payment === false && r.total === item.sessions && r.remaining === item.sessions &&
      /^\d{4}-\d\d-\d\d$/.test(r.expiresOn);
    async function readResult(item, key) {
      const r = await call("read", item.id, key);
      if (validReceipt(r,item)) {
        status.textContent = `등록 확인 · 잔여 ${r.remaining}회 · 만료 ${r.expiresOn}`;
        button.disabled = true;
        select.disabled = true;
        return true;
      }
      return false;
    }
    button.addEventListener("click", async () => {
      const item = rows.get(select.value);
      if (!current() || !item || working) return;
      working = true;
      select.disabled = button.disabled = true;
      status.textContent = "등록 결과를 확인하는 중입니다.";
      const operation = root.crypto.randomUUID();
      try {
        const r = await call("issue", item.id, operation);
        if (!validReceipt(r,item) || !await readResult(item,operation)) throw Error("readback_missing");
      } catch {
        if (!current()) return;
        try { if (await readResult(item,operation)) return; } catch {}
        status.textContent = "발급 결과를 확인하지 못했습니다. 다시 발급하지 말고 결과를 먼저 확인해 주세요.";
      }
    });
    void (async () => {
      try {
        const items = await call("list");
        if (!Array.isArray(items) || items.length !== 1) return;
        const item = items[0];
        if (!uuid.test(item.id) || typeof item.name !== "string" || item.price !== 0 ||
          ![20,30,40].includes(item.minutes) || !Number.isInteger(item.sessions) ||
          item.sessions < 1 || !Number.isInteger(item.days) || item.days < 1 || item.days > 366) return;
        rows.set(item.id,item);
        const option = create("option", `${item.name} · ${item.sessions}회 · ${item.minutes}분 · ${item.days}일 · 0원`);
        option.value = item.id;
        select.append(option);
        panel.hidden = false;
        if (!await readResult(item,root.crypto.randomUUID()) && current()) button.disabled = false;
      } catch { if (current()) panel.hidden = true; }
    })();
  }
  root.TennisNoteR4InternalCatalogIssueDev = Object.freeze({mount});
})(window, document);
