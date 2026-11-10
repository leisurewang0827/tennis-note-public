(function installR4ZeroPersonalIssue(root, document) {
  "use strict";
  const origin = "https://tennisnote-admin.pages.dev";
  const api = "https://cnympiwrwgouuvhaivbc.supabase.co";
  const fingerprint = "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a";
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  const node = (tag, text) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    return el;
  };
  function identity(client) {
    try {
      const token = client.getSession()?.access_token;
      const value = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(root.atob(value.padEnd(Math.ceil(value.length / 4) * 4, "=")));
      return claims.role === "authenticated" && uuid.test(claims.sub) && uuid.test(claims.session_id) &&
        Number.isFinite(claims.exp) && claims.exp * 1000 > Date.now()
        ? { token, subject: claims.sub, session: claims.session_id } : null;
    } catch { return null; }
  }
  function mount({ target, member, branch, client, currentScope }) {
    const cfg = client?.loadConfig?.();
    if (root.location.origin !== origin || cfg?.environment !== "production" || cfg.supabaseUrl !== api ||
      cfg.projectFingerprint !== fingerprint || !cfg.supabasePublishableKey ||
      !uuid.test(member) || !uuid.test(branch) || typeof currentScope !== "function" || !currentScope()) return;
    const initial = identity(client);
    const form = target?.querySelector("#memberManagementForm");
    if (!initial || !form || target.querySelector("[data-r4-zero-personal-issue]")) return;
    const panel = node("details");
    panel.dataset.r4ZeroPersonalIssue = "";
    panel.className = "member-management-rule";
    panel.hidden = true;
    const label = node("label", "내부 상품 ");
    const select = node("select");
    const issue = node("button", "0원 개인권 발급");
    const status = node("p");
    const ackLabel = node("label", " 선택한 회원에게 0원 개인권 1회를 발급합니다.");
    const acknowledge = node("input");
    acknowledge.type = "checkbox";
    acknowledge.disabled = true;
    ackLabel.prepend(acknowledge);
    issue.type = "button";
    issue.className = "small-button";
    issue.disabled = true;
    status.setAttribute("role", "status");
    label.append(select);
    panel.append(node("summary", "내부 상품으로 등록"), label, ackLabel, issue, status);
    form.before(panel);
    const rows = new Map();
    const blocked = new Set();
    let reviewed = "", busy = false, generation = 0;
    function current() {
      const now = identity(client);
      return form.isConnected && panel.isConnected && currentScope() && now?.subject === initial.subject && now?.session === initial.session ? now : null;
    }
    function enable() {
      issue.disabled = !current() || busy || !acknowledge.checked || !reviewed ||
        reviewed !== select.value || blocked.has(select.value);
    }
    async function call(action, registration = null, operation = null) {
      const user = current();
      if (!user) throw Error("scope_changed");
      const res = await root.fetch(api + "/rest/v1/rpc/tn_r4_prod_zero_personal_issue", {
        method: "POST", credentials: "omit", redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { apikey: cfg.supabasePublishableKey, Authorization: "Bearer " + user.token, "Content-Type": "application/json" },
        body: JSON.stringify({ p_action: action, p_branch: branch, p_member: member, p_registration: registration, p_operation: operation }),
      });
      if (!res.ok) throw Error("request_failed");
      const data = await res.json();
      if (!current()) throw Error("scope_changed");
      return data;
    }
    function isReceipt(data, id) {
      return data?.registrationId === id && uuid.test(data.ticketId) && data.price === 0 &&
        data.public === false && data.payment === false && (data.removed === true ||
        (data.removed === false && Number.isSafeInteger(data.total) &&
        Number.isSafeInteger(data.remaining) && data.remaining >= 0 && data.remaining <= data.total &&
        /^\d{4}-\d\d-\d\d$/.test(data.expiresOn)));
    }
    function showReceipt(data) {
      blocked.add(data.registrationId);
      acknowledge.disabled = true;
      acknowledge.checked = false;
      status.textContent = data.removed
        ? "이전에 발급한 개인권이 삭제되었습니다. 같은 상품은 다시 발급하지 않습니다."
        : "등록 확인 · 잔여 " + data.remaining + "회 · 만료 " + data.expiresOn;
    }
    async function review() {
      const id = select.value, version = ++generation;
      reviewed = "";
      acknowledge.checked = false;
      acknowledge.disabled = true;
      enable();
      if (!rows.has(id) || busy || !current()) return;
      status.textContent = "기존 등록을 확인하는 중입니다.";
      try {
        const result = await call("read", id, root.crypto.randomUUID());
        if (version !== generation || select.value !== id) return;
        if (isReceipt(result, id)) showReceipt(result);
        else if (result === null && !blocked.has(id)) {
          reviewed = id;
          acknowledge.disabled = false;
          status.textContent = "신규 발급 · 결제와 고정 시간표는 만들지 않습니다.";
        } else throw Error("receipt_drift");
      } catch {
        if (version === generation) status.textContent = "등록 상태를 확인하지 못해 발급을 막았습니다.";
      } finally { enable(); }
    }
    acknowledge.addEventListener("change", enable);
    select.addEventListener("change", () => { void review(); });
    issue.addEventListener("click", async () => {
      enable();
      if (issue.disabled) return;
      const id = select.value, operation = root.crypto.randomUUID();
      busy = select.disabled = acknowledge.disabled = true;
      blocked.add(id);
      enable();
      status.textContent = "등록 결과를 확인하는 중입니다.";
      try {
        const issued = await call("issue", id, operation);
        if (!isReceipt(issued, id)) throw Error("receipt_drift");
        const result = await call("read", id, operation);
        if (!isReceipt(result, id) || result.ticketId !== issued.ticketId) throw Error("receipt_drift");
        showReceipt(result);
      } catch {
        try {
          const result = await call("read", id, operation);
          if (!isReceipt(result, id)) throw Error("receipt_drift");
          showReceipt(result);
        } catch { status.textContent = "발급 결과가 불확실합니다. 다시 발급하지 말고 기존 등록을 확인해 주세요."; }
      } finally {
        busy = select.disabled = false;
        enable();
      }
    });
    void (async () => {
      try {
        const items = await call("list");
        if (!Array.isArray(items) || !items.length || items.length > 100) return;
        for (const item of items) {
          if (!uuid.test(item.id) || rows.has(item.id) || typeof item.name !== "string" || item.price !== 0 ||
            !Number.isInteger(item.sessions) || item.sessions < 1 || ![20, 30, 40].includes(item.minutes) ||
            !Number.isInteger(item.days) || item.days < 1 || item.days > 366) return;
          rows.set(item.id, item);
          const option = node("option", item.name + " · " + item.sessions + "회 · " + item.minutes + "분 · " + item.days + "일 · 0원");
          option.value = item.id;
          select.append(option);
        }
        panel.hidden = false;
        await review();
      } catch { panel.hidden = true; }
    })();
  }
  root.TennisNoteR4ZeroPersonalIssue = Object.freeze({ mount });
})(window, document);
