(function installProductDraftCandidate(root) {
  "use strict";
  const mounted = new WeakMap();
  // Local candidate: the host must explicitly mount this into its existing settings area.
  function mount(container, { client, branchId, currentBranch, scopeRevision, storage }) {
    if (!container || !client || !branchId || !client.sessionSubject?.() ||
      typeof currentBranch !== "function" || currentBranch() !== branchId ||
      typeof scopeRevision !== "function" || scopeRevision() == null || !storage) throw Error("draft_scope_required");
    mounted.get(container)?.();
    const revision = scopeRevision();
    const actor = client.sessionSubject();
    const storageKey = `tennis-note-r4-draft-v1:${actor}:${branchId}`;
    const doc = container.ownerDocument;
    const el = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n; };
    const title = el("h2", "상품 정보 초안");
    const note = el("p", "비공개 초안입니다. 판매·결제는 시작되지 않으며 회원권도 만들지 않습니다.");
    const existing = el("p", "기본 등록은 0원 회원권입니다. 실제 가격 설정과 다릅니다.");
    const form = el("form"); form.className = "operations-password-login-form";
    const entries = [ ["name", "상품 이름", "text"], ["sessions", "총 횟수", "number"],
      ["minutes", "수업 시간(분)", "number"], ["days", "이용 기간(일)", "number"],
      ["price", "가격(원)", "number"] ];
    const fields = {};
    for (const [key, label, type] of entries) {
      const wrapper = el("label", label); const input = el("input");
      input.name = key; input.type = type; input.required = true;
      if (type === "number") { input.min = key === "price" ? "0" : "1"; input.step = "1"; input.inputMode = "numeric"; }
      if (key === "name") input.maxLength = 100;
      if (["sessions", "minutes", "days"].includes(key)) input.max = "2147483647";
      wrapper.append(input); form.append(wrapper); fields[key] = input;
    }
    const submit = el("button", "상품 초안 저장"); submit.type = "submit"; submit.className = "primary-button";
    const status = el("p", "상품 정보를 입력해 주세요. 0원은 직접 입력한 경우에만 저장합니다.");
    const savedInfo = el("p"); savedInfo.setAttribute("aria-live", "polite");
    status.setAttribute("role", "status");
    const recover = el("button", "저장 결과 확인"); recover.type = "button"; recover.className = "ghost-button"; recover.hidden = true;
    recover.style.background = "transparent"; recover.style.color = "inherit";
    recover.style.border = "1px solid currentColor";
    form.append(submit, recover, status, savedInfo);
    container.replaceChildren(title, note, existing, form);
    let pending = null, busy = false, alive = true, generation = 0, pointerBlocked = false;
    const current = stamp => alive && stamp === generation && client.sessionSubject?.() === actor &&
      currentBranch() === branchId && scopeRevision() === revision;
    const validReceipt = (result, saved) => result && result.branchId === branchId && result.operationId === saved.id &&
      result.status === "draft" && result.public === false && result.saleEnabled === false && result.paymentEnabled === false &&
      typeof result.name === "string" && result.name.length > 0 && Number.isSafeInteger(result.sessions) && result.sessions > 0 &&
      Number.isSafeInteger(result.minutes) && result.minutes > 0 && Number.isSafeInteger(result.days) && result.days > 0 &&
      Number.isSafeInteger(result.price) && result.price >= 0 && (!saved.payload ||
      (result.name === saved.payload.p_name && result.sessions === saved.payload.p_sessions &&
      result.minutes === saved.payload.p_minutes && result.days === saved.payload.p_days && result.price === saved.payload.p_price));
    async function checkPending(stamp) {
      const saved = pending;
      if (!saved || !current(stamp)) return;
      const result = await client.rpc("tn_r4_prod_product_draft_get", { p_branch: branchId, p_operation: saved.id },
        { requireCurrentSession: true, retryAuth: false });
      if (!current(stamp) || pending !== saved) return;
      if (!validReceipt(result, saved)) {
        status.textContent = "저장 여부를 확인하지 못했습니다. 다시 저장하지 말고 관리자에게 확인해 주세요."; return;
      }
      pending = null; recover.hidden = true;
      form.reset(); Object.values(fields).forEach(input => { input.disabled = false; });
      savedInfo.textContent = `${result.name} · ${result.sessions}회 · ${result.minutes}분 · ${result.days}일 · ${result.price.toLocaleString("ko-KR")}원 · 비공개 초안`;
      status.textContent = "비공개 초안을 저장하고 확인했습니다. 실제 판매 설정은 아직 완료되지 않았습니다.";
    }
    recover.addEventListener("click", async () => {
      const stamp = generation;
      if (busy || !pending || !current(stamp)) return;
      busy = true; recover.disabled = true; submit.disabled = true;
      try { await checkPending(stamp); }
      catch { if (current(stamp)) status.textContent = "저장 여부를 확인하지 못했습니다. 다시 저장하지 말고 관리자에게 확인해 주세요."; }
      finally { if (current(stamp)) { busy = false; recover.disabled = false; submit.disabled = !!pending; } }
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const stamp = generation;
      if (busy || pointerBlocked || !current(stamp) || !form.reportValidity()) return;
      const integers = ["sessions", "minutes", "days", "price"];
      const values = Object.fromEntries(entries.map(([key]) => [key, fields[key].value.trim()]));
      if (!values.name || Array.from(values.name).length > 100 ||
        integers.some(key => !/^\d+$/.test(values[key]) || !Number.isSafeInteger(Number(values[key]))) ||
        integers.some(key => key !== "price" && (Number(values[key]) < 1 || Number(values[key]) > 2147483647))) {
        status.textContent = "이름과 횟수·시간·기간·가격을 정확히 입력해 주세요."; return;
      }
      const payload = { p_branch: branchId, p_name: values.name, p_sessions: Number(values.sessions),
        p_minutes: Number(values.minutes), p_days: Number(values.days), p_price: Number(values.price) };
      const fingerprint = JSON.stringify(payload);
      if (pending) {
        status.textContent = "이전 저장 결과를 먼저 확인해 주세요."; return;
      }
      if (!pending && typeof root.crypto?.randomUUID !== "function") {
        status.textContent = "안전한 저장 환경을 확인할 수 없습니다. 페이지를 다시 열어 주세요."; return;
      }
      pending = { fingerprint, id: root.crypto.randomUUID(), payload };
      payload.p_operation = pending.id;
      try {
        storage.setItem(storageKey, JSON.stringify({ operation: pending.id }));
        if (JSON.parse(storage.getItem(storageKey) || "null")?.operation !== pending.id) throw Error("pointer_mismatch");
      } catch {
        pending = null; pointerBlocked = true; submit.disabled = true;
        status.textContent = "저장 결과를 안전하게 확인할 수 없어 진행할 수 없습니다."; return;
      }
      busy = true; submit.disabled = true; Object.values(fields).forEach(input => { input.disabled = true; });
      status.textContent = "초안 저장을 확인하는 중입니다.";
      try {
        const result = await client.rpc("tn_r4_prod_product_draft_save", payload,
          { requireCurrentSession: true, retryAuth: false });
        if (!current(stamp)) return;
        if (!validReceipt(result, pending)) throw Error("draft_receipt_mismatch");
        await checkPending(stamp);
      } catch {
        if (current(stamp)) status.textContent = "저장 결과를 확인하지 못했습니다. 저장 결과 확인을 눌러 주세요.";
      } finally {
        if (current(stamp)) { busy = false; submit.disabled = !!pending; recover.hidden = !pending; }
      }
    });
    const invalidate = () => { alive = false; generation++; };
    mounted.set(container, invalidate);
    try {
      const raw = storage.getItem(storageKey);
      if (raw !== null) {
        const pointer = JSON.parse(raw);
        if (!pointer || Object.keys(pointer).length !== 1 ||
          typeof pointer.operation !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(pointer.operation))
          throw Error("pointer_invalid");
        pending = { id: pointer.operation, payload: null };
        submit.disabled = true; recover.hidden = false;
        Object.values(fields).forEach(input => { input.disabled = true; });
        status.textContent = "이전 저장 결과를 확인해 주세요.";
        recover.click();
      }
    } catch {
      pointerBlocked = true; submit.disabled = true;
      status.textContent = "이전 저장 기록을 확인할 수 없어 새 저장을 중단했습니다.";
    }
    return Object.freeze({ destroy() {
      invalidate();
      if (mounted.get(container) === invalidate) { mounted.delete(container); container.replaceChildren(); }
    } });
  }
  root.TennisNoteR4ProductDraftCandidate = Object.freeze({ mount });
})(window);
