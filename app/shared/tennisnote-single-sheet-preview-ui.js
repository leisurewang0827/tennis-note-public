(function (root) {
  "use strict";
  const scriptURL = document.currentScript.src;
  const MAX_BYTES = 5 * 1024 * 1024;
  const DEADLINE = 10000;
  let templateDependenciesPromise = null;
  const reasons = {
    ADMIN_SNAPSHOT_REQUIRED: "관리자 조회 정보가 필요합니다. 관리자 화면에서 다시 확인해 주세요.",
    SHEET_IMPORT_ENVIRONMENT_BLOCKED: "현재 관리자 주소와 연결 환경이 일치하지 않아 서버 요청을 보내지 않았습니다.",
    SHEET_IMPORT_SESSION_REQUIRED: "관리자 로그인이 만료됐습니다. 다시 로그인한 뒤 확인해 주세요.",
    SHEET_IMPORT_SCOPE_DISABLED: "이 관리자·지점의 등록 범위가 비활성화되어 서버 요청을 보내지 않았습니다.",
    SHEET_IMPORT_APPLY_DISABLED: "등록 적용 권한이 비활성화되어 서버 요청을 보내지 않았습니다.",
    SHEET_IMPORT_REVERSE_DISABLED: "원복 권한이 비활성화되어 서버 요청을 보내지 않았습니다.",
    SHEET_IMPORT_TIMEOUT: "서버 미리보기 시간이 초과됐습니다. 지점과 로그인 상태를 확인한 뒤 다시 시도해 주세요.",
    SHEET_IMPORT_PREVIEW_FAILED: "서버 미리보기를 확인하지 못했습니다. 지점과 로그인 상태를 확인해 주세요.",
    SHEET_IMPORT_APPLY_FAILED: "등록 결과를 확정하지 못했습니다. 같은 파일로 처리 이력을 먼저 다시 확인해 주세요.",
    SHEET_IMPORT_REVERSE_FAILED: "원복 결과를 확정하지 못했습니다. 같은 파일로 처리 이력을 먼저 다시 확인해 주세요.",
    SHEET_IMPORT_REVERSE_HOLD: "등록 뒤 사용 이력이 있어 자동 원복할 수 없습니다. 처리 상세를 확인해 주세요.",
    SHEET_IMPORT_RECEIPT_REQUIRED: "이 관리자의 등록 이력을 찾지 못해 원복하지 않았습니다.",
    SHEET_IMPORT_OPERATION_CONFLICT: "같은 처리 키의 대상이 달라 안전을 위해 중단했습니다.",
    SHEET_PAYLOAD_INVALID: "파일의 등록 단위를 안전하게 만들지 못했습니다. 입력 행을 확인해 주세요.",
    TARGET_OR_REVISION_MISMATCH: "지점·환경이 달라졌습니다. 선택한 지점을 다시 확인해 주세요.",
    TARGET_UNVERIFIED: "조회 대상 지점·환경의 검증 근거가 없습니다. 서버 조회 계약 확인 전에는 판정을 보류합니다.",
    REVISION_UNCONFIRMED: "조회 시점이 확정되지 않았습니다. 서버 조회 계약 보완 후 다시 확인해 주세요.",
    REVISION_SCOPE_INCOMPLETE: "회원·상품·시간표 전체의 변경 시점을 확인할 수 없어 판정을 보류합니다.",
    IMPORT_RECEIPTS_UNAVAILABLE: "이 파일의 기존 등록 이력을 확인할 수 없어 중복 여부 판정을 보류합니다.",
    SNAPSHOT_INCOMPLETE: "전체 회원·미래 시간표 조회가 확인되지 않았습니다. 일부 목록만으로 등록하지 않습니다.",
    POLICY_UNCONFIRMED: "기간·휴무·정원 정책이 미확정입니다. 정책 확인이 필요합니다.",
    GROUP_POLICY_SERVER_REQUIRED: "그룹 차감·참가자 정책의 서버 확인이 필요합니다.",
    IDENTITY_SCOPE_INCOMPLETE: "지점 회원과 계정 연결 조회가 완전하지 않습니다. 관리자 연결 정보를 확인해 주세요.",
    AVAILABILITY_POLICY_UNCONFIRMED: "코치 근무·차단 시간 정책을 확정할 수 없습니다. 근무시간을 확인해 주세요.",
    PARTICIPANT_SCOPE_INCOMPLETE: "수업 참가자와 회원권 연결 조회가 완전하지 않습니다. 기존 수업을 확인해 주세요.",
    TICKET_STATE_UNSUPPORTED: "일시중지·결제대기 등 회원권 상태의 확인이 필요합니다. 기존 회원권을 먼저 확인해 주세요.",
    LESSON_STATE_UNSUPPORTED: "기존 수업 상태를 확정할 수 없어 충돌 판정을 보류합니다.",
    CLOSURE_POLICY_UNCONFIRMED: "시간 단위 휴무 정책을 확정할 수 없습니다. 휴무 범위를 먼저 확인해 주세요.",
    SNAPSHOT_AMBIGUOUS: "조회된 식별키가 중복됩니다. 기존 연결을 확인해 주세요.", SNAPSHOT_INVALID: "서버 조회 정보의 날짜·시간·연결 값이 올바르지 않습니다. 기존 자료를 확인해 주세요.",
    STALE_PREVIEW: "미리보기 정보가 오래됐습니다. 파일을 다시 선택해 확인해 주세요.",
    EMPTY_DATA: "입력된 행이 없습니다. 빈 양식에 회원권 정보를 입력해 주세요.",
    SINGLE_SHEET_REQUIRED: "회원등록 시트 하나만 사용해 주세요.",
    HEADER_MISSING: "필수 7개 열을 확인해 주세요.", HEADER_UNKNOWN: "양식에 없는 열을 제거해 주세요.", HEADER_DUPLICATE: "같은 제목의 열을 하나로 정리해 주세요.",
    ROW_LIMIT: "회원권은 한 번에 최대 500행까지 확인할 수 있습니다.", ROW_OR_COLUMN_LIMIT: "양식 밖 열이나 너무 먼 행에 입력된 내용을 확인해 주세요.",
    FILE_SIZE_INVALID: "5MB 이하의 비어 있지 않은 XLSX 파일을 선택해 주세요.", XLSX_REQUIRED: "회원등록 XLSX 양식을 선택해 주세요.",
    ZIP_LIMIT: "파일의 압축 해제 크기 또는 항목 수가 한도를 초과했습니다. 파일을 나눠 주세요.",
    ZIP_STRUCTURE_INVALID: "파일 압축 구조를 확인할 수 없습니다. 원본 양식에서 다시 저장해 주세요.",
    ZIP_SIZE_MISMATCH: "파일 크기 정보가 일치하지 않습니다. 파일을 다시 저장해 주세요.", ZIP_CRC_MISMATCH: "파일 손상이 확인됐습니다. 원본을 다시 저장해 주세요.",
    PARSING_TIMEOUT: "파일 확인 시간이 초과됐습니다. 파일을 줄여 다시 선택해 주세요.",
    DECOMPRESSION_UNAVAILABLE: "이 브라우저는 안전한 압축 해제를 지원하지 않습니다. 최신 브라우저를 이용해 주세요.",
    WORKER_UNAVAILABLE: "이 브라우저는 안전한 파일 처리를 지원하지 않습니다. 최신 브라우저를 이용해 주세요.",
    SNAPSHOT_OFFLINE: "오프라인입니다. 조회 근거를 확인할 수 없어 판정을 보류합니다.",
    XLSX_PARSE_FAILED: "파일 형식을 읽지 못했습니다. 양식을 확인하고 다시 선택해 주세요.", SNAPSHOT_READ_FAILED: "조회 정보를 가져오지 못했습니다. 다시 확인해 주세요.",
    REQUIRED_VALUE_MISSING: "필수값이 비어 있습니다. 해당 행의 필수 7개 값을 채워 주세요.", PHONE_TEXT_REQUIRED: "연락처를 앞자리 0이 보존된 텍스트로 입력해 주세요.", PHONE_INVALID: "연락처 형식을 확인해 주세요.",
    DATE_INVALID: "시작일을 올바른 날짜로 입력해 주세요.", SESSION_COUNTS_INVALID: "총횟수·사용횟수는 정수이며 사용횟수는 총횟수 이하여야 합니다.",
    SLOT_PAIR_INCOMPLETE: "요일과 시간을 함께 입력하거나 둘 다 비워 주세요.", SLOT_INVALID: "요일과 HH:mm 시간을 확인해 주세요.", SLOT_DUPLICATE: "같은 요일·시간을 한 번만 입력해 주세요.",
    FORMULA_OR_LINK_FORBIDDEN: "수식·외부 링크 대신 확인된 값만 입력해 주세요.", WORKBOOK_UNSAFE: "외부 연결·매크로·숨김 등 미지원 구조가 있습니다. 기본 양식을 사용해 주세요.",
    HIDDEN_OR_MERGED_CELLS: "숨김 또는 병합 셀을 풀고 다시 확인해 주세요.", TEXT_UNSAFE: "이름·상품·그룹의 특수 입력을 확인해 주세요.",
    DUPLICATE_TICKET_INTENT: "같은 회원·코치·상품 행이 중복됩니다. 중복을 확인해 주세요.", IDENTITY_NAME_CONFLICT: "같은 연락처에 서로 다른 이름이 있습니다. 본인 정보를 확인해 주세요.",
    MEMBER_AMBIGUOUS: "같은 연락처의 회원이 여러 명입니다. 기존 회원 연결을 먼저 확인해 주세요.", COACH_NOT_EXACT: "지점의 활성 코치가 정확히 한 명인지 확인해 주세요.", PRODUCT_NOT_EXACT: "지점의 활성 상품이 정확히 하나인지 확인해 주세요.",
    RENEWAL_SERVER_DECISION_REQUIRED: "기존 회원권의 연장 후보입니다. 기존 이력을 보존하는 서버 판정 전에는 등록하지 않습니다.", ACTIVE_TICKET_AMBIGUOUS: "활성 회원권이 여러 개입니다. 정확한 대상 확인이 필요합니다.",
    GROUP_MISMATCH: "같은 그룹 두 행의 코치·상품·시작일·회차·시간을 맞춰 주세요.", GROUP_ATOMIC_HOLD: "그룹의 다른 행에도 확인이 필요해 그룹 전체를 보류합니다.", GROUP_CODE_REQUIRED: "두 참가자에게 같은 그룹코드를 입력해 주세요.", GROUP_PRODUCT_MISMATCH: "그룹코드와 상품의 수업 형태가 일치하지 않습니다.",
    SCHEDULE_CONFLICT: "기존 수업과 충돌합니다. 시간을 변경해 주세요.", PROPOSED_SCHEDULE_CONFLICT: "파일 안의 다른 계획과 충돌합니다. 양쪽 시간을 확인해 주세요.", AVAILABILITY_UNCONFIRMED: "코치 근무시간을 확인할 수 없습니다. 시간 확인이 필요합니다.",
    INSUFFICIENT_FUTURE_SLOTS: "기간 안에 잔여 수업을 모두 배정할 수 없습니다. 기간·시간을 확인해 주세요.", TICKET_PERIOD_EXPIRED: "현재 기준으로 기간이 끝났습니다. 시작일·기간을 확인해 주세요.",
    SESSION_UNIT_REMAINDER: "상품의 회차 단위와 잔여횟수가 맞지 않습니다. 회차를 확인해 주세요.", PRODUCT_POLICY_UNCONFIRMED: "상품 기간·회차 단위가 미확정입니다. 상품 정책을 확인해 주세요.",
  };
  const explain = code => reasons[code] || "자동 판정을 보류했습니다. 입력과 서버 정책을 확인해 주세요.";
  const safeBatchText = value => reasons[value] || (/^[A-Z0-9_]+$/.test(String(value || "")) ? explain(value) : String(value || ""));
  const safeFailureCode = error => reasons[String(error?.code || error?.message || "")] ? String(error?.code || error?.message) : "SHEET_IMPORT_PREVIEW_FAILED";
  function loadTemplateDependency(relative, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL(relative, scriptURL).href;
      script.async = true;
      script.dataset.tennisnoteOptionalModule = "single-sheet-template";
      script.onload = () => ready() ? resolve() : reject(new Error("TEMPLATE_DEPENDENCY_INVALID"));
      script.onerror = () => reject(new Error("TEMPLATE_DEPENDENCY_LOAD_FAILED"));
      document.head.append(script);
    });
  }
  function ensureTemplateDependencies() {
    if (root.TennisNoteSingleSheetImport?.buildTemplateWorkbook && typeof root.XLSX?.writeFile === "function") return Promise.resolve();
    if (templateDependenciesPromise) return templateDependenciesPromise;
    templateDependenciesPromise = (async () => {
      await loadTemplateDependency("./tennisnote-single-sheet-import.js", () => Boolean(root.TennisNoteSingleSheetImport?.buildTemplateWorkbook));
      await loadTemplateDependency("./vendor/xlsx.full.min.js?v=0.18.5", () => typeof root.XLSX?.writeFile === "function");
    })().catch(error => { templateDependenciesPromise = null; throw error; });
    return templateDependenciesPromise;
  }
  function bind(options) {
    const trigger = options.button;
    if (!trigger || trigger.dataset.excelBound) return;
    trigger.dataset.excelBound = "true";
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop"; backdrop.id = "singleSheetPreviewModal"; backdrop.hidden = true;
    backdrop.innerHTML = `<section class="modal-panel tn-excel-panel" role="dialog" aria-modal="true" aria-labelledby="singleSheetPreviewTitle" tabindex="-1">
      <div class="modal-heading"><h2 id="singleSheetPreviewTitle">엑셀 등록 미리보기</h2><button type="button" class="ghost-button" data-excel-close>닫기</button></div>
      <p>회원등록 시트 · 회원권 1개당 1행 · 최대 500행</p>
      <label class="form-field">XLSX 파일 선택<input type="file" accept=".xlsx" data-excel-file /></label>
      <p class="tn-excel-status" data-excel-status role="status" aria-live="polite">파일을 선택하면 등록 전에 내용을 확인합니다.</p>
      <div data-excel-results></div>
      <p data-excel-boundary>현재는 읽기 전용입니다. 서버의 최종 판정·원자 적용 기능이 연결되기 전에는 등록할 수 없습니다.</p>
      <div class="modal-actions"><button type="button" class="ghost-button" data-excel-template>양식 받기</button><button type="button" class="ghost-button" data-excel-retry hidden>다시 확인</button><button type="button" class="ghost-button" data-excel-cancel hidden>파일 확인 취소</button><button type="button" class="ghost-button" data-excel-reverse hidden disabled aria-disabled="true">방금 등록 원복</button><button type="button" class="tn-excel-disabled" data-excel-apply disabled aria-disabled="true">등록 적용 불가 · 읽기 전용</button></div>
    </section>`;
    document.body.append(backdrop);
    const input = backdrop.querySelector("[data-excel-file]"), status = backdrop.querySelector("[data-excel-status]"), results = backdrop.querySelector("[data-excel-results]");
    const template = backdrop.querySelector("[data-excel-template]"), retry = backdrop.querySelector("[data-excel-retry]"), cancel = backdrop.querySelector("[data-excel-cancel]");
    const apply = backdrop.querySelector("[data-excel-apply]"), reverse = backdrop.querySelector("[data-excel-reverse]"), boundary = backdrop.querySelector("[data-excel-boundary]");
    let batch = null, confirming = false, requestBusy = false, templateBusy = false;
    let generation = 0, worker = null, timer = null, expires = null, opener = null;
    function stop() { generation++; requestBusy = false; input.disabled = false; worker?.terminate(); worker = null; clearTimeout(timer); clearTimeout(expires); timer = null; cancel.hidden = true; }
    function reset() {
      results.replaceChildren(); status.textContent = "파일을 선택하면 등록 전에 내용을 확인합니다."; retry.hidden = true;
      apply.disabled = true; apply.setAttribute("aria-disabled", "true"); apply.className = "tn-excel-disabled"; apply.textContent = "등록할 안전 항목 없음";
      reverse.hidden = true; reverse.disabled = true; reverse.setAttribute("aria-disabled", "true");
    }
    function close(fromHistory = false) {
      if (backdrop.hidden) return;
      if (batch?.view().confirmed === true) batch.cancel();
      else { batch?.dispose(); batch = null; }
      confirming = false; stop(); backdrop.hidden = true; input.value = ""; reset(); opener?.focus();
      if (!fromHistory && history.state?.tnExcelPreview === true) history.back();
    }
    function open() {
      if (options.canOpen?.() !== true || !backdrop.hidden) return;
      // Safari may not focus a clicked button; restore the authoritative entry,
      // not whichever unrelated control happened to have keyboard focus.
      opener = trigger; reset(); backdrop.hidden = false;
      if (batch) renderBatch(batch.view());
      history.pushState({ ...(history.state || {}), tnExcelPreview: true }, ""); input.focus();
    }
    async function downloadTemplate() {
      if (templateBusy) return;
      templateBusy = true; template.disabled = true; template.setAttribute("aria-disabled", "true");
      status.textContent = "한 장 엑셀 양식을 준비하고 있습니다…";
      try {
        await ensureTemplateDependencies();
        const api = root.TennisNoteSingleSheetImport;
        const workbook = api.buildTemplateWorkbook(root.XLSX);
        root.XLSX.writeFile(workbook, api.TEMPLATE_FILE_NAME, { bookType: "xlsx", compression: true });
        status.textContent = "빈 양식 다운로드 완료 · 연락처는 앞자리 0이 유지되는 텍스트 형식입니다.";
      } catch {
        status.textContent = "엑셀 양식을 만들지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.";
      } finally {
        templateBusy = false; template.disabled = false; template.removeAttribute("aria-disabled");
      }
    }
    const line = (parent, tag, value) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
    function renderBatch(v) {
      results.replaceChildren(); input.disabled = v.busy; retry.hidden = !v.expired || v.busy;
      clearTimeout(expires);
      if (!v.busy && Date.parse(v.expiresAt) > Date.now()) expires = setTimeout(() => { if (batch && !backdrop.hidden) renderBatch(batch.view()); }, Date.parse(v.expiresAt) - Date.now() + 1);
      boundary.textContent = "서버가 회원·회원권·시간표를 한 단위로 처리합니다. 결제는 만들지 않으며 원복은 같은 관리자와 허용 범위에서만 가능합니다.";
      status.textContent = v.message ? safeBatchText(v.message) : ({ previewing: "서버 판정을 확인하고 있습니다…", ready: "미리보기 완료 · 안전 단위를 한 번 확인하고 등록합니다.", applying: "등록 처리 중 · 이미 완료된 항목은 유지됩니다.", reversing: "원복 처리 중 · 서버 이력을 다시 확인합니다.", paused: "전송 중단 · 처리 이력을 먼저 다시 확인해 주세요.", done: "등록 결과 재조회 완료", reversed: "원복 결과 재조회 완료", blocked: "서버 확인이 필요합니다." }[v.phase] || "파일을 선택해 주세요.");
      if (confirming === "apply") status.textContent = "확인: 안전 항목만 등록하며 보류 항목은 건너뜁니다. 결제는 생성하지 않습니다.";
      if (confirming === "reverse") status.textContent = "확인: 이 파일로 방금 등록한 단위만 원복합니다. 후속 사용 이력이 있으면 서버가 중단합니다.";
      const totals = document.createElement("dl"); totals.className = "tn-excel-summary"; results.append(totals);
      for (const [label, value] of [["등록 완료 단위", v.applied], ["원복 완료 단위", v.reversed], ["미처리 단위", v.pending], ["신규 회원권 계획", v.rows.reduce((n,r)=>n+r.newTickets,0)], ["예정 수업", v.rows.reduce((n,r)=>n+r.newLessons,0)]]) {
        const pair = document.createElement("div"); line(pair,"dt",label); line(pair,"dd",String(value)); totals.append(pair);
      }
      const list = document.createElement("ol"); list.className = "tn-excel-rows"; results.append(list);
      const labels = { READY:"등록 가능", HOLD:"보류", APPLIED:"등록 완료", REVERSED:"원복 완료", PROCESSING:"처리 중", REVERSING:"원복 처리 중", UNKNOWN:"결과 미확정", RETRY:"미처리 확인" };
      for (const row of v.rows) { const li = document.createElement("li"); list.append(li); line(li,"strong",`${row.rowNumbers.join("·")}행 · ${labels[row.state] || "확인 필요"}`); if(row.reason) line(li,"p",safeBatchText(row.reason)); }
      apply.disabled = !(v.canConfirm || v.canResume); apply.setAttribute("aria-disabled", String(apply.disabled));
      apply.className = apply.disabled ? "tn-excel-disabled" : "primary-button";
      apply.textContent = v.busy ? "처리 중…" : v.canResume ? "미처리분 재조회·재개" : confirming === "apply" ? "확인하고 등록" : v.canConfirm ? "안전 항목 등록" : v.applied ? "처리 완료 · 새 파일 선택" : "등록할 안전 항목 없음";
      reverse.hidden = !(v.canReverse || confirming === "reverse");
      reverse.disabled = v.busy || !v.canReverse;
      reverse.setAttribute("aria-disabled", String(reverse.disabled));
      reverse.textContent = confirming === "reverse" ? "확인하고 원복" : "방금 등록 원복";
      cancel.hidden = !v.busy; cancel.textContent = "미전송분 중단";
      backdrop.dataset.batchPhase = v.phase;
    }
    function render(result) {
      results.replaceChildren();
      const errors = [...new Set([...(result.errors || []), ...(result.snapshotErrors || [])])];
      status.textContent = errors.length || result.rows.some(row => row.status === "HOLD") ? "확인 필요 · 등록 판정 보류" : "미리보기 완료 · 실제 등록되지 않았습니다.";
      for (const code of errors) line(results, "p", explain(code));
      const summary = document.createElement("dl"); summary.className = "tn-excel-summary"; results.append(summary);
      const s = result.summary;
      for (const [label, value] of [["전체 행", result.rows.length], ["새 회원", s?.newMembers], ["기존 회원", s?.existingMembers], ["신규 회원권", s?.newTickets], ["갱신 후보", s?.renewalCandidates], ["예정 수업", s?.plannedLessons], ["시간 수동 배정", s?.manualSchedule], ["보류 행", s?.holdRows ?? result.rows.length]]) {
        const pair = document.createElement("div"); line(pair, "dt", label); line(pair, "dd", value == null ? "미확정" : String(value)); summary.append(pair);
      }
      const list = document.createElement("ol"); list.className = "tn-excel-rows"; results.append(list);
      for (const row of result.rows) {
        const item = document.createElement("li"); list.append(item);
        line(item, "strong", `${row.rowNumber}행 · ${row.status === "HOLD" ? "확인 필요" : row.status === "NO_OP" ? "기존 처리 이력" : "서버 최종 확인 필요"}`);
        for (const code of row.reasons || []) line(item, "p", explain(code));
        if (!row.reasons?.length && errors.length) line(item, "p", "전체 조회 근거가 미확정되어 이 행의 등록도 보류합니다.");
      }
    }
    function renderRemote(result, payload) {
      results.replaceChildren();
      boundary.textContent = "개발계 서버 미리보기 전용 · 등록·원복은 비활성입니다.";
      reverse.hidden = true; reverse.disabled = true; reverse.setAttribute("aria-disabled", "true");
      apply.disabled = true; apply.setAttribute("aria-disabled", "true"); apply.className = "tn-excel-disabled"; apply.textContent = "등록 적용 불가 · 미리보기 전용";
      const preview = result.serverPreview;
      const held = (payload.held || []).map(row => ({ rowNumbers: [row.rowNumber], status: "HOLD", reasons: row.reasons || [] }));
      const serverRows = (preview?.units || []).map((unit, index) => ({
        rowNumbers: payload.units[index]?.rowNumbers || [], status: unit.status,
        reason: unit.reason || "", newMembers: unit.newMembers, newTickets: unit.newTickets, newLessons: unit.newLessons,
      }));
      const rows = [...held, ...serverRows];
      const errors = [...new Set(result.errors || [])];
      status.textContent = errors.length || rows.some(row => row.status === "HOLD")
        ? "확인 필요 · 서버 미리보기에서 등록 판정을 보류했습니다."
        : "서버 미리보기 완료 · 실제 등록되지 않았습니다.";
      for (const code of errors) line(results, "p", explain(code));
      const summary = document.createElement("dl"); summary.className = "tn-excel-summary"; results.append(summary);
      const totalRows = held.length + Number(preview?.rowCount || 0);
      for (const [label, value] of [
        ["전체 행", totalRows],
        ["새 회원", serverRows.reduce((n, row) => n + Number(row.newMembers || 0), 0)],
        ["신규 회원권", Number(preview?.newTickets || 0)],
        ["예정 수업", Number(preview?.newLessons || 0)],
        ["보류 행", rows.filter(row => row.status === "HOLD").reduce((n, row) => n + Math.max(1, row.rowNumbers.length), 0)],
      ]) { const pair = document.createElement("div"); line(pair, "dt", label); line(pair, "dd", String(value)); summary.append(pair); }
      const list = document.createElement("ol"); list.className = "tn-excel-rows"; results.append(list);
      const labels = { READY: "서버 판정 완료", HOLD: "확인 필요", APPLIED: "기존 처리 이력", REVERSED: "기존 원복 이력" };
      for (const row of rows) {
        const item = document.createElement("li"); list.append(item);
        line(item, "strong", `${row.rowNumbers.join("·")}행 · ${labels[row.status] || "확인 필요"}`);
        if (row.reason) line(item, "p", row.reason);
        for (const code of row.reasons || []) line(item, "p", explain(code));
      }
      retry.hidden = false;
      clearTimeout(expires);
      if (preview?.expiresAt && Date.parse(preview.expiresAt) > Date.now()) {
        expires = setTimeout(() => { results.replaceChildren(); status.textContent = explain("STALE_PREVIEW"); }, Date.parse(preview.expiresAt) - Date.now() + 1);
      }
    }
    async function run(file) {
      if (requestBusy || batch?.view().busy) return;
      batch?.dispose(); batch = null; confirming = false;
      apply.disabled = true; apply.setAttribute("aria-disabled", "true"); apply.className = "tn-excel-disabled"; apply.textContent = "등록 적용 불가 · 읽기 전용";
      stop(); reset(); if (!file) return;
      const id = generation;
      const error = code => { stop(); results.replaceChildren(); status.textContent = explain(code); retry.hidden = false; };
      if (navigator.onLine === false) { error("SNAPSHOT_OFFLINE"); return; }
      if (!/\.xlsx$/i.test(file.name)) { error("XLSX_REQUIRED"); return; }
      if (!file.size || file.size > MAX_BYTES) { error("FILE_SIZE_INVALID"); return; }
      if (typeof Worker !== "function") { error("WORKER_UNAVAILABLE"); return; }
      requestBusy = true; input.disabled = true;
      status.textContent = "파일과 조회 근거를 확인하고 있습니다…"; cancel.hidden = false;
      timer = setTimeout(() => error("PARSING_TIMEOUT"), DEADLINE);
      try {
        const transport = options.getLocalTransport?.();
        const local = root.TennisNoteSingleSheetBatch?.allowed(location.hostname, transport) && options.canOpen?.() === true;
        const previewTransport = local ? null : await options.getPreviewTransport?.();
        const remote = !local && root.TennisNoteSingleSheetRemotePreview?.recognized(previewTransport) && options.canOpen?.() === true;
        const executable = remote && previewTransport.canApply === true && previewTransport.canReverse === true
          && root.TennisNoteSingleSheetBatch?.allowed(location.hostname, previewTransport);
        if (remote && previewTransport.enabled !== true) { error(previewTransport.reason || "SHEET_IMPORT_SCOPE_DISABLED"); return; }
        const snapshot = local || remote ? null : await options.getSnapshot();
        if (id !== generation || backdrop.hidden) return;
        const bytes = await file.arrayBuffer();
        if (id !== generation || backdrop.hidden) return;
        worker = new Worker(new URL("./tennisnote-single-sheet-worker.js", scriptURL));
        worker.onerror = event => { event.preventDefault(); if (id === generation) error("XLSX_PARSE_FAILED"); };
        worker.onmessage = async event => {
          if (id !== generation || event.data?.id !== id) return;
          if (event.data.type === "error") { error(event.data.code); return; }
          if (event.data.type === "ephemeral-units") {
            if (!local) { error("SNAPSHOT_READ_FAILED"); return; }
            stop();
            try {
              batch = root.TennisNoteSingleSheetBatch.create({ host: location.hostname, transport, adapter: root.TennisNoteSingleSheetSnapshot, canOpen: options.canOpen, changed: renderBatch });
              await batch.load(event.data.payload);
            } catch { error("SNAPSHOT_READ_FAILED"); }
            return;
          }
          if (event.data.type === "remote-preview-units") {
            if (!remote || event.data.payload?.protocol !== previewTransport.protocol) { error("SNAPSHOT_READ_FAILED"); return; }
            try {
              const payload = event.data.payload;
              if (executable) {
                stop();
                batch = root.TennisNoteSingleSheetBatch.create({ host: location.hostname, transport: previewTransport, adapter: root.TennisNoteSingleSheetSnapshot, canOpen: options.canOpen, changed: renderBatch });
                await batch.load(payload);
                return;
              }
              if (!payload.units.length) { stop(); renderRemote({ errors: [], serverPreview: null }, payload); return; }
              const packet = await previewTransport.preview(previewTransport.scope, payload.units.map(entry => entry.unit));
              if (id !== generation || backdrop.hidden || options.canOpen?.() !== true) return;
              const adapted = root.TennisNoteSingleSheetSnapshot.adaptServer(packet, { ...previewTransport.scope, authorized: true }, new Date().toISOString());
              stop(); renderRemote(adapted, payload);
            } catch (previewError) { if (id === generation) error(safeFailureCode(previewError)); }
            return;
          }
          stop(); render(event.data.result); retry.hidden = false;
          if (snapshot?.context) {
            const until = Math.min(Date.parse(snapshot.context.expiresAt), ...event.data.result.plans.map(p => Date.parse(`${p.date}T${p.time}:00+09:00`)));
            expires = setTimeout(() => { results.replaceChildren(); status.textContent = explain("STALE_PREVIEW"); }, Math.max(0, until - Date.now()));
          }
        };
        worker.postMessage({ id, bytes, snapshot, now: new Date().toISOString(), ...(local ? { serverProtocol: "local-synthetic/1" } : remote ? { serverProtocol: previewTransport.protocol } : {}) }, [bytes]);
      } catch { if (id === generation) error("SNAPSHOT_READ_FAILED"); }
    }
    trigger.addEventListener("click", open);
    template.addEventListener("click", () => void downloadTemplate());
    input.addEventListener("change", () => void run(input.files[0]));
    retry.addEventListener("click", () => void run(input.files[0]));
    apply.addEventListener("click", () => {
      if (!batch || apply.disabled) return;
      const v = batch.view();
      if (v.canResume) { confirming = false; void batch.resume(); }
      else if (v.canConfirm && confirming !== "apply") { confirming = "apply"; renderBatch(v); }
      else if (v.canConfirm) { confirming = false; void batch.confirm(); }
    });
    reverse.addEventListener("click", () => {
      if (!batch || reverse.disabled) return;
      const v = batch.view();
      if (!v.canReverse) return;
      if (confirming !== "reverse") { confirming = "reverse"; renderBatch(v); return; }
      confirming = false; void batch.reverse();
    });
    cancel.addEventListener("click", () => { confirming = false; if (batch) { batch.cancel(); return; } stop(); status.textContent = "파일 확인을 취소했습니다. 다른 파일을 선택할 수 있습니다."; retry.hidden = false; });
    backdrop.querySelector("[data-excel-close]").addEventListener("click", () => close());
    backdrop.addEventListener("click", event => { if (event.target === backdrop) close(); });
    // Hiding the retry control while it is focused can move focus to body in
    // Chromium. Escape/Tab must still belong to this open modal in that state.
    root.addEventListener("keydown", event => {
      if (backdrop.hidden) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key === "Tab") {
        const targets = [...backdrop.querySelectorAll("button:not(:disabled),input")].filter(el => !el.hidden && el.getClientRects().length);
        if (!backdrop.contains(document.activeElement)) { event.preventDefault(); targets[0]?.focus(); return; }
        if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1).focus(); }
        if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0].focus(); }
      }
    }, true);
    root.addEventListener("popstate", () => close(true));
    root.addEventListener("pagehide", () => { close(true); batch?.dispose(); batch = null; });
    root.addEventListener("offline", () => { if (!backdrop.hidden) { if (batch) { batch.cancel(); return; } stop(); results.replaceChildren(); status.textContent = explain("SNAPSHOT_OFFLINE"); retry.hidden = false; } });
    root.addEventListener("tennisnote:excel-snapshot-changed", () => { if (!backdrop.hidden) { if (batch) { batch.cancel(); return; } stop(); results.replaceChildren(); status.textContent = explain("STALE_PREVIEW"); retry.hidden = false; } });
    return Object.freeze({ close });
  }
  root.TennisNoteExcelPreviewUI = Object.freeze({ bind });
})(window);
