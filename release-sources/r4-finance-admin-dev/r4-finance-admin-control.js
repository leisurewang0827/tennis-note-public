/* R4-FINANCE-ADMIN-01: 지점 일상 업무와 분리된 총관리자 전용 DEV 권한 패널. */
(function (root, doc) {
  "use strict";
  const client = root.TennisNoteDataClient;
  const config = client?.loadConfig?.();
  const allowed = ["https://tennisnote-admin-dev.pages.dev", "https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev"];
  if (!allowed.includes(root.location.origin) || config?.environment !== "development"
    || config.supabaseUrl !== "https://udjmiezroipctytmztwz.supabase.co"
    || config.projectFingerprint !== "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
    || !client?.sessionSubject || doc.getElementById("r4FinancePlatformPanel")) return;
  const el = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n; };
  const rpc = (name, args) => client.rpc(name, args, { requireCurrentSession: true, retryAuth: false });
  const panel = el("section"); panel.id = "r4FinancePlatformPanel"; panel.hidden = true;
  panel.setAttribute("aria-label", "총관리자 지점 권한");
  const title = el("h2", "지점 사용 권한");
  const note = el("p", "선택한 지점장의 수납·회원권 등록·코치 정산 기준과 조회만 관리합니다.");
  const branch = el("select"), manager = el("select");
  const field = (name, input) => { const label = el("label", name); input.setAttribute("aria-label", name); label.append(input); return label; };
  const state = el("p"); state.setAttribute("role", "status"); state.setAttribute("aria-live", "polite");
  const refresh = el("button", "상태 새로 확인"), open = el("button", "사용 개방"), close = el("button", "OFF · 사용 중지");
  for (const b of [refresh, open, close]) b.type = "button";
  open.className = "primary-button"; close.className = "ghost-button"; refresh.className = "ghost-button";
  const actions = el("div"); actions.className = "finance-admin-actions"; actions.append(open, close);
  panel.append(title, note, field("지점", branch), field("기존 지점장", manager), state, actions, refresh);
  const host = doc.getElementById("adminApp") || doc.querySelector("main") || doc.body;
  if (host === doc.body) host.prepend(panel); else host.before(panel);
  let subject = "", epoch = 0, rows = [], busy = false, uncertain = false;
  const selected = () => rows.find(x => x.branchId === branch.value);
  const anyOn = row => row?.paidEnabled || row?.termsEnabled || row?.historyEnabled;
  const valid = row => row && /^[a-f0-9-]{36}$/.test(row.branchId) && /^[a-f0-9-]{36}$/.test(row.managerId)
    && Number.isSafeInteger(row.revision) && row.revision >= 0 && typeof row.eligible === "boolean"
    && [row.paidEnabled, row.termsEnabled, row.historyEnabled].every(x => typeof x === "boolean");
  function lock() {
    const row = selected();
    branch.disabled = manager.disabled = refresh.disabled = busy;
    open.disabled = busy || uncertain || !row?.eligible || Boolean(anyOn(row));
    close.disabled = busy || uncertain || !anyOn(row);
  }
  function show() {
    const row = selected(); manager.replaceChildren();
    if (row) {
      const option = el("option", row.managerName || "기존 지점장");
      option.value = row.managerId; manager.append(option);
      const allOn = row.paidEnabled && row.termsEnabled && row.historyEnabled;
      state.textContent = allOn ? "현재 ON · 수납·회원권·정산 사용 가능"
        : anyOn(row) ? "일부 권한 ON · OFF 후 개방 범위를 다시 확인해 주세요." : "현재 OFF · 기존 기록은 보존됩니다.";
      if (!row.eligible) state.textContent += " 지점장 소속을 확인해야 하며 개방할 수 없습니다.";
    } else state.textContent = "관리할 지점이 없습니다.";
    lock();
  }
  async function load() {
    const who = client.sessionSubject(); const stamp = ++epoch;
    busy = true; lock();
    try {
      const result = await rpc("tn_r4_finance_admin_state", { p_branch: null });
      if (stamp !== epoch || who !== client.sessionSubject()) return;
      if (!Array.isArray(result?.rows) || !result.rows.every(valid)) throw Error("invalid_state");
      const previous = branch.value; rows = result.rows; branch.replaceChildren();
      for (const row of rows) { const option = el("option", row.branchName); option.value = row.branchId; branch.append(option); }
      if (rows.some(x => x.branchId === previous)) branch.value = previous;
      uncertain = false; panel.hidden = false; show();
    } catch {
      if (stamp !== epoch || who !== client.sessionSubject()) return;
      if (panel.hidden) rows = [];
      else { uncertain = true; state.textContent = "권한 또는 상태를 확인할 수 없습니다. 상태를 다시 확인해 주세요."; }
    } finally { if (stamp === epoch) { busy = false; lock(); } }
  }
  async function change(enabled) {
    const row = selected(); if (busy || uncertain || !row || (enabled ? open.disabled : close.disabled)) return;
    const who = client.sessionSubject(), stamp = epoch;
    if (!root.confirm(`${row.branchName} · ${row.managerName}\n${enabled ? "수납·회원권·정산 사용을 개방할까요?" : "사용을 중지할까요? 저장된 기록은 삭제되지 않습니다."}`)) return;
    busy = true; lock();
    try {
      await rpc("tn_r4_finance_admin_set", { p_branch: row.branchId, p_manager: row.managerId,
        p_enabled: enabled, p_revision: row.revision, p_operation: root.crypto.randomUUID() });
      if (who !== client.sessionSubject() || stamp !== epoch) return;
      // Separate read-back, never claim success from a write acknowledgement alone.
      busy = false; await load();
    } catch {
      if (who !== client.sessionSubject() || stamp !== epoch) return;
      uncertain = true; state.textContent = "처리 결과를 확인해야 합니다. 다시 누르지 말고 ‘상태 새로 확인’을 눌러 주세요.";
    } finally { if (who === client.sessionSubject()) { busy = false; lock(); } }
  }
  branch.addEventListener("change", show);
  open.addEventListener("click", () => change(true)); close.addEventListener("click", () => change(false));
  refresh.addEventListener("click", load);
  const sync = () => {
    const next = client.sessionSubject() || ""; if (next === subject) return;
    subject = next; ++epoch; rows = []; branch.replaceChildren(); manager.replaceChildren();
    panel.hidden = true; uncertain = false; busy = false; if (next) void load();
  };
  root.setInterval(sync, 500); sync();
})(window, document);
