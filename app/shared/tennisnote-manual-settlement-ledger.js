(function (global) {
  "use strict";
  const VERSION = "r3_manual_ledger_state_v1";
  const METHODS = /^[a-z][a-z0-9_]{1,39}$/;
  const METHOD_LABELS = { bank_transfer: "계좌이체", cash: "현금" };
  const CALC = ["r3_monthly_settlement_v1", "r3_effective_settlement_v2"];
  const SUMS = ["confirmedOwedAmount", "owedAdjustmentTotal", "currentOwedAmount", "recordedPaidAmount", "paymentDifference"];
  const mounts = new WeakMap();
  function exactScope(scope) {
    return Boolean(scope && ["confirmationId", "snapshotId", "branchId", "coachRoleId", "sourceFingerprint"].every((key) =>
      typeof scope[key] === "string" && scope[key].length > 0)
      && /^\d{4}-\d{2}-01$/.test(scope.month || "")
      && Number.isSafeInteger(scope.snapshotRevision) && scope.snapshotRevision > 0
      && CALC.includes(scope.calculationVersion) && /^[a-f0-9]{64}$/i.test(scope.sourceFingerprint));
  }
  function signature(scope) {
    return exactScope(scope) ? JSON.stringify([scope.confirmationId, scope.snapshotId, scope.branchId,
      scope.coachRoleId, scope.month, scope.snapshotRevision, scope.sourceFingerprint, scope.calculationVersion]) : "";
  }
  function unwrap(value) { return Array.isArray(value) && value.length === 1 ? value[0] : value; }
  function exactState(value, scope) {
    if (!exactScope(scope) || !value || value.ok !== true || value.version !== VERSION || value.financialMovement !== false) return false;
    if (["confirmationId", "snapshotId", "branchId", "coachRoleId", "sourceFingerprint"].some((key) => value[key] !== scope[key])
      || value.settlementMonth !== scope.month || value.snapshotRevision !== scope.snapshotRevision) return false;
    if (!SUMS.every((key) => Number.isSafeInteger(value[key])) || value.currentOwedAmount < 0 || value.recordedPaidAmount < 0
      || value.confirmedOwedAmount + value.owedAdjustmentTotal !== value.currentOwedAmount
      || value.currentOwedAmount - value.recordedPaidAmount !== value.paymentDifference) return false;
    if (!Array.isArray(value.records) || !Array.isArray(value.events) || value.eventCount !== value.events.length
      || !Number.isSafeInteger(value.eventCount) || value.eventCount < 0) return false;
    const leaf = value.records[value.records.length - 1];
    if ((leaf?.id || null) !== (value.leafId || null)) return false;
    if (value.records.some((row, index) => !row.id || row.sequence !== index + 1 || !Number.isSafeInteger(row.amount)
      || row.amount < 0 || typeof row.voided !== "boolean"
      || (index === 0 ? row.supersedesPaymentRecordId !== null : row.supersedesPaymentRecordId !== value.records[index - 1].id))) return false;
    if (value.events.some((row, index) => !row.id || row.sequence !== index + 1 || !Number.isSafeInteger(row.signedAmount)
      || !["payment_record_void", "amount_adjustment", "adjustment_reversal"].includes(row.kind)
      || !value.records.some((record) => record.id === row.paymentRecordId))) return false;
    const active = value.currentPaymentRecord;
    return active ? Boolean(leaf && !leaf.voided && active.id === leaf.id && active.amount === value.recordedPaidAmount
      && active.amount === leaf.amount && active.sequence === leaf.sequence && active.status === "manual_payment_recorded")
      : value.recordedPaidAmount === 0 && (!leaf || leaf.voided);
  }
  function permission(value, role, action) {
    const policy = value?.actionContract;
    if (role !== "admin" || !policy || policy.version !== "r3_manual_ledger_actions_v1"
      || policy.gateEnabled !== true || policy.policiesReady !== true || policy.sourceReady !== true
      || policy.responseReady !== true || policy.paymentPolicy !== "full_only"
      || !["acknowledgement_only", "block_dispute_warn_missing"].includes(policy.responsePolicy)
      || policy.requiredFields !== "date_method_amount" || !Array.isArray(policy.allowedMethods)
      || !policy.allowedMethods.length || !policy.allowedMethods.every((method) => METHODS.test(method)
        && Object.hasOwn(METHOD_LABELS, method))) return false;
    return policy[action === "record" ? "canRecord" : action === "void" ? "canVoid" : "canAdjust"] === true;
  }
  function safeReason(value) { return /^[A-Za-z가-힣 ._-]{2,240}$/.test(value); }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    const date = new Date(value + "T00:00:00Z");
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function requestFor(value, scope, action, draft) {
    if (!["record", "void", "adjustment"].includes(action) || !exactState(value, scope) || !permission(value, "admin", action) || !validDate(draft.date)) throw new Error("ledger_input_hold");
    const request = { ...scope, expectedLeafId: value.leafId || null, expectedEventCount: value.eventCount };
    if (action === "record") {
      if (!value.actionContract.allowedMethods.includes(draft.method) || value.currentPaymentRecord) throw new Error("ledger_input_hold");
      return { ...request, amount: value.currentOwedAmount, reportedPaidOn: draft.date,
        paymentMethod: draft.method, supersedesPaymentRecordId: value.leafId || null };
    }
    if (!safeReason(draft.reason || "") || !value.leafId || (action === "void" && !value.currentPaymentRecord)) throw new Error("ledger_input_hold");
    const amount = action === "void" ? 0 : Number(draft.amount);
    if (action !== "void" && (!/^-?\d+$/.test(String(draft.amount)) || !Number.isSafeInteger(amount)
      || amount === 0 || value.currentOwedAmount + amount < 0)) throw new Error("ledger_input_hold");
    return { ...request, paymentRecordId: value.leafId, eventKind: action === "void" ? "payment_record_void" : "amount_adjustment",
      signedAmount: amount, reasonCode: action === "void" ? "record_correction" : "manual_owed_correction",
      reason: draft.reason, effectiveOn: draft.date, reversesId: null };
  }
  function append(parent, tag, text, className) {
    const node = parent.ownerDocument.createElement(tag);
    if (text !== undefined) node.textContent = String(text);
    if (className) node.className = className;
    parent.appendChild(node); return node;
  }
  function message(code) {
    if (/stale|mismatch|conflict/.test(code)) return "대상 정산이 변경됐습니다. 현재 상태를 다시 확인해 주세요.";
    if (/scope|identity|authenticated|forbidden|denied/.test(code)) return "현재 정산을 조회할 권한을 확인할 수 없습니다.";
    if (/policy|gate|response_hold/.test(code)) return "지급 기록 정책 또는 코치 응답을 확인하기 전에는 저장할 수 없습니다.";
    if (/privacy|input/.test(code)) return "날짜·방식과 조정 내용을 확인해 주세요. 개인정보는 입력하지 마세요.";
    return "처리 결과를 확인하지 못했습니다. 입력은 보존했습니다. 저장 여부 확인 후 같은 요청으로 재시도하세요.";
  }
  function connect(host, options) {
    if (!host || !["admin", "coach"].includes(options.role)) throw new Error("ledger_mount_invalid");
    const role = options.role;
    let scope = null, scopeKey = "", fenceKey = "", value = null, generation = 0, busy = false, pending = null;
    let status = "EMPTY", errorText = "", mode = "record", draft = { date: "", method: "", reason: "", amount: "" };
    const current = (id, key, identity) => id === generation && key === scopeKey && identity === fenceKey
      && options.identityKey() === identity && options.isCurrent(scope) && signature(options.scope()) === key;
    function editable() {
      return !busy && !pending && value && current(generation, scopeKey, fenceKey)
        && options.online() && permission(value, role, mode);
    }
    function render() {
      host.replaceChildren(); host.classList.add("tn-manual-ledger");
      host.dataset.state = status; host.setAttribute("aria-busy", String(busy));
      append(host, "strong", "수동 지급 기록 · 조정 이력");
      append(host, "p", "정산 의무와 관리자가 기록한 외부 지급 사실을 구분합니다. 자동 송금·환불 기능이 아닙니다.", "tn-ledger-help");
      append(host, "p", errorText || (busy ? "서버 기록 확인 중입니다." : !value ? "관리자 확정 기록이 있어야 지급 이력을 조회할 수 있습니다."
        : value.currentPaymentRecord ? "수동 지급 기록됨" : value.records.length ? "잘못된 기록은 보존됨 · 정정 기록 대기" : "지급 기록 없음"),
        "tn-ledger-status").setAttribute("role", "status");
      if (value) {
        const labels = ["확정 의무액", "의무 조정 합계", "현재 의무액", "유효 지급 기록액", "검토 차이"];
        const amounts = append(host, "dl", undefined, "tn-ledger-amounts");
        SUMS.forEach((key, index) => { append(amounts, "dt", labels[index]); append(amounts, "dd", value[key].toLocaleString("ko-KR") + "원"); });
        if (value.paymentDifference < 0) append(host, "p", "음수 차이는 검토 대상이며 환수·상계 완료가 아닙니다.", "tn-ledger-help");
        const history = append(host, "details");
        append(history, "summary", "기록·정정 감사 이력");
        value.records.forEach((row) => append(history, "p", "지급 기록 " + row.sequence + " · " + row.amount.toLocaleString("ko-KR") + "원 · " + (row.voided ? "무효 표시 · 원본 보존" : "유효")));
        value.events.forEach((row) => append(history, "p", "조정 " + row.sequence + " · " + ({ payment_record_void: "잘못 기록함", amount_adjustment: "의무액 조정", adjustment_reversal: "조정 역분개" })[row.kind] + " · " + row.signedAmount.toLocaleString("ko-KR") + "원"));
        if (role === "admin") {
          if (value.actionContract?.responsePolicy === "block_dispute_warn_missing"
            && value.coachResponse !== "acknowledged" && value.coachResponse !== "disputed") {
            append(host, "p", "코치 확인 응답이 아직 없습니다. 관리자는 기록할 수 있지만, 이의가 접수되면 저장이 차단됩니다.", "tn-ledger-help");
          }
          if (!permission(value, role, "record") && !permission(value, role, "void") && !permission(value, role, "adjustment")) {
            append(host, "p", "저장 보류: 정책·권한·현재 원장 상태 확인이 필요합니다. 운영 기본값은 OFF입니다.", "tn-ledger-help");
          } else {
            const form = append(host, "form"); form.noValidate = true;
            const chooserLabel = append(form, "label", "처리");
            const chooser = append(chooserLabel, "select"); chooser.dataset.field = "action";
            const available = [["record", value.leafId ? "정정 지급 기록" : "수동 지급 기록"], ["void", "잘못 기록함 · 원본 보존"], ["adjustment", "의무액 조정 기록"]].filter(([key]) => permission(value, role, key));
            if (!available.some(([key]) => key === mode)) mode = available[0][0];
            available.forEach(([key, label]) => { const option = append(chooser, "option", label); option.value = key; });
            chooser.value = mode; chooser.disabled = busy || Boolean(pending);
            const field = (key, label, type) => {
              const wrap = append(form, "label", label);
              const input = append(wrap, type === "select" ? "select" : "input");
              if (type !== "select") input.type = type;
              input.dataset.field = key; input.disabled = !editable();
              if (key === "method") {
                const empty = append(input, "option", "방식 선택"); empty.value = "";
                value.actionContract.allowedMethods.forEach((method) => { const option = append(input, "option", METHOD_LABELS[method] || "정책 확인 필요"); option.value = method; });
              }
              input.value = draft[key]; return input;
            };
            field("date", mode === "record" ? "지급 기록일" : "정정 적용일", "date");
            if (mode === "record") { field("method", "지급 방식", "select"); append(form, "p", "전액 기록: " + value.currentOwedAmount.toLocaleString("ko-KR") + "원"); }
            else { if (mode === "adjustment") field("amount", "의무 조정액 · 증감", "text"); field("reason", "사유 · 개인정보 제외", "text").maxLength = 240; }
            const button = append(form, "button", mode === "record" ? "수동 지급 기록 저장" : mode === "void" ? "잘못 기록함 저장" : "의무 조정 기록 저장", "primary-button");
            button.type = "submit"; button.dataset.submit = "ledger";
            button.disabled = !editable(); button.setAttribute("aria-disabled", String(button.disabled));
          }
        }
      }
      const reload = append(host, "button", "현재 상태 다시 확인", "ghost-button"); reload.type = "button";
      reload.dataset.reload = "ledger"; reload.disabled = busy || !scopeKey;
      if (pending && role === "admin") {
        const retry = append(host, "button", "같은 저장 요청 재시도", "ghost-button");
        retry.type = "button"; retry.dataset.retry = "ledger"; retry.disabled = busy || !options.online();
      }
    }
    async function read() {
      const id = generation, key = scopeKey, identity = fenceKey;
      if (!key || !current(id, key, identity)) { value = null; status = "EMPTY"; render(); return false; }
      if (!options.online()) { status = "OFFLINE"; errorText = "오프라인에서는 최신 원장 확인과 저장을 할 수 없습니다."; render(); return false; }
      busy = true; status = "LOADING"; errorText = ""; render();
      try {
        const response = unwrap(await options.rpc(role === "admin" ? "tn_admin_monthly_settlement_payment_state" : "tn_coach_monthly_settlement_payment_state", { target_confirmation_id: scope.confirmationId }));
        if (!current(id, key, identity)) return false;
        if (!exactState(response, scope)) throw new Error("ledger_scope_mismatch");
        value = response; status = "READY"; return true;
      } catch (error) {
        if (!current(id, key, identity)) return false;
        value = null; status = "ERROR"; errorText = message(String(error?.message || "")); return false;
      } finally { if (id === generation) { busy = false; render(); } }
    }
    async function submit(retry) {
      if (busy || role !== "admin" || !options.online() || !current(generation, scopeKey, fenceKey)) return false;
      const id = generation, key = scopeKey, identity = fenceKey;
      if (!retry) {
        if (!editable()) return false;
        let request;
        try { request = requestFor(value, scope, mode, draft); }
        catch (_) { status = "HOLD"; errorText = message("ledger_input_hold"); render(); return false; }
        if (!options.confirm(mode === "void" ? "원본을 보존하고 잘못 기록함을 추가할까요?" : "실제 송금이 아닌 수동 기록을 저장할까요?")) return false;
        pending = { request, mode, key: options.operationKey() };
      } else if (!pending) return false;
      busy = true; errorText = ""; status = "SAVING"; render();
      const operation = pending;
      try {
        const response = unwrap(await options.rpc(operation.mode === "record" ? "tn_admin_record_monthly_settlement_manual_payment" : "tn_admin_append_monthly_settlement_payment_adjustment",
          { request: operation.request, operation_key: operation.key }));
        if (!current(id, key, identity)) return false;
        if (!exactState(response, scope) || !response.operationResultId) throw new Error("ledger_scope_mismatch");
        const readback = unwrap(await options.rpc("tn_admin_monthly_settlement_payment_state", { target_confirmation_id: scope.confirmationId }));
        if (!current(id, key, identity)) return false;
        const result = operation.mode === "record" ? readback?.records : readback?.events;
        if (!exactState(readback, scope) || !result.some((row) => row.id === response.operationResultId)) throw new Error("ledger_readback_mismatch");
        value = readback; pending = null; draft = { date: "", method: "", reason: "", amount: "" };
        status = "SAVED"; errorText = "수동 기록과 서버 조회 결과가 일치합니다. 실제 송금 완료를 뜻하지 않습니다."; return true;
      } catch (error) {
        if (!current(id, key, identity)) return false;
        status = "UNCERTAIN"; errorText = message(String(error?.message || "")); return false;
      } finally { if (id === generation) { busy = false; render(); } }
    }
    host.addEventListener("input", (event) => { const key = event.target.dataset.field; if (key in draft && !pending && !busy) draft[key] = event.target.value; });
    host.addEventListener("change", (event) => { if (event.target.dataset.field === "action" && !pending && !busy) { mode = event.target.value; render(); } });
    host.addEventListener("submit", (event) => { event.preventDefault(); void submit(false); });
    host.addEventListener("click", (event) => {
      if (event.target.closest("[data-reload]")) void read();
      if (event.target.closest("[data-retry]")) void submit(true);
    });
    function update() {
      const nextScope = options.scope(), nextKey = signature(nextScope), nextIdentity = options.identityKey();
      if (nextKey === scopeKey && nextIdentity === fenceKey) return;
      ++generation; scope = nextScope; scopeKey = nextKey; fenceKey = nextIdentity;
      busy = false; value = null; pending = null; status = "EMPTY"; errorText = "";
      draft = { date: "", method: "", reason: "", amount: "" }; render(); if (nextKey) void read();
    }
    const api = { update, read, submit, state: () => ({ status, busy, hasPending: Boolean(pending), value }) };
    update(); return api;
  }
  function mount(parent, options) {
    if (!parent) return null;
    let entry = mounts.get(parent);
    if (!entry) {
      const host = parent.ownerDocument.createElement("section"); host.dataset.manualLedger = options.role;
      parent.appendChild(host); entry = { host, controller: connect(host, options) }; mounts.set(parent, entry);
    } else if (!entry.host.isConnected || entry.host.parentNode !== parent) parent.appendChild(entry.host);
    entry.controller.update(); return entry.controller;
  }
  function fromConfirmation(payload, scope) {
    const snapshot = payload?.snapshot, confirmation = payload?.confirmation;
    if (!snapshot || !confirmation || confirmation.status !== "confirmed" || !scope
      || String(payload.scope?.branchId || "") !== scope.branchId
      || String(payload.scope?.coachRoleId || "") !== scope.coachRoleId
      || String(payload.scope?.settlementMonth || "").slice(0, 10) !== scope.settlementMonth) return null;
    const exact = { confirmationId: confirmation.confirmationId, snapshotId: snapshot.snapshotId,
      branchId: scope.branchId, coachRoleId: scope.coachRoleId, month: scope.settlementMonth,
      snapshotRevision: snapshot.revision, calculationVersion: snapshot.calculationVersion,
      sourceFingerprint: snapshot.sourceFingerprint };
    return exactScope(exact) ? exact : null;
  }
  function bindExisting(parent, options) {
    return mount(parent, { ...options,
      scope: () => options.ready() ? fromConfirmation(options.payload(), options.currentScope()) : null,
      isCurrent: () => options.ready(),
      online: () => global.navigator.onLine !== false,
      confirm: (text) => global.confirm(text),
      operationKey: () => "r3-manual-" + global.crypto.randomUUID(),
    });
  }
  global.TennisNoteManualSettlementLedger = Object.freeze({ exactScope, exactState, permission, requestFor, connect, mount, fromConfirmation, bindExisting });
})(window);
