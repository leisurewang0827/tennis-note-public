(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TennisNoteSingleSheetBatch = api;
})(globalThis, function () {
  "use strict";
  const digest = s => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
  const clone = value => JSON.parse(JSON.stringify(value));
  const sameScope = (a, b) => ["environment", "projectFingerprint", "branchId"].every(k => a?.[k] && a[k] === b?.[k]);
  const safeMutationCode = error => {
    const code = String(error?.code || error?.message || "");
    return /^(SHEET_IMPORT_(?:APPLY_FAILED|REVERSE_FAILED|REVERSE_HOLD|RECEIPT_REQUIRED|OPERATION_CONFLICT|SESSION_REQUIRED|SCOPE_DISABLED|TIMEOUT)|TARGET_OR_REVISION_MISMATCH|STALE_PREVIEW)$/.test(code) ? code : "";
  };
  // Only fixed presentation codes may leave the preview catch. Never retain
  // database messages/details, source rows, or an inferred scope failure cause.
  const safePreviewCode = error => {
    const code = String(error?.code || error?.message || "");
    if (code === "LOCAL_RESPONSE_TIMEOUT") return "SHEET_IMPORT_TIMEOUT";
    return /^(SHEET_IMPORT_(?:ENVIRONMENT_BLOCKED|SESSION_REQUIRED|SCOPE_DISABLED|TIMEOUT|PREVIEW_FAILED|TRANSPORT_UNAVAILABLE)|SHEET_WORK_(?:RUNTIME_UNAVAILABLE|ENVIRONMENT_MISMATCH|BRANCH_UNAVAILABLE|SESSION_REVOKED|SESSION_EXPIRED|SESSION_SUPERSEDED)|TARGET_(?:OR_REVISION_MISMATCH|UNVERIFIED)|STALE_PREVIEW|SNAPSHOT_INCOMPLETE|SERVER_(?:CONTRACT_REQUIRED|UNITS_INVALID|COUNTS_INVALID|PREVIEW_INVALID)|READBACK_UNVERIFIED)$/.test(code)
      ? code : "SHEET_IMPORT_PREVIEW_FAILED";
  };
  function bounded(call) {
    let timer;
    return Promise.race([Promise.resolve().then(call), new Promise((_, reject) => { timer = setTimeout(() => reject(Error("LOCAL_RESPONSE_TIMEOUT")), 11000); })]).finally(() => clearTimeout(timer));
  }
  const localTransport = (host, transport) => ["localhost", "127.0.0.1", "[::1]"].includes(host)
    && transport?.protocol === "local-synthetic/1" && transport.scope?.environment === "local";
  const hostedTransport = (host, transport) => transport?.protocol === "scoped-postgrest-import/2"
    && transport.host === host && ["development", "production"].includes(transport.scope?.environment)
    && transport.canApply === true
    && typeof transport.isReady === "function" && transport.isReady() === true;
  function allowed(host, transport) {
    return (localTransport(host, transport) || hostedTransport(host, transport)) &&
      transport.enabled === true && digest(transport.scope.projectFingerprint) &&
      typeof transport.scope.branchId === "string" && transport.scope.branchId.length > 0 &&
      typeof transport.preview === "function" && typeof transport.apply === "function" && typeof transport.currentScope === "function" &&
      sameScope(transport.scope, transport.currentScope());
  }
  function create({ host, transport, adapter, canOpen, changed = () => {} }) {
    if (!allowed(host, transport) || canOpen() !== true) throw Error("SHEET_APPLY_DISABLED");
    const scope = clone(transport.scope);
    let entries = [], held = [], fileHash = "", busy = false, stop = false, disposed = false, confirmed = false;
    let phase = "empty", expiresAt = "", message = "", failureCode = "", noticePrefix = "", mutationAttempted = false;
    let invalidated = false, cancelled = false;
    const access = () => !disposed && globalThis.navigator?.onLine !== false && allowed(host, transport) && sameScope(scope, transport.currentScope()) && canOpen() === true;
    // 미처리 0은 성공 근거가 아니다. 같은 batch의 exact readback만 완료로 인정한다.
    const receiptPhase = () => mutationAttempted && entries.length > 0 && held.length === 0
      ? entries.some(e => e.state === "APPLIED") && entries.every(e => ["APPLIED", "NO_OP"].includes(e.state) && e.plan.verified === true) ? "done"
        : entries.some(e => e.state === "REVERSED") && entries.every(e => ["REVERSED", "NO_OP"].includes(e.state) && e.plan.verified === true) ? "reversed" : ""
      : "";
    function settle(nextPhase) {
      const completed = invalidated && !cancelled && access() && receiptPhase();
      if (completed) { phase = completed; noticePrefix = ""; message = ""; }
      else phase = stop || invalidated ? "paused" : nextPhase;
    }
    const outcomeNotice = () => {
      const applied = entries.filter(e => e.state === "APPLIED").length;
      const reversed = entries.filter(e => e.state === "REVERSED").length;
      const unresolved = entries.some(e => ["UNKNOWN", "PROCESSING", "REVERSING"].includes(e.state));
      if (unresolved) return "처리 중이거나 결과가 미확정인 항목은 이력을 먼저 확인해 주세요." + (applied ? ` 확인된 등록 ${applied}단위는 유지됩니다.` : "");
      if (applied) return `확인된 등록 ${applied}단위는 유지됩니다. 나머지는 다시 확인해 주세요.`;
      if (reversed) return `원복 이력이 확인된 항목은 ${reversed}단위입니다. 나머지는 다시 확인해 주세요.`;
      return mutationAttempted ? "처리 이력을 먼저 확인한 뒤 미처리 항목을 재개해 주세요." : "등록은 실행하지 않았습니다.";
    };
    const view = () => ({ phase, busy, confirmed, expiresAt, failureCode, invalidated,
      reverseEnabled: transport.canReverse !== false && typeof transport.reverse === "function",
      expired: Date.now() >= Date.parse(expiresAt) && entries.some(e => ["READY", "RETRY", "HOLD"].includes(e.state)),
      message: Date.now() >= Date.parse(expiresAt) && entries.some(e => ["READY", "RETRY", "HOLD"].includes(e.state))
        ? `미리보기가 만료됐습니다. 다시 확인해 주세요. ${outcomeNotice()}` : noticePrefix ? `${noticePrefix} ${outcomeNotice()}` : message,
      unconfirmed: entries.filter(e => ["UNKNOWN", "PROCESSING", "REVERSING"].includes(e.state)).length,
      pending: entries.filter(e => ["READY", "RETRY", "UNKNOWN"].includes(e.state)).length,
      applied: entries.filter(e => e.state === "APPLIED").length,
      reversed: entries.filter(e => e.state === "REVERSED").length,
      canConfirm: access() && !busy && !invalidated && phase === "ready" && Date.now() < Date.parse(expiresAt) && entries.some(e => e.state === "READY"),
      canResume: access() && !busy && confirmed && entries.some(e => e.state === "UNKNOWN" || (!invalidated && Date.now() < Date.parse(expiresAt) && ["READY", "RETRY"].includes(e.state))),
      canReverse: access() && !busy && transport.canReverse !== false && typeof transport.reverse === "function"
        && entries.some(e => e.state === "APPLIED" && e.appliedHere === true && e.plan.reversible === true),
      rows: [...held.map(h => ({ rowNumbers: [h.rowNumber], state: "HOLD", reason: "입력값 또는 그룹을 확인해 주세요.", newMembers: null, newTickets: null, newLessons: null })),
        ...entries.map(e => ({ rowNumbers: e.rowNumbers.slice(), state: e.state, reason: e.reason || "", newMembers: e.plan.newMembers, newTickets: e.plan.newTickets, newLessons: e.plan.newLessons, initial: !invalidated || e.plan.initial?.historicalReceipt ? e.plan.initial || null : null }))] });
    const emit = () => { if (!disposed) changed(view()); };
    const packet = async units => {
      if (!access()) throw Error("SHEET_APPLY_DISABLED");
      const result = adapter.adaptServer(await bounded(() => transport.preview(clone(scope), clone(units))), { ...scope, authorized: true }, new Date().toISOString());
      if (!access()) throw Error("TARGET_OR_REVISION_MISMATCH");
      if (!result.serverPreview || result.serverPreview.units.length !== units.length) throw Error(safePreviewCode({ code: result.errors?.[0] || "SERVER_PREVIEW_INVALID" }));
      return result.serverPreview;
    };
    async function load(payload) {
      if (busy || disposed) return false;
      if (!access() || payload?.protocol !== transport.protocol || !digest(payload.fileHash) || !Array.isArray(payload.units) || payload.units.length > 500 || !Array.isArray(payload.held)) throw Error("SHEET_INPUT_INVALID");
      if (payload.units.some(e => !digest(e.operationKey) || !Array.isArray(e.unit?.rows) || e.unit.rows.length < 1 || e.unit.rows.length > 2 || !Array.isArray(e.rowNumbers) || e.rowNumbers.length !== e.unit.rows.length || e.rowNumbers.some(n => !Number.isInteger(n) || n < 2))) throw Error("SHEET_INPUT_INVALID");
      busy = true; stop = false; invalidated = false; cancelled = false; phase = "previewing"; confirmed = false; entries = []; held = clone(payload.held); fileHash = payload.fileHash; expiresAt = ""; message = ""; failureCode = ""; noticePrefix = ""; mutationAttempted = false; emit();
      try {
        if (!payload.units.length) { phase = "ready"; return true; }
        const p = await packet(payload.units.map(e => e.unit));
        expiresAt = new Date(Math.min(Date.parse(p.expiresAt), Date.parse(transport.workSessionExpiresAt?.() || p.expiresAt))).toISOString();
        entries = payload.units.map((e, i) => ({ ...clone(e), plan: p.units[i], state: p.units[i].status, reason: p.units[i].reason, appliedHere: false }));
        if (entries.some(e => ["APPLIED", "REVERSED", "NO_OP"].includes(e.state) && !e.plan.verified)) throw Error("READBACK_UNVERIFIED");
        phase = stop ? "paused" : "ready"; return !stop;
      } catch (error) { phase = stop ? "paused" : "blocked"; entries = []; failureCode = safePreviewCode(error); message = failureCode; return false; }
      finally { busy = false; emit(); }
    }
    async function reconcile(e) {
      const p = await packet([e.unit]), now = p.units[0];
      if (now.unitHash !== e.plan.unitHash) throw Error("READBACK_UNVERIFIED");
      if (["APPLIED", "REVERSED"].includes(now.status)) {
        if (!now.verified) throw Error("READBACK_UNVERIFIED");
        e.plan = now; e.state = now.status; e.reason = "처리 이력을 재조회했습니다."; return;
      }
      if (invalidated || now.status !== "READY" || now.planHash !== e.plan.planHash || now.revision !== e.plan.revision) {
        e.state = "HOLD"; e.plan = { ...e.plan,
          newMembers: now.status === "HOLD" ? now.newMembers : null,
          newTickets: now.status === "HOLD" ? now.newTickets : null,
          newLessons: now.status === "HOLD" ? now.newLessons : null, initial: null };
        e.reason = invalidated ? "조회 정보가 달라졌습니다. 새 미리보기로 확인해 주세요." : now.reason || "계획이 달라졌습니다. 새 미리보기로 확인해 주세요."; return;
      }
      // Keep the original approved plan and expiry; never accept a new plan silently.
      e.state = "RETRY"; e.reason = "미처리 확인 · 같은 승인 범위로 재개할 수 있습니다.";
    }
    async function run(first) {
      if (busy || !access() || (first ? !view().canConfirm : !view().canResume)) return false;
      confirmed = true; busy = true; stop = false; cancelled = false; phase = "applying"; message = ""; noticePrefix = ""; emit();
      try {
        for (const e of entries) {
          if (stop) break;
          if (!["READY", "RETRY", "UNKNOWN"].includes(e.state)) continue;
          if (!access()) throw Error("LOCAL_APPLY_DISABLED");
          if (e.state === "UNKNOWN") { await reconcile(e); emit(); if (!["READY", "RETRY"].includes(e.state)) continue; }
          if (stop || invalidated) { stop = true; break; }
          if (Date.now() >= Date.parse(expiresAt)) { e.state = "HOLD"; e.reason = "미리보기가 만료됐습니다. 다시 확인해 주세요."; stop = true; break; }
          e.state = "PROCESSING"; emit();
          try {
            mutationAttempted = true;
            await bounded(() => transport.apply(clone(scope), clone(e.unit), e.plan.revision, e.plan.planHash, expiresAt, fileHash, e.operationKey));
            e.state = "UNKNOWN";
            await reconcile(e);
            if (e.state === "APPLIED" && e.plan.reversible === true) e.appliedHere = true;
            if (e.state !== "APPLIED") stop = true;
          } catch (error) {
            // Do not retry a write. One readback resolves response loss; otherwise
            // retain UNKNOWN and block unsent units until the user explicitly resumes.
            e.state = "UNKNOWN"; stop = true;
            try {
              await reconcile(e);
              if (e.state === "APPLIED" && e.plan.reversible === true) {
                e.appliedHere = true;
                stop = cancelled || invalidated || entries.some(candidate => ["READY", "RETRY", "UNKNOWN"].includes(candidate.state));
              }
            } catch { e.reason = safeMutationCode(error) || "결과 미확정 · 다시 조회 후 재개해 주세요."; }
            message = safeMutationCode(error) || (stop
              ? "전송을 중단했습니다. 처리 이력을 먼저 확인해 주세요."
              : "응답이 끊겼지만 서버 처리 이력을 확인했습니다.");
          }
          emit();
        }
        settle("done");
      } catch { phase = "paused"; noticePrefix = "권한·환경 또는 조회 상태가 달라져 중단했습니다."; }
      finally { busy = false; if (disposed) { entries = []; held = []; fileHash = ""; } emit(); }
      return true;
    }
    async function reverse() {
      if (busy || !access() || !view().canReverse) return false;
      busy = true; stop = false; cancelled = false; phase = "reversing"; message = ""; noticePrefix = ""; emit();
      try {
        for (const e of [...entries].reverse()) {
          if (stop) break;
          if (e.state !== "APPLIED" || e.appliedHere !== true || e.plan.reversible !== true) continue;
          if (!access()) throw Error("SHEET_APPLY_DISABLED");
          e.state = "REVERSING"; emit();
          try {
            mutationAttempted = true;
            await bounded(() => transport.reverse(clone(scope), e.operationKey));
            e.state = "UNKNOWN";
            await reconcile(e);
            if (e.state !== "REVERSED") stop = true;
          } catch (error) {
            e.state = "UNKNOWN"; stop = true;
            try {
              await reconcile(e);
              if (e.state === "REVERSED") stop = cancelled || invalidated || entries.some(candidate => candidate.appliedHere === true && candidate.state === "APPLIED");
            } catch { e.reason = safeMutationCode(error) || "원복 결과 미확정 · 같은 파일로 다시 조회해 주세요."; }
            message = safeMutationCode(error) || (stop
              ? "원복 전송을 중단했습니다. 처리 이력을 다시 조회해 주세요."
              : "응답이 끊겼지만 서버 원복 이력을 확인했습니다.");
          }
          emit();
        }
        settle("reversed");
      } catch { phase = "paused"; message = "권한·환경 또는 원복 상태가 달라져 중단했습니다."; }
      finally { busy = false; emit(); }
      return true;
    }
    return Object.freeze({ load, view, confirm: () => run(true), resume: () => run(false),
      reverse,
      invalidate: () => {
        invalidated = true; stop = true;
        noticePrefix = "조회 정보가 달라져 미전송분을 보류합니다. 새 미리보기로 확인해 주세요.";
        if (!busy) settle("paused");
        emit();
      },
      cancel: () => { stop = true; cancelled = true; if (!busy) phase = "paused"; noticePrefix = "미전송분을 중단합니다."; emit(); },
      dispose: () => { stop = true; disposed = true; if (!busy) { entries = []; held = []; fileHash = ""; } } });
  }
  return Object.freeze({ allowed, create });
});
