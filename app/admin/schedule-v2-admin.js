(() => {
  "use strict";

  const root = document.querySelector("#scheduleView");
  const workspace = document.querySelector("#scheduleV2Workspace");
  const editor = document.querySelector("#scheduleV2Editor");
  const closureEditor = document.querySelector("#scheduleV2ClosureEditor");
  if (!root || !workspace || !editor) return;

  const query = new URLSearchParams(window.location.search);
  const localDemoMode = query.get("demoAdmin") === "1"
    && ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const parallelComparisonMode = query.get("scheduleV2Compare") === "1";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const kindLabels = { regular: "정규", makeup: "보강", coupon: "쿠폰", one_day: "원데이" };
  const overlapBlockingStatuses = new Set(["scheduled", "reserved", "pending_change", "completed", "no_show"]);
  const defaultAddDurationMinutes = 20;
  const statusLabels = {
    scheduled: "예정",
    reserved: "예약",
    pending_change: "승인 대기",
    completed: "완료",
    no_show: "노쇼",
    absent: "불참",
    cancelled: "취소",
  };
  const workspaceCache = new Map();
  const workspaceCacheTtlMs = 30_000;
  const desktopWeeklyMedia = window.matchMedia("(min-width: 981px)");
  const outcomeLabels = {
    completed: "완료",
    no_show: "노쇼",
    absence: "불참",
    cancelled: "취소",
    holiday: "휴무",
  };
  const lessonHistoryLabels = {
    schedule_v2_lesson_created: "수업 추가",
    schedule_v2_lesson_updated: "수업 수정",
    schedule_v2_lesson_cancelled: "수업 취소",
    schedule_v2_lesson_restored: "취소 수업 복구",
    schedule_v2_lesson_outcome: "수업 처리 저장",
    schedule_v2_lesson_finalized: "수업 처리 완료",
    schedule_v2_substitute_assigned: "대타 지정",
    schedule_v2_substitute_cancelled: "대타 취소",
    schedule_v2_regular_anchor_revised: "미래 정규 일정 수정",
    schedule_v2_regular_anchor_ended: "미래 정규 일정 종료",
    admin_lesson_force_deleted: "관리자 강제 삭제",
  };
  const regularCutoffLabels = {
    ticket_status: "이전 회원권 일정",
    date_range: "회원권 기간 종료",
    session_limit: "회원권 횟수 종료",
    paused_schedule_replaced: "시간 변경으로 종료",
  };
  const entitlementStatusLabels = {
    open: "보강 선택 대기",
    booked: "보강 예약됨",
    cancelled: "보강 권리 종료",
    expired: "보강 권리 만료",
  };
  const curriculumCatalog = window.TennisNoteCurriculumCatalog || { steps: [], aliases: {} };
  const curriculumSteps = Array.isArray(curriculumCatalog.steps) ? curriculumCatalog.steps : [];
  const curriculumByCode = new Map(curriculumSteps.map((step) => [String(step.id || "").toUpperCase(), step]));
  const scheduleLaneTools = window.TennisNoteScheduleLanes;
  const state = {
    engine: "v2",
    weekStart: mondayOf(new Date()),
    selectedDate: localDateKey(new Date()),
    payload: null,
    loading: false,
    activeLoadKey: "",
    loadSequence: 0,
    serverReady: false,
    selectedTicketId: "",
    selectedParticipants: [],
    pendingTicketId: "",
    editingLesson: null,
    reopeningLesson: null,
    editorOpen: false,
    editorScrollY: 0,
    editorFocusTarget: null,
    closureEditorOpen: false,
    editingClosureId: "",
    editingOperationDayId: "",
    closureImpact: null,
    closureScrollY: 0,
    closureFocusTarget: null,
    deferredRefresh: false,
    refreshTimer: null,
    searchScrollTimer: null,
    lastSearchScrollKey: "",
    renderMode: "",
    showArchivedHistory: false,
    feedbackOnly: false,
    feedbackRevisionUserId: "",
    cancelConfirmationKey: "",
    revisionWatcher: null,
    absorbingRevisionRefresh: false,
    postSaveRefreshPending: false,
    policyEditorDirty: false,
    integrityRepairGroups: new Map(),
  };

  function bridge() {
    return window.TennisNoteAdminScheduleV2Bridge || null;
  }

  function scheduleWorkspaceIsActive() {
    return root.classList.contains("is-active")
      && !root.hidden
      && root.getAttribute("aria-hidden") !== "true";
  }

  const escapeHtml = window.escapeHtml;

  function curriculumStepFromValue(value = "") {
    const code = String(value).trim().split(/\s|·/)[0].toUpperCase();
    const canonical = String(curriculumCatalog.aliases?.[code] || code).toUpperCase();
    return curriculumByCode.get(canonical) || null;
  }

  function curriculumInputValue(participant = {}) {
    const code = participant.nextCurriculumSkillLabel || participant.next_curriculum_skill_label || "";
    if (!code) return "";
    const step = curriculumStepFromValue(code);
    const title = step?.title || participant.nextCurriculumTitle || participant.next_curriculum_title || "";
    return title ? `${step?.id || code} · ${title}` : String(code);
  }

  function renderCurriculumOptions() {
    const target = $("#scheduleV2CurriculumOptions");
    if (!target || target.dataset.ready === curriculumCatalog.version) return;
    target.innerHTML = curriculumSteps.map((step) => `<option value="${escapeHtml(`${step.id} · ${step.title}`)}">${escapeHtml(step.trackTitle || step.category || "커리큘럼")}</option>`).join("");
    target.dataset.ready = curriculumCatalog.version || "ready";
  }

  function curriculumSearchResults(value) {
    const query = String(value || "").trim();
    if (!query) return [];
    const search = window.TennisNoteCurriculumSearch;
    if (search?.search) return search.search(curriculumSteps, query, { limit: 24 }).map((result) => result.step);
    const normalized = query.toLocaleLowerCase("ko-KR");
    return curriculumSteps
      .filter((step) => `${step.id} ${step.title} ${step.trackTitle || ""} ${step.category || ""}`.toLocaleLowerCase("ko-KR").includes(normalized))
      .slice(0, 24);
  }

  function curriculumNotionUrl(step) {
    const value = String(step?.notionUrl || "").trim();
    return /^https:\/\/(?:www\.)?(?:app\.)?notion\.(?:com|so|site)\//i.test(value) ? value : "";
  }

  function curriculumDetailLinkMarkup(step, dataAttribute = "") {
    const notionUrl = curriculumNotionUrl(step);
    if (!notionUrl) return "";
    const title = `${step.id} ${step.title} 자세히 보기`;
    return `<a class="tn-curriculum-detail-link" href="${escapeHtml(notionUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title)}" ${dataAttribute}>자세히 보기</a>`;
  }

  function updateV2CurriculumDetailLink(input) {
    const row = input?.closest("[data-v2-outcome-user]");
    const link = row?.querySelector("[data-v2-curriculum-detail-link]");
    if (!link) return;
    const step = curriculumStepFromValue(input.value);
    const notionUrl = curriculumNotionUrl(step);
    link.hidden = !notionUrl;
    if (!notionUrl) {
      link.removeAttribute("href");
      link.removeAttribute("aria-label");
      return;
    }
    link.href = notionUrl;
    link.setAttribute("aria-label", `${step.id} ${step.title} 자세히 보기`);
  }

  function renderV2CurriculumSuggestions(input) {
    const target = input?.closest("[data-v2-outcome-user]")?.querySelector("[data-v2-curriculum-suggestions]");
    if (!target) return;
    const query = String(input.value || "").trim();
    const exactStep = curriculumStepFromValue(query);
    const exactValue = exactStep ? `${exactStep.id} · ${exactStep.title}` : "";
    if (!query || exactValue === query) {
      target.hidden = true;
      target.innerHTML = "";
      return;
    }
    const matches = curriculumSearchResults(query);
    target.hidden = false;
    target.innerHTML = matches.length
      ? matches.map((step, index) => `<div class="tn-curriculum-suggestion-row"><button type="button" class="tn-curriculum-suggestion${index === 0 ? " is-active" : ""}" role="option" data-v2-curriculum-code="${escapeHtml(step.id)}"><strong>${escapeHtml(`${step.id} · ${step.title}`)}</strong><span>${escapeHtml([step.trackTitle || step.category, step.stageLabel || step.level].filter(Boolean).join(" · "))}</span><small>${escapeHtml(step.focus || step.goal || step.guide || "선택한 단계가 다음 커리큘럼으로 저장됩니다.")}</small></button>${curriculumDetailLinkMarkup(step)}</div>`).join("")
      : '<p class="tn-curriculum-suggestions-empty">일치하는 단계가 없습니다. 증상이나 동작을 다른 말로 입력해 보세요.</p>';
  }

  function selectV2CurriculumSuggestion(button) {
    const row = button?.closest("[data-v2-outcome-user]");
    const input = row?.querySelector("[data-v2-curriculum]");
    const target = row?.querySelector("[data-v2-curriculum-suggestions]");
    const step = curriculumByCode.get(String(button?.dataset.v2CurriculumCode || "").toUpperCase());
    if (!input || !step) return;
    input.value = `${step.id} · ${step.title}`;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (target) target.hidden = true;
    updateV2CurriculumDetailLink(input);
    input.focus();
  }

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function mondayOf(value) {
    const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
    const offset = date.getDay() === 0 ? -6 : 1 - date.getDay();
    date.setDate(date.getDate() + offset);
    date.setHours(12, 0, 0, 0);
    return date;
  }

  function addDays(value, amount) {
    const date = value instanceof Date ? new Date(value) : new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return date;
  }

  function weekDates() {
    return Array.from({ length: 7 }, (_, index) => localDateKey(addDays(state.weekStart, index)));
  }

  function workspaceCacheKey(branchId, dates = weekDates()) {
    return `${branchId}:${dates[0]}:${dates[6]}`;
  }

  function cacheWorkspace(cacheKey, payload) {
    workspaceCache.delete(cacheKey);
    workspaceCache.set(cacheKey, { payload, storedAt: Date.now() });
    while (workspaceCache.size > 4) workspaceCache.delete(workspaceCache.keys().next().value);
  }

  function invalidateCurrentWorkspaceCache() {
    const snapshot = bridge()?.snapshot?.() || {};
    if (snapshot.branchId) workspaceCache.delete(workspaceCacheKey(snapshot.branchId));
  }

  function dateLabel(value, includeYear = false) {
    const date = new Date(`${value}T12:00:00`);
    return `${includeYear ? `${date.getFullYear()}년 ` : ""}${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  function timeMinutes(value = "00:00") {
    const [hours, minutes] = String(value).slice(0, 5).split(":").map(Number);
    return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  }

  function minutesTime(value) {
    const minutes = Math.max(0, Math.min(24 * 60 - 1, Number(value) || 0));
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  function makeTimes(start, end) {
    const result = [];
    for (let minute = timeMinutes(start); minute < timeMinutes(end); minute += 10) result.push(minutesTime(minute));
    return result;
  }

  function operationKey(prefix) {
    const suffix = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function setStatus(message, tone = "", { retry = false } = {}) {
    const target = $("#scheduleV2Status");
    if (!target) return;
    const text = $("#scheduleV2StatusText") || target;
    text.textContent = message;
    target.dataset.tone = tone;
    const retryButton = $("#scheduleV2RefreshAfterSaveButton");
    if (retryButton) retryButton.hidden = !retry;
  }

  function workspaceFocusToken(element = document.activeElement) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.id) return { type: "id", value: element.id };
    const lesson = element.closest?.("[data-v2-lesson-id]");
    if (lesson?.dataset.v2LessonId) return { type: "lesson", value: lesson.dataset.v2LessonId };
    return null;
  }

  function captureWorkspaceViewState({ focusLessonId = "" } = {}) {
    const scrollContainers = [
      ...document.querySelectorAll("#scheduleV2Grid .schedule-v2-week-scroll, #scheduleV2Grid .schedule-v2-period-scroll"),
    ].map((element, index) => ({ index, left: element.scrollLeft, top: element.scrollTop }));
    return {
      weekStart: localDateKey(state.weekStart),
      selectedDate: state.selectedDate,
      pageScrollY: state.editorOpen ? state.editorScrollY : Math.max(0, window.scrollY || 0),
      search: String($("#scheduleV2LessonSearch")?.value || ""),
      feedbackOnly: state.feedbackOnly,
      focus: focusLessonId ? { type: "lesson", value: String(focusLessonId) } : workspaceFocusToken(),
      scrollContainers,
    };
  }

  function restoreWorkspaceViewState(snapshot) {
    if (!snapshot) return;
    state.weekStart = mondayOf(snapshot.weekStart || state.weekStart);
    state.selectedDate = snapshot.selectedDate || state.selectedDate;
    const searchInput = $("#scheduleV2LessonSearch");
    if (searchInput) searchInput.value = snapshot.search || "";
    state.feedbackOnly = snapshot.feedbackOnly === true;
    syncFeedbackFilterButton();
    const restore = () => {
      const containers = document.querySelectorAll("#scheduleV2Grid .schedule-v2-week-scroll, #scheduleV2Grid .schedule-v2-period-scroll");
      (snapshot.scrollContainers || []).forEach((item) => {
        const target = containers[item.index];
        if (!target) return;
        target.scrollLeft = item.left;
        target.scrollTop = item.top;
      });
      window.scrollTo({ top: snapshot.pageScrollY || 0, left: 0, behavior: "auto" });
      const focusTarget = snapshot.focus?.type === "lesson"
        ? document.querySelector(`[data-v2-lesson-id="${CSS.escape(String(snapshot.focus.value || ""))}"]`)
        : snapshot.focus?.type === "id"
          ? document.getElementById(snapshot.focus.value)
          : null;
      focusTarget?.focus?.({ preventScroll: true });
    };
    restore();
    window.requestAnimationFrame(restore);
  }

  function renderWorkspacePreservingView(snapshot = captureWorkspaceViewState()) {
    renderWorkspace();
    restoreWorkspaceViewState(snapshot);
  }

  function setEditorMessage(message = "", tone = "error") {
    const target = $("#scheduleV2EditorMessage");
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function scheduleIntegrityIssueLabel(code = "") {
    return {
      active_regular_ticket_without_future_lessons: "미래 정규수업 없음",
      future_lesson_participant_ticket_mismatch: "수업·회원권 연결 불일치",
      ticket_coach_missing: "담당 코치 없음",
    }[code] || "연결 확인 필요";
  }

  function scheduleIntegrityRepairLabel(result, issueCodes = []) {
    if (!issueCodes.includes("active_regular_ticket_without_future_lessons")) {
      return issueCodes.includes("ticket_coach_missing") ? "담당 코치를 먼저 선택하세요" : "수동 확인 필요";
    }
    if (!result) return "시작일·잔여횟수·정규시간을 확인하세요";
    const created = Number(result.createdCount) || 0;
    const remaining = Number(result.remainingUnassignedUnits) || 0;
    const conflicts = Number(result.conflictCount) || 0;
    const reason = String(result.reason || "");
    if (created > 0 && remaining === 0) return `자동 생성 가능 ${created}회`;
    if (created > 0) return `${created}회 생성 가능 · ${remaining}회는 수동 확인`;
    if (conflicts > 0) return `코치 시간 충돌 ${conflicts}건 · 시간표에서 조정`;
    return {
      regular_schedule_rule_missing: "정규 요일·시간 설정 필요",
      regular_schedule_rule_incomplete: "주 횟수와 정규시간 수가 다름",
      regular_schedule_coach_unavailable: "담당 코치 근무 상태 확인 필요",
      ticket_not_started: "시작 예정 회원권",
      ticket_expired: "만료 회원권 상태 확인 필요",
      ticket_no_remaining_sessions: "잔여횟수 없음",
      coach_time_conflict: "코치 시간 충돌 · 시간표에서 조정",
      closure_only: "휴무일 이후 생성 가능한 날짜 없음",
      no_future_occurrence: "회원권 기간 안에 다음 정규 요일 없음",
    }[reason] || "자동 생성 대상 아님 · 설정 확인 필요";
  }

  function groupedScheduleIntegrityItems(items = []) {
    const grouped = new Map();
    items.forEach((item, index) => {
      const ticketKey = item.ticketId
        ? `ticket:${String(item.ticketId)}`
        : `unlinked:${String(item.userId || "unknown")}:${index}`;
      const entry = grouped.get(ticketKey) || {
        ...item,
        memberUserIds: new Set(),
        issueCodes: new Set(),
        futureLessonCount: 0,
      };
      if (item.userId) entry.memberUserIds.add(item.userId);
      (Array.isArray(item.issueCodes) ? item.issueCodes : []).forEach((code) => entry.issueCodes.add(code));
      entry.futureLessonCount = Math.max(
        Number(entry.futureLessonCount) || 0,
        Number(item.futureLessonCount) || 0,
      );
      grouped.set(ticketKey, entry);
    });
    return [...grouped.values()].map((item) => ({
      ...item,
      memberUserIds: [...item.memberUserIds],
      issueCodes: [...item.issueCodes],
    }));
  }

  function scheduleIntegrityMemberLabel(item = {}) {
    const names = (Array.isArray(item.memberUserIds) ? item.memberUserIds : [item.userId])
      .map((userId) => memberName(userId))
      .filter(Boolean);
    return [...new Set(names)].join(" · ") || "이름 확인 필요";
  }

  async function runScheduleV2MemberIntegrityPreview() {
    const button = $("#scheduleV2IntegrityButton");
    const applyButton = $("#scheduleV2IntegrityApplyButton");
    const summary = $("#scheduleV2IntegritySummary");
    const list = $("#scheduleV2IntegrityList");
    if (!button || !summary || !list || !bridge()?.rpc) return;
    button.disabled = true;
    state.integrityRepairGroups = new Map();
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.textContent = "확정 가능한 일정 생성";
    }
    summary.textContent = "확인 중";
    list.innerHTML = "";
    try {
      const response = await bridge().rpc("tn_admin_schedule_v2_member_integrity_preview", {});
      const result = Array.isArray(response) ? response[0] || {} : response || {};
      const items = Array.isArray(result.items) ? result.items : [];
      const groupedItems = groupedScheduleIntegrityItems(items);
      const affectedMembers = Number(result.affectedMemberCount) || 0;
      const affectedTickets = Number(result.affectedTicketCount) || 0;
      const reconcileByTicket = new Map();
      const missingByBranch = new Map();
      items.forEach((item) => {
        const codes = Array.isArray(item.issueCodes) ? item.issueCodes : [];
        if (!codes.includes("active_regular_ticket_without_future_lessons") || !item.branchId || !item.ticketId) return;
        const ticketIds = missingByBranch.get(item.branchId) || new Set();
        ticketIds.add(item.ticketId);
        missingByBranch.set(item.branchId, ticketIds);
      });
      await Promise.all([...missingByBranch.entries()].map(async ([branchId, ticketIds]) => {
        try {
          const preview = await bridge().rpc("tn_admin_reconcile_future_regular_schedules", {
            target_branch_id: branchId,
            target_ticket_ids: [...ticketIds],
            target_operation_key: operationKey("integrity-preview"),
            target_dry_run: true,
          });
          const rows = Array.isArray(preview?.results) ? preview.results : [];
          rows.forEach((row) => reconcileByTicket.set(row.ticketId, row));
        } catch (error) {
          console.warn("Schedule V2 integrity reconciliation preview failed", error);
        }
      }));
      const autoRepairable = [...reconcileByTicket.values()].filter((row) => Number(row.createdCount) > 0).length;
      reconcileByTicket.forEach((row, ticketId) => {
        const created = Number(row.createdCount) || 0;
        const remaining = Number(row.remainingUnassignedUnits) || 0;
        const conflicts = Number(row.conflictCount) || 0;
        const item = items.find((candidate) => String(candidate.ticketId) === String(ticketId));
        if (!item?.branchId || created < 1 || remaining > 0 || conflicts > 0) return;
        const ticketIds = state.integrityRepairGroups.get(item.branchId) || new Set();
        ticketIds.add(ticketId);
        state.integrityRepairGroups.set(item.branchId, ticketIds);
      });
      const repairableTicketCount = [...state.integrityRepairGroups.values()]
        .reduce((total, ticketIds) => total + ticketIds.size, 0);
      if (applyButton) {
        applyButton.disabled = repairableTicketCount === 0;
        applyButton.textContent = repairableTicketCount
          ? `확정 가능한 ${repairableTicketCount}권 일정 생성`
          : "확정 가능한 일정 없음";
      }
      summary.textContent = affectedTickets
        ? `확인 필요 ${affectedMembers}명 · ${affectedTickets}권 · 자동 생성 가능 ${autoRepairable}권`
        : "문제 없음";
      list.innerHTML = groupedItems.length
        ? groupedItems.map((item) => {
          const codes = Array.isArray(item.issueCodes) ? item.issueCodes : [];
          const labels = codes
            .map(scheduleIntegrityIssueLabel)
            .join(" · ");
          const repairLabel = scheduleIntegrityRepairLabel(reconcileByTicket.get(item.ticketId), codes);
          return `<div><strong>${escapeHtml(scheduleIntegrityMemberLabel(item))}</strong><span>${escapeHtml(labels)}</span><small>${escapeHtml(repairLabel)} · 미래 수업 ${Number(item.futureLessonCount) || 0}</small></div>`;
        }).join("")
        : '<p class="schedule-v2-integrity-empty">현재 확인된 연결 오류가 없습니다.</p>';
    } catch (error) {
      state.integrityRepairGroups = new Map();
      if (applyButton) applyButton.disabled = true;
      const text = `${error?.payload?.message || ""} ${error?.message || ""}`;
      summary.textContent = "점검 실패";
      list.innerHTML = `<p class="schedule-v2-integrity-empty">${escapeHtml(/admin_required/i.test(text) ? "관리자 권한을 확인해 주세요." : "서버 점검 기능을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")}</p>`;
    } finally {
      button.disabled = false;
    }
  }

  async function applyScheduleV2IntegrityRepairs() {
    const button = $("#scheduleV2IntegrityApplyButton");
    const groups = [...state.integrityRepairGroups.entries()];
    const ticketCount = groups.reduce((total, [, ticketIds]) => total + ticketIds.size, 0);
    if (!button || !ticketCount || !bridge()?.rpc || !requireWritableServer("status")) return;
    if (!window.confirm(`충돌 없이 복구 가능한 회원권 ${ticketCount}개의 미래 고정수업을 생성할까요?`)) return;
    button.disabled = true;
    setStatus("미래 고정수업을 복구하는 중입니다.");
    try {
      for (const [branchId, ticketIds] of groups) {
        await bridge().rpc("tn_admin_reconcile_future_regular_schedules", {
          target_branch_id: branchId,
          target_ticket_ids: [...ticketIds],
          target_operation_key: operationKey("integrity-apply"),
          target_dry_run: false,
        });
      }
      state.integrityRepairGroups = new Map();
      const refreshed = await refreshWorkspaceAfterWrite(bridge());
      if (refreshed) {
        setStatus(`미래 고정수업 복구 완료 · 회원권 ${ticketCount}개`, "success");
        await runScheduleV2MemberIntegrityPreview();
      }
      void bridge()?.refresh?.();
    } catch (error) {
      setStatus(errorMessage(error), "error");
      button.disabled = false;
    }
  }

  async function repairExpectedRegularSlot(slot) {
    if (!slot?.ticketId || !requireWritableServer("status")) return;
    const branchId = slot.branchId || state.payload?.branchId || state.payload?.branch?.id || ticketById(slot.ticketId)?.branchId;
    if (!branchId) {
      setStatus("지점 정보를 다시 불러온 뒤 고정수업을 복구해 주세요.", "error");
      return;
    }
    const memberLabel = lessonParticipantLabel(slot);
    const exactRuleId = slot.ruleId || slot.rule_id || "";
    const exactLessonDate = slot.lessonDate || slot.lesson_date || "";
    if (exactRuleId && exactLessonDate) {
      const exactStartTime = String(slot.startTime || slot.start_time || "").slice(0, 5);
      const shouldRestore = window.confirm(
        `${memberLabel} ${dateLabel(exactLessonDate)} ${exactStartTime} 누락 고정수업입니다.\n\n`
        + "[확인] 이 회차 복구\n[취소] 잘못된 고정시간 정리 선택",
      );
      if (!shouldRestore) {
        const shouldEndWrongTime = window.confirm(
          `${memberLabel} ${dateLabel(exactLessonDate)} ${exactStartTime} 고정시간을 종료할까요?\n\n`
          + "이 시간의 미래 수업만 삭제하며, 다른 고정시간과 과거 수업 기록은 보존합니다.",
        );
        if (!shouldEndWrongTime) {
          setStatus("고정수업 복구·정리를 취소했습니다.");
          return;
        }
        setStatus(`${memberLabel} 잘못된 고정시간을 정리하는 중입니다.`);
        try {
          const result = await bridge().rpc("tn_admin_end_expected_regular_slot", {
            target_ticket_id: slot.ticketId,
            target_rule_id: exactRuleId,
            target_lesson_date: exactLessonDate,
            target_reason: `잘못 생성된 미래 고정시간 종료 (${dateLabel(exactLessonDate)} ${exactStartTime})`,
            target_operation_key: operationKey("expected-slot-end"),
          });
          const refreshed = await refreshWorkspaceAfterWrite(bridge());
          if (refreshed) {
            const deletedFutureCount = Number(result?.deletedFutureCount ?? result?.deleted_future_count) || 0;
            setStatus(`${memberLabel} ${exactStartTime} 잘못된 고정시간을 종료했습니다. 미래 수업 ${deletedFutureCount}건 정리`, "success");
          }
          void bridge()?.refresh?.();
        } catch (error) {
          setStatus(errorMessage(error), "error");
        }
        return;
      }
      setStatus(`${memberLabel} 고정수업 1건을 복구하는 중입니다.`);
      try {
        await bridge().rpc("tn_admin_materialize_expected_regular_slot", {
          target_ticket_id: slot.ticketId,
          target_rule_id: exactRuleId,
          target_lesson_date: exactLessonDate,
          target_operation_key: operationKey("expected-slot-exact-apply"),
        });
        const refreshed = await refreshWorkspaceAfterWrite(bridge());
        if (refreshed) setStatus(`${memberLabel} ${dateLabel(exactLessonDate)} 고정수업을 복구했습니다.`, "success");
        void bridge()?.refresh?.();
      } catch (error) {
        setStatus(errorMessage(error), "error");
      }
      return;
    }
    setStatus(`${memberLabel} 현재 회원권 일정을 확인하는 중입니다.`);
    try {
      const preview = await bridge().rpc("tn_admin_reconcile_future_regular_schedules", {
        target_branch_id: branchId,
        target_ticket_ids: [slot.ticketId],
        target_operation_key: operationKey("expected-slot-preview"),
        target_dry_run: true,
      });
      const row = (Array.isArray(preview?.results) ? preview.results : [])
        .find((item) => String(item.ticketId || item.ticket_id || "") === String(slot.ticketId)) || {};
      const createdCount = Number(row.createdCount ?? row.created_count) || 0;
      const conflictCount = Number(row.conflictCount ?? row.conflict_count) || 0;
      const remainingCount = Number(row.remainingUnassignedUnits ?? row.remaining_unassigned_units) || 0;
      if (!createdCount || conflictCount || remainingCount) {
        const detail = conflictCount
          ? `겹치는 시간 ${conflictCount}건`
          : remainingCount ? `배정하지 못한 횟수 ${remainingCount}회` : "생성할 일정 없음";
        setStatus(`${memberLabel} 일정은 자동 생성할 수 없습니다. ${detail}을 확인해 주세요.`, "warning");
        return;
      }
      if (!window.confirm(`${memberLabel} 현재 회원권으로 미래 고정수업 ${createdCount}건을 생성할까요?`)) {
        setStatus("일정 생성이 취소됐습니다.");
        return;
      }
      await bridge().rpc("tn_admin_reconcile_future_regular_schedules", {
        target_branch_id: branchId,
        target_ticket_ids: [slot.ticketId],
        target_operation_key: operationKey("expected-slot-apply"),
        target_dry_run: false,
      });
      const refreshed = await refreshWorkspaceAfterWrite(bridge());
      if (refreshed) setStatus(`${memberLabel} 현재 회원권 일정 ${createdCount}건을 생성했습니다.`, "success");
      void bridge()?.refresh?.();
    } catch (error) {
      setStatus(errorMessage(error), "error");
    }
  }

  function missingWorkspaceRpc(error) {
    const text = `${error?.payload?.message || ""} ${error?.message || error || ""}`;
    return /PGRST202|42883|schema cache|could not find (?:the )?function[^\n]*tn_schedule_v2_admin_workspace|tn_schedule_v2_admin_workspace[^\n]*does not exist/i.test(text);
  }

  function markV2Availability(available) {
    const button = $('[data-schedule-engine="v2"]', root);
    if (!button) return;
    button.textContent = available === false ? "V2 확인 필요" : "V2 시간표";
    button.title = available === false
      ? "V2 시간표 서버 연결을 확인한 뒤 다시 불러와 주세요."
      : "V2 레슨시간표";
    button.dataset.serverAvailable = available === false ? "false" : "true";
  }

  function preferredScheduleEngine() {
    return "v2";
  }

  function rememberScheduleEngine() {
    // Schedule V2 is the only operating timetable.
  }

  function requireWritableServer(surface = "editor") {
    if (state.serverReady && bridge()?.rpc) return true;
    const message = "서버 최신값을 확인하지 못해 지금은 읽기만 가능합니다. 새로고침 후 다시 시도해 주세요.";
    if (surface === "status") setStatus(message, "warning");
    else setEditorMessage(message);
    return false;
  }

  function normalizeWorkspacePayload(raw = {}, fallback = {}) {
    const response = Array.isArray(raw) ? raw[0] || {} : raw || {};
    const fallbackMembersById = new Map();
    (fallback.members || []).forEach((member) => {
      [member.id, member.userId, ...(member.userIds || [])]
        .filter(Boolean)
        .forEach((id) => fallbackMembersById.set(String(id), member));
    });
    const responseMembers = (Array.isArray(response.members) ? response.members : []).map((member) => {
      const fallbackMember = fallbackMembersById.get(String(member.id)) || {};
      return {
        ...member,
        phoneLast4: String(member.phoneLast4 || fallbackMember.phoneLast4 || "").replace(/\D/g, "").slice(-4),
        birthYear: member.birthYear || member.birth_year || fallbackMember.birthYear || "",
      };
    });
    const responseMemberIds = new Set(responseMembers.flatMap((member) => [
      member.id,
      member.userId,
      ...(member.userIds || []),
    ].filter(Boolean).map(String)));
    const members = [
      ...responseMembers,
      ...(fallback.members || []).filter((member) => ![
        member.id,
        member.userId,
        ...(member.userIds || []),
      ].filter(Boolean).map(String).some((id) => responseMemberIds.has(id))),
    ];
    const responseLessons = Array.isArray(response.lessons) ? response.lessons : [];
    const responseOneDayIds = new Set(responseLessons.flatMap((lesson) => [
      lesson.oneDayBookingId,
      lesson.one_day_booking_id,
      lesson.oneDayBooking ? lesson.id : "",
    ].filter(Boolean).map(String)));
    const fallbackOneDayIds = new Set(responseOneDayIds);
    const fallbackOneDayLessons = (fallback.lessons || []).filter((lesson) => {
      if (!lesson.oneDayBooking) return false;
      const bookingId = String(lesson.oneDayBookingId || lesson.one_day_booking_id || lesson.id || "");
      if (!bookingId || fallbackOneDayIds.has(bookingId)) return false;
      fallbackOneDayIds.add(bookingId);
      return true;
    });
    return {
      branchId: response.branchId || response.branch_id || fallback.branchId || "",
      branch: response.branch || { id: fallback.branchId || "", name: fallback.branchName || "", openStart: "06:40", openEnd: "22:00" },
      policy: response.policy || {},
      closures: Array.isArray(response.closures) ? response.closures : [],
      operationDays: Array.isArray(response.operationDays) ? response.operationDays : [],
      coaches: Array.isArray(response.coaches) ? response.coaches : [],
      members,
      tickets: Array.isArray(response.tickets) ? response.tickets : [],
      lessons: [...responseLessons, ...fallbackOneDayLessons],
      expectedRegularSlots: Array.isArray(response.expectedRegularSlots) ? response.expectedRegularSlots : [],
      unassigned: Array.isArray(response.unassigned) ? response.unassigned : [],
    };
  }

  function expectedRegularLesson(slot = {}) {
    const participantUserIds = Array.isArray(slot.participantUserIds) ? slot.participantUserIds : [];
    return {
      ...slot,
      expectedRegularSlot: true,
      participants: participantUserIds.map((userId) => ({
        userId,
        ticketId: slot.ticketId,
        name: memberName(userId),
      })),
      memberLabel: participantUserIds.map((userId) => memberName(userId)).filter(Boolean).join(" · ") || "회원 연결 확인",
      status: "reserved",
      scheduleKind: "regular",
    };
  }

  function timetableLessons(payload = state.payload) {
    if (!payload) return [];
    return [
      ...(payload.lessons || []),
      ...(payload.expectedRegularSlots || []).map(expectedRegularLesson),
    ];
  }

  function comparisonParticipantIds(lesson = {}, participantRowsByLesson = new Map()) {
    const directParticipants = Array.isArray(lesson.participants) ? lesson.participants : [];
    const directIds = directParticipants
      .map((participant) => participant.userId || participant.user_id || participant.id)
      .filter(Boolean)
      .map(String);
    const lessonIds = Array.isArray(lesson.participantUserIds)
      ? lesson.participantUserIds.filter(Boolean).map(String)
      : [];
    const rowIds = (participantRowsByLesson.get(String(lesson.id || "")) || [])
      .map((row) => row.userId || row.user_id)
      .filter(Boolean)
      .map(String);
    const ids = [...new Set([...directIds, ...lessonIds, ...rowIds])].sort();
    if (ids.length) return ids;
    const names = directParticipants
      .map((participant) => participant.name)
      .filter(Boolean)
      .map((name) => String(name).trim().toLowerCase());
    const fallbackName = String(lesson.memberLabel || lesson.member || "").trim().toLowerCase();
    return [...new Set(names.length ? names : [fallbackName].filter(Boolean))].sort();
  }

  function comparisonLesson(lesson = {}, participantRowsByLesson = new Map()) {
    const date = String(lesson.lessonDate || lesson.lesson_date || "").slice(0, 10);
    const startTime = String(lesson.startTime || lesson.start_time || lesson.time || "").slice(0, 5);
    const coachRoleId = String(lesson.coachRoleId || lesson.coach_role_id || "");
    const durationMinutes = Number(lesson.durationMinutes || lesson.duration_minutes) || 20;
    const status = String(lesson.status || lesson.serverStatus || "scheduled");
    const scheduleKind = String(lesson.scheduleKind || lesson.schedule_v2_kind || lesson.lessonSource || lesson.lesson_source || "regular");
    const participantIds = comparisonParticipantIds(lesson, participantRowsByLesson);
    return {
      id: String(lesson.id || ""),
      date,
      startTime,
      coachRoleId,
      durationMinutes,
      status,
      scheduleKind,
      participantIds,
      slotKey: [date, startTime, coachRoleId, durationMinutes].join("|"),
      signature: [status, scheduleKind, participantIds.join(",")].join("|"),
    };
  }

  function comparisonIsHistory(lesson = {}) {
    return ["cancelled", "canceled"].includes(String(lesson.status || "").toLowerCase());
  }

  function compareScheduleWeek(snapshot = {}, payload = {}, dates = weekDates()) {
    const dateSet = new Set((dates || []).map((date) => String(date).slice(0, 10)));
    const participantRowsByLesson = new Map();
    (snapshot.participantRows || []).forEach((row) => {
      const lessonId = String(row.lessonId || row.lesson_id || "");
      const rows = participantRowsByLesson.get(lessonId) || [];
      rows.push(row);
      participantRowsByLesson.set(lessonId, rows);
    });
    const withinWeek = (lesson) => dateSet.has(String(lesson.lessonDate || lesson.lesson_date || "").slice(0, 10));
    const legacyAllLessons = (snapshot.lessons || []).filter(withinWeek).map((lesson) => comparisonLesson(lesson, participantRowsByLesson));
    const v2AllLessons = (payload.lessons || []).filter(withinWeek).map((lesson) => comparisonLesson(lesson));
    const legacyHistory = legacyAllLessons.filter(comparisonIsHistory);
    const v2History = v2AllLessons.filter(comparisonIsHistory);
    const legacyLessons = legacyAllLessons.filter((lesson) => !comparisonIsHistory(lesson));
    const v2Lessons = v2AllLessons.filter((lesson) => !comparisonIsHistory(lesson));
    const legacyBySlot = new Map();
    const v2BySlot = new Map();
    legacyLessons.forEach((lesson) => legacyBySlot.set(lesson.slotKey, [...(legacyBySlot.get(lesson.slotKey) || []), lesson]));
    v2Lessons.forEach((lesson) => v2BySlot.set(lesson.slotKey, [...(v2BySlot.get(lesson.slotKey) || []), lesson]));
    const result = {
      legacyTotal: legacyLessons.length,
      v2Total: v2Lessons.length,
      legacyHistoryTotal: legacyHistory.length,
      v2HistoryTotal: v2History.length,
      matching: 0,
      changed: [],
      legacyOnly: [],
      v2Only: [],
    };
    const slotKeys = [...new Set([...legacyBySlot.keys(), ...v2BySlot.keys()])].sort();
    slotKeys.forEach((slotKey) => {
      const legacy = [...(legacyBySlot.get(slotKey) || [])];
      const v2 = [...(v2BySlot.get(slotKey) || [])];
      for (let index = legacy.length - 1; index >= 0; index -= 1) {
        const matchIndex = v2.findIndex((candidate) => candidate.signature === legacy[index].signature);
        if (matchIndex < 0) continue;
        legacy.splice(index, 1);
        v2.splice(matchIndex, 1);
        result.matching += 1;
      }
      while (legacy.length && v2.length) result.changed.push({ slotKey, legacy: legacy.shift(), v2: v2.shift() });
      result.legacyOnly.push(...legacy);
      result.v2Only.push(...v2);
    });
    result.differenceCount = result.changed.length + result.legacyOnly.length + result.v2Only.length;
    result.isExact = result.differenceCount === 0 && result.legacyTotal === result.v2Total;
    return result;
  }

  function comparisonItemLabel(item = {}) {
    return `${item.date} ${item.startTime} · ${item.durationMinutes}분`;
  }

  function comparisonBaselineStatus(snapshot = {}) {
    if (snapshot.liveLoading) {
      return {
        ready: false,
        summary: "기존 시간표 불러오는 중",
        description: "기존 시간표를 모두 불러온 뒤 같은 주를 비교합니다.",
      };
    }
    if (!snapshot.accessReady || snapshot.liveLoaded !== true || !Array.isArray(snapshot.lessons)) {
      return {
        ready: false,
        summary: "기존 자료 확인 필요",
        description: "관리자 로그인과 기존 시간표 로딩을 확인한 뒤 다시 비교해 주세요.",
      };
    }
    return { ready: true, summary: "", description: "" };
  }

  function renderParallelComparison() {
    const panel = $("#scheduleV2ParallelCheck");
    if (!panel) return;
    panel.hidden = !parallelComparisonMode;
    if (!parallelComparisonMode || !state.payload) return;
    const snapshot = bridge()?.snapshot?.() || {};
    const summary = $("#scheduleV2ParallelSummary");
    const description = $("#scheduleV2ParallelDescription");
    const differences = $("#scheduleV2ParallelDifferences");
    const dates = weekDates();
    const baseline = comparisonBaselineStatus(snapshot);
    if (!baseline.ready) {
      panel.dataset.tone = snapshot.liveLoading ? "" : "warning";
      summary.textContent = baseline.summary;
      description.textContent = baseline.description;
      differences.innerHTML = "";
      return;
    }
    const legacyWeekStart = String(snapshot.week?.startDate || snapshot.week?.start_date || "").slice(0, 10);
    if (legacyWeekStart && legacyWeekStart !== dates[0]) {
      panel.dataset.tone = "warning";
      summary.textContent = "같은 주 선택 필요";
      description.textContent = `기존 화면에서 ${dateLabel(dates[0])} 시작 주를 먼저 열어 주세요.`;
      differences.innerHTML = "";
      return;
    }
    const comparison = compareScheduleWeek(snapshot, state.payload, dates);
    panel.dataset.tone = comparison.isExact ? "success" : "warning";
    summary.textContent = comparison.isExact
      ? `${comparison.matching}/${comparison.v2Total} 일치`
      : `${comparison.differenceCount}건 확인 필요`;
    description.textContent = comparison.isExact
      ? `활성 수업 ${comparison.matching}/${comparison.v2Total} 일치 · 취소·불참 이력 기존 ${comparison.legacyHistoryTotal}건 / 새 시간표 ${comparison.v2HistoryTotal}건`
      : `활성 수업 기존 ${comparison.legacyTotal}건 · 새 시간표 ${comparison.v2Total}건 · 동일 ${comparison.matching}건 · 이력 기존 ${comparison.legacyHistoryTotal}건 / 새 시간표 ${comparison.v2HistoryTotal}건`;
    const rows = [
      ...comparison.changed.map((item) => ({ type: "내용 다름", item: item.v2 })),
      ...comparison.legacyOnly.map((item) => ({ type: "기존에만 있음", item })),
      ...comparison.v2Only.map((item) => ({ type: "새 시간표에만 있음", item })),
    ];
    differences.innerHTML = rows.length
      ? rows.slice(0, 20).map(({ type, item }) => `<div><strong>${escapeHtml(type)}</strong><span>${escapeHtml(comparisonItemLabel(item))}</span></div>`).join("")
      : '<div><strong>차이 없음</strong><span>같은 주의 수업이 모두 일치합니다.</span></div>';
  }

  window.TennisNoteScheduleV2Comparison = {
    compare: compareScheduleWeek,
    baselineStatus: comparisonBaselineStatus,
  };

  function demoWorkspacePayload() {
    const lessonDate = state.selectedDate;
    const dayOfWeek = new Date(`${lessonDate}T12:00:00`).getDay();
    const availability = (startTime, endTime, targetDay = dayOfWeek) => ({
      dayOfWeek: targetDay,
      startTime,
      endTime,
      type: "available",
    });
    const weeklyAvailability = (startTime, endTime) => [0, 1, 2, 3, 4, 5, 6]
      .map((targetDay) => availability(startTime, endTime, targetDay));
    return normalizeWorkspacePayload({
      branchId: "demo-branch",
      branch: {
        id: "demo-branch",
        name: "테니스클럽하우스 데모",
        openStart: "06:40",
        openEnd: "22:00",
      },
      policy: {
        coach_single_add_mode: "approval",
        coach_regular_change_mode: "approval",
        allow_cross_coach_member_edit: false,
        allow_coach_locked_time_override: true,
        allow_coach_holiday_override: false,
        makeup_anchor_gap_minutes: 40,
      },
      coaches: [
        {
          roleId: "demo-coach-main",
          name: "노형규 코치",
          color: "#08795a",
          availability: [...weeklyAvailability("06:40", "13:00"), ...weeklyAvailability("17:00", "22:00")],
        },
        {
          roleId: "demo-coach-morning",
          name: "황유미 코치",
          color: "#b97800",
          availability: weeklyAvailability("08:00", "13:00"),
        },
        {
          roleId: "demo-coach-evening",
          name: "강정훈 코치",
          color: "#2f6fc4",
          availability: weeklyAvailability("17:00", "22:00"),
        },
      ],
      members: [
        { id: "demo-member-a", name: "김테니스" },
        { id: "demo-member-b", name: "이노트" },
        { id: "demo-member-c", name: "박스매시" },
        { id: "demo-member-d", name: "최포핸드" },
      ],
      tickets: [
        {
          id: "demo-ticket-a",
          ownerUserId: "demo-member-a",
          participantUserIds: ["demo-member-a"],
          productName: "개인 평일 1회(20분)",
          productKind: "regular",
          lessonMinutes: 20,
          groupSize: 1,
          totalSessions: 4,
          remainingSessions: 3,
          startsOn: lessonDate,
          expiresOn: localDateKey(addDays(lessonDate, 35)),
        },
        {
          id: "demo-ticket-group",
          ownerUserId: "demo-member-b",
          participantUserIds: ["demo-member-b", "demo-member-c"],
          productName: "그룹 평일 1회(20분)",
          productKind: "regular",
          lessonMinutes: 20,
          groupSize: 2,
          totalSessions: 4,
          remainingSessions: 4,
          startsOn: lessonDate,
          expiresOn: localDateKey(addDays(lessonDate, 35)),
        },
        {
          id: "demo-ticket-coupon",
          ownerUserId: "demo-member-d",
          participantUserIds: ["demo-member-d"],
          productName: "쿠폰 5회(30분)",
          productKind: "coupon",
          lessonMinutes: 30,
          groupSize: 1,
          totalSessions: 5,
          remainingSessions: 4,
          startsOn: lessonDate,
          expiresOn: localDateKey(addDays(lessonDate, 56)),
        },
      ],
      lessons: [
        {
          id: "demo-lesson-regular",
          revision: 2,
          coachRoleId: "demo-coach-main",
          lessonDate,
          startTime: "07:20",
          durationMinutes: 20,
          status: "scheduled",
          scheduleKind: "regular",
          participants: [{ userId: "demo-member-a", ticketId: "demo-ticket-a", name: "김테니스" }],
        },
        {
          id: "demo-lesson-group",
          revision: 4,
          coachRoleId: "demo-coach-morning",
          lessonDate,
          startTime: "08:20",
          durationMinutes: 20,
          status: "scheduled",
          scheduleKind: "regular",
          participants: [
            { userId: "demo-member-b", ticketId: "demo-ticket-group", name: "이노트" },
            { userId: "demo-member-c", ticketId: "demo-ticket-group", name: "박스매시" },
          ],
        },
        {
          id: "demo-lesson-absence",
          revision: 3,
          coachRoleId: "demo-coach-main",
          lessonDate,
          startTime: "09:00",
          durationMinutes: 20,
          status: "absent",
          scheduleKind: "regular",
          memberLabel: "김테니스 · 차감 없음",
          participants: [{ userId: "demo-member-a", ticketId: "demo-ticket-a", name: "김테니스" }],
        },
        {
          id: "demo-lesson-coupon",
          revision: 1,
          coachRoleId: "demo-coach-evening",
          lessonDate,
          startTime: "18:40",
          durationMinutes: 30,
          status: "scheduled",
          scheduleKind: "coupon",
          substitute: {
            assignmentId: "demo-substitute",
            coachRoleId: "demo-coach-main",
            coachName: "노형규 코치",
            settlementMode: "none",
            hourlyAmount: null,
          },
          participants: [{ userId: "demo-member-d", ticketId: "demo-ticket-coupon", name: "최포핸드" }],
        },
      ],
      unassigned: [
        {
          ticket_id: "demo-ticket-group",
          member_name: "이노트 · 박스매시",
          product_name: "그룹 평일 1회(20분)",
          missing_sessions: 3,
          assignment_status: "partial",
        },
      ],
    });
  }

  function fallbackPayload(snapshot = {}) {
    const memberById = new Map((snapshot.members || []).flatMap((member) => {
      const ids = [...new Set([member.userId, ...(member.userIds || [])].filter(Boolean))];
      return ids.map((id) => [String(id), { id, name: member.name }]);
    }));
    const participantRowsByLesson = new Map();
    (snapshot.participantRows || []).forEach((row) => {
      const rows = participantRowsByLesson.get(String(row.lessonId)) || [];
      rows.push({
        userId: row.userId,
        ticketId: row.ticketId,
        name: memberById.get(String(row.userId))?.name || "회원 확인 필요",
      });
      participantRowsByLesson.set(String(row.lessonId), rows);
    });
    const lessons = (snapshot.lessons || []).map((lesson) => ({
      ...lesson,
      participants: participantRowsByLesson.get(String(lesson.id)) || [],
    }));
    const coaches = (snapshot.coaches || []).map((coach) => ({
      roleId: coach.roleId,
      name: coach.name,
      color: coach.color,
      availability: [
        ...(coach.workBlocks || []).flatMap((block) => (block.days || []).map((day) => ({
          dayOfWeek: dayLabels.indexOf(day),
          startTime: block.start,
          endTime: block.end,
          type: "available",
          note: block.label || "근무",
        }))),
        ...(coach.breakBlocks || []).flatMap((block) => (block.days || []).map((day) => ({
          dayOfWeek: dayLabels.indexOf(day),
          startTime: block.start,
          endTime: block.end,
          type: "blocked",
          note: block.label || "브레이크",
        }))),
      ],
    }));
    const futureReservedByTicket = new Map();
    lessons.filter((lesson) => (
      lesson.lessonDate >= localDateKey(new Date())
      && ["scheduled", "pending_change"].includes(lesson.status)
      && lesson.scheduleKind === "regular"
    )).forEach((lesson) => {
      (lesson.participants || []).forEach((participant) => {
        const ticket = (snapshot.tickets || []).find((item) => String(item.id) === String(participant.ticketId));
        const units = Math.max(1, Math.ceil(Number(lesson.durationMinutes || 20) / Math.max(1, Number(ticket?.lessonMinutes || 20))));
        futureReservedByTicket.set(String(participant.ticketId), (futureReservedByTicket.get(String(participant.ticketId)) || 0) + units);
      });
    });
    const unassigned = (snapshot.tickets || [])
      .filter((ticket) => ticket.productKind === "regular" && ticket.status === "active" && Number(ticket.remainingSessions) > 0)
      .map((ticket) => {
        const reserved = futureReservedByTicket.get(String(ticket.id)) || 0;
        return {
          ticket_id: ticket.id,
          member_user_id: ticket.ownerUserId,
          member_name: memberById.get(String(ticket.ownerUserId))?.name || "회원 확인 필요",
          coach_role_id: ticket.coachRoleId,
          product_name: ticket.productName,
          remaining_sessions: Number(ticket.remainingSessions) || 0,
          future_reserved_sessions: reserved,
          missing_sessions: Math.max(0, Number(ticket.remainingSessions) - reserved),
          assignment_status: reserved ? "partial" : "unassigned",
        };
      })
      .filter((item) => item.missing_sessions > 0);
    return normalizeWorkspacePayload({
      branchId: snapshot.branchId,
      branch: { id: snapshot.branchId, name: snapshot.branchName, openStart: "06:40", openEnd: "22:00" },
      coaches,
      members: [...memberById.values()],
      tickets: snapshot.tickets || [],
      lessons,
      unassigned,
    }, snapshot);
  }

  async function loadWorkspace({ quiet = false, force = false, absorbRevisionRefresh = false, preserveViewState = null } = {}) {
    if (state.engine !== "v2") return false;
    if (localDemoMode) {
      state.payload = demoWorkspacePayload();
      state.serverReady = false;
      markV2Availability(true);
      setStatus("로컬 데모 · 운영 데이터는 저장하지 않습니다.", "success");
      renderWorkspace();
      return true;
    }
    const api = bridge();
    const snapshot = api?.snapshot?.() || {};
    if (!snapshot.accessReady || !snapshot.branchId) {
      setStatus(snapshot.liveLoading ? "로그인과 운영 자료를 확인하는 중입니다." : "관리자 로그인 후 운영 지점을 선택해 주세요.", "warning");
      if (!state.payload) renderEmpty("로그인과 지점 확인 후 새 시간표가 표시됩니다.");
      return false;
    }
    const dates = weekDates();
    const cacheKey = workspaceCacheKey(snapshot.branchId, dates);
    if (state.loading && state.activeLoadKey === cacheKey && !force) return false;
    const sequence = ++state.loadSequence;
    state.activeLoadKey = cacheKey;
    const cached = !force ? workspaceCache.get(cacheKey) : null;
    if (!state.payload && cached && Date.now() - cached.storedAt <= workspaceCacheTtlMs) {
      state.payload = cached.payload;
      state.serverReady = true;
      setStatus("최근 시간표를 먼저 표시했습니다. 서버 최신값을 확인하는 중입니다.", "success");
      renderWorkspace();
      quiet = true;
    }
    state.loading = true;
    let loadSucceeded = false;
    if (!quiet) {
      setStatus("선택한 주의 시간표를 불러오는 중입니다.");
      $("#scheduleV2Grid").innerHTML = '<div class="schedule-v2-loading">시간표 불러오는 중</div>';
    }
    try {
      const [response, operationDays] = await Promise.all([
        api.rpc?.("tn_schedule_v2_admin_workspace", {
          target_branch_id: snapshot.branchId,
          target_from: dates[0],
          target_to: dates[6],
        }),
        api.rpc?.("tn_schedule_v2_operation_days_between", {
          target_branch_id: snapshot.branchId,
          target_from: dates[0],
          target_to: dates[6],
        }).catch(() => []),
      ]);
      if (sequence !== state.loadSequence) return false;
      const optimisticOneDayLessons = (state.payload?.lessons || []).filter((lesson) => lesson.oneDayBooking);
      const fallbackSnapshot = optimisticOneDayLessons.length
        ? { ...snapshot, lessons: [...(snapshot.lessons || []), ...optimisticOneDayLessons] }
        : snapshot;
      state.payload = normalizeWorkspacePayload(response, fallbackSnapshot);
      state.payload.operationDays = Array.isArray(operationDays) ? operationDays : [];
      cacheWorkspace(cacheKey, state.payload);
      state.serverReady = true;
      if (absorbRevisionRefresh && state.revisionWatcher?.check) {
        state.absorbingRevisionRefresh = true;
        try {
          await state.revisionWatcher.check();
        } finally {
          state.absorbingRevisionRefresh = false;
        }
      } else {
        void state.revisionWatcher?.check?.();
      }
      markV2Availability(true);
      setStatus(`서버 저장 연결 · ${dateLabel(dates[0])}~${dateLabel(dates[6])}`, "success");
      loadSucceeded = true;
    } catch (error) {
      if (sequence !== state.loadSequence) return false;
      state.serverReady = false;
      if (missingWorkspaceRpc(error)) {
        state.payload = null;
        markV2Availability(false);
        setStatus("시간표 서버 연결을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.", "error");
        renderEmpty("시간표를 불러오지 못했습니다. 연결을 확인하고 다시 불러와 주세요.");
        console.warn("[Tennis Note] Schedule V2 workspace is unavailable.");
        return false;
      }
      if (!state.payload) renderEmpty("시간표를 불러오지 못했습니다. 연결을 확인하고 다시 불러와 주세요.");
      setStatus(cached
        ? "서버 연결을 확인하지 못해 최근 시간표를 표시합니다. 저장 전 새로고침해 주세요."
        : "시간표 서버 연결을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.", "warning");
      console.warn("[Tennis Note] Schedule V2 workspace unavailable", error?.message || "workspace_unavailable");
    } finally {
      if (sequence === state.loadSequence) {
        state.loading = false;
        state.activeLoadKey = "";
      }
    }
    if (preserveViewState) renderWorkspacePreservingView(preserveViewState);
    else renderWorkspace();
    return loadSucceeded;
  }

  function renderEmpty(message) {
    $("#scheduleV2Grid").innerHTML = `<div class="schedule-v2-empty">${escapeHtml(message)}</div>`;
    $("#scheduleV2QueueList").innerHTML = "";
    $("#scheduleV2QueueCount").textContent = "0명";
  }

  function renderDayTabs() {
    const dates = weekDates();
    $("#scheduleV2DayTabs").innerHTML = dates.map((date) => {
      const value = new Date(`${date}T12:00:00`);
      const active = date === state.selectedDate;
      return `<button type="button" role="tab" data-v2-date="${date}" class="${active ? "is-active" : ""}" aria-selected="${active}"><strong>${dayLabels[value.getDay()]}</strong><span>${value.getMonth() + 1}/${value.getDate()}</span></button>`;
    }).join("");
    $("#scheduleV2RangeLabel").textContent = `${dateLabel(dates[0], true)}~${dateLabel(dates[6])}`;
  }

  function availabilityRows(coach) {
    return Array.isArray(coach.availability) ? coach.availability : [];
  }

  function intervalContains(row, minute) {
    return minute >= timeMinutes(row.startTime || row.start_time) && minute < timeMinutes(row.endTime || row.end_time);
  }

  function closuresForDate(date) {
    return (state.payload?.closures || []).filter((closure) => (
      String(closure.date || closure.closure_date || "") === date
    ));
  }

  function operationDaysForDate(date) {
    return (state.payload?.operationDays || []).filter((operation) => (
      String(operation.date || operation.operation_date || "") === date
    ));
  }

  function operationModeLabel(mode) {
    return ({ closed: "휴무", normal: "정상 운영", shortened: "단축 운영" })[String(mode || "")] || "운영 안내";
  }

  function selectedDateClosures() {
    return closuresForDate(state.selectedDate);
  }

  function closureAtDate(date, time, durationMinutes = 10) {
    const slotStart = timeMinutes(time);
    const slotEnd = slotStart + Number(durationMinutes || 10);
    return closuresForDate(date).find((closure) => {
      const allDay = closure.allDay ?? closure.all_day;
      if (allDay === true) return true;
      const closureStart = timeMinutes(closure.startTime || closure.start_time);
      const closureEnd = timeMinutes(closure.endTime || closure.end_time);
      return slotStart < closureEnd && slotEnd > closureStart;
    }) || null;
  }

  function closureAt(time, durationMinutes = 10) {
    return closureAtDate(state.selectedDate, time, durationMinutes);
  }

  function coachBaseAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability) {
    const rows = availabilityRows(coach).filter((row) => Number(row.dayOfWeek ?? row.day_of_week) === dayOfWeek);
    const available = rows.filter((row) => (row.type || row.availability_type) === "available");
    return available.length ? available.some((row) => intervalContains(row, minute)) : !hasAnyAvailability;
  }

  function coachAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability) {
    const rows = availabilityRows(coach).filter((row) => Number(row.dayOfWeek ?? row.day_of_week) === dayOfWeek);
    const blocked = rows.filter((row) => (row.type || row.availability_type) === "blocked");
    return coachBaseAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability)
      && !blocked.some((row) => intervalContains(row, minute));
  }

  function lessonOverlaps(lesson, time) {
    const start = timeMinutes(lesson.startTime);
    const end = start + Number(lesson.durationMinutes || 20);
    const slot = timeMinutes(time);
    return slot < end && slot + 10 > start;
  }

  function selectedDayPeriods() {
    const payload = state.payload;
    if (!payload) return [];
    const date = new Date(`${state.selectedDate}T12:00:00`);
    const dayOfWeek = date.getDay();
    const lessons = timetableLessons(payload).filter((lesson) => (
      lesson.lessonDate === state.selectedDate && lessonVisibleOnTimetable(lesson)
    ));
    const coaches = payload.coaches.filter((coach) => coach.roleId);
    const availableRows = coaches.flatMap((coach) => availabilityRows(coach).filter((row) => (
      Number(row.dayOfWeek ?? row.day_of_week) === dayOfWeek
      && (row.type || row.availability_type) === "available"
    )));
    const hasAnyAvailability = availableRows.length > 0;
    const branchStart = payload.branch?.openStart || payload.branch?.open_start || "06:40";
    const branchEnd = payload.branch?.openEnd || payload.branch?.open_end || "22:00";
    const starts = availableRows.map((row) => timeMinutes(row.startTime || row.start_time));
    const ends = availableRows.map((row) => timeMinutes(row.endTime || row.end_time));
    lessons.forEach((lesson) => {
      starts.push(timeMinutes(lesson.startTime));
      ends.push(timeMinutes(lesson.startTime) + Number(lesson.durationMinutes || 20));
    });
    const startMinute = starts.length ? Math.min(...starts) : timeMinutes(branchStart);
    const endMinute = ends.length ? Math.max(...ends) : timeMinutes(branchEnd);
    const times = makeTimes(minutesTime(startMinute), minutesTime(endMinute));
    const laneOccupancy = new Set();
    lessons.forEach((lesson) => {
      const start = timeMinutes(lesson.startTime);
      const end = start + Number(lesson.durationMinutes || 20);
      for (let minute = start; minute < end; minute += 10) {
        laneOccupancy.add(`${lesson.coachRoleId}|${minutesTime(minute)}`);
      }
    });
    const candidateGroups = times.map((time) => {
      const minute = timeMinutes(time);
      return coaches.filter((coach) => (
        coachBaseAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability)
        || laneOccupancy.has(`${coach.roleId}|${time}`)
      ));
    });
    const lanePlan = scheduleLaneTools?.assignStableLanes?.(candidateGroups);
    const orderedGroups = lanePlan?.rows || candidateGroups.map((group) => (
      scheduleLaneTools?.sortByLaneOrder?.(group) || group
    ));
    const periods = [];
    let current = null;
    times.forEach((time, timeIndex) => {
      const active = (orderedGroups[timeIndex] || []).filter(Boolean);
      if (!active.length) {
        current = null;
        return;
      }
      const key = active.map((coach) => coach.roleId).sort().join("|");
      if (!current || current.key !== key) {
        current = { key, coaches: active, times: [], lessons };
        periods.push(current);
      }
      current.times.push(time);
    });
    return periods;
  }

  function lessonParticipantLabel(lesson) {
    const names = (lesson.participants || []).map((participant) => participant.name).filter(Boolean);
    return names.join(" · ") || lesson.memberLabel || "회원 확인 필요";
  }

  function lessonEditAriaLabel(lesson, memberLabel, kind) {
    const status = statusLabels[lesson.status] || lesson.status || "예정";
    return `${dateLabel(lesson.lessonDate)} ${String(lesson.startTime || "").slice(0, 5)} ${memberLabel} ${kindLabels[kind] || kind} ${status} 수업 수정`;
  }

  function lessonHistoryLabel(lesson) {
    const context = lessonCancellationContext(lesson);
    const memberLabel = lessonParticipantLabel(lesson);
    if (context.type === "member_inactive") {
      return `${memberLabel} · 삭제회원 처리로 자동 정리`;
    }
    if (context.type === "superseded") {
      return `${memberLabel} · 시간 변경으로 종료된 이전 일정`;
    }
    if (context.type === "prior_ticket") {
      return `${memberLabel} · 이전 회원권 일정 · 차감 대상 아님`;
    }
    if (context.type === "automatic_cutoff") {
      return `${memberLabel} · ${regularCutoffLabels[context.regularCutoffReason] || "회원권 상태에 따라 자동 제외"}`;
    }
    if (context.type === "absence") {
      const entitlementLabel = entitlementStatusLabels[context.entitlement?.status] || "불참 처리";
      return `${memberLabel} · 불참 · 차감 없음 · ${entitlementLabel}`;
    }
    if (context.type === "staff_cancelled") {
      return `${memberLabel} · 관리자 취소 · 차감 없음`;
    }
    const participants = lesson.participants || [];
    const details = participants.map((participant) => {
      const label = context.type === "unknown_cancelled"
        ? "취소 기록"
        : outcomeLabels[participant.outcome] || statusLabels[lesson.status] || "취소";
      const deduction = Number(participant.deductedSessions) > 0 ? "차감" : "차감 없음";
      return `${participant.name || "회원"} ${label} · ${deduction}`;
    });
    return details.join(" / ") || `${memberLabel} · 취소 기록 · 차감 없음`;
  }

  function lessonCancellationContext(lesson = {}) {
    const raw = lesson.cancellationContext || lesson.cancellation_context || {};
    return {
      type: raw.type || "unknown_cancelled",
      regularCutoffReason: raw.regularCutoffReason || raw.regular_cutoff_reason || "",
      entitlement: raw.entitlement || null,
      staffAction: raw.staffAction || raw.staff_action || "",
      memberOperationalStatus: raw.memberOperationalStatus || raw.member_operational_status || "",
      sourceTicketId: raw.sourceTicketId || raw.source_ticket_id || "",
      currentTicketId: raw.currentTicketId || raw.current_ticket_id || "",
      currentTicketAvailable: Boolean(raw.currentTicketAvailable ?? raw.current_ticket_available),
    };
  }

  function lessonHistoryIsArchived(lesson = {}) {
    if (String(lesson.status || "") !== "cancelled") return false;
    return ["automatic_cutoff", "member_inactive", "superseded", "prior_ticket"].includes(lessonCancellationContext(lesson).type);
  }

  function lessonVisibleOnTimetable(lesson = {}) {
    return state.showArchivedHistory || !lessonHistoryIsArchived(lesson);
  }

  function archivedHistoryLessons() {
    return (state.payload?.lessons || [])
      .filter(lessonHistoryIsArchived)
      .sort((left, right) => [left.lessonDate, left.startTime, lessonParticipantLabel(left)].join("|")
        .localeCompare([right.lessonDate, right.startTime, lessonParticipantLabel(right)].join("|"), "ko"));
  }

  function renderArchivedHistory() {
    const count = $("#scheduleV2ArchivedHistoryCount");
    const list = $("#scheduleV2ArchivedHistoryList");
    const toggle = $("#scheduleV2ArchivedHistoryToggle");
    if (!count || !list || !toggle) return;
    const lessons = archivedHistoryLessons();
    count.textContent = `${lessons.length}건`;
    toggle.disabled = lessons.length === 0;
    toggle.setAttribute("aria-pressed", String(state.showArchivedHistory));
    toggle.textContent = state.showArchivedHistory ? "시간표에서 숨기기" : "시간표에 표시";
    list.innerHTML = lessons.length
      ? lessons.map((lesson) => `<button type="button" data-v2-lesson-id="${escapeHtml(lesson.id)}"><strong>${escapeHtml(lessonParticipantLabel(lesson))}</strong><span>${escapeHtml(`${dateLabel(lesson.lessonDate)} ${String(lesson.startTime || "").slice(0, 5)} · ${lessonHistoryLabel(lesson).replace(`${lessonParticipantLabel(lesson)} · `, "")}`)}</span></button>`).join("")
      : '<p class="schedule-v2-history-empty">이 주에는 자동 정리된 수업이 없습니다.</p>';
  }

  function lessonIsTodayOrFuture(lesson) {
    return lesson.lessonDate >= localDateKey(new Date());
  }

  function lessonAbsenceCanBeRestored(lesson) {
    const context = lessonCancellationContext(lesson);
    return context.type === "absence"
      && ["open", "booked"].includes(String(context.entitlement?.status || ""))
      && Boolean(context.entitlement?.id)
      && lessonIsTodayOrFuture(lesson);
  }

  function lessonStaffCancellationCanBeRestored(lesson) {
    return String(lesson?.status || "") === "cancelled"
      && lessonCancellationContext(lesson).type === "staff_cancelled"
      && lessonIsTodayOrFuture(lesson);
  }

  function lessonHistoryActions(lesson) {
    if (!lessonIsTodayOrFuture(lesson)) return "";
    const context = lessonCancellationContext(lesson);
    const hasActiveAbsenceEntitlement = context.type === "absence"
      && ["open", "booked"].includes(String(context.entitlement?.status || ""));
    if (lessonAbsenceCanBeRestored(lesson)) {
      return `<div class="schedule-v2-history-actions"><button type="button" class="schedule-v2-history-restore" data-v2-restore-absence="${escapeHtml(lesson.id)}">원래 수업 복원</button><button type="button" class="schedule-v2-history-add" data-v2-add data-v2-kind="makeup" data-date="${escapeHtml(lesson.lessonDate)}" data-time="${escapeHtml(lesson.startTime)}" data-coach-role-id="${escapeHtml(lesson.coachRoleId)}">+ 보강·원데이</button></div>`;
    }
    if (lessonStaffCancellationCanBeRestored(lesson)) {
      return `<div class="schedule-v2-history-actions"><button type="button" class="schedule-v2-history-restore" data-v2-restore-cancelled="${escapeHtml(lesson.id)}">취소 복구</button></div>`;
    }
    if (context.type === "prior_ticket" && context.currentTicketAvailable && context.currentTicketId) {
      return `<div class="schedule-v2-history-actions"><button type="button" class="schedule-v2-history-restore" data-v2-reconcile-ticket="${escapeHtml(context.currentTicketId)}" data-v2-source-lesson-id="${escapeHtml(lesson.id)}">현재 회원권 일정 생성</button></div>`;
    }
    if (hasActiveAbsenceEntitlement) return "";
    return "";
  }

  function lessonsOverlapEachOther(left, right) {
    const leftStart = timeMinutes(left.startTime);
    const leftEnd = leftStart + Number(left.durationMinutes || 20);
    const rightStart = timeMinutes(right.startTime);
    const rightEnd = rightStart + Number(right.durationMinutes || 20);
    return leftStart < rightEnd && rightStart < leftEnd;
  }

  function lessonPlacementConflict({ date, startTime, coachRoleId, durationMinutes, ignoredLessonId = null }) {
    const candidate = {
      startTime,
      durationMinutes: Number(durationMinutes) || defaultAddDurationMinutes,
    };
    return timetableLessons().find((lesson) => {
      if (String(lesson.id) === String(ignoredLessonId || "")) return false;
      if (lesson.lessonDate !== date || !overlapBlockingStatuses.has(lesson.status)) return false;
      const usesCoach = String(lesson.coachRoleId) === String(coachRoleId)
        || String(lesson.substitute?.coachRoleId || "") === String(coachRoleId);
      return usesCoach && lessonsOverlapEachOther(candidate, lesson);
    }) || null;
  }

  function coachAvailableForLesson(coach, date, startTime, durationMinutes, hasAnyAvailability, allowLockedTimeOverride = false) {
    if (!coach) return false;
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const start = timeMinutes(startTime);
    const end = start + (Number(durationMinutes) || defaultAddDurationMinutes);
    const branchStart = timeMinutes(state.payload?.branch?.openStart || state.payload?.branch?.open_start || "06:40");
    const branchEnd = timeMinutes(state.payload?.branch?.openEnd || state.payload?.branch?.open_end || "22:00");
    if (start < branchStart || end > branchEnd) return false;
    for (let minute = start; minute < end; minute += 10) {
      const available = allowLockedTimeOverride
        ? coachBaseAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability)
        : coachAvailableAt(coach, dayOfWeek, minute, hasAnyAvailability);
      if (!available) return false;
    }
    return true;
  }

  function canStartLessonAt({ date, startTime, coachRoleId, durationMinutes = defaultAddDurationMinutes, ignoredLessonId = null, requireAvailability = true, allowLockedTimeOverride = false }) {
    if (!date || !startTime || !coachRoleId) return false;
    if (lessonPlacementConflict({ date, startTime, coachRoleId, durationMinutes, ignoredLessonId })) return false;
    if (!requireAvailability) return true;
    const coaches = state.payload?.coaches || [];
    const coach = coaches.find((item) => String(item.roleId) === String(coachRoleId));
    const hasAnyAvailability = coaches.some((item) => availabilityRows(item)
      .some((row) => (row.type || row.availability_type) === "available"));
    return coachAvailableForLesson(coach, date, startTime, durationMinutes, hasAnyAvailability, allowLockedTimeOverride);
  }

  function placementConflictMessage({ date, startTime, coachRoleId, durationMinutes, ignoredLessonId = null }) {
    const conflict = lessonPlacementConflict({ date, startTime, coachRoleId, durationMinutes, ignoredLessonId });
    if (!conflict) return "";
    const coach = (state.payload?.coaches || []).find((item) => String(item.roleId) === String(coachRoleId));
    const conflictEnd = minutesTime(timeMinutes(conflict.startTime) + Number(conflict.durationMinutes || 20));
    return `${coach?.name || "선택한 코치"}의 ${String(conflict.startTime).slice(0, 5)}~${conflictEnd} 수업과 겹칩니다. 다른 시작 시간이나 수업 길이를 선택해 주세요.`;
  }

  function usesDesktopWeeklyView() {
    return desktopWeeklyMedia.matches;
  }

  function weeklyTimeRange() {
    const payload = state.payload;
    const dates = weekDates();
    const dateSet = new Set(dates);
    const weekDays = new Set(dates.map((date) => new Date(`${date}T12:00:00`).getDay()));
    const startCandidates = [timeMinutes(payload?.branch?.openStart || payload?.branch?.open_start || "06:40")];
    const endCandidates = [timeMinutes(payload?.branch?.openEnd || payload?.branch?.open_end || "22:00")];
    (payload?.coaches || []).forEach((coach) => availabilityRows(coach).forEach((row) => {
      if (!weekDays.has(Number(row.dayOfWeek ?? row.day_of_week))) return;
      startCandidates.push(timeMinutes(row.startTime || row.start_time));
      endCandidates.push(timeMinutes(row.endTime || row.end_time));
    }));
    timetableLessons(payload).filter((lesson) => (
      dateSet.has(lesson.lessonDate) && lessonVisibleOnTimetable(lesson)
    )).forEach((lesson) => {
      startCandidates.push(timeMinutes(lesson.startTime));
      endCandidates.push(timeMinutes(lesson.startTime) + Number(lesson.durationMinutes || 20));
    });
    return makeTimes(minutesTime(Math.min(...startCandidates)), minutesTime(Math.max(...endCandidates)));
  }

  function dayLanePlan(date, times) {
    const payload = state.payload;
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const lessons = timetableLessons(payload).filter((lesson) => (
      lesson.lessonDate === date && lessonVisibleOnTimetable(lesson)
    ));
    const coaches = (payload.coaches || []).filter((coach) => coach.roleId);
    const coachById = new Map(coaches.map((coach) => [String(coach.roleId), coach]));
    lessons.forEach((lesson) => {
      const roleId = String(lesson.coachRoleId || "");
      if (!roleId || coachById.has(roleId)) return;
      const coach = {
        roleId,
        name: lesson.coachName || "코치 확인 필요",
        color: "#6f7d78",
        availability: [],
        missingRole: true,
      };
      coaches.push(coach);
      coachById.set(roleId, coach);
    });
    const hasConfiguredAvailability = (payload.coaches || []).some((coach) => availabilityRows(coach)
      .some((row) => (row.type || row.availability_type) === "available"));
    const assignments = new Map();
    const activeGroups = times.map((time) => {
      const minute = timeMinutes(time);
      const activeById = new Map();
      coaches.forEach((coach) => {
        if (coachBaseAvailableAt(coach, dayOfWeek, minute, hasConfiguredAvailability)) {
          activeById.set(String(coach.roleId), coach);
        }
      });
      lessons.filter((lesson) => lessonOverlaps(lesson, time)).forEach((lesson) => {
        const coach = coachById.get(String(lesson.coachRoleId));
        if (coach) activeById.set(String(coach.roleId), coach);
      });
      return [...activeById.values()];
    });
    const lanePlan = scheduleLaneTools?.assignStableLanes?.(activeGroups);
    const laneRows = lanePlan?.rows || activeGroups.map((group) => (
      scheduleLaneTools?.sortByLaneOrder?.(group) || group
    ));
    let laneCount = lanePlan?.laneCount || Math.max(1, ...laneRows.map((row) => row.length));

    times.forEach((time, timeIndex) => {
      const row = new Map();
      (laneRows[timeIndex] || []).forEach((coach, lane) => {
        if (coach) row.set(String(coach.roleId), lane);
      });
      assignments.set(time, row);
    });

    laneCount = Math.max(1, laneCount);
    const segmentsByLane = Array.from({ length: laneCount }, () => []);
    for (let lane = 0; lane < laneCount; lane += 1) {
      let segment = null;
      times.forEach((time) => {
        const roleId = [...(assignments.get(time) || new Map()).entries()]
          .find(([, assignedLane]) => assignedLane === lane)?.[0] || "";
        if (segment?.roleId === roleId) {
          segment.endTime = minutesTime(timeMinutes(time) + 10);
          return;
        }
        if (segment?.roleId) segmentsByLane[lane].push(segment);
        segment = roleId ? {
          roleId,
          startTime: time,
          endTime: minutesTime(timeMinutes(time) + 10),
          coach: coachById.get(roleId),
        } : null;
      });
      if (segment?.roleId) segmentsByLane[lane].push(segment);
    }
    return { date, dayOfWeek, lessons, coachById, hasConfiguredAvailability, assignments, laneCount, segmentsByLane };
  }

  function dayLessonCollections(plan) {
    const blockingStatuses = new Set(["scheduled", "reserved", "pending_change", "completed", "no_show", "absent"]);
    const activeLessons = plan.lessons.filter((lesson) => blockingStatuses.has(lesson.status));
    const historyLessons = plan.lessons.filter((lesson) => lesson.status === "cancelled");
    const replacedHistoryIds = new Set(historyLessons
      .filter((history) => activeLessons.some((lesson) => (
        String(lesson.coachRoleId) === String(history.coachRoleId)
        && lessonsOverlapEachOther(lesson, history)
      )))
      .map((lesson) => String(lesson.id)));
    const standaloneHistory = historyLessons.filter((lesson) => !replacedHistoryIds.has(String(lesson.id)));
    const occupiedSlots = new Set();
    activeLessons.forEach((lesson) => {
      const start = timeMinutes(lesson.startTime);
      const end = start + Number(lesson.durationMinutes || 20);
      for (let minute = start; minute < end; minute += 10) occupiedSlots.add(`${lesson.coachRoleId}|${minutesTime(minute)}`);
    });
    const historySlots = new Set();
    standaloneHistory.forEach((lesson) => {
      const start = timeMinutes(lesson.startTime);
      const end = start + Number(lesson.durationMinutes || 20);
      for (let minute = start; minute < end; minute += 10) historySlots.add(`${lesson.coachRoleId}|${minutesTime(minute)}`);
    });
    return { activeLessons, historyLessons, standaloneHistory, occupiedSlots, historySlots };
  }

  function renderWeeklySheet() {
    const dates = weekDates();
    const times = weeklyTimeRange();
    const plans = dates.map((date) => dayLanePlan(date, times));
    let nextColumn = 2;
    plans.forEach((plan) => {
      plan.columnStart = nextColumn;
      nextColumn += plan.laneCount;
    });
    const totalLanes = plans.reduce((sum, plan) => sum + plan.laneCount, 0);
    const templateColumns = `56px ${plans.map((plan) => `repeat(${plan.laneCount}, minmax(96px, 1fr))`).join(" ")}`;
    const search = String($("#scheduleV2LessonSearch")?.value || "").trim().toLowerCase();
    const today = localDateKey(new Date());
    const headerCells = plans.map((plan) => {
      const value = new Date(`${plan.date}T12:00:00`);
      const operationDays = operationDaysForDate(plan.date);
      const generatedClosureIds = new Set(operationDays.flatMap((operation) => operation.closureIds || []).map(String));
      const closureLabels = [...new Set([
        ...operationDays.map((operation) => operation.label || operationModeLabel(operation.mode)),
        ...closuresForDate(plan.date)
          .filter((closure) => !generatedClosureIds.has(String(closure.id)))
          .map((closure) => closure.label || "휴무"),
      ])];
      const dayHeader = `<div class="schedule-v2-week-day-head ${plan.date === today ? "is-today" : ""}" style="grid-row:1;grid-column:${plan.columnStart} / span ${plan.laneCount}"><strong>${dayLabels[value.getDay()]} ${value.getMonth() + 1}/${value.getDate()}</strong>${closureLabels.length ? `<span>${escapeHtml(closureLabels.join(" · "))}</span>` : ""}</div>`;
      const laneHeaders = plan.segmentsByLane.map((segments, lane) => {
        const names = [...new Set(segments.map((segment) => (segment.coach?.name || "코치 확인 필요").replace(/\s*코치$/, "")))];
        const ranges = segments.map((segment) => `${segment.startTime}-${segment.endTime}`).join(" / ");
        const colors = segments.map((segment) => segment.coach?.color).filter(Boolean);
        return `<div class="schedule-v2-week-coach-head ${lane === 0 ? "is-day-start" : ""}" style="grid-row:2;grid-column:${plan.columnStart + lane};--coach-tone:${escapeHtml(colors[0] || "#7b8581")}" title="${escapeHtml(`${names.join(" / ")} ${ranges}`.trim())}"><strong>${escapeHtml(names.join(" / ") || "근무 없음")}</strong><span>${escapeHtml(ranges || "등록된 근무시간 없음")}</span></div>`;
      }).join("");
      return dayHeader + laneHeaders;
    }).join("");
    const timeCells = times.map((time, index) => `<div class="schedule-v2-week-time" style="grid-row:${index + 3};grid-column:1">${time}</div>`).join("");
    const bodyCells = [];
    const lessonCards = [];

    plans.forEach((plan) => {
      const collections = dayLessonCollections(plan);
      for (let lane = 0; lane < plan.laneCount; lane += 1) {
        const runs = [];
        times.forEach((time, timeIndex) => {
          const assignment = plan.assignments.get(time) || new Map();
          const roleId = [...assignment.entries()].find(([, assignedLane]) => assignedLane === lane)?.[0] || "";
          const coach = roleId ? plan.coachById.get(roleId) : null;
          const previousAssignment = timeIndex ? plan.assignments.get(times[timeIndex - 1]) || new Map() : new Map();
          const previousRoleId = [...previousAssignment.entries()].find(([, assignedLane]) => assignedLane === lane)?.[0] || "";
          const shiftStart = Boolean(roleId && roleId !== previousRoleId);
          const slotKey = `${roleId}|${time}`;
          const occupied = Boolean(coach && collections.occupiedSlots.has(slotKey));
          const history = Boolean(coach && collections.historySlots.has(slotKey));
          const closure = coach ? closureAtDate(plan.date, time) : null;
          const locked = Boolean(coach && !coachAvailableAt(coach, plan.dayOfWeek, timeMinutes(time), plan.hasConfiguredAvailability));
          const stateName = !coach ? "unavailable" : occupied ? "occupied" : history ? "history" : locked ? "manual_override" : "available";
          const closureLabel = closure?.label || "";
          const runKey = [roleId, stateName, closureLabel].join("|");
          const previousRun = runs.at(-1);
          if (previousRun && previousRun.key === runKey && !shiftStart) {
            previousRun.slotCount += 1;
          } else {
            runs.push({
              key: runKey,
              roleId,
              coach,
              stateName,
              closureLabel,
              startIndex: timeIndex,
              slotCount: 1,
              shiftStart,
            });
          }
        });

        runs.forEach((run) => {
          const startTime = times[run.startIndex];
          const endTime = minutesTime(timeMinutes(startTime) + run.slotCount * 10);
          const dayClass = lane === 0 ? "is-day-start" : "";
          const shiftClass = run.shiftStart ? "is-shift-start" : "";
          const occupiedClass = run.stateName === "occupied" ? "is-occupied" : "";
          const historyClass = run.stateName === "history" ? "has-history" : "";
          const closureClass = run.closureLabel ? "is-closure" : "";
          const classes = ["schedule-v2-week-run", dayClass, shiftClass, occupiedClass, historyClass, closureClass].filter(Boolean).join(" ");
          const styleFor = (startOffset, slotCount) => `grid-row:${run.startIndex + startOffset + 3} / span ${slotCount};grid-column:${plan.columnStart + lane};--v2-run-rows:${slotCount}`;
          if (!run.coach) {
            bodyCells.push(`<div class="schedule-v2-week-slot ${classes} is-unavailable" title="${escapeHtml(`${dateLabel(plan.date)} ${startTime}-${endTime} 근무 코치 없음`)}" style="${styleFor(0, run.slotCount)}"></div>`);
            return;
          }
          const closureText = run.closureLabel ? ` · ${run.closureLabel}` : "";
          if (!["available", "manual_override"].includes(run.stateName)) {
            bodyCells.push(`<div class="schedule-v2-week-slot ${classes}" style="${styleFor(0, run.slotCount)}" title="${escapeHtml(`${run.coach.name} ${startTime}-${endTime}${closureText}`)}"></div>`);
            return;
          }
          const lockedOverride = run.stateName === "manual_override";
          const startSegments = [];
          for (let offset = 0; offset < run.slotCount; offset += 1) {
            const candidateTime = minutesTime(timeMinutes(startTime) + offset * 10);
            const valid = canStartLessonAt({
              date: plan.date,
              startTime: candidateTime,
              coachRoleId: run.roleId,
              durationMinutes: defaultAddDurationMinutes,
              allowLockedTimeOverride: true,
            });
            const previousSegment = startSegments.at(-1);
            if (previousSegment?.valid === valid) previousSegment.slotCount += 1;
            else startSegments.push({ valid, startOffset: offset, slotCount: 1 });
          }
          startSegments.forEach((segment) => {
            const segmentStart = minutesTime(timeMinutes(startTime) + segment.startOffset * 10);
            const segmentEnd = minutesTime(timeMinutes(segmentStart) + segment.slotCount * 10);
            const segmentClasses = ["schedule-v2-week-run", dayClass, segment.startOffset === 0 ? shiftClass : "", closureClass, lockedOverride ? "is-locked-override" : ""].filter(Boolean).join(" ");
            if (!segment.valid) {
              bodyCells.push(`<div class="schedule-v2-week-slot ${segmentClasses} is-duration-unavailable" style="${styleFor(segment.startOffset, segment.slotCount)}" title="${escapeHtml(`${run.coach.name} · ${segmentStart}부터 ${defaultAddDurationMinutes}분 수업 공간 부족`)}"></div>`);
              return;
            }
            const overrideLabel = lockedOverride ? " · 브레이크 · 관리자 수동 등록 가능" : run.closureLabel ? ` · ${run.closureLabel} 관리자 등록 가능` : "";
            bodyCells.push(`<button class="schedule-v2-week-slot schedule-v2-week-add schedule-v2-week-add-run ${segmentClasses}" type="button" style="${styleFor(segment.startOffset, segment.slotCount)}" data-v2-add data-v2-add-run data-date="${plan.date}" data-time="${segmentStart}" data-start-time="${segmentStart}" data-slot-count="${segment.slotCount}" data-duration-minutes="${defaultAddDurationMinutes}" data-coach-role-id="${escapeHtml(run.roleId)}" aria-label="${escapeHtml(`${run.coach.name} ${dateLabel(plan.date)} ${segmentStart}-${segmentEnd} ${defaultAddDurationMinutes}분 수업 시작 가능${lockedOverride ? " 브레이크 관리자 수동 등록" : ""}`)}" title="${escapeHtml(`${run.coach.name} · ${segmentStart}-${segmentEnd}${overrideLabel}`)}"></button>`);
          });
        });
      }

      collections.activeLessons.forEach((lesson) => {
        const startTime = String(lesson.startTime).slice(0, 5);
        const rowIndex = times.indexOf(startTime);
        const lane = plan.assignments.get(startTime)?.get(String(lesson.coachRoleId));
        if (rowIndex < 0 || lane == null) return;
        const span = Math.max(1, Math.ceil(Number(lesson.durationMinutes || 20) / 10));
        const kind = lesson.scheduleKind || "regular";
        const memberLabel = lessonParticipantLabel(lesson);
        const substituteLabel = lesson.substitute?.coachName ? ` · 대타 ${lesson.substitute.coachName}` : "";
        const relatedHistory = collections.historyLessons.filter((history) => (
          String(history.coachRoleId) === String(lesson.coachRoleId)
          && lessonsOverlapEachOther(lesson, history)
        ));
        const historyLabel = relatedHistory.map(lessonHistoryLabel).join(" / ");
        const coach = plan.coachById.get(String(lesson.coachRoleId));
        const scheduledAvailable = coach ? coachAvailableAt(coach, plan.dayOfWeek, timeMinutes(startTime), plan.hasConfiguredAvailability) : false;
        const card = lessonCardMarkup(lesson, { memberLabel, kind, historyLabel, substituteLabel, scheduledAvailable });
        lessonCards.push(`<button type="button" class="schedule-v2-lesson schedule-v2-week-lesson kind-${escapeHtml(kind)} status-${escapeHtml(lesson.status || "scheduled")} ${card.classes} ${search && !card.searchText.includes(search) ? "is-filtered" : ""} ${scheduledAvailable ? "" : "is-outside-hours"}" data-v2-lesson-id="${escapeHtml(lesson.id)}" data-v2-search-text="${escapeHtml(card.searchText)}" data-v2-feedback-pending="${card.needsFeedback}" style="grid-row:${rowIndex + 3} / span ${span};grid-column:${plan.columnStart + lane}" aria-label="${escapeHtml(`${lessonEditAriaLabel(lesson, memberLabel, kind)} · ${lessonCardState(lesson).label}`)}"><strong>${escapeHtml(memberLabel)}</strong>${card.detailMarkup}${card.stateMarkup}</button>`);
      });

      collections.standaloneHistory.forEach((lesson) => {
        const startTime = String(lesson.startTime).slice(0, 5);
        const rowIndex = times.indexOf(startTime);
        const lane = plan.assignments.get(startTime)?.get(String(lesson.coachRoleId));
        if (rowIndex < 0 || lane == null) return;
        const span = Math.max(1, Math.ceil(Number(lesson.durationMinutes || 20) / 10));
        const memberLabel = lessonParticipantLabel(lesson);
        const historyLabel = lessonHistoryLabel(lesson);
        const searchText = `${memberLabel} ${historyLabel}`.toLowerCase();
        lessonCards.push(`<div class="schedule-v2-history-card schedule-v2-week-history ${search && !searchText.includes(search) ? "is-filtered" : ""}" data-v2-search-text="${escapeHtml(searchText)}" style="grid-row:${rowIndex + 3} / span ${span};grid-column:${plan.columnStart + lane}"><button type="button" class="schedule-v2-history-open" data-v2-lesson-id="${escapeHtml(lesson.id)}" aria-label="${escapeHtml(`${historyLabel} 기록 확인`)}"><strong>${escapeHtml(memberLabel)}</strong><span>${escapeHtml(historyLabel.replace(`${memberLabel} `, ""))}</span></button>${lessonHistoryActions(lesson)}</div>`);
      });
    });

    return `<section class="schedule-v2-week"><div class="schedule-v2-week-title"><strong>주간 전체</strong><span>${times[0]}~${minutesTime(timeMinutes(times.at(-1)) + 10)} · 날짜별 동시 근무 열</span></div><div class="schedule-v2-week-scroll" role="region" tabindex="0" aria-label="${escapeHtml(`${dateLabel(dates[0])}부터 ${dateLabel(dates[6])}까지 주간 레슨시간표, 가로와 세로로 이동 가능`)}"><div class="schedule-v2-week-sheet" style="grid-template-columns:${templateColumns};grid-template-rows:34px 46px repeat(${times.length}, var(--v2-week-row-height));min-width:calc(56px + ${totalLanes} * 96px)"><div class="schedule-v2-week-corner" style="grid-row:1 / span 2;grid-column:1">시간</div>${headerCells}${timeCells}${bodyCells.join("")}${lessonCards.join("")}</div></div></section>`;
  }

  function renderPeriod(period, periodIndex) {
    const visibleLessons = period.lessons.filter((lesson) => period.coaches.some((coach) => String(coach.roleId) === String(lesson.coachRoleId)));
    const search = String($("#scheduleV2LessonSearch")?.value || "").trim().toLowerCase();
    const coachIndex = new Map(period.coaches.map((coach, index) => [String(coach.roleId), index]));
    const startIndex = new Map(period.times.map((time, index) => [time, index]));
    const blockingStatuses = new Set(["scheduled", "reserved", "pending_change", "completed", "no_show", "absent"]);
    const activeLessons = visibleLessons.filter((lesson) => blockingStatuses.has(lesson.status));
    const historyLessons = visibleLessons.filter((lesson) => lesson.status === "cancelled");
    const replacedHistoryIds = new Set(historyLessons
      .filter((history) => activeLessons.some((lesson) => (
        String(lesson.coachRoleId) === String(history.coachRoleId)
        && lessonsOverlapEachOther(lesson, history)
      )))
      .map((lesson) => String(lesson.id)));
    const standaloneHistory = historyLessons.filter((lesson) => !replacedHistoryIds.has(String(lesson.id)));
    const occupiedSlots = new Set();
    activeLessons.forEach((lesson) => {
      const start = timeMinutes(lesson.startTime);
      const end = start + Number(lesson.durationMinutes || 20);
      for (let minute = start; minute < end; minute += 10) {
        occupiedSlots.add(`${lesson.coachRoleId}|${minutesTime(minute)}`);
      }
    });
    const historySlots = new Set();
    standaloneHistory.forEach((lesson) => {
      const start = timeMinutes(lesson.startTime);
      const end = start + Number(lesson.durationMinutes || 20);
      for (let minute = start; minute < end; minute += 10) {
        historySlots.add(`${lesson.coachRoleId}|${minutesTime(minute)}`);
      }
    });
    const timeCells = period.times.map((time, index) => `<div class="schedule-v2-time" style="grid-row:${index + 2};grid-column:1">${time}</div>`).join("");
    const slots = period.times.flatMap((time, timeIndex) => period.coaches.map((coach, laneIndex) => {
      const slotKey = `${coach.roleId}|${time}`;
      const occupied = occupiedSlots.has(slotKey);
      const history = historySlots.has(slotKey);
      const closure = closureAt(time);
      const closureClass = closure ? "is-closure" : "";
      const closureLabel = closure?.label || "휴무";
      const dayOfWeek = new Date(`${state.selectedDate}T12:00:00`).getDay();
      const hasConfiguredAvailability = (state.payload?.coaches || []).some((item) => availabilityRows(item)
        .some((row) => (row.type || row.availability_type) === "available"));
      const lockedOverride = !coachAvailableAt(coach, dayOfWeek, timeMinutes(time), hasConfiguredAvailability);
      if (occupied || history) {
        return `<div class="schedule-v2-slot ${occupied ? "is-occupied" : ""} ${history ? "has-history" : ""} ${closureClass}" style="grid-row:${timeIndex + 2};grid-column:${laneIndex + 2}" ${closure ? `title="${escapeHtml(closureLabel)}"` : ""}></div>`;
      }
      const canStart = canStartLessonAt({
        date: state.selectedDate,
        startTime: time,
        coachRoleId: coach.roleId,
        durationMinutes: defaultAddDurationMinutes,
        allowLockedTimeOverride: true,
      });
      if (!canStart) {
        return `<div class="schedule-v2-slot is-duration-unavailable ${closureClass}" style="grid-row:${timeIndex + 2};grid-column:${laneIndex + 2}" title="${escapeHtml(`${coach.name} · ${time}부터 ${defaultAddDurationMinutes}분 수업 공간 부족`)}"></div>`;
      }
      const overrideClass = lockedOverride ? "is-locked-override" : "";
      const overrideText = lockedOverride ? "브레이크 · 관리자 수동 등록" : closure ? `${closureLabel} 관리자 수업 추가` : "수업 추가";
      return `<button class="schedule-v2-slot schedule-v2-add ${closureClass} ${overrideClass}" type="button" style="grid-row:${timeIndex + 2};grid-column:${laneIndex + 2}" data-v2-add data-date="${state.selectedDate}" data-time="${time}" data-duration-minutes="${defaultAddDurationMinutes}" data-coach-role-id="${escapeHtml(coach.roleId)}" aria-label="${escapeHtml(`${coach.name} ${time} ${defaultAddDurationMinutes}분 ${overrideText}`)}" ${lockedOverride || closure ? `title="${escapeHtml(`${overrideText} 가능`)}"` : ""}></button>`;
    })).join("");
    const lessonCards = activeLessons.map((lesson) => {
      const rowIndex = startIndex.get(String(lesson.startTime).slice(0, 5));
      const laneIndex = coachIndex.get(String(lesson.coachRoleId));
      if (rowIndex === undefined || laneIndex === undefined) return "";
      const span = Math.max(1, Math.ceil(Number(lesson.durationMinutes || 20) / 10));
      const kind = lesson.scheduleKind || "regular";
      const memberLabel = lessonParticipantLabel(lesson);
      const substituteLabel = lesson.substitute?.coachName
        ? ` · 대타 ${lesson.substitute.coachName}`
        : "";
      const relatedHistory = historyLessons.filter((history) => (
        String(history.coachRoleId) === String(lesson.coachRoleId)
        && lessonsOverlapEachOther(lesson, history)
      ));
      const historyLabel = relatedHistory.map(lessonHistoryLabel).join(" / ");
      const card = lessonCardMarkup(lesson, { memberLabel, kind, historyLabel, substituteLabel });
      const filtered = search && !card.searchText.includes(search);
      return `<button type="button" class="schedule-v2-lesson kind-${escapeHtml(kind)} status-${escapeHtml(lesson.status || "scheduled")} ${card.classes} ${filtered ? "is-filtered" : ""}" data-v2-lesson-id="${escapeHtml(lesson.id)}" data-v2-search-text="${escapeHtml(card.searchText)}" data-v2-feedback-pending="${card.needsFeedback}" style="grid-row:${rowIndex + 2} / span ${span};grid-column:${laneIndex + 2}" aria-label="${escapeHtml(`${lessonEditAriaLabel(lesson, memberLabel, kind)} · ${lessonCardState(lesson).label}`)}"><strong>${escapeHtml(memberLabel)}</strong>${card.detailMarkup}${card.stateMarkup}</button>`;
    }).join("");
    const historyCards = standaloneHistory.map((lesson) => {
      const rowIndex = startIndex.get(String(lesson.startTime).slice(0, 5));
      const laneIndex = coachIndex.get(String(lesson.coachRoleId));
      if (rowIndex === undefined || laneIndex === undefined) return "";
      const span = Math.max(1, Math.ceil(Number(lesson.durationMinutes || 20) / 10));
      const memberLabel = lessonParticipantLabel(lesson);
      const historyLabel = lessonHistoryLabel(lesson);
      const searchText = `${memberLabel} ${historyLabel}`.toLowerCase();
      const filtered = search && !searchText.includes(search);
      return `<div class="schedule-v2-history-card ${filtered ? "is-filtered" : ""}" data-v2-search-text="${escapeHtml(searchText)}" style="grid-row:${rowIndex + 2} / span ${span};grid-column:${laneIndex + 2}"><button type="button" class="schedule-v2-history-open" data-v2-lesson-id="${escapeHtml(lesson.id)}" aria-label="${escapeHtml(`${historyLabel} 기록 확인`)}"><strong>${escapeHtml(memberLabel)}</strong><span>${escapeHtml(historyLabel.replace(`${memberLabel} `, ""))}</span></button>${lessonHistoryActions(lesson)}</div>`;
    }).join("");
    const endTime = minutesTime(timeMinutes(period.times.at(-1)) + 10);
    return `<section class="schedule-v2-period"><div class="schedule-v2-period-title"><strong>${period.times[0]}~${endTime}</strong><span>${escapeHtml(period.coaches.map((coach) => coach.name.replace(/\s*코치$/, "")).join(" · "))}</span></div><div class="schedule-v2-period-scroll"><div class="schedule-v2-period-grid" style="--v2-coach-count:${period.coaches.length}" data-v2-period="${periodIndex}"><div class="schedule-v2-corner" style="grid-row:1;grid-column:1">시간</div>${period.coaches.map((coach, index) => `<div class="schedule-v2-coach-head" style="grid-row:1;grid-column:${index + 2};--coach-tone:${escapeHtml(coach.color || "#08795a")}">${escapeHtml(coach.name.replace(/\s*코치$/, ""))}</div>`).join("")}${timeCells}${slots}${historyCards}${lessonCards}</div></div></section>`;
  }

  function renderQueue() {
    const items = (state.payload?.unassigned || []).map((item) => ({
      ticketId: item.ticket_id || item.ticketId,
      memberName: item.member_name || item.memberName || "회원 확인 필요",
      productName: item.product_name || item.productName || "정규권",
      missingSessions: Number(item.missing_sessions ?? item.missingSessions) || 0,
      status: item.assignment_status || item.assignmentStatus || "unassigned",
    })).filter((item) => item.missingSessions > 0);
    $("#scheduleV2QueueCount").textContent = `${items.length}명`;
    $("#scheduleV2QueueList").innerHTML = items.length
      ? items.map((item) => `<button class="schedule-v2-queue-item" type="button" data-v2-queue-ticket="${escapeHtml(item.ticketId)}"><strong>${escapeHtml(item.memberName)}</strong><span>${escapeHtml(item.productName)} · ${item.missingSessions}회 미배정</span></button>`).join("")
      : '<div class="schedule-v2-empty" style="min-height:90px">미배정 정규권이 없습니다.</div>';
  }

  function renderPolicy({ force = false } = {}) {
    const policy = state.payload?.policy || {};
    const panel = $("#scheduleV2PolicyPanel");
    if (!panel) return;
    if (!force && state.policyEditorDirty && !panel.hidden) {
      renderMemberChangePolicyPreview();
      return;
    }
    const values = {
      coachSingleAddMode: policy.coach_single_add_mode || "approval",
      coachRegularChangeMode: policy.coach_regular_change_mode || "approval",
      allowCrossCoachMemberEdit: String(policy.allow_cross_coach_member_edit === true),
      allowCoachLockedTimeOverride: String(policy.allow_coach_locked_time_override !== false),
      allowCoachHolidayOverride: String(policy.allow_coach_holiday_override === true),
      makeupAnchorGapMinutes: String(Math.min(100, Math.max(0, Number(policy.makeup_anchor_gap_minutes ?? 40) || 0))),
      memberChangeEnabled: String(policy.member_change_enabled !== false),
      memberAutoChangeEnabled: String(policy.member_auto_change_enabled !== false),
      memberAutoApproveBeforeHours: String(Math.min(168, Math.max(1, Number(policy.member_auto_approve_before_hours ?? 24) || 24))),
      memberWithinCutoffMode: policy.member_within_cutoff_mode || "coach_approval",
      memberAutoReasonMode: policy.member_auto_reason_mode || "none",
      memberApprovalReasonMode: policy.member_approval_reason_mode || "required",
      groupMemberChangeMode: policy.group_member_change_mode || "coach_approval",
    };
    Object.entries(values).forEach(([name, value]) => {
      const input = panel.querySelector(`[name="${name}"]`);
      if (input) input.value = value;
    });
    renderMemberChangePolicyPreview();
  }

  function renderMemberChangePolicyPreview() {
    const panel = $("#scheduleV2PolicyPanel");
    const preview = $("#scheduleV2MemberChangePolicyPreview");
    if (!panel || !preview) return;
    const enabled = panel.querySelector('[name="memberChangeEnabled"]')?.value !== "false";
    const autoEnabled = panel.querySelector('[name="memberAutoChangeEnabled"]')?.value !== "false";
    const hours = Math.min(168, Math.max(1, Number(panel.querySelector('[name="memberAutoApproveBeforeHours"]')?.value) || 24));
    const withinMode = panel.querySelector('[name="memberWithinCutoffMode"]')?.value || "coach_approval";
    const autoHours = panel.querySelector('[name="memberAutoApproveBeforeHours"]');
    const within = panel.querySelector('[name="memberWithinCutoffMode"]');
    if (autoHours) autoHours.disabled = !enabled || !autoEnabled;
    if (within) within.disabled = !enabled;
    if (!enabled) {
      preview.textContent = "회원 앱에서 수업을 변경할 수 없습니다. 담당 코치에게 문의해 주세요.";
      return;
    }
    if (!autoEnabled) {
      preview.textContent = withinMode === "blocked"
        ? "회원 앱의 수업 변경 신청을 받지 않습니다."
        : "모든 수업 변경은 담당 코치 승인이 필요합니다.";
      return;
    }
    preview.textContent = `${hours}시간 이상 남은 수업은 설정한 사유 방식으로 바로 변경됩니다.\n${hours}시간 미만 남은 수업은 ${withinMode === "blocked" ? "앱에서 변경할 수 없습니다." : "담당 코치 승인이 필요합니다."}`;
  }

  function renderWorkspace() {
    renderDayTabs();
    if (!state.payload) {
      renderEmpty("서버 시간표를 준비하고 있습니다.");
      renderParallelComparison();
      return;
    }
    const desktopWeekly = usesDesktopWeeklyView();
    state.renderMode = desktopWeekly ? "weekly" : "daily";
    workspace.dataset.v2ViewMode = state.renderMode;
    if (desktopWeekly) {
      $("#scheduleV2Grid").innerHTML = renderWeeklySheet();
    } else {
      const periods = selectedDayPeriods();
      const closures = selectedDateClosures();
      const closureLabels = [...new Set(closures.map((closure) => closure.label || "휴무"))];
      const closureNotice = closures.length
        ? `<div class="schedule-v2-closure-notice"><strong>${escapeHtml(closureLabels.join(" · "))}</strong><span>자동 미래수업은 건너뜁니다. 관리자는 필요할 때 직접 추가할 수 있습니다.</span></div>`
        : "";
      $("#scheduleV2Grid").innerHTML = closureNotice + (periods.length
        ? periods.map(renderPeriod).join("")
        : '<div class="schedule-v2-empty">이 날짜에 등록된 코치 운영시간이 없습니다.</div>');
    }
    renderLessonTicketCounts();
    renderQueue();
    renderPolicy();
    renderArchivedHistory();
    renderParallelComparison();
    applyLessonSearchFilter({ scrollToMatch: true });
  }

  function lessonEndPassed(lesson = {}, now = new Date()) {
    const date = String(lesson.lessonDate || lesson.lesson_date || "").trim();
    const time = String(lesson.startTime || lesson.start_time || "").slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
    const end = new Date(`${date}T${time}:00`);
    if (!Number.isFinite(end.getTime())) return false;
    end.setMinutes(end.getMinutes() + Math.max(1, Number(lesson.durationMinutes || lesson.duration_minutes) || 20));
    return now.getTime() >= end.getTime();
  }

  function normalizedFeedbackComment(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function feedbackCommentIsPlaceholder(value) {
    return normalizedFeedbackComment(value).replace(/\s/g, "").toLowerCase() === "테스트기간";
  }

  function participantFeedbackComplete(participant = {}) {
    if (!outcomeRowFinal(participant)) return false;
    const outcome = String(participant.outcome || "completed").toLowerCase();
    if (outcome !== "completed") return true;
    const comment = normalizedFeedbackComment(participant.coachComment || participant.coach_comment);
    return comment.length >= 5 && !feedbackCommentIsPlaceholder(comment);
  }

  function lessonCardState(lesson = {}, now = new Date()) {
    const status = String(lesson.status || "scheduled").toLowerCase();
    const participants = Array.isArray(lesson.participants) ? lesson.participants : [];
    const finalParticipants = participants.filter(outcomeRowFinal);
    const incompleteCount = participants.filter((participant) => !participantFeedbackComplete(participant)).length;
    const finalizedOutcomes = finalParticipants.map((participant) => String(participant.outcome || "completed").toLowerCase());
    const deducted = finalParticipants.some((participant) => Number(participant.deductedSessions ?? participant.deducted_sessions) > 0);
    const ended = lessonEndPassed(lesson, now);

    if (status === "pending_change") {
      return { id: "approval", label: "승인 대기", className: "record-approval", needsFeedback: false };
    }
    if (["cancelled", "holiday"].includes(status)) {
      return { id: status, label: statusLabels[status] || "취소", className: "record-neutral", needsFeedback: false };
    }
    if (finalizedOutcomes.includes("no_show") || status === "no_show") {
      return { id: "no_show", label: `노쇼 · ${deducted ? "1회 차감" : "차감 없음"}`, className: "record-problem outcome-no-show", needsFeedback: false };
    }
    if (finalizedOutcomes.includes("absence") || status === "absent") {
      return { id: "absence", label: `불참 · ${deducted ? "1회 차감" : "차감 없음"}`, className: "record-neutral outcome-absence", needsFeedback: false };
    }
    if (participants.length && incompleteCount > 0 && ended) {
      const label = participants.length > 1
        ? `${participants.length}명 중 ${incompleteCount}명 피드백 필요`
        : finalParticipants.length === participants.length
          ? "출석 완료 · 피드백 필요"
          : "피드백 필요";
      return { id: "feedback_pending", label, className: "record-problem", needsFeedback: true };
    }
    if (!participants.length && ended && ["scheduled", "reserved", "completed"].includes(status)) {
      return { id: "feedback_pending", label: "피드백 필요", className: "record-problem", needsFeedback: true };
    }
    if (participants.length && finalParticipants.length === participants.length && incompleteCount === 0) {
      return { id: "feedback_complete", label: "피드백 완료", className: "record-complete", needsFeedback: false };
    }
    return { id: "scheduled", label: statusLabels[status] || "예정", className: "record-planned", needsFeedback: false };
  }

  function lessonCardMarkup(lesson, { memberLabel, kind, historyLabel = "", substituteLabel = "", scheduledAvailable = true } = {}) {
    if (lesson.expectedRegularSlot) {
      return {
        classes: "type-regular record-problem expected-regular-slot",
        searchText: `${memberLabel} 고정수업 연결 확인 미래 수업 복구 잘못된 시간 종료`.toLowerCase(),
        stateMarkup: '<small class="schedule-v2-card-state">연결 확인</small>',
        detailMarkup: `<span>고정수업 · ${Number(lesson.durationMinutes || 20)}분</span><small class="schedule-v2-lesson-warning">눌러서 복구·잘못된 시간 종료</small>`,
        needsFeedback: false,
      };
    }
    const cardState = lessonCardState(lesson);
    const typeClass = kind === "regular" ? "type-regular" : "type-changed";
    const kindLabel = kindLabels[kind] || kind || "수업";
    const searchText = `${memberLabel} ${historyLabel} ${kindLabel} ${cardState.label}`.trim().toLowerCase();
    return {
      classes: `${typeClass} ${cardState.className}`,
      searchText,
      stateMarkup: `<small class="schedule-v2-card-state">${escapeHtml(cardState.label)}</small>`,
      detailMarkup: `<span>${escapeHtml(kindLabel)} · ${Number(lesson.durationMinutes || 20)}분${escapeHtml(substituteLabel)}</span>${historyLabel ? `<small class="schedule-v2-lesson-history">기존 ${escapeHtml(historyLabel)} 자리</small>` : ""}${scheduledAvailable ? "" : '<small class="schedule-v2-lesson-warning">근무시간 확인 필요</small>'}`,
      needsFeedback: cardState.needsFeedback,
    };
  }

  function syncFeedbackFilterButton() {
    const button = $("#scheduleV2FeedbackFilter");
    if (!button) return;
    button.classList.toggle("is-active", state.feedbackOnly);
    button.setAttribute("aria-pressed", String(state.feedbackOnly));
    button.textContent = state.feedbackOnly ? "미작성만 보는 중" : "피드백 미작성만";
  }

  function applyLessonSearchFilter({ scrollToMatch = false } = {}) {
    const search = String($("#scheduleV2LessonSearch")?.value || "").trim().toLowerCase();
    let firstMatch = null;
    $$("[data-v2-search-text]", workspace).forEach((lesson) => {
      const matches = Boolean(search) && lesson.dataset.v2SearchText.includes(search);
      const feedbackFiltered = state.feedbackOnly && lesson.dataset.v2FeedbackPending !== "true";
      lesson.classList.toggle("is-feedback-filtered", feedbackFiltered);
      lesson.classList.toggle("is-filtered", Boolean(search) && !matches);
      lesson.classList.toggle("is-search-match", matches);
      lesson.classList.remove("is-search-primary");
      if (!feedbackFiltered && !firstMatch && matches) firstMatch = lesson;
    });
    if (firstMatch) firstMatch.classList.add("is-search-primary");

    if (state.searchScrollTimer) {
      window.clearTimeout(state.searchScrollTimer);
      state.searchScrollTimer = null;
    }
    if (!search) {
      state.lastSearchScrollKey = "";
      return;
    }
    const scrollKey = `${state.selectedDate}:${search}`;
    if (!scrollToMatch || search.length < 2 || !firstMatch || state.lastSearchScrollKey === scrollKey) return;
    state.lastSearchScrollKey = scrollKey;
    state.searchScrollTimer = window.setTimeout(() => {
      state.searchScrollTimer = null;
      const currentSearch = String($("#scheduleV2LessonSearch")?.value || "").trim().toLowerCase();
      if (currentSearch !== search || !firstMatch.isConnected) return;
      firstMatch.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "nearest",
      });
    }, 120);
  }

  function setEngine(mode) {
    state.engine = "v2";
    rememberScheduleEngine(state.engine);
    root.dataset.scheduleEngineMode = state.engine;
    $$('[data-schedule-engine]', root).forEach((button) => {
      const active = button.dataset.scheduleEngine === state.engine;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (state.engine === "v2" && !state.payload && scheduleWorkspaceIsActive()) void loadWorkspace();
  }

  function ticketById(ticketId) {
    return (state.payload?.tickets || []).find((ticket) => String(ticket.id) === String(ticketId)) || null;
  }

  function normalizedGroupDeductionPolicy(ticket, participantCount = 1) {
    const configured = String(ticket?.groupDeductionPolicy || ticket?.group_deduction_policy || "").trim();
    if (["per_participant", "shared_once", "representative_only"].includes(configured)) return configured;
    return participantCount > 1 ? "shared_once" : "per_participant";
  }

  function participantDeductionContext(lesson, participant) {
    const participants = lesson?.participants || [];
    const ticketId = String(participant?.ticketId || participant?.ticket_id || "");
    const ticketParticipants = ticketId
      ? participants.filter((item) => String(item.ticketId || item.ticket_id || "") === ticketId)
      : [];
    const ticket = ticketById(ticketId);
    const policy = normalizedGroupDeductionPolicy(ticket, ticketParticipants.length);
    const shared = ticketParticipants.length > 1 && ["shared_once", "representative_only"].includes(policy);
    const lessonMinutes = Math.max(1, Number(ticket?.lessonMinutes || ticket?.lesson_minutes || lesson?.durationMinutes || 20));
    const expectedUnits = lesson?.scheduleKind === "one_day"
      ? 0
      : Math.max(1, Math.ceil(Number(lesson?.durationMinutes || lessonMinutes) / lessonMinutes));
    const actualUnits = ticketParticipants.reduce(
      (sum, item) => sum + Math.max(0, Number(item.deductedSessions ?? item.deducted_sessions) || 0),
      0,
    );
    const deductedParticipant = ticketParticipants.find(
      (item) => Number(item.deductedSessions ?? item.deducted_sessions) > 0,
    );
    const ownerUserId = String(ticket?.ownerUserId || ticket?.owner_user_id || "");
    const ownerParticipant = ticketParticipants.find((item) => String(item.userId || item.user_id || "") === ownerUserId);
    const actionParticipant = actualUnits > 0
      ? deductedParticipant || ownerParticipant || ticketParticipants[0]
      : ownerParticipant || ticketParticipants[0];
    return {
      policy,
      shared,
      expectedUnits,
      actualUnits,
      actionUserId: String(actionParticipant?.userId || actionParticipant?.user_id || ""),
      isActionParticipant: String(participant?.userId || participant?.user_id || "")
        === String(actionParticipant?.userId || actionParticipant?.user_id || ""),
    };
  }

  function outcomeCorrectionMarkup(lesson, participant, outcome, final) {
    if (!final || lesson?.scheduleKind === "one_day" || !["completed", "no_show", "absence"].includes(outcome) || !participant.ticketId) return "";
    const deducted = Math.max(0, Number(participant.deductedSessions ?? participant.deducted_sessions) || 0);
    const context = participantDeductionContext(lesson, participant);
    if (!context.shared) {
      return `<div class="schedule-v2-outcome-correction"><span>차감 ${deducted > 0 ? `${deducted}회` : "없음"}</span><button type="button" data-v2-correct-deduction="${deducted > 0 ? "restore" : "deduct"}">${deducted > 0 ? "차감 복구" : "누락 차감"}</button></div>`;
    }
    if (context.actualUnits > context.expectedUnits) {
      const action = context.isActionParticipant
        ? '<button type="button" data-v2-correct-deduction="restore">그룹 과다 차감 복구</button>'
        : "";
      return `<div class="schedule-v2-outcome-correction is-warning"><span>공유 회원권 과다 차감 확인 필요 · ${context.actualUnits}/${context.expectedUnits}회</span>${action}</div>`;
    }
    if (context.actualUnits < context.expectedUnits) {
      const action = context.isActionParticipant
        ? '<button type="button" data-v2-correct-deduction="deduct">그룹 누락 차감</button>'
        : "";
      return `<div class="schedule-v2-outcome-correction is-warning"><span>공유 회원권 차감 확인 필요 · ${context.actualUnits}/${context.expectedUnits}회</span>${action}</div>`;
    }
    const action = context.isActionParticipant
      ? '<button type="button" data-v2-correct-deduction="restore">그룹 차감 복구</button>'
      : "";
    return `<div class="schedule-v2-outcome-correction is-shared"><span>공유 회원권 ${context.actualUnits}회 차감 완료</span>${action}</div>`;
  }

  function deductionConfirmationGuide(results) {
    const requested = results.filter((result) => result.deduct && result.ticketId);
    if (!requested.length) return "회원권 차감은 없습니다.";
    const groups = new Map();
    results.forEach((result) => {
      const ticketId = String(result.ticketId || "");
      if (!ticketId) return;
      const group = groups.get(ticketId) || [];
      group.push(result);
      groups.set(ticketId, group);
    });
    let sharedTickets = 0;
    let individualDeductions = 0;
    groups.forEach((group, ticketId) => {
      const requestedCount = group.filter((result) => result.deduct).length;
      if (!requestedCount) return;
      const policy = normalizedGroupDeductionPolicy(ticketById(ticketId), group.length);
      if (group.length > 1 && ["shared_once", "representative_only"].includes(policy)) sharedTickets += 1;
      else individualDeductions += requestedCount;
    });
    if (sharedTickets && !individualDeductions) return `공유 회원권 ${sharedTickets}개가 차감됩니다.`;
    if (!sharedTickets) return `${individualDeductions}명의 회원권이 차감됩니다.`;
    return `공유 회원권 ${sharedTickets}개와 개별 회원권 ${individualDeductions}건이 차감됩니다.`;
  }

  function lessonTicketCountsMarkup(lesson) {
    const text = lessonTicketCountsText(lesson);
    if (!text) return "";
    return `<small class="schedule-v2-ticket-counts" aria-label="${escapeHtml(lessonTicketCountsAria(lesson))}" title="총/사용/잔여 · 회원권 상세는 수업을 눌러 확인">${escapeHtml(text)}</small>`;
  }

  function lessonTicketCountsText(lesson) {
    if (String(lesson?.scheduleKind || "") === "one_day") return "";
    const labels = [...new Set((lesson?.participants || []).map((participant) => {
      const ticket = ticketById(participant.ticketId || participant.ticket_id);
      if (!ticket) return "";
      const total = Math.max(0, Number(ticket.totalSessions ?? ticket.total_sessions ?? 0));
      const remaining = Math.max(0, Number(ticket.remainingSessions ?? ticket.remaining_sessions ?? total));
      if (!total && !remaining) return "";
      const explicitUsed = ticket.usedSessions ?? ticket.used_sessions;
      const used = Math.max(0, Number(explicitUsed ?? Math.max(0, total - remaining)));
      return `${total}/${used}/${remaining}`;
    }).filter(Boolean))];
    return labels.join(" · ");
  }

  function lessonTicketCountsAria(lesson) {
    const labels = [...new Set((lesson?.participants || []).map((participant) => {
      const ticket = ticketById(participant.ticketId || participant.ticket_id);
      if (!ticket) return "";
      const total = Math.max(0, Number(ticket.totalSessions ?? ticket.total_sessions ?? 0));
      const remaining = Math.max(0, Number(ticket.remainingSessions ?? ticket.remaining_sessions ?? total));
      const explicitUsed = ticket.usedSessions ?? ticket.used_sessions;
      const used = Math.max(0, Number(explicitUsed ?? Math.max(0, total - remaining)));
      return `총 ${total}회, 사용 ${used}회, 잔여 ${remaining}회`;
    }).filter(Boolean))];
    return labels.join(" · ");
  }

  function renderLessonTicketCounts() {
    const lessons = new Map((state.payload?.lessons || []).map((lesson) => [String(lesson.id), lesson]));
    document.querySelectorAll("#scheduleV2Grid .schedule-v2-lesson[data-v2-lesson-id]").forEach((card) => {
      const lesson = lessons.get(String(card.dataset.v2LessonId || ""));
      const markup = lessonTicketCountsMarkup(lesson);
      if (markup) card.insertAdjacentHTML("beforeend", markup);
    });
  }

  function memberById(userId) {
    const normalizedUserId = String(userId || "");
    return (state.payload?.members || []).find((member) => [
      member.id,
      member.userId,
      ...(member.userIds || []),
    ].filter(Boolean).map(String).includes(normalizedUserId)) || null;
  }

  function primaryMemberUserId(member = {}) {
    return String(member.userId || member.id || (member.userIds || [])[0] || "");
  }

  function memberName(userId) {
    return memberById(userId)?.name || "회원 확인 필요";
  }

  function memberIdentityLabel(userId) {
    const member = memberById(userId);
    const parts = [];
    if (member?.phoneLast4) parts.push(`휴대전화 끝 ${member.phoneLast4}`);
    if (member?.birthYear) parts.push(`${member.birthYear}년생`);
    return parts.join(" · ") || "추가 식별정보 미입력";
  }

  function ticketParticipantIds(ticket) {
    return [...new Set([...(ticket?.participantUserIds || ticket?.participant_user_ids || []), ticket?.ownerUserId || ticket?.owner_user_id].filter(Boolean).map(String))];
  }

  function ticketMemberLabel(ticket) {
    return ticketParticipantIds(ticket).map(memberName).join(" · ") || "회원 확인 필요";
  }

  function ticketIdentityLabel(ticket) {
    return ticketParticipantIds(ticket)
      .map((userId) => `${memberName(userId)} ${memberIdentityLabel(userId)}`)
      .join(" / ");
  }

  function ticketProductKind(ticket) {
    return String(ticket?.productKind || ticket?.product_kind || "regular");
  }

  function ticketMatchesKind(ticket, kind) {
    const productKind = ticketProductKind(ticket);
    if (kind === "coupon") return ["coupon", "pass"].includes(productKind);
    if (["regular", "makeup"].includes(kind)) return productKind === "regular";
    return true;
  }

  function adminMayScheduleWithoutBalance() {
    return String(bridge()?.snapshot?.().role || "").trim().toLowerCase() === "admin";
  }

  function ticketSelectableForLesson(ticket, lessonDate, options = {}) {
    const status = String(ticket?.status || "").trim().toLowerCase();
    if (status && status !== "active") return false;
    if (Number(ticket?.remainingSessions ?? ticket?.remaining_sessions) <= 0 && options.allowNoBalance !== true) return false;
    const startsOn = ticket?.startsOn || ticket?.starts_on || "";
    const expiresOn = ticket?.expiresOn || ticket?.expires_on || "";
    if (lessonDate && startsOn && lessonDate < startsOn) return false;
    if (lessonDate && expiresOn && lessonDate > expiresOn) return false;
    return true;
  }

  function selectedKind() {
    return $("#scheduleV2EditorForm input[name='scheduleKind']:checked")?.value || "regular";
  }

  function selectedRegularEditScope() {
    return $("#scheduleV2EditorForm input[name='regularEditScope']:checked")?.value || "single";
  }

  function participantSignature(participants = []) {
    return participants
      .map((participant) => `${participant.userId || ""}:${participant.ticketId || ""}`)
      .sort()
      .join("|");
  }

  function regularSeriesEditEligible(lesson = state.editingLesson) {
    return Boolean(
      lesson
      && lesson.scheduleKind === "regular"
      && ["scheduled", "pending_change"].includes(lesson.status)
      && lesson.lessonDate >= localDateKey(new Date()),
    );
  }

  function lessonCanBeAdminCancelled(lesson = state.editingLesson) {
    if (!lesson || lesson.oneDayBooking) return false;
    return ["scheduled", "pending_change", "no_show"].includes(String(lesson.status || ""));
  }

  function lessonRequiresPastNoShowCancellation(lesson = state.editingLesson) {
    return Boolean(lesson && String(lesson.status || "") === "no_show");
  }

  function syncRegularEditScope() {
    const form = $("#scheduleV2EditorForm");
    const scope = $("#scheduleV2RegularEditScope");
    const eligible = regularSeriesEditEligible() && selectedKind() === "regular";
    scope.hidden = !eligible;
    if (!eligible) {
      const single = form.querySelector('input[name="regularEditScope"][value="single"]');
      if (single) single.checked = true;
    }
    const future = eligible && selectedRegularEditScope() === "future";
    const lessonDate = form.elements.lessonDate;
    if (future) lessonDate.min = state.editingLesson.lessonDate;
    else lessonDate.removeAttribute("min");
    const guide = $("#scheduleV2RegularEditScopeGuide");
    if (guide) {
      guide.textContent = future
        ? "선택한 날짜부터 매주 새 시간으로 바뀝니다. 회원과 회원권은 그대로 유지됩니다."
        : "이번 수업만 바뀌고 다음 주부터는 기존 시간 그대로 진행됩니다.";
    }
    $$("input[name='scheduleKind']", form).forEach((input) => {
      input.disabled = future && input.value !== "regular";
    });
    const search = $("#scheduleV2MemberSearch");
    search.disabled = future;
    $("#scheduleV2MemberResults").hidden = future;
    $$('[data-v2-remove-user]', $("#scheduleV2SelectedTicket")).forEach((button) => {
      button.disabled = future;
    });
    const cancelButton = $("#scheduleV2CancelLessonButton");
    state.cancelConfirmationKey = "";
    delete cancelButton.dataset.confirming;
    if (!cancelButton.hidden) {
      cancelButton.textContent = future
        ? "이후 정규시간 종료"
        : lessonRequiresPastNoShowCancellation()
          ? "관리자 취소 · 차감 없음"
          : "수업 취소";
    }
    $("#scheduleV2SaveButton").textContent = state.reopeningLesson
      ? "새 수업으로 저장"
      : future ? "이후 정규일정 저장" : "시간표에 저장";
  }

  function regularRuleFromEditor(form, duration, participants) {
    const selectedTickets = [...new Set(participants.map((participant) => participant.ticketId))]
      .map(ticketById)
      .filter(Boolean);
    if (!selectedTickets.length) return { error: "정규 회원권 정보를 다시 선택해 주세요." };
    const selectedDate = form.elements.lessonDate.value;
    const latestStart = selectedTickets
      .map((ticket) => ticket.startsOn || ticket.starts_on)
      .filter(Boolean)
      .sort()
      .at(-1) || selectedDate;
    const earliestEnd = selectedTickets
      .map((ticket) => ticket.expiresOn || ticket.expires_on)
      .filter(Boolean)
      .sort()[0] || localDateKey(addDays(selectedDate, 370));
    const effectiveStart = latestStart > selectedDate ? latestStart : selectedDate;
    if (!selectedDate || effectiveStart > earliestEnd) return { error: "회원권 사용기간 안의 날짜를 선택해 주세요." };
    return {
      selectedTickets,
      rule: {
        coachRoleId: form.elements.coachRoleId.value,
        dayOfWeek: new Date(`${selectedDate}T12:00:00`).getDay(),
        startTime: form.elements.startTime.value,
        durationMinutes: duration,
        effectiveStartOn: effectiveStart,
        effectiveEndOn: earliestEnd,
      },
    };
  }

  function requiredRegularAnchorCount(duration, selectedTickets = []) {
    return selectedTickets.reduce((required, ticket) => {
      const weeklyUnits = Math.max(1, Number(ticket.frequencyPerWeek ?? ticket.frequency_per_week) || 1);
      const ticketUnit = Math.max(1, Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20);
      const unitsPerAnchor = Math.max(1, Math.ceil(duration / ticketUnit));
      return Math.max(required, Math.ceil(weeklyUnits / unitsPerAnchor));
    }, 1);
  }

  function singleAnchorNeedsFillVerification(result, prepared, duration) {
    const normalized = Array.isArray(result) ? result[0] || {} : result || {};
    if (normalized.anchorPending || requiredRegularAnchorCount(duration, prepared.selectedTickets) !== 1) return false;
    const unitsRequired = prepared.selectedTickets.map((ticket) => {
      const ticketUnit = Math.max(1, Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20);
      return Math.max(1, Math.ceil(duration / ticketUnit));
    });
    const hasMoreCapacity = prepared.selectedTickets.every((ticket, index) => Number(ticket.remaining ?? ticket.remaining_sessions ?? 0) > unitsRequired[index]);
    return hasMoreCapacity && Number(normalized.createdCount || 0) <= 1;
  }

  function updateSeriesGuidance() {
    const title = $("#scheduleV2SeriesTitle");
    const guide = $("#scheduleV2SeriesGuide");
    if (!title || !guide) return;
    const duration = Number($("#scheduleV2EditorForm input[name='durationMinutes']:checked")?.value) || 20;
    const tickets = [...new Set(state.selectedParticipants.map((participant) => String(participant.ticketId)))]
      .map(ticketById)
      .filter((ticket) => ticket && ticketProductKind(ticket) === "regular");
    const requiredAnchors = tickets.map((ticket) => {
      const weeklyUnits = Math.max(1, Number(ticket.frequencyPerWeek ?? ticket.frequency_per_week) || 1);
      const ticketUnit = Math.max(1, Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20);
      const unitsPerAnchor = Math.max(1, Math.ceil(duration / ticketUnit));
      return Math.max(1, Math.ceil(weeklyUnits / unitsPerAnchor));
    });
    const anchorCount = requiredAnchors.length ? Math.max(...requiredAnchors) : 1;
    if (anchorCount > 1) {
      title.textContent = "정규시간을 한 칸씩 연결";
      guide.textContent = `${anchorCount}개 시간을 시간표에서 차례로 저장하면 잔여 횟수만큼 자동 생성됩니다.`;
      return;
    }
    title.textContent = "잔여 횟수만큼 미래 정규수업 생성";
    guide.textContent = "선택한 요일·시간으로 회원권 종료일까지 생성합니다.";
  }

  function renderMemberResults() {
    const target = $("#scheduleV2MemberResults");
    if (regularSeriesEditEligible() && selectedRegularEditScope() === "future") {
      target.innerHTML = "";
      target.hidden = true;
      return;
    }
    target.hidden = false;
    const query = String($("#scheduleV2MemberSearch")?.value || "").trim().toLowerCase();
    if (!query) {
      target.innerHTML = "";
      renderSelectedTicket();
      return;
    }
    const kind = selectedKind();
    if (kind === "one_day") {
      const rows = (state.payload?.members || [])
        .filter((member) => `${member.name || ""} ${member.phoneLast4 || ""} ${member.birthYear || member.birth_year || ""}`.toLowerCase().includes(query))
        .slice(0, 30);
      target.innerHTML = rows.length
        ? rows.map((member) => {
          const userId = primaryMemberUserId(member);
          const selected = state.selectedParticipants.some((participant) => String(participant.userId) === userId);
          return `<button type="button" class="schedule-v2-member-result ${selected ? "is-selected" : ""}" data-v2-one-day-user-id="${escapeHtml(userId)}" aria-pressed="${selected}"><span><strong>${escapeHtml(member.name || "회원")}</strong><span class="schedule-v2-member-identity">${escapeHtml(memberIdentityLabel(userId))} · 서비스 원데이 · 차감 없음</span></span><small>${selected ? "연결됨" : "회원 연결"}</small></button>`;
        }).join("")
        : '<div class="schedule-v2-selected-ticket">일치하는 기존 회원이 없습니다. 입력한 이름으로 비회원 원데이를 저장할 수 있습니다.</div>';
      renderSelectedTicket();
      return;
    }
    const lessonDate = $("#scheduleV2EditorForm")?.elements?.lessonDate?.value || state.selectedDate;
    const matchingTickets = (state.payload?.tickets || []).filter((ticket) => (
      ticketMatchesKind(ticket, kind) && ticketSelectableForLesson(ticket, lessonDate, {
        allowNoBalance: adminMayScheduleWithoutBalance(),
      })
    ));
    const candidates = matchingTickets.map((ticket) => ({ ticket, userId: "" }));
    const rows = candidates
      .filter(({ ticket, userId }) => {
        const searchText = userId
          ? `${memberName(userId)} ${memberIdentityLabel(userId)}`
          : `${ticketMemberLabel(ticket)} ${ticketIdentityLabel(ticket)} ${ticket.productName || ticket.product_name || ""}`;
        return searchText.toLowerCase().includes(query);
      })
      .slice(0, 30);
    target.innerHTML = rows.length
      ? rows.map(({ ticket, userId }) => {
        const total = Number(ticket.totalSessions ?? ticket.total_sessions) || 0;
        const remaining = Number(ticket.remainingSessions ?? ticket.remaining_sessions) || 0;
        const selected = userId
          ? state.selectedParticipants.some((participant) => String(participant.userId) === String(userId))
          : state.selectedParticipants.some((participant) => String(participant.ticketId) === String(ticket.id));
        const memberLabel = userId ? memberName(userId) : ticketMemberLabel(ticket);
        const detail = userId
          ? memberIdentityLabel(userId)
          : `${ticketIdentityLabel(ticket)} · ${ticket.productName || ticket.product_name || "회원권"}`;
        const noBalance = remaining <= 0;
        const result = userId
          ? (selected ? "선택됨" : "선택")
          : selected
            ? "선택됨"
            : noBalance ? "잔여 0회 · 등록 후 연장 안내" : `잔여 ${remaining}/${total}`;
        return `<button type="button" class="schedule-v2-member-result ${selected ? "is-selected" : ""} ${noBalance ? "is-balance-warning" : ""}" data-v2-ticket-id="${escapeHtml(ticket.id)}"${userId ? ` data-v2-user-id="${escapeHtml(userId)}"` : ""} aria-pressed="${selected}"><span><strong>${escapeHtml(memberLabel)}</strong><span class="schedule-v2-member-identity">${escapeHtml(detail)}</span></span><small>${result}</small></button>`;
      }).join("")
      : '<div class="schedule-v2-selected-ticket">조건에 맞는 회원권이 없습니다.</div>';
  }

  function setSelectedTicket(ticketId) {
    const ticket = ticketById(ticketId);
    if (!ticket) return;
    state.selectedTicketId = String(ticket.id);
    state.selectedParticipants = ticketParticipantIds(ticket).map((userId) => ({ userId, ticketId: String(ticket.id), name: memberName(userId) }));
    const duration = Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20;
    const durationInput = $(`#scheduleV2EditorForm input[name="durationMinutes"][value="${duration}"]`);
    if (durationInput) durationInput.checked = true;
    $("#scheduleV2MemberSearch").value = ticketMemberLabel(ticket);
    renderMemberResults();
    renderSelectedTicket();
    syncEditorPlacementAvailability();
  }

  function toggleSelectedTicket(ticketId, selectedUserId = "") {
    if (regularSeriesEditEligible() && selectedRegularEditScope() === "future") return;
    const ticket = ticketById(ticketId);
    if (!ticket) return;
    const normalizedTicketId = String(ticket.id);
    if (selectedKind() === "one_day" && selectedUserId) {
      const normalizedUserId = String(selectedUserId);
      const alreadySelected = state.selectedParticipants.some((participant) => String(participant.userId) === normalizedUserId);
      state.selectedParticipants = alreadySelected
        ? []
        : [{ userId: normalizedUserId, ticketId: normalizedTicketId, name: memberName(normalizedUserId) }];
      state.selectedTicketId = alreadySelected ? "" : normalizedTicketId;
      $("#scheduleV2MemberSearch").value = alreadySelected ? "" : memberName(normalizedUserId);
      setEditorMessage("");
      renderMemberResults();
      renderSelectedTicket();
      syncEditorPlacementAvailability();
      return;
    }
    if (state.selectedParticipants.some((participant) => String(participant.ticketId) === normalizedTicketId)) {
      state.selectedParticipants = state.selectedParticipants.filter((participant) => String(participant.ticketId) !== normalizedTicketId);
    } else {
      const additions = ticketParticipantIds(ticket).map((userId) => ({ userId, ticketId: normalizedTicketId, name: memberName(userId) }));
      const nextByUser = new Map(state.selectedParticipants.map((participant) => [String(participant.userId), participant]));
      additions.forEach((participant) => nextByUser.set(String(participant.userId), participant));
      const next = [...nextByUser.values()];
      if (next.length > 2) {
        setEditorMessage("한 수업에는 회원을 최대 2명까지 선택할 수 있습니다.");
        return;
      }
      state.selectedParticipants = next;
      const duration = Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20;
      const durationInput = $(`#scheduleV2EditorForm input[name="durationMinutes"][value="${duration}"]`);
      if (durationInput && state.selectedParticipants.length === additions.length) durationInput.checked = true;
    }
    state.selectedTicketId = [...new Set(state.selectedParticipants.map((participant) => String(participant.ticketId)))].join(",");
    setEditorMessage("");
    renderMemberResults();
    renderSelectedTicket();
    syncEditorPlacementAvailability();
  }

  function toggleSelectedOneDayMember(userId) {
    if (selectedKind() !== "one_day") return;
    const normalizedUserId = String(userId || "");
    const member = memberById(normalizedUserId);
    if (!member) return;
    const alreadySelected = state.selectedParticipants.some((participant) => String(participant.userId) === normalizedUserId);
    state.selectedParticipants = alreadySelected
      ? []
      : [{ userId: normalizedUserId, ticketId: "", name: member.name || "회원" }];
    state.selectedTicketId = "";
    if (!alreadySelected) $("#scheduleV2MemberSearch").value = member.name || "";
    setEditorMessage("");
    renderMemberResults();
    syncEditorPlacementAvailability();
  }

  function removeSelectedParticipant(userId) {
    if (regularSeriesEditEligible() && selectedRegularEditScope() === "future") return;
    state.selectedParticipants = state.selectedParticipants.filter((participant) => String(participant.userId) !== String(userId));
    state.selectedTicketId = [...new Set(state.selectedParticipants.map((participant) => String(participant.ticketId)))].join(",");
    renderMemberResults();
    renderSelectedTicket();
  }

  function renderSelectedTicket() {
    const target = $("#scheduleV2SelectedTicket");
    const oneDay = selectedKind() === "one_day";
    if (!state.selectedParticipants.length) {
      target.classList.remove("has-balance-warning");
      const guestName = String($("#scheduleV2MemberSearch")?.value || "").trim();
      target.textContent = oneDay
        ? guestName.length >= 2
          ? `${guestName} · 비회원 원데이 · 회원권 차감 없음`
          : "이름만 입력하면 비회원 원데이로 저장됩니다. 기존 회원 연결은 선택사항입니다."
        : "회원을 선택해 주세요.";
      updateSeriesGuidance();
      syncRegularEditScope();
      return;
    }
    const ticketIds = [...new Set(state.selectedParticipants.map((participant) => participant.ticketId))];
    const selectedTickets = ticketIds.map((ticketId) => ticketById(ticketId)).filter(Boolean);
    const ticketLabels = selectedTickets.map((ticket) => ticket.productName || ticket.product_name || "회원권");
    const hasNoBalance = !oneDay && selectedTickets.some((ticket) => Number(ticket.remainingSessions ?? ticket.remaining_sessions) <= 0);
    const summary = oneDay ? "기존 회원 서비스 원데이 · 회원권 차감 없음" : ticketLabels.join(" · ");
    target.classList.toggle("has-balance-warning", hasNoBalance);
    target.innerHTML = `<div class="schedule-v2-selected-head"><strong>참여자 ${state.selectedParticipants.length}명</strong><span>${escapeHtml(summary)}</span></div>${hasNoBalance ? '<p class="schedule-v2-balance-warning">잔여 횟수가 부족합니다. 이번 수업은 저장하고 회원권 연장 필요로 표시합니다.</p>' : ""}<div class="schedule-v2-selected-members">${state.selectedParticipants.map((participant) => `<span>${escapeHtml(participant.name || memberName(participant.userId))}<small>${escapeHtml(memberIdentityLabel(participant.userId))}</small><button type="button" data-v2-remove-user="${escapeHtml(participant.userId)}" aria-label="${escapeHtml(`${participant.name || memberName(participant.userId)} 선택 해제`)}">×</button></span>`).join("")}</div>`;
    updateSeriesGuidance();
    syncRegularEditScope();
  }

  function syncMemberPickerMode() {
    const input = $("#scheduleV2MemberSearch");
    const label = input?.closest("label")?.querySelector("span");
    const oneDay = selectedKind() === "one_day";
    if (label) label.textContent = oneDay ? "원데이 이름" : "회원 검색";
    if (input) input.placeholder = oneDay ? "이름만 입력해도 저장됩니다" : "이름·연락처 끝 4자리·출생연도";
    syncOneDayIntake();
  }

  function syncOneDayIntake() {
    const form = $("#scheduleV2EditorForm");
    const panel = $("#scheduleV2OneDayIntake");
    if (!form || !panel) return;
    const oneDay = selectedKind() === "one_day";
    panel.hidden = !oneDay;
    if (!oneDay) return;
    const source = form.elements.oneDayBookingSource?.value || "walk_in";
    const paymentStatus = form.elements.oneDayPaymentStatus?.value || "unpaid";
    const paymentMethod = form.elements.oneDayPaymentMethod;
    const paymentAmount = form.elements.oneDayPaymentAmount;
    const paid = paymentStatus === "paid";
    if (paymentMethod) {
      paymentMethod.disabled = !paid;
      if (!paid) paymentMethod.value = "";
    }
    if (paymentAmount) {
      paymentAmount.disabled = !paid;
      if (!paid) paymentAmount.value = "0";
    }
    const sourceLabels = { walk_in: "현장", phone: "전화", naver_booking: "네이버예약", kakao_channel: "카카오채널", other: "기타" };
    const paymentLabels = { unpaid: "미수납", paid: "수납 완료", complimentary: "서비스" };
    const summary = $("#scheduleV2OneDayIntakeSummary");
    if (summary) summary.textContent = `${sourceLabels[source] || "현장"} · ${paymentLabels[paymentStatus] || "미수납"}`;
  }

  function fillEditorControls(slot) {
    const form = $("#scheduleV2EditorForm");
    form.elements.lessonDate.value = slot.date;
    const branchStart = state.payload?.branch?.openStart || state.payload?.branch?.open_start || "06:40";
    const branchEnd = state.payload?.branch?.openEnd || state.payload?.branch?.open_end || "22:00";
    const times = makeTimes(branchStart, branchEnd);
    if (!times.includes(slot.time)) times.push(slot.time);
    times.sort((left, right) => timeMinutes(left) - timeMinutes(right));
    form.elements.startTime.innerHTML = times.map((time) => `<option value="${time}" ${time === slot.time ? "selected" : ""}>${time}</option>`).join("");
    form.elements.coachRoleId.innerHTML = (state.payload?.coaches || []).map((coach) => `<option value="${escapeHtml(coach.roleId)}" ${String(coach.roleId) === String(slot.coachRoleId) ? "selected" : ""}>${escapeHtml(coach.name)}</option>`).join("");
    syncSlotAdjustmentSummary();
  }

  function syncSlotAdjustmentSummary() {
    const form = $("#scheduleV2EditorForm");
    const target = $("#scheduleV2SlotAdjustmentSummary");
    if (!form || !target) return;
    const date = form.elements.lessonDate?.value || state.selectedDate;
    const time = form.elements.startTime?.value || "시간 확인";
    const coach = form.elements.coachRoleId?.selectedOptions?.[0]?.textContent?.trim() || "코치 확인";
    target.textContent = `${dateLabel(date)} · ${time} · ${coach}`;
  }

  function syncLessonSummary(lesson = null) {
    if (!lesson) return;
    const coach = (state.payload?.coaches || []).find((item) => String(item.roleId) === String(lesson.coachRoleId));
    const substitute = lesson.substitute?.coachName ? ` · 대타 ${lesson.substitute.coachName}` : "";
    const kind = kindLabels[lesson.scheduleKind] || lesson.scheduleKind || "수업";
    $("#scheduleV2SummaryMember").textContent = lessonParticipantLabel(lesson);
    $("#scheduleV2SummarySchedule").textContent = `${dateLabel(lesson.lessonDate)} · ${String(lesson.startTime || "").slice(0, 5)} · ${coach?.name || "코치 확인"}${substitute}`;
    $("#scheduleV2SummaryTicket").textContent = lessonTicketCountsText(lesson) || (lesson.oneDayBooking ? "원데이 · 회원권 차감 없음" : "회원권 연결 확인");
    $("#scheduleV2SummaryStatus").textContent = `${kind} · ${Number(lesson.durationMinutes || 20)}분 · ${statusLabels[lesson.status] || lesson.status || "예정"}`;
  }

  function setEditorMode(mode = "summary", lesson = state.editingLesson) {
    const form = $("#scheduleV2EditorForm");
    const hasLesson = Boolean(lesson);
    const nextMode = hasLesson && ["summary", "schedule", "outcome", "more"].includes(mode) ? mode : "schedule";
    form.dataset.editorMode = nextMode;
    $("#scheduleV2LessonSummary").hidden = !hasLesson || nextMode !== "summary";
    $("#scheduleV2EditorModes").hidden = !hasLesson;
    $$("[data-v2-editor-mode]", form).forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.v2EditorMode === nextMode));
    });
    $$('[data-v2-editor-mode="outcome"]', form).forEach((outcomeButton) => {
      outcomeButton.disabled = $("#scheduleV2OutcomePanel").hidden;
    });
    if (nextMode === "outcome" && !$("#scheduleV2OutcomePanel").hidden) $("#scheduleV2OutcomePanel").open = true;
  }

  function syncEditorPlacementAvailability() {
    if (!state.editorOpen) return;
    const form = $("#scheduleV2EditorForm");
    syncSlotAdjustmentSummary();
    const saveButton = $("#scheduleV2SaveButton");
    const messageTarget = $("#scheduleV2EditorMessage");
    const message = placementConflictMessage({
      date: form.elements.lessonDate.value,
      startTime: form.elements.startTime.value,
      coachRoleId: form.elements.coachRoleId.value,
      durationMinutes: Number(form.elements.durationMinutes.value) || defaultAddDurationMinutes,
      ignoredLessonId: state.editingLesson?.id || null,
    });
    saveButton.disabled = Boolean(message);
    if (message) {
      messageTarget.dataset.placementConflict = "true";
      setEditorMessage(message);
    } else if (messageTarget.dataset.placementConflict === "true") {
      delete messageTarget.dataset.placementConflict;
      setEditorMessage("");
    }
  }

  function renderSubstituteEditor() {
    const panel = $("#scheduleV2SubstitutePanel");
    const form = $("#scheduleV2EditorForm");
    const lesson = state.editingLesson;
    panel.hidden = !lesson || Boolean(lesson.oneDayBooking);
    if (!lesson || lesson.oneDayBooking) return;

    const current = lesson.substitute || null;
    const availableCoaches = (state.payload?.coaches || []).filter((coach) => (
      String(coach.roleId) !== String(lesson.coachRoleId)
    ));
    form.elements.substituteCoachRoleId.innerHTML = [
      '<option value="">대타 코치 선택</option>',
      ...availableCoaches.map((coach) => `<option value="${escapeHtml(coach.roleId)}">${escapeHtml(coach.name)}</option>`),
    ].join("");
    form.elements.substituteCoachRoleId.value = current?.coachRoleId || "";
    form.elements.substituteSettlementMode.value = current?.settlementMode || "actual_coach";
    form.elements.substituteHourlyAmount.value = current?.hourlyAmount || "";
    form.elements.substituteReason.value = current?.reason || "";
    $("#scheduleV2SubstituteSummary").textContent = current?.coachName
      ? `${current.coachName} · ${current.settlementMode === "none" ? "정산 없음" : current.settlementMode === "hourly" ? "시급" : "대타 귀속"}`
      : "지정 없음";
    $("#scheduleV2CancelSubstituteButton").hidden = !current;
    $("#scheduleV2AssignSubstituteButton").disabled = availableCoaches.length === 0;
    $("#scheduleV2SubstituteHourlyField").hidden = form.elements.substituteSettlementMode.value !== "hourly";
  }

  function lessonHistoryTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function lessonHistoryDetail(details = {}) {
    const parts = [];
    if (details.lessonDate || details.startTime) {
      parts.push([details.lessonDate, String(details.startTime || "").slice(0, 5)].filter(Boolean).join(" "));
    }
    if (details.durationMinutes) parts.push(`${details.durationMinutes}분`);
    if (details.reason) parts.push(details.reason);
    if (details.settlementMode) {
      parts.push(details.settlementMode === "none" ? "정산 없음" : details.settlementMode === "hourly" ? "시급 정산" : "대타 코치 정산");
    }
    if (details.cancelledFutureCount) parts.push(`미래 ${details.cancelledFutureCount}건 정리`);
    if (details.restoredSessions) parts.push(`${details.restoredSessions}회 복원`);
    return parts.filter(Boolean).join(" · ");
  }

  function renderLessonHistory(items = []) {
    const list = $("#scheduleV2LessonHistoryList");
    const summary = $("#scheduleV2LessonHistorySummary");
    if (!list || !summary) return;
    summary.textContent = items.length ? `${items.length}건` : "기록 없음";
    list.innerHTML = items.length
      ? items.map((item) => {
        const action = lessonHistoryLabels[item.action] || "수업 변경";
        const detail = lessonHistoryDetail(item.details || {});
        return `<article><div><strong>${escapeHtml(action)}</strong><time>${escapeHtml(lessonHistoryTimestamp(item.changedAt))}</time></div><span>${escapeHtml(item.actorName || "관리자")}</span>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</article>`;
      }).join("")
      : '<p class="schedule-v2-history-empty">이 수업의 변경 기록이 없습니다.</p>';
  }

  function resetLessonHistory(lesson = null) {
    const panel = $("#scheduleV2LessonHistoryPanel");
    if (!panel) return;
    panel.hidden = !lesson;
    panel.open = false;
    panel.dataset.lessonId = lesson?.id || "";
    delete panel.dataset.loadedLessonId;
    $("#scheduleV2LessonHistorySummary").textContent = "열어보기";
    $("#scheduleV2LessonHistoryList").innerHTML = "";
  }

  async function loadLessonHistory() {
    const panel = $("#scheduleV2LessonHistoryPanel");
    const lessonId = panel?.dataset.lessonId || "";
    if (!panel?.open || !lessonId || panel.dataset.loadedLessonId === lessonId) return;
    const api = bridge();
    if (!api?.rpc) return;
    const list = $("#scheduleV2LessonHistoryList");
    const summary = $("#scheduleV2LessonHistorySummary");
    summary.textContent = "불러오는 중";
    list.innerHTML = '<p class="schedule-v2-history-empty">변경 기록을 불러오는 중입니다.</p>';
    try {
      const response = await api.rpc("tn_schedule_v2_lesson_history", {
        target_lesson_id: lessonId,
        target_limit: 30,
      });
      const items = Array.isArray(response) ? response : [];
      panel.dataset.loadedLessonId = lessonId;
      renderLessonHistory(items);
    } catch (error) {
      summary.textContent = "다시 확인";
      list.innerHTML = '<p class="schedule-v2-history-empty">변경 기록을 불러오지 못했습니다. 다시 열어 확인해 주세요.</p>';
    }
  }

  function outcomeRowFinal(participant) {
    return String(participant?.recordStatus || participant?.record_status || "") === "final";
  }

  function generateOutcomeComment(row) {
    if (!row) return;
    const keywordInput = row.querySelector("[data-v2-comment-keywords]");
    const commentInput = row.querySelector("[data-v2-comment]");
    const generator = window.TennisNoteCommentDraft;
    if (!keywordInput || !commentInput || !generator?.generate) return;
    const curriculumInput = row.querySelector("[data-v2-curriculum]");
    const selectedCurriculum = curriculumStepFromValue(curriculumInput?.value || "")
      || curriculumSearchResults(curriculumInput?.value || keywordInput.value)[0]
      || null;
    const draft = generator.generate(keywordInput.value, { curriculum: selectedCurriculum });
    if (!draft.ok) {
      setEditorMessage(draft.message || "키워드를 한 개 이상 입력해 주세요.");
      keywordInput.focus();
      return;
    }
    commentInput.value = draft.comment;
    commentInput.dataset.v2Keywords = draft.keywords.join("|");
    setEditorMessage("세부 피드백 초안을 만들었습니다. 회원에게 맞게 확인한 뒤 저장해 주세요.", "success");
  }

  async function correctParticipantDeduction(row, deduct) {
    const lesson = state.editingLesson;
    if (!lesson || !row || !requireWritableServer()) return;
    const memberLabel = row.querySelector("strong")?.textContent || "회원";
    const actionLabel = deduct ? "누락 차감" : "차감 복구";
    const reason = window.prompt(`${memberLabel} ${actionLabel} 사유를 입력해 주세요.`, deduct ? "완료 후 누락 차감" : "잘못된 차감 복구");
    if (!reason?.trim()) return;
    if (!window.confirm(`${memberLabel} 회원권에 ${actionLabel}을 반영할까요?`)) return;
    const buttons = $$('[data-v2-correct-deduction]', row);
    buttons.forEach((button) => { button.disabled = true; });
    setEditorMessage(`${actionLabel}을 서버에 반영하는 중입니다.`, "info");
    try {
      const api = bridge();
      await api.rpc("tn_admin_correct_schedule_v2_participant_deduction", {
        target_lesson_id: lesson.id,
        target_user_id: row.dataset.v2OutcomeUser,
        target_ticket_id: row.dataset.v2TicketId,
        target_deduct: deduct,
        target_reason: reason.trim(),
        target_operation_key: operationKey(deduct ? "admin-missing-deduction" : "admin-restore-deduction"),
      });
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      state.editingLesson = state.payload?.lessons.find((item) => String(item.id) === String(lesson.id)) || lesson;
      renderOutcomeEditor();
      setEditorMessage(`${actionLabel}이 완료되었습니다. 회원권 잔여 횟수를 다시 확인했습니다.`, "success");
    } catch (error) {
      setEditorMessage(errorMessage(error));
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  function openParticipantFeedbackRevision(row) {
    if (!row) return;
    state.feedbackRevisionUserId = row.dataset.v2OutcomeUser || "";
    renderOutcomeEditor();
    const activeRow = $$('[data-v2-outcome-user]', $("#scheduleV2OutcomeList"))
      .find((candidate) => candidate.dataset.v2OutcomeUser === state.feedbackRevisionUserId);
    activeRow?.querySelector("[data-v2-comment]")?.focus({ preventScroll: true });
  }

  function cancelParticipantFeedbackRevision() {
    state.feedbackRevisionUserId = "";
    renderOutcomeEditor();
    setEditorMessage("피드백 수정 내용을 저장하지 않았습니다.", "info");
  }

  async function saveParticipantFeedbackRevision(row) {
    const lesson = state.editingLesson;
    if (!lesson || !row || !requireWritableServer()) return;
    const memberLabel = row.querySelector("strong")?.textContent || "회원";
    const coachComment = row.querySelector("[data-v2-comment]")?.value.trim() || "";
    const curriculumInput = row.querySelector("[data-v2-curriculum]");
    const curriculumValue = curriculumInput?.value.trim() || "";
    const curriculumStep = curriculumValue ? curriculumStepFromValue(curriculumValue) : null;
    if (coachComment.length < 5) {
      setEditorMessage(`${memberLabel} 회원의 피드백을 5자 이상 입력해 주세요.`);
      return;
    }
    if (feedbackCommentIsPlaceholder(coachComment)) {
      setEditorMessage("'테스트 기간'은 완료 피드백으로 저장할 수 없습니다. 실제 수업 피드백을 입력해 주세요.");
      return;
    }
    if (!curriculumStep) {
      setEditorMessage(`${memberLabel} 회원의 다음 커리큘럼을 검색 목록에서 선택해 주세요.`);
      return;
    }
    const expectedUpdatedAt = row.dataset.v2RecordUpdatedAt || "";
    if (!expectedUpdatedAt) {
      setEditorMessage("최신 피드백 정보를 다시 불러온 뒤 수정해 주세요.");
      return;
    }
    const saveButton = row.querySelector("[data-v2-save-feedback-revision]");
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "저장 중";
    }
    setEditorMessage("피드백만 수정하고 있습니다. 회원권 횟수는 변경하지 않습니다.", "info");
    try {
      const api = bridge();
      const [resolved] = await resolveOutcomeCurriculumRefs(api, [{
        userId: row.dataset.v2OutcomeUser,
        ticketId: row.dataset.v2TicketId,
        coachComment,
        curriculumCode: curriculumStep.id,
        existingCurriculumCode: curriculumInput?.dataset.v2ExistingCode || "",
        nextCurriculumRefId: curriculumInput?.dataset.v2ExistingRefId || null,
      }]);
      await api.rpc("tn_schedule_v2_update_feedback", {
        target_lesson_id: lesson.id,
        target_user_id: row.dataset.v2OutcomeUser,
        target_coach_comment: coachComment,
        target_next_curriculum_ref_id: resolved.nextCurriculumRefId,
        target_expected_updated_at: expectedUpdatedAt,
        target_operation_key: operationKey("admin-feedback-revision"),
      });
      state.feedbackRevisionUserId = "";
      state.deferredRefresh = false;
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      state.editingLesson = state.payload?.lessons.find((item) => String(item.id) === String(lesson.id)) || lesson;
      renderOutcomeEditor();
      setEditorMessage("피드백과 다음 커리큘럼을 수정했습니다. 회원권 횟수는 그대로입니다.", "success");
      setStatus("완료 피드백 수정 완료", "success");
      void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "피드백 저장";
      }
    }
  }

  function syncOutcomeRow(row, { setDefault = false } = {}) {
    if (!row) return;
    const outcome = row.querySelector("[data-v2-outcome]")?.value || "completed";
    const deduct = row.querySelector("[data-v2-deduct]");
    const comment = row.querySelector("[data-v2-comment]");
    const oneDay = state.editingLesson?.scheduleKind === "one_day";
    const canDeduct = !oneDay && ["completed", "no_show", "absence"].includes(outcome);
    if (deduct) {
      deduct.disabled = !canDeduct || row.classList.contains("is-final");
      if (!canDeduct) deduct.checked = false;
      else if (setDefault) deduct.checked = outcome === "completed";
    }
    if (comment) {
      comment.placeholder = outcome === "completed"
        ? "수업 내용과 다음 연습을 5자 이상 입력"
        : outcome === "no_show"
          ? "노쇼 사유를 2자 이상 입력"
          : outcome === "absence"
            ? "불참 사유를 2자 이상 입력"
            : "메모 (선택)";
    }
  }

  function renderOutcomeEditor() {
    const panel = $("#scheduleV2OutcomePanel");
    const list = $("#scheduleV2OutcomeList");
    const actions = $("#scheduleV2OutcomeActions");
    const lesson = state.editingLesson;
    panel.hidden = !lesson || Boolean(lesson.oneDayBooking);
    if (!lesson || lesson.oneDayBooking) {
      list.innerHTML = "";
      return;
    }
    const participants = lesson.participants || [];
    const anyFinal = participants.some(outcomeRowFinal);
    const allFinal = participants.length > 0 && participants.every(outcomeRowFinal);
    const allFeedbackComplete = participants.length > 0 && participants.every(participantFeedbackComplete);
    const hasCompletedOutcome = participants.some((participant) => String(participant.outcome || "completed").toLowerCase() === "completed");
    const editable = ["scheduled", "pending_change"].includes(lesson.status) && !anyFinal;
    $("#scheduleV2OutcomeSummary").textContent = allFinal
      ? allFeedbackComplete
        ? hasCompletedOutcome ? "처리 완료 · 피드백 완료" : "처리 완료"
        : "출석 처리 완료 · 피드백 필요"
      : anyFinal
        ? "점검 필요"
      : editable
        ? "처리 전"
        : statusLabels[lesson.status] || "수정 불가";
    actions.hidden = !editable;
    list.innerHTML = participants.length
      ? participants.map((participant) => {
        const final = outcomeRowFinal(participant);
        const outcome = participant.outcome || "completed";
        const feedbackEditing = final
          && outcome === "completed"
          && String(state.feedbackRevisionUserId || "") === String(participant.userId || "");
        const deducted = Number(participant.deductedSessions ?? participant.deducted_sessions) > 0;
        const disabled = editable && !final ? "" : " disabled";
        const feedbackDisabled = editable && !final || feedbackEditing ? "" : " disabled";
        const outcomeOptions = Object.entries(outcomeLabels).map(([value, label]) => `<option value="${value}" ${value === outcome ? "selected" : ""}>${label}</option>`).join("");
        const oneDay = lesson.scheduleKind === "one_day";
        const deductChecked = !oneDay && (deducted || (!participant.recordStatus && outcome === "completed"));
        const deductDisabled = `${disabled}${oneDay ? " disabled" : ""}`;
        const draftTools = editable && !final
          ? '<div class="schedule-v2-comment-draft"><input type="text" data-v2-comment-keywords placeholder="키워드 입력 · Enter로 초안 만들기" aria-label="피드백 키워드" /><button type="button" data-v2-generate-comment>초안 만들기</button></div>'
          : "";
        const correctionTools = outcomeCorrectionMarkup(lesson, participant, outcome, final);
        const revisionTools = final && outcome === "completed"
          ? feedbackEditing
            ? '<div class="schedule-v2-feedback-revision-actions"><button type="button" data-v2-save-feedback-revision>피드백 저장</button><button type="button" data-v2-cancel-feedback-revision>취소</button><small>회원권 횟수는 변경되지 않습니다.</small></div>'
            : '<button type="button" class="schedule-v2-feedback-revision-open" data-v2-open-feedback-revision>피드백 수정</button>'
          : "";
        return `<div class="schedule-v2-outcome-row ${final ? "is-final" : ""} ${feedbackEditing ? "is-feedback-editing" : ""}" data-v2-outcome-user="${escapeHtml(participant.userId)}" data-v2-ticket-id="${escapeHtml(participant.ticketId)}" data-v2-record-updated-at="${escapeHtml(participant.updatedAt || participant.updated_at || "")}"><strong>${escapeHtml(participant.name || memberName(participant.userId))}</strong><select data-v2-outcome aria-label="${escapeHtml(`${participant.name || memberName(participant.userId)} 수업 상태`)}"${disabled}>${outcomeOptions}</select><label class="schedule-v2-outcome-deduct"><input type="checkbox" data-v2-deduct ${deductChecked ? "checked" : ""}${deductDisabled} /><span>${oneDay ? "차감 없음" : "차감"}</span></label><textarea data-v2-comment maxlength="500" aria-label="${escapeHtml(`${participant.name || memberName(participant.userId)} 피드백`)}"${feedbackDisabled}>${escapeHtml(participant.coachComment || participant.coach_comment || "")}</textarea>${draftTools}${correctionTools}${revisionTools}</div>`;
      }).join("")
      : '<div class="schedule-v2-selected-ticket">참여자 정보가 없어 수업을 처리할 수 없습니다.</div>';
    renderCurriculumOptions();
    $$("[data-v2-outcome-user]", list).forEach((row) => {
      const participant = participants.find((item) => String(item.userId) === String(row.dataset.v2OutcomeUser)) || {};
      const final = outcomeRowFinal(participant);
      const feedbackEditing = final && String(state.feedbackRevisionUserId || "") === String(participant.userId || "");
      row.insertAdjacentHTML("beforeend", `<div class="schedule-v2-outcome-curriculum"><span>다음 커리큘럼 <small>${feedbackEditing ? "수정" : "완료 시 필수"}</small></span><div class="tn-curriculum-field-control"><input type="search" data-v2-curriculum value="${escapeHtml(curriculumInputValue(participant))}" data-v2-existing-code="${escapeHtml(participant.nextCurriculumSkillLabel || participant.next_curriculum_skill_label || "")}" data-v2-existing-ref-id="${escapeHtml(participant.nextCurriculumRefId || participant.next_curriculum_ref_id || "")}" placeholder="증상·동작·목표·코드 검색" aria-label="${escapeHtml(`${participant.name || memberName(participant.userId)} 다음 커리큘럼 검색`)}" autocomplete="off"${editable && !final || feedbackEditing ? "" : " disabled"} />${curriculumDetailLinkMarkup(curriculumStepFromValue(curriculumInputValue(participant)), "data-v2-curriculum-detail-link") || '<a class="tn-curriculum-detail-link" data-v2-curriculum-detail-link target="_blank" rel="noopener noreferrer" hidden>자세히 보기</a>'}</div></div><div class="tn-curriculum-suggestions" data-v2-curriculum-suggestions role="listbox" hidden></div>`);
      updateV2CurriculumDetailLink(row.querySelector("[data-v2-curriculum]"));
    });
    $$(".schedule-v2-outcome-row", list).forEach((row) => syncOutcomeRow(row));
  }

  function collectOutcomeResults(finalize) {
    const rows = $$("[data-v2-outcome-user]", $("#scheduleV2OutcomeList"));
    if (!rows.length) return { error: "처리할 회원이 없습니다.", results: [] };
    const results = [];
    for (const row of rows) {
      const outcome = row.querySelector("[data-v2-outcome]").value;
      const coachComment = row.querySelector("[data-v2-comment]").value.trim();
      const curriculumInput = row.querySelector("[data-v2-curriculum]");
      const curriculumValue = curriculumInput?.value.trim() || "";
      const curriculumStep = curriculumValue ? curriculumStepFromValue(curriculumValue) : null;
      if (curriculumValue && !curriculumStep) {
        return { error: `${row.querySelector("strong").textContent} 회원의 다음 커리큘럼을 검색 목록에서 선택해 주세요.`, results: [] };
      }
      if (finalize && outcome === "completed" && coachComment.length < 5) {
        return { error: `${row.querySelector("strong").textContent} 회원의 피드백을 5자 이상 입력해 주세요.`, results: [] };
      }
      if (finalize && outcome === "completed" && feedbackCommentIsPlaceholder(coachComment)) {
        return { error: `${row.querySelector("strong").textContent} 회원의 실제 수업 피드백을 입력해 주세요. '테스트 기간'은 완료 피드백으로 저장할 수 없습니다.`, results: [] };
      }
      if (finalize && outcome === "completed" && !curriculumStep) {
        return { error: `${row.querySelector("strong").textContent} 회원의 다음 커리큘럼을 선택해 주세요.`, results: [] };
      }
      if (finalize && ["no_show", "absence"].includes(outcome) && coachComment.length < 2) {
        const outcomeLabel = outcome === "absence" ? "불참" : "노쇼";
        return { error: `${row.querySelector("strong").textContent} 회원의 ${outcomeLabel} 사유를 입력해 주세요.`, results: [] };
      }
      results.push({
        userId: row.dataset.v2OutcomeUser,
        ticketId: row.dataset.v2TicketId,
        outcome,
        deduct: state.editingLesson?.scheduleKind !== "one_day" && row.querySelector("[data-v2-deduct]").checked,
        coachComment,
        keywords: String(row.querySelector("[data-v2-comment]")?.dataset.v2Keywords || "")
          .split("|")
          .filter(Boolean),
        curriculumCode: curriculumStep?.id || "",
        existingCurriculumCode: curriculumInput?.dataset.v2ExistingCode || "",
        nextCurriculumRefId: curriculumInput?.dataset.v2ExistingRefId || null,
      });
    }
    return { error: "", results };
  }

  async function resolveOutcomeCurriculumRefs(api, results) {
    const ensuredRefs = new Map();
    return Promise.all(results.map(async (result) => {
      let nextCurriculumRefId = result.curriculumCode
        ? result.nextCurriculumRefId || null
        : null;
      if (result.curriculumCode && result.curriculumCode !== result.existingCurriculumCode) {
        if (!ensuredRefs.has(result.curriculumCode)) {
          const step = curriculumStepFromValue(result.curriculumCode);
          ensuredRefs.set(result.curriculumCode, api.rpc("tn_ensure_curriculum_ref", {
            target_code: step.id,
            target_level: `${step.trackTitle || step.category || "커리큘럼"} · ${step.stageLabel || step.level || "단계"}`,
            target_title: step.title,
            target_notion_url: step.notionUrl || curriculumCatalog.sources?.detailedGuide || null,
          }));
        }
        const response = await ensuredRefs.get(result.curriculumCode);
        nextCurriculumRefId = Array.isArray(response)
          ? response[0]
          : typeof response === "object" && response
            ? response.id || response.curriculumId || response.value
            : response;
        if (!nextCurriculumRefId) throw new Error("schedule_v2_curriculum_save_failed");
      }
      const { curriculumCode, existingCurriculumCode, ...serverResult } = result;
      return { ...serverResult, nextCurriculumRefId };
    }));
  }

  async function processLessonOutcome() {
    const lesson = state.editingLesson;
    if (!lesson) return;
    const collected = collectOutcomeResults(true);
    if (collected.error) {
      setEditorMessage(collected.error);
      return;
    }
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 수업 처리 화면만 확인할 수 있습니다. 운영 데이터는 변경하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const deductionGuide = deductionConfirmationGuide(collected.results);
    if (!window.confirm(`수업 처리를 완료할까요? ${deductionGuide}`)) return;
    const api = bridge();
    const finalizeButton = $("#scheduleV2FinalizeOutcomeButton");
    finalizeButton.disabled = true;
    setEditorMessage("수업 완료와 차감을 저장하는 중입니다.", "info");
    try {
      const participantResults = await resolveOutcomeCurriculumRefs(api, collected.results);
      await api.rpc("tn_schedule_v2_process_lesson", {
        target_lesson_id: lesson.id,
        target_participant_results: participantResults,
        target_finalize: true,
        target_operation_key: operationKey("admin-outcome-final"),
      });
      state.deferredRefresh = false;
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      state.editingLesson = state.payload?.lessons.find((item) => String(item.id) === String(lesson.id)) || lesson;
      renderOutcomeEditor();
      setEditorMessage("수업 처리와 서버 차감이 완료됐습니다.", "success");
      setStatus("수업 처리 완료 · 시간표와 회원권을 다시 확인했습니다.", "success");
      void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      finalizeButton.disabled = false;
    }
  }

  function actualCloseEditor() {
    if (!state.editorOpen) return;
    state.editorOpen = false;
    editor.hidden = true;
    document.body.classList.remove("schedule-v2-editor-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.right = "";
    document.body.style.left = "";
    document.body.style.width = "";
    window.scrollTo(0, state.editorScrollY);
    state.editorFocusTarget?.focus?.({ preventScroll: true });
    state.editorFocusTarget = null;
    state.reopeningLesson = null;
    state.cancelConfirmationKey = "";
    if (state.deferredRefresh) {
      state.deferredRefresh = false;
      requestLiveRefresh();
    }
  }

  function closeEditor() {
    if (history.state?.tennisNoteScheduleV2Editor) {
      history.back();
      return;
    }
    actualCloseEditor();
  }

  function openEditor({ date, time, coachRoleId, lesson = null, kind: preferredKind = null }) {
    const form = $("#scheduleV2EditorForm");
    form.reset();
    const reopeningLesson = lesson?.status === "cancelled" ? lesson : null;
    state.reopeningLesson = reopeningLesson;
    state.editingLesson = reopeningLesson ? null : lesson;
    state.selectedTicketId = "";
    state.selectedParticipants = reopeningLesson
      ? []
      : lesson?.oneDayBooking && lesson.linkedUserId
      ? [{ userId: String(lesson.linkedUserId), ticketId: "", name: memberById(lesson.linkedUserId)?.name || lesson.memberLabel || "회원" }]
      : lesson?.participants?.map((participant) => ({ ...participant })) || [];
    fillEditorControls({ date, time, coachRoleId });
    const slotAdjustments = $("#scheduleV2SlotAdjustments");
    if (slotAdjustments) slotAdjustments.open = Boolean(lesson && !reopeningLesson);
    $("#scheduleV2EditorTitle").textContent = reopeningLesson ? "취소 자리 새 수업" : lesson ? "수업 수정" : "수업 추가";
    $("#scheduleV2SlotLabel").textContent = `${dateLabel(date)} · ${time}`;
    const kind = lesson?.scheduleKind || preferredKind || "regular";
    const kindInput = form.querySelector(`input[name="scheduleKind"][value="${kind}"]`);
    if (kindInput) kindInput.checked = true;
    const duration = Number(lesson?.durationMinutes) || 20;
    const durationInput = form.querySelector(`input[name="durationMinutes"][value="${duration}"]`);
    if (durationInput) durationInput.checked = true;
    form.elements.note.value = lesson?.note || "";
    if (form.elements.oneDayBookingSource) form.elements.oneDayBookingSource.value = lesson?.oneDayBookingSource || "walk_in";
    if (form.elements.oneDayPaymentStatus) form.elements.oneDayPaymentStatus.value = lesson?.oneDayPaymentStatus || "unpaid";
    if (form.elements.oneDayPaymentMethod) form.elements.oneDayPaymentMethod.value = lesson?.oneDayPaymentMethod || "";
    if (form.elements.oneDayPaymentAmount) form.elements.oneDayPaymentAmount.value = String(Math.max(0, Number(lesson?.oneDayPaymentAmount) || 0));
    const firstTicketId = state.selectedParticipants[0]?.ticketId || state.pendingTicketId || "";
    if (!lesson && firstTicketId) setSelectedTicket(firstTicketId);
    state.pendingTicketId = "";
    form.elements.fillSeries.checked = !lesson && kind === "regular" && date >= localDateKey(new Date());
    $("#scheduleV2SeriesOption").hidden = Boolean(lesson) || kind !== "regular";
    $("#scheduleV2CancelLessonButton").hidden = !lessonCanBeAdminCancelled(lesson);
    $("#scheduleV2DeleteLessonButton").hidden = !lesson;
    if (lesson && !reopeningLesson) {
      state.selectedTicketId = [...new Set(state.selectedParticipants.map((participant) => String(participant.ticketId || "")).filter(Boolean))].join(",");
      $("#scheduleV2MemberSearch").value = lessonParticipantLabel(lesson);
    } else if (reopeningLesson) {
      $("#scheduleV2MemberSearch").value = "";
    }
    syncMemberPickerMode();
    renderMemberResults();
    renderSelectedTicket();
    renderSubstituteEditor();
    renderOutcomeEditor();
    resetLessonHistory(lesson);
    syncLessonSummary(state.editingLesson);
    setEditorMode(state.editingLesson ? "summary" : "schedule", state.editingLesson);
    syncRegularEditScope();
    setEditorMessage(reopeningLesson ? "취소 기록은 그대로 보존하고 이 자리에 새 수업을 등록합니다." : "", reopeningLesson ? "info" : "");
    state.editorScrollY = window.scrollY;
    state.editorFocusTarget = document.activeElement;
    editor.hidden = false;
    state.editorOpen = true;
    document.body.classList.add("schedule-v2-editor-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${state.editorScrollY}px`;
    document.body.style.right = "0";
    document.body.style.left = "0";
    document.body.style.width = "100%";
    syncEditorPlacementAvailability();
    history.pushState({ ...(history.state || {}), tennisNoteScheduleV2Editor: true }, "");
    window.setTimeout(() => $("#scheduleV2MemberSearch")?.focus(), 0);
  }

  function setClosureMessage(message = "", tone = "") {
    const target = $("#scheduleV2ClosureMessage");
    if (!target) return;
    target.textContent = message;
    target.dataset.tone = tone;
  }

  function syncClosureTimeFields() {
    const form = $("#scheduleV2ClosureForm");
    const fields = $("#scheduleV2ClosureTimeFields");
    if (!form || !fields) return;
    const mode = form.elements.operationMode?.value || "closed";
    const partial = mode === "shortened" || (mode === "closed" && form.elements.closureRange.value === "partial");
    const rangeField = $("#scheduleV2ClosureRangeField");
    const guide = $("#scheduleV2OperationGuide");
    if (rangeField) rangeField.hidden = mode !== "closed";
    fields.hidden = !partial;
    form.elements.closureStartTime.required = partial;
    form.elements.closureEndTime.required = partial;
    if (guide) {
      guide.textContent = mode === "normal"
        ? "공휴일이어도 평소 코치 근무시간대로 운영합니다. 같은 날짜의 휴무 잠금은 해제됩니다."
        : mode === "shortened"
          ? "선택한 시간 안에서만 신청할 수 있습니다. 운영시간 밖은 기존 앱에서도 자동으로 막힙니다."
          : "휴무 시간에는 회원이 신청할 수 없습니다. 기존 수업은 처리 방법을 따로 확인합니다.";
    }
  }

  function closurePeriodLabel(closure) {
    if (closure.allDay ?? closure.all_day) return "하루 전체";
    return `${String(closure.startTime || closure.start_time || "").slice(0, 5)}-${String(closure.endTime || closure.end_time || "").slice(0, 5)}`;
  }

  function renderClosureList() {
    const form = $("#scheduleV2ClosureForm");
    const list = $("#scheduleV2ClosureList");
    if (!form || !list) return;
    const date = form.elements.closureDate.value;
    const generatedIds = new Set(operationDaysForDate(date).flatMap((operation) => operation.closureIds || []).map(String));
    const closures = closuresForDate(date).filter((closure) => !generatedIds.has(String(closure.id)));
    list.innerHTML = closures.length
      ? closures.map((closure) => `
        <div class="schedule-v2-closure-row" data-v2-closure-id="${escapeHtml(closure.id)}">
          <div><strong>${escapeHtml(closure.label || "휴무")}</strong><span>${escapeHtml(dateLabel(date))} · ${escapeHtml(closurePeriodLabel(closure))}</span></div>
          <button type="button" data-v2-edit-closure="${escapeHtml(closure.id)}">수정</button>
          <button class="danger-button" type="button" data-v2-delete-closure="${escapeHtml(closure.id)}">해제</button>
        </div>
      `).join("")
      : '<div class="schedule-v2-closure-empty">별도로 지정한 시간 휴무가 없습니다.</div>';
  }

  function operationPeriodLabel(operation) {
    if (operation.mode === "shortened") return `${String(operation.startTime || "").slice(0, 5)}-${String(operation.endTime || "").slice(0, 5)}`;
    return operation.mode === "normal" ? "평소 근무시간" : "하루 전체";
  }

  function renderOperationList() {
    const form = $("#scheduleV2ClosureForm");
    const list = $("#scheduleV2OperationList");
    if (!form || !list) return;
    const date = form.elements.closureDate.value;
    const operations = operationDaysForDate(date);
    list.innerHTML = operations.length
      ? operations.map((operation) => `
        <div class="schedule-v2-closure-row" data-v2-operation-id="${escapeHtml(operation.id)}">
          <div><strong>${escapeHtml(operation.label || operationModeLabel(operation.mode))}</strong><span>${escapeHtml(dateLabel(date))} · ${escapeHtml(operationModeLabel(operation.mode))} · ${escapeHtml(operationPeriodLabel(operation))}</span></div>
          <button type="button" data-v2-edit-operation="${escapeHtml(operation.id)}">수정</button>
          <button class="danger-button" type="button" data-v2-delete-operation="${escapeHtml(operation.id)}">해제</button>
        </div>
      `).join("")
      : '<div class="schedule-v2-closure-empty">이 날짜의 운영 구분을 선택해 저장하세요.</div>';
  }

  function resetClosureForm({ keepDate = true } = {}) {
    const form = $("#scheduleV2ClosureForm");
    if (!form) return;
    const date = keepDate ? form.elements.closureDate.value : state.selectedDate;
    form.reset();
    form.elements.closureDate.value = date || state.selectedDate;
    form.elements.operationMode.value = "closed";
    form.elements.closureRange.value = "all_day";
    form.elements.closureLabel.value = "휴무";
    form.elements.closureStartTime.value = "09:00";
    form.elements.closureEndTime.value = "18:00";
    state.editingClosureId = "";
    state.editingOperationDayId = "";
    state.closureImpact = null;
    const impact = $("#scheduleV2ClosureImpact");
    if (impact) impact.hidden = true;
    $("#scheduleV2ClosureSaveButton").textContent = "운영일 저장";
    syncClosureTimeFields();
    renderOperationList();
    renderClosureList();
    setClosureMessage("");
  }

  function renderClosureImpact(preview) {
    const panel = $("#scheduleV2ClosureImpact");
    const summary = $("#scheduleV2ClosureImpactSummary");
    const list = $("#scheduleV2ClosureImpactList");
    if (!panel || !summary || !list) return;
    state.closureImpact = preview || null;
    if (!preview || Number(preview.lessonCount || 0) + Number(preview.oneDayCount || 0) === 0) {
      panel.hidden = true;
      list.innerHTML = "";
      return;
    }
    const lessonCount = Number(preview.lessonCount || 0);
    const oneDayCount = Number(preview.oneDayCount || 0);
    const paidOneDayCount = Number(preview.paidOneDayCount || 0);
    summary.textContent = `예정 수업 ${lessonCount}건 · 원데이 ${oneDayCount}건${paidOneDayCount ? ` · 결제 확인 원데이 ${paidOneDayCount}건` : ""}`;
    const lessonRows = (preview.lessons || []).map((lesson) => {
      const names = (lesson.participants || []).map((participant) => participant.name).filter(Boolean).join(" · ") || "참여자 확인 필요";
      return `<div class="schedule-v2-closure-impact-row"><span>${escapeHtml(`${lesson.startTime} · ${lesson.coachName || "코치"}`)}</span><strong>${escapeHtml(names)}</strong></div>`;
    });
    const oneDayRows = (preview.oneDayBookings || []).map((booking) => (
      `<div class="schedule-v2-closure-impact-row"><span>${escapeHtml(`${booking.startTime} · 원데이`)}</span><strong>${escapeHtml(booking.guestName || "이름 미입력")}${booking.paymentStatus === "paid" ? " · 결제 확인" : ""}</strong></div>`
    ));
    list.innerHTML = [...lessonRows, ...oneDayRows].join("");
    panel.hidden = false;
  }

  async function previewClosureImpact(closureId) {
    const preview = await bridge().rpc("tn_schedule_v2_preview_closure_impact", {
      target_branch_id: state.payload.branch.id,
      target_closure_id: closureId,
    });
    renderClosureImpact(preview);
    return preview;
  }

  async function applyClosureTreatment(policy) {
    const preview = state.closureImpact;
    const closureId = preview?.closure?.id;
    if (!closureId || !requireWritableServer()) return;
    const holiday = policy === "holiday_no_deduction";
    const button = holiday ? $("#scheduleV2ClosureApplyHolidayButton") : $("#scheduleV2ClosureKeepLessonsButton");
    const reason = $("#scheduleV2ClosureReason")?.value?.trim() || "센터 휴무";
    button.disabled = true;
    setClosureMessage(holiday ? "기존 수업을 휴무·차감 없음으로 처리하고 있습니다." : "기존 수업 유지 정책을 저장하고 있습니다.", "info");
    try {
      const result = await bridge().rpc("tn_schedule_v2_apply_closure_treatment_reversible", {
        target_branch_id: state.payload.branch.id,
        target_closure_id: closureId,
        target_policy: policy,
        target_reason: reason,
        target_operation_key: operationKey("admin-closure-treatment"),
      });
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      const paidCount = Number(result?.paidOneDayCount || 0);
      setStatus(holiday
        ? `휴무 처리 완료 · 수업 ${Number(result?.processedLessonCount || 0)}건 · 원데이 ${Number(result?.cancelledOneDayCount || 0)}건${paidCount ? ` · 결제 확인 ${paidCount}건` : ""}`
        : "휴무 표시만 적용하고 기존 수업은 유지했습니다.", paidCount ? "warning" : "success");
      state.closureImpact = null;
      closeClosureEditor();
    } catch (error) {
      setClosureMessage(errorMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  function editClosure(closureId) {
    const form = $("#scheduleV2ClosureForm");
    const closure = (state.payload?.closures || []).find((item) => String(item.id) === String(closureId));
    if (!form || !closure) return;
    state.editingClosureId = String(closure.id);
    state.editingOperationDayId = "";
    form.elements.operationMode.value = "closed";
    form.elements.closureDate.value = String(closure.date || closure.closure_date || state.selectedDate);
    form.elements.closureLabel.value = closure.label || "휴무";
    const allDay = closure.allDay ?? closure.all_day;
    form.elements.closureRange.value = allDay ? "all_day" : "partial";
    form.elements.closureStartTime.value = String(closure.startTime || closure.start_time || "09:00").slice(0, 5);
    form.elements.closureEndTime.value = String(closure.endTime || closure.end_time || "18:00").slice(0, 5);
    $("#scheduleV2ClosureSaveButton").textContent = "휴무일 수정";
    syncClosureTimeFields();
    renderClosureList();
    setClosureMessage("선택한 휴무를 수정합니다.", "info");
  }

  function editOperationDay(operationId) {
    const form = $("#scheduleV2ClosureForm");
    const operation = (state.payload?.operationDays || []).find((item) => String(item.id) === String(operationId));
    if (!form || !operation) return;
    state.editingClosureId = "";
    state.editingOperationDayId = String(operation.id);
    form.elements.closureDate.value = String(operation.date || state.selectedDate);
    form.elements.operationMode.value = operation.mode || "normal";
    form.elements.closureRange.value = operation.mode === "closed" && operation.allDay === false ? "partial" : "all_day";
    form.elements.closureLabel.value = operation.label || operationModeLabel(operation.mode);
    form.elements.closureStartTime.value = String(operation.startTime || "09:00").slice(0, 5);
    form.elements.closureEndTime.value = String(operation.endTime || "18:00").slice(0, 5);
    $("#scheduleV2ClosureSaveButton").textContent = "운영일 수정";
    syncClosureTimeFields();
    renderOperationList();
    renderClosureList();
    setClosureMessage("선택한 운영일을 수정합니다.", "info");
  }

  function actualCloseClosureEditor() {
    if (!state.closureEditorOpen || !closureEditor) return;
    state.closureEditorOpen = false;
    closureEditor.hidden = true;
    document.body.classList.remove("schedule-v2-editor-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.right = "";
    document.body.style.left = "";
    document.body.style.width = "";
    window.scrollTo(0, state.closureScrollY);
    state.closureFocusTarget?.focus?.({ preventScroll: true });
    state.closureFocusTarget = null;
  }

  function closeClosureEditor() {
    if (history.state?.tennisNoteScheduleV2Closure) {
      history.back();
      return;
    }
    actualCloseClosureEditor();
  }

  function openClosureEditor() {
    if (!closureEditor || state.editorOpen) return;
    const form = $("#scheduleV2ClosureForm");
    if (!form) return;
    form.elements.closureDate.value = state.selectedDate;
    resetClosureForm({ keepDate: true });
    state.closureScrollY = window.scrollY;
    state.closureFocusTarget = document.activeElement;
    closureEditor.hidden = false;
    state.closureEditorOpen = true;
    document.body.classList.add("schedule-v2-editor-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${state.closureScrollY}px`;
    document.body.style.right = "0";
    document.body.style.left = "0";
    document.body.style.width = "100%";
    history.pushState({ ...(history.state || {}), tennisNoteScheduleV2Closure: true }, "");
    window.setTimeout(() => form.elements.closureDate.focus(), 0);
  }

  async function saveClosure(event) {
    event.preventDefault();
    if (!requireWritableServer()) return;
    const form = event.currentTarget;
    const mode = form.elements.operationMode?.value || "closed";
    const allDay = mode === "normal" || (mode === "closed" && form.elements.closureRange.value === "all_day");
    const usesTime = mode === "shortened" || !allDay;
    const startTime = usesTime ? form.elements.closureStartTime.value : null;
    const endTime = usesTime ? form.elements.closureEndTime.value : null;
    if (usesTime && (!startTime || !endTime || startTime >= endTime)) {
      setClosureMessage("종료 시간은 시작 시간보다 늦게 선택해 주세요.");
      return;
    }
    const saveButton = $("#scheduleV2ClosureSaveButton");
    saveButton.disabled = true;
    setClosureMessage("운영일을 서버에 저장하고 있습니다.", "info");
    try {
      const editingManualClosure = Boolean(state.editingClosureId);
      const result = editingManualClosure
        ? await bridge().rpc("tn_schedule_v2_upsert_closure", {
          target_branch_id: state.payload.branch.id,
          target_closure_date: form.elements.closureDate.value,
          target_all_day: allDay,
          target_start_time: startTime,
          target_end_time: endTime,
          target_label: form.elements.closureLabel.value.trim() || "휴무",
          target_closure_id: state.editingClosureId,
        })
        : await bridge().rpc("tn_schedule_v2_set_operation_day", {
          target_branch_id: state.payload.branch.id,
          target_operation_date: form.elements.closureDate.value,
          target_mode: mode,
          target_start_time: usesTime ? startTime : null,
          target_end_time: usesTime ? endTime : null,
          target_label: form.elements.closureLabel.value.trim() || operationModeLabel(mode),
          target_operation_id: state.editingOperationDayId || null,
          target_operation_key: operationKey("admin-operation-day-save"),
        });
      const date = form.elements.closureDate.value;
      state.weekStart = mondayOf(date);
      state.selectedDate = date;
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      renderOperationList();
      renderClosureList();
      const closureId = result?.closure?.id || (mode === "closed" ? result?.operation?.closureIds?.[0] : null);
      const preview = closureId ? await previewClosureImpact(closureId) : null;
      const count = Number(preview?.lessonCount || result?.existingLessonCount || result?.existing_lesson_count || 0);
      const oneDayCount = Number(preview?.oneDayCount || 0);
      const restoredCount = Number(result?.restoration?.restoredLessonCount || 0);
      const pastCount = Number(result?.restoration?.pastLessonCount || 0);
      if (restoredCount > 0) {
        setClosureMessage(`정상 운영으로 변경하고 기존 수업 ${restoredCount}건을 예정 상태로 복구했습니다.${pastCount ? ` 지난 수업 ${pastCount}건은 변경하지 않았습니다.` : ""}`, "success");
        setStatus(`정상 운영 반영 완료 · 수업 ${restoredCount}건 복구`, "success");
        closeClosureEditor();
      } else if (count + oneDayCount > 0) {
        setClosureMessage(mode === "shortened"
          ? `단축 운영시간 밖의 기존 일정 ${count}건은 그대로 유지됩니다. 시간표에서 확인해 주세요.`
          : "휴무와 겹치는 기존 일정의 처리 방법을 선택해 주세요.", "warning");
        setStatus(`운영일 저장 완료 · 기존 일정 ${count + oneDayCount}건 확인 필요`, "warning");
      } else {
        setStatus(`${operationModeLabel(mode)} 반영 완료 · 시간표에 바로 표시했습니다.`, "success");
        closeClosureEditor();
      }
    } catch (error) {
      setClosureMessage(errorMessage(error));
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteClosure(closureId) {
    const closure = (state.payload?.closures || []).find((item) => String(item.id) === String(closureId));
    if (!closure || !requireWritableServer()) return;
    if (!window.confirm(`${closure.label || "휴무"} 지정을 해제할까요? 휴무·차감 없음으로 처리된 미래 수업은 예정 상태로 복구됩니다.`)) return;
    setClosureMessage("휴무일을 해제하고 있습니다.", "info");
    try {
      const result = await bridge().rpc("tn_schedule_v2_clear_closure", {
        target_branch_id: state.payload.branch.id,
        target_closure_id: closure.id,
        target_operation_key: operationKey("admin-closure-clear"),
      });
      state.editingClosureId = "";
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      resetClosureForm({ keepDate: true });
      const restoredCount = Number(result?.restoration?.restoredLessonCount || 0);
      setClosureMessage(restoredCount
        ? `휴무일을 해제하고 기존 수업 ${restoredCount}건을 예정 상태로 복구했습니다.`
        : "휴무일 해제가 서버와 시간표에 반영됐습니다.", "success");
      setStatus(restoredCount ? `휴무일 해제 완료 · 수업 ${restoredCount}건 복구` : "휴무일 해제 완료", "success");
    } catch (error) {
      setClosureMessage(errorMessage(error));
    }
  }

  async function deleteOperationDay(operationId) {
    const operation = (state.payload?.operationDays || []).find((item) => String(item.id) === String(operationId));
    if (!operation || !requireWritableServer()) return;
    if (!window.confirm(`${operation.label || operationModeLabel(operation.mode)} 설정을 해제할까요? 휴무·차감 없음으로 처리된 미래 수업은 예정 상태로 복구됩니다.`)) return;
    setClosureMessage("운영일 설정을 해제하고 있습니다.", "info");
    try {
      const result = await bridge().rpc("tn_schedule_v2_clear_operation_day", {
        target_branch_id: state.payload.branch.id,
        target_operation_id: operation.id,
        target_operation_key: operationKey("admin-operation-day-clear"),
      });
      state.editingOperationDayId = "";
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ quiet: true, force: true });
      resetClosureForm({ keepDate: true });
      const restoredCount = Number(result?.restoration?.restoredLessonCount || 0);
      setClosureMessage(restoredCount
        ? `운영일 설정을 해제하고 기존 수업 ${restoredCount}건을 예정 상태로 복구했습니다.`
        : "운영일 설정 해제가 서버와 시간표에 반영됐습니다.", "success");
      setStatus(restoredCount ? `운영일 설정 해제 완료 · 수업 ${restoredCount}건 복구` : "운영일 설정 해제 완료", "success");
    } catch (error) {
      setClosureMessage(errorMessage(error));
    }
  }

  function errorMessage(error) {
    const source = String(error?.message || error || "server_error");
    const labels = {
      schedule_v2_coach_time_overlap: "같은 코치의 수업 시간이 겹칩니다.",
      schedule_v2_expected_regular_slot_reserved: "누락된 미래 고정수업 자리입니다. 고정수업을 먼저 복구하거나 다른 시간을 선택해 주세요.",
      schedule_v2_expected_regular_slot_reference_required: "복구할 고정수업 정보를 다시 불러와 주세요.",
      schedule_v2_expected_regular_slot_ticket_not_found: "회원권을 찾을 수 없습니다. 회원권 상태를 다시 확인해 주세요.",
      schedule_v2_expected_regular_slot_not_repairable: "이미 배정됐거나 잔여 횟수·기간·겹치는 시간을 다시 확인해야 합니다. 시간표를 새로고침해 주세요.",
      schedule_v2_expected_regular_slot_concurrent_update: "다른 화면에서 같은 고정수업을 먼저 처리했습니다. 시간표를 새로고침해 주세요.",
      schedule_v2_expected_regular_slot_end_reference_required: "정리할 고정시간 정보를 다시 불러와 주세요.",
      schedule_v2_expected_regular_slot_end_reason_required: "잘못된 고정시간 정리 사유를 확인해 주세요.",
      schedule_v2_expected_regular_slot_end_past_forbidden: "과거 고정시간은 이 메뉴에서 정리할 수 없습니다.",
      schedule_v2_expected_regular_slot_end_ticket_not_found: "연결된 회원권을 찾을 수 없습니다. 회원권을 다시 확인해 주세요.",
      schedule_v2_expected_regular_slot_end_rule_not_found: "이미 종료되었거나 찾을 수 없는 고정시간입니다. 시간표를 새로고침해 주세요.",
      schedule_v2_expected_regular_slot_end_not_available: "이 카드는 더 이상 정리 가능한 누락 고정수업이 아닙니다. 시간표를 새로고침해 주세요.",
      schedule_v2_expected_regular_slot_end_rule_ambiguous: "같은 시간의 고정규칙이 중복되어 자동 정리를 중단했습니다. 회원권 정규시간을 먼저 확인해 주세요.",
      schedule_v2_expected_regular_slot_end_materialized: "해당 회차가 이미 실제 수업으로 생성됐습니다. 실제 수업 카드에서 변경해 주세요.",
      schedule_v2_expected_regular_slot_end_mixed_participants: "다른 회원권 참가자가 섞인 미래 수업이 있어 자동 정리를 중단했습니다.",
      schedule_v2_expected_regular_slot_end_concurrent_update: "다른 화면에서 고정시간을 먼저 변경했습니다. 시간표를 새로고침해 주세요.",
      schedule_v2_expected_regular_slot_end_delete_failed: "미래 수업 일부를 안전하게 삭제하지 못해 전체 정리를 취소했습니다.",
      schedule_v2_ticket_unavailable: "사용할 수 있는 회원권이 아닙니다.",
      schedule_v2_duration_ticket_mismatch: "수업 시간과 회원권 단위가 맞지 않습니다.",
      schedule_v2_regular_ticket_required: "정규 회원권을 선택해 주세요.",
      schedule_v2_coupon_ticket_required: "쿠폰 회원권을 선택해 주세요.",
      schedule_v2_makeup_regular_ticket_required: "보강은 정규 회원권을 선택해 주세요.",
      schedule_v2_holiday_restore_conflict: "정상 수업으로 복구할 시간에 다른 수업이 이미 있습니다. 겹치는 수업을 먼저 확인해 주세요.",
      schedule_v2_holiday_restore_makeup_review_required: "휴무 처리된 보강수업은 보강권 연결을 확인한 뒤 복구해야 합니다.",
      schedule_v2_holiday_restore_record_changed: "휴무 처리 뒤 수업 기록이 변경되어 자동 복구를 중단했습니다. 수업 상세를 확인해 주세요.",
      schedule_v2_holiday_restore_deduction_changed: "휴무 수업에 횟수 차감 기록이 있어 자동 복구하지 않았습니다. 차감 내역을 먼저 확인해 주세요.",
      schedule_v2_concurrent_update: "다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.",
      schedule_v2_workspace_range_invalid: "시간표 조회 기간을 확인해 주세요.",
      schedule_v2_makeup_gap_invalid: "보강 인접 간격은 0~100분으로 설정해 주세요.",
      schedule_v2_admin_required: "관리자 권한이 필요합니다.",
      schedule_v2_closure_date_required: "휴무 날짜를 선택해 주세요.",
      schedule_v2_closure_time_invalid: "휴무 시작·종료 시간을 확인해 주세요.",
      schedule_v2_closure_overlap: "같은 날짜와 시간에 겹치는 휴무가 이미 있습니다.",
      schedule_v2_closure_not_found: "이미 해제되었거나 찾을 수 없는 휴무입니다. 시간표를 새로고침해 주세요.",
      schedule_v2_closure_reference_required: "해제할 휴무를 다시 선택해 주세요.",
      schedule_v2_closure_policy_invalid: "기존 수업 처리 방법을 다시 선택해 주세요.",
      schedule_v2_policy_revision_conflict: "다른 관리자가 운영 규칙을 먼저 변경했습니다. 최신 설정을 다시 불러온 뒤 저장해 주세요.",
      schedule_v2_closure_participant_ticket_review_required: "회원권 연결을 확인해야 하는 수업이 있어 휴무 처리를 중단했습니다. 기존 수업 목록을 확인해 주세요.",
      schedule_v2_operation_date_required: "운영 날짜를 선택해 주세요.",
      schedule_v2_operation_mode_invalid: "휴무, 정상 운영, 단축 운영 중 하나를 선택해 주세요.",
      schedule_v2_operation_time_invalid: "단축 운영 시작·종료 시간을 확인해 주세요.",
      schedule_v2_operation_reference_required: "해제할 운영일을 다시 선택해 주세요.",
      schedule_v2_operation_not_found: "이미 해제되었거나 찾을 수 없는 운영일입니다. 시간표를 새로고침해 주세요.",
      schedule_v2_operation_changed: "다른 화면에서 운영일을 먼저 변경했습니다. 새로고침 후 다시 확인해 주세요.",
      schedule_v2_operation_branch_forbidden: "이 지점의 운영일을 확인할 권한이 없습니다.",
      schedule_v2_operation_key_required: "중복 방지 정보가 없어 저장을 중단했습니다. 다시 시도해 주세요.",
      schedule_v2_substitute_time_overlap: "대타 코치의 다른 수업과 시간이 겹칩니다.",
      schedule_v2_substitute_coach_unavailable: "현재 근무 중인 대타 코치를 선택해 주세요.",
      schedule_v2_substitute_same_as_original: "원 담당 코치와 다른 코치를 선택해 주세요.",
      schedule_v2_substitute_hourly_amount_required: "시급 정산 금액을 입력해 주세요.",
      schedule_v2_outcome_status_invalid: "이미 처리되거나 취소된 수업입니다. 새로고침 후 확인해 주세요.",
      schedule_v2_closed_lesson_edit_forbidden: "완료·취소된 수업 기록은 일반 수정할 수 없습니다. 취소 기록은 보존하고 빈 자리에 새 수업을 등록해 주세요.",
      schedule_v2_outcome_ticket_units_unavailable: "차감할 회원권 잔여 횟수가 부족합니다.",
      schedule_v2_outcome_participant_ticket_mismatch: "수업 회원과 회원권 연결이 맞지 않습니다.",
      schedule_v2_feedback_comment_required: "완료 수업의 피드백을 5자 이상 입력해 주세요.",
      schedule_v2_feedback_placeholder_forbidden: "'테스트 기간'은 완료 피드백으로 저장할 수 없습니다. 실제 수업 피드백을 입력해 주세요.",
      schedule_v2_feedback_revision_reference_required: "최신 피드백 정보를 다시 불러온 뒤 수정해 주세요.",
      schedule_v2_feedback_revision_forbidden: "담당 코치 또는 관리자만 완료 피드백을 수정할 수 있습니다.",
      schedule_v2_feedback_revision_final_completed_required: "완료된 출석 수업의 피드백만 수정할 수 있습니다.",
      schedule_v2_feedback_revision_stale: "다른 화면에서 피드백을 먼저 수정했습니다. 새로고침 후 다시 확인해 주세요.",
      schedule_v2_next_curriculum_required: "완료 수업의 다음 커리큘럼을 선택해 주세요.",
      schedule_v2_shared_ticket_policy_required: "같은 공유 회원권을 두 번 차감할 수 없습니다. 1:2 차감 방식을 관리자에서 확인해 주세요.",
      schedule_v2_representative_ticket_owner_required: "대표회원 기준 차감 상품입니다. 회원권 대표회원 행에서 정정해 주세요.",
      schedule_v2_correction_admin_required: "누락 차감 정정은 관리자만 할 수 있습니다.",
      schedule_v2_correction_reference_required: "정정할 수업·회원·회원권 정보를 다시 확인해 주세요.",
      schedule_v2_correction_reason_required: "정정 사유를 2자 이상 입력해 주세요.",
      schedule_v2_correction_final_record_required: "완료된 참여자 기록에서만 차감을 정정할 수 있습니다.",
      schedule_v2_correction_ticket_mismatch: "완료 기록과 선택한 회원권이 일치하지 않습니다.",
      schedule_v2_correction_ticket_balance_insufficient: "회원권 잔여 횟수가 부족해 누락 차감을 반영할 수 없습니다.",
      schedule_v2_correction_ticket_count_inconsistent: "회원권 사용 횟수가 기록과 달라 자동 복구할 수 없습니다.",
      schedule_v2_no_show_reason_required: "노쇼 사유를 2자 이상 입력해 주세요.",
      schedule_v2_legacy_outcome_already_processed: "기존 방식으로 이미 처리된 수업입니다.",
      schedule_v2_outcome_partial_final_state: "일부 회원만 완료된 비정상 상태입니다. 관리자 점검이 필요합니다.",
      schedule_v2_series_capacity_unavailable: "이미 예정된 미래수업을 제외한 남은 횟수가 부족합니다. 회원권 잔여 횟수와 기존 미래수업을 확인해 주세요.",
      schedule_v2_staff_cancel_no_show_record_required: "노쇼 처리 기록을 확인할 수 없어 관리자 취소를 중단했습니다. 최신 시간표를 다시 불러와 주세요.",
      schedule_v2_staff_cancel_mixed_outcome_review_required: "그룹 참여자의 처리 상태가 서로 달라 자동 취소할 수 없습니다. 수업 기록을 먼저 확인해 주세요.",
      schedule_v2_staff_cancel_journal_review_required: "회원 운동일지와 연결된 수업은 자동 취소할 수 없습니다. 기록 보존 여부를 먼저 확인해 주세요.",
      schedule_v2_staff_cancel_makeup_review_required: "이미 보강 권리 또는 보강 예약과 연결된 수업은 자동 취소할 수 없습니다. 보강 상태를 먼저 확인해 주세요.",
      schedule_v2_staff_cancel_refund_review_required: "환불 처리 중인 회원권과 연결되어 있어 자동 취소할 수 없습니다. 결제·환불 상태를 먼저 확인해 주세요.",
      schedule_v2_staff_cancel_ticket_count_inconsistent: "노쇼 차감 횟수와 회원권 사용 횟수가 맞지 않아 자동 복원하지 않았습니다. 회원권 기록을 확인해 주세요.",
      schedule_v2_regular_anchor_conflict: "같은 요일·시간의 정규시간이 이미 다른 조건으로 연결되어 있습니다.",
      schedule_v2_regular_anchor_not_found: "이 수업은 새 시간표 정규 기준점과 연결되지 않았습니다. 이번 수업만 변경하거나 시간 미배정 목록에서 다시 연결해 주세요.",
      schedule_v2_regular_end_reference_required: "종료할 정규수업을 다시 선택해 주세요.",
      schedule_v2_regular_end_reason_required: "정규시간 종료 사유를 확인해 주세요.",
      schedule_v2_regular_end_no_future_lesson: "종료할 미래 정규수업이 없습니다. 시간표를 새로고침해 주세요.",
      schedule_v2_regular_revision_past_forbidden: "지난 수업은 이후 정규일정 변경의 기준으로 사용할 수 없습니다.",
      schedule_v2_regular_revision_start_before_source: "선택한 회차보다 앞에서 시작하려면 더 이른 정규수업을 먼저 선택해 주세요.",
      schedule_v2_regular_revision_participants_invalid: "정규수업의 회원·회원권 연결을 확인해 주세요.",
      schedule_v2_regular_revision_unavailable: "예정된 정규수업에서만 이후 일정을 변경할 수 있습니다.",
      schedule_v2_saved_refresh_failed: "저장은 완료됐지만 최신 시간표를 불러오지 못했습니다. 저장 버튼을 다시 누르지 말고 시간표 새로고침을 눌러 주세요.",
      lesson_not_found: "이미 삭제되었거나 다른 화면에서 변경된 수업입니다. 시간표를 새로고침해 주세요.",
      lesson_correction_ticket_inconsistent: "회원권 횟수와 완료 기록이 맞지 않아 자동 복원을 중단했습니다. 관리자 데이터 확인이 필요합니다.",
      one_day_lesson_time_conflict: "같은 코치의 수업과 시간이 겹칩니다.",
      one_day_booking_time_conflict: "같은 코치의 다른 원데이 예약과 시간이 겹칩니다.",
      one_day_guest_name_required: "원데이 이름을 두 글자 이상 입력해 주세요.",
      one_day_booking_source_invalid: "원데이 예약 경로를 다시 선택해 주세요.",
      one_day_payment_status_invalid: "원데이 수납 상태를 다시 선택해 주세요.",
      one_day_payment_method_invalid: "원데이 결제수단을 다시 선택해 주세요.",
      one_day_paid_method_required: "수납 완료는 결제수단을 선택해 주세요.",
      one_day_paid_amount_required: "수납 완료는 결제금액을 1원 이상 입력해 주세요.",
      approved_branch_coach_required: "현재 지점의 승인된 코치를 선택해 주세요.",
    };
    const key = Object.keys(labels).find((candidate) => source.includes(candidate));
    return key ? labels[key] : `저장하지 못했습니다. ${source}`;
  }

  function validateParticipants(kind, duration) {
    if (kind === "one_day") return "";
    if (!state.selectedParticipants.length) return kind === "one_day" ? "검색 결과에서 정확한 회원을 선택해 주세요." : "회원권을 먼저 선택해 주세요.";
    const tickets = [...new Set(state.selectedParticipants.map((participant) => participant.ticketId))].map(ticketById).filter(Boolean);
    if (tickets.length !== new Set(state.selectedParticipants.map((participant) => participant.ticketId)).size) return kind === "one_day" ? "선택한 회원 정보를 다시 확인해 주세요." : "회원권 정보를 다시 선택해 주세요.";
    const groupTicket = tickets.find((ticket) => Number(ticket.groupSize ?? ticket.group_size) === 2);
    if (kind !== "one_day" && groupTicket && state.selectedParticipants.length < 2) return "1:2 회원권은 두 회원 연결이 필요합니다.";
    if (tickets.some((ticket) => !ticketMatchesKind(ticket, kind))) return "선택한 수업 종류와 회원권이 맞지 않습니다.";
    const lessonDate = $("#scheduleV2EditorForm")?.elements?.lessonDate?.value || state.selectedDate;
    if (tickets.some((ticket) => !ticketSelectableForLesson(ticket, lessonDate, {
      allowNoBalance: adminMayScheduleWithoutBalance(),
    }))) return "수업일에 사용 가능한 회원권을 선택해 주세요.";
    const mismatchedTickets = tickets.filter((ticket) => (
      duration % Math.max(1, Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20) !== 0
    ));
    if (mismatchedTickets.length) {
      const ticketMinutes = [...new Set(mismatchedTickets.map((ticket) => (
        Math.max(1, Number(ticket.lessonMinutes ?? ticket.lesson_minutes) || 20)
      )))].sort((left, right) => left - right);
      return `선택한 회원권은 ${ticketMinutes.map((minutes) => `${minutes}분`).join("·")} 단위입니다. ${duration}분 수업으로 저장하려면 회원관리에서 먼저 ${duration}분 회원권으로 변경해 주세요.`;
    }
    return "";
  }

  function normalizedSaveResult(result) {
    return Array.isArray(result) ? result[0] || {} : result || {};
  }

  function optimisticLessonFromEditor({ form, duration, kind, participants, result, oneDay = false, guestName = "" }) {
    const normalized = normalizedSaveResult(result);
    const previous = state.editingLesson || {};
    const bookingId = String(normalized.bookingId || previous.oneDayBookingId || "");
    const lessonId = String(normalized.lessonId || previous.id || (oneDay && bookingId ? `one-day-${bookingId}` : ""));
    if (!lessonId) return null;
    const normalizedParticipants = (participants || []).map((participant) => ({
      ...participant,
      name: participant.name || memberName(participant.userId),
    }));
    return {
      ...previous,
      id: lessonId,
      revision: Number(normalized.revision) || Math.max(1, Number(previous.revision || 0) + 1),
      coachRoleId: form.elements.coachRoleId.value,
      lessonDate: form.elements.lessonDate.value,
      startTime: form.elements.startTime.value,
      durationMinutes: duration,
      scheduleKind: kind,
      status: oneDay ? "scheduled" : (["scheduled", "pending_change"].includes(previous.status) ? previous.status : "scheduled"),
      participants: normalizedParticipants,
      memberLabel: oneDay ? guestName : normalizedParticipants.map((participant) => participant.name).filter(Boolean).join(" · "),
      note: form.elements.note.value.trim(),
      oneDayBooking: oneDay,
      oneDayBookingId: oneDay ? bookingId : "",
      linkedUserId: oneDay ? String(normalizedParticipants[0]?.userId || "") : "",
      oneDayBookingSource: oneDay ? form.elements.oneDayBookingSource?.value || "walk_in" : "",
      oneDayPaymentStatus: oneDay ? form.elements.oneDayPaymentStatus?.value || "unpaid" : "",
      oneDayPaymentMethod: oneDay ? form.elements.oneDayPaymentMethod?.value || "" : "",
      oneDayPaymentAmount: oneDay ? Math.max(0, Number(form.elements.oneDayPaymentAmount?.value) || 0) : 0,
    };
  }

  function upsertOptimisticLesson(lesson, viewState) {
    if (!lesson || !state.payload) return false;
    state.payload.lessons = [
      ...(state.payload.lessons || []).filter((item) => String(item.id) !== String(lesson.id)),
      lesson,
    ];
    const snapshot = bridge()?.snapshot?.() || {};
    const dates = weekDates();
    if (snapshot.branchId) cacheWorkspace(workspaceCacheKey(snapshot.branchId, dates), state.payload);
    if (viewState) viewState.focus = { type: "lesson", value: lesson.id };
    renderWorkspacePreservingView(viewState);
    return true;
  }

  function isSeriesCapacityError(error) {
    return String(error?.message || error?.payload?.message || error || "")
      .includes("schedule_v2_series_capacity_unavailable");
  }

  function closeEditorAfterSuccessfulSave(lesson, viewState, message, tone = "success") {
    if (history.state?.tennisNoteScheduleV2Editor) {
      history.replaceState({ ...(history.state || {}), tennisNoteScheduleV2Editor: false }, "");
    }
    state.deferredRefresh = false;
    actualCloseEditor();
    if (!upsertOptimisticLesson(lesson, viewState)) restoreWorkspaceViewState(viewState);
    setStatus(message, tone);
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 화면만 확인할 수 있습니다. 운영 데이터는 변경하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const form = event.currentTarget;
    const api = bridge();
    const snapshot = api?.snapshot?.() || {};
    const kind = selectedKind();
    const duration = Number(form.elements.durationMinutes.value) || 20;
    const nativeOneDay = kind === "one_day" && (!state.editingLesson || state.editingLesson.oneDayBooking);
    const oneDayGuestName = String(state.selectedParticipants[0]?.name || $("#scheduleV2MemberSearch")?.value || "").trim();
    const oneDayPaymentStatus = form.elements.oneDayPaymentStatus?.value || "unpaid";
    const oneDayPaymentMethod = form.elements.oneDayPaymentMethod?.value || "";
    const oneDayPaymentAmount = Math.max(0, Number(form.elements.oneDayPaymentAmount?.value) || 0);
    const validation = nativeOneDay
      ? oneDayGuestName.length < 2
        ? "원데이 이름을 두 글자 이상 입력해 주세요."
        : oneDayPaymentStatus === "paid" && !oneDayPaymentMethod
          ? "수납 완료 결제수단을 선택해 주세요."
          : oneDayPaymentStatus === "paid" && oneDayPaymentAmount <= 0
            ? "수납 완료 금액을 입력해 주세요."
            : ""
      : validateParticipants(kind, duration);
    if (validation) {
      setEditorMessage(validation);
      return;
    }
    const placementMessage = placementConflictMessage({
      date: form.elements.lessonDate.value,
      startTime: form.elements.startTime.value,
      coachRoleId: form.elements.coachRoleId.value,
      durationMinutes: duration,
      ignoredLessonId: state.editingLesson?.id || null,
    });
    if (placementMessage) {
      setEditorMessage(placementMessage);
      return;
    }
    if (state.editingLesson && !nativeOneDay && !Number.isFinite(Number(state.editingLesson.revision))) {
      setEditorMessage("이 수업의 최신 변경번호를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }
    if (!snapshot.branchId || (nativeOneDay ? !api?.saveOneDayBooking : !api?.rpc)) {
      setEditorMessage("관리자 로그인과 운영 지점을 확인해 주세요.");
      return;
    }
    const saveButton = $("#scheduleV2SaveButton");
    const savedViewState = captureWorkspaceViewState({ focusLessonId: state.editingLesson?.id || "" });
    saveButton.disabled = true;
    setEditorMessage("서버에 저장하는 중입니다.", "info");
    if (nativeOneDay) {
      try {
        const savedOneDay = await api.saveOneDayBooking({
          bookingId: state.editingLesson?.oneDayBookingId || null,
          coachRoleId: form.elements.coachRoleId.value,
          bookingDate: form.elements.lessonDate.value,
          startTime: form.elements.startTime.value,
          durationMinutes: duration,
          guestName: oneDayGuestName,
          selectedUserId: state.selectedParticipants[0]?.userId || "",
          note: form.elements.note.value.trim(),
          bookingSource: form.elements.oneDayBookingSource?.value || "walk_in",
          paymentStatus: oneDayPaymentStatus,
          paymentMethod: oneDayPaymentMethod,
          paymentAmount: oneDayPaymentAmount,
        });
        const optimisticLesson = optimisticLessonFromEditor({
          form,
          duration,
          kind,
          participants: state.selectedParticipants,
          result: savedOneDay,
          oneDay: true,
          guestName: oneDayGuestName,
        });
        const successMessage = `${oneDayGuestName} 원데이 예약 완료 · 회원권 차감 없음`;
        closeEditorAfterSuccessfulSave(optimisticLesson, savedViewState, successMessage);
        const refreshed = await refreshWorkspaceAfterWrite(api, savedViewState);
        if (refreshed) setStatus(successMessage, "success");
      } catch (error) {
        setEditorMessage(errorMessage(error));
      } finally {
        saveButton.disabled = false;
      }
      return;
    }
    const participants = state.selectedParticipants.map((participant) => ({ userId: participant.userId, ticketId: participant.ticketId }));
    const hasInsufficientBalance = [...new Set(participants.map((participant) => participant.ticketId))]
      .map(ticketById)
      .filter(Boolean)
      .some((ticket) => Number(ticket.remainingSessions ?? ticket.remaining_sessions) <= 0);
    const editScope = selectedRegularEditScope();
    if (editScope === "future") {
      if (!regularSeriesEditEligible() || kind !== "regular") {
        setEditorMessage("예정된 정규수업에서만 이후 정규일정을 변경할 수 있습니다.");
        saveButton.disabled = false;
        return;
      }
      if (form.elements.lessonDate.value < localDateKey(new Date())) {
        setEditorMessage("이후 정규일정은 오늘 이후 날짜부터 변경할 수 있습니다.");
        saveButton.disabled = false;
        return;
      }
      if (form.elements.lessonDate.value < state.editingLesson.lessonDate) {
        setEditorMessage("선택한 회차보다 앞에서 시작하려면 더 이른 정규수업을 먼저 선택해 주세요.");
        saveButton.disabled = false;
        return;
      }
      if (participantSignature(participants) !== participantSignature(state.editingLesson?.participants || [])) {
        setEditorMessage("이후 정규일정 변경에서는 기존 회원과 회원권을 유지해 주세요.");
        saveButton.disabled = false;
        return;
      }
    }
    let saveResult = null;
    let successMessage = "서버 저장 완료 · 최신 시간표를 다시 확인했습니다.";
    let successTone = "success";
    let balanceWarningFallback = false;
    try {
      if (state.editingLesson && editScope === "future") {
        const prepared = regularRuleFromEditor(form, duration, participants);
        if (prepared.error) throw new Error(prepared.error);
        saveResult = await api.rpc("tn_schedule_v2_revise_regular_anchor", {
          target_lesson_id: state.editingLesson.id,
          target_expected_revision: state.editingLesson.revision,
          target_new_rule: prepared.rule,
          target_operation_key: operationKey("admin-regular-revise"),
        });
        const normalizedRevision = Array.isArray(saveResult) ? saveResult[0] || {} : saveResult || {};
        const fillResult = normalizedRevision.fillResult || {};
        successMessage = fillResult.anchorPending
          ? "정규시간 변경 완료 · 필요한 나머지 정규시간을 시간표에서 선택해 주세요."
          : `정규시간 변경 완료 · 기존 미래 ${Number(normalizedRevision.cancelledFutureCount) || 0}회는 취소 이력으로 보존했습니다.`;
      } else if (!state.editingLesson && kind === "regular" && form.elements.fillSeries.checked) {
        const prepared = regularRuleFromEditor(form, duration, participants);
        if (prepared.error) throw new Error(prepared.error);
        try {
          saveResult = await api.rpc("tn_schedule_v2_fill_regular_series", {
            target_branch_id: snapshot.branchId,
            target_participants: participants,
            target_rules: [prepared.rule],
            target_operation_key: operationKey("admin-series"),
            target_replace_v2_rules: false,
          });
          if (singleAnchorNeedsFillVerification(saveResult, prepared, duration)) {
            const firstResult = Array.isArray(saveResult) ? saveResult[0] || {} : saveResult || {};
            const verifiedResult = await api.rpc("tn_schedule_v2_fill_regular_series", {
              target_branch_id: snapshot.branchId,
              target_participants: participants,
              target_rules: [prepared.rule],
              target_operation_key: operationKey("admin-series-verify"),
              target_replace_v2_rules: false,
            });
            const normalizedVerified = Array.isArray(verifiedResult) ? verifiedResult[0] || {} : verifiedResult || {};
            saveResult = {
              ...normalizedVerified,
              createdCount: Number(firstResult.createdCount || 0) + Number(normalizedVerified.createdCount || 0),
            };
          }
        } catch (seriesError) {
          if (!isSeriesCapacityError(seriesError)) throw seriesError;
          saveResult = await api.rpc("tn_schedule_v2_save_lesson", {
            target_branch_id: snapshot.branchId,
            target_coach_role_id: form.elements.coachRoleId.value,
            target_lesson_date: form.elements.lessonDate.value,
            target_start_time: form.elements.startTime.value,
            target_duration_minutes: duration,
            target_schedule_kind: kind,
            target_participants: participants,
            target_operation_key: operationKey("admin-balance-warning-lesson"),
            target_lesson_id: null,
            target_expected_revision: null,
            target_request_id: null,
            target_note: form.elements.note.value.trim() || null,
          });
          balanceWarningFallback = true;
          successTone = "warning";
          successMessage = "이번 수업은 저장됨 · 잔여 횟수가 부족해 반복 일정은 만들지 않았습니다. 회원권을 연장해 주세요.";
        }
      } else {
        saveResult = await api.rpc("tn_schedule_v2_save_lesson", {
          target_branch_id: snapshot.branchId,
          target_coach_role_id: form.elements.coachRoleId.value,
          target_lesson_date: form.elements.lessonDate.value,
          target_start_time: form.elements.startTime.value,
          target_duration_minutes: duration,
          target_schedule_kind: kind,
          target_participants: participants,
          target_operation_key: operationKey("admin-lesson"),
          target_lesson_id: state.editingLesson?.id || null,
          target_expected_revision: state.editingLesson?.revision || null,
          target_request_id: null,
          target_note: form.elements.note.value.trim() || null,
        });
      }
      if (hasInsufficientBalance && !balanceWarningFallback) {
        successTone = "warning";
        successMessage = "수업 저장 완료 · 잔여 횟수가 부족합니다. 수업 전 회원권을 연장해 주세요.";
      }
      const normalizedResult = normalizedSaveResult(saveResult);
      if (!balanceWarningFallback && normalizedResult.anchorPending) {
        const missingUnits = Object.values(normalizedResult.missingWeeklyUnitsByTicket || {})
          .map(Number)
          .filter((value) => Number.isFinite(value) && value > 0);
        const missingCount = missingUnits.length ? Math.max(...missingUnits) : 1;
        successMessage = `정규시간 저장 완료 · 시간표에서 ${missingCount}개 시간을 더 선택해 주세요.`;
      } else if (!balanceWarningFallback && Number(normalizedResult.createdCount) > 1) {
        successMessage = `정규시간 저장 완료 · 미래수업 ${Number(normalizedResult.createdCount)}회가 연결되었습니다.`;
      }
      const optimisticLesson = optimisticLessonFromEditor({ form, duration, kind, participants, result: saveResult });
      closeEditorAfterSuccessfulSave(optimisticLesson, savedViewState, successMessage, successTone);
      const refreshed = await refreshWorkspaceAfterWrite(api, savedViewState);
      if (refreshed) setStatus(successMessage, successTone);
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      saveButton.disabled = false;
    }
  }

  async function cancelLesson() {
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 수업을 취소하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const lesson = state.editingLesson;
    const futureScope = regularSeriesEditEligible(lesson) && selectedRegularEditScope() === "future";
    const pastNoShowCancellation = lessonRequiresPastNoShowCancellation(lesson);
    if (!lesson) return;
    const confirmation = futureScope
      ? "이 회차부터 같은 정규시간을 종료할까요? 지난 수업과 완료 기록은 유지되고, 예정 수업은 취소 이력으로 보존됩니다."
      : pastNoShowCancellation
        ? "이 과거 노쇼를 관리자 취소로 바꿀까요? 기존 노쇼 차감은 복원되고, 원본 처리 내역과 취소 사유는 이력으로 보존됩니다."
        : "이 수업을 취소할까요? 회원권 횟수는 차감하지 않습니다.";
    const api = bridge();
    const button = $("#scheduleV2CancelLessonButton");
    const confirmationKey = `${lesson.id}:${lesson.revision}:${futureScope ? "future" : "single"}`;
    if (state.cancelConfirmationKey !== confirmationKey) {
      state.cancelConfirmationKey = confirmationKey;
      button.dataset.confirming = "true";
      button.textContent = futureScope ? "종료 확인" : pastNoShowCancellation ? "관리자 취소 확인" : "취소 확인";
      setEditorMessage(`${confirmation} 이 버튼을 한 번 더 누르면 적용됩니다.`, "warning");
      return;
    }
    state.cancelConfirmationKey = "";
    delete button.dataset.confirming;
    button.disabled = true;
    button.textContent = futureScope ? "종료 중..." : pastNoShowCancellation ? "노쇼 차감 복원 중..." : "취소 중...";
    setEditorMessage(
      futureScope
        ? "이후 정규시간을 종료하는 중입니다."
        : pastNoShowCancellation
          ? "과거 노쇼 차감을 복원하고 관리자 취소 이력을 저장하는 중입니다."
          : "수업을 취소하는 중입니다.",
      "info",
    );
    try {
      let cancelResult = null;
      if (futureScope) {
        cancelResult = await api.rpc("tn_schedule_v2_end_regular_anchor", {
          target_lesson_id: lesson.id,
          target_expected_revision: lesson.revision,
          target_reason: "관리자 시간표에서 이후 정규시간 종료",
          target_operation_key: operationKey("admin-regular-end"),
        });
      } else {
        cancelResult = await api.rpc("tn_schedule_v2_cancel_lesson", {
          target_lesson_id: lesson.id,
          target_expected_revision: lesson.revision,
          target_operation_key: operationKey("admin-cancel"),
          target_reason: "관리자 시간표에서 취소",
        });
      }
      if (history.state?.tennisNoteScheduleV2Editor) history.replaceState({ ...(history.state || {}), tennisNoteScheduleV2Editor: false }, "");
      state.deferredRefresh = false;
      actualCloseEditor();
      const refreshed = await refreshWorkspaceAfterWrite(api);
      if (refreshed) {
        const restoredSessions = Math.max(0, Number(cancelResult?.restoredSessions) || 0);
        setStatus(
          futureScope
            ? "이후 정규시간 종료 완료 · 과거 기록은 유지했습니다."
            : pastNoShowCancellation
              ? `관리자 취소 완료 · 노쇼 차감 ${restoredSessions}회 복원 · 원본 이력 보존`
              : "수업 취소 완료",
          "success",
        );
      }
      void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      button.disabled = false;
      if (state.editorOpen) syncRegularEditScope();
    }
  }

  async function restoreAbsentLesson(lessonId) {
    if (localDemoMode || !requireWritableServer("status")) return;
    const lesson = state.payload?.lessons.find((item) => String(item.id) === String(lessonId));
    if (!lessonAbsenceCanBeRestored(lesson)) {
      setStatus("복원 가능한 실제 불참 기록이 아닙니다. 시간표를 새로고침해 주세요.", "warning");
      return;
    }
    const context = lessonCancellationContext(lesson);
    const cancelBookedMakeup = context.entitlement.status === "booked";
    const confirmation = cancelBookedMakeup
      ? `${lessonParticipantLabel(lesson)} 회원의 원래 정규수업을 복원할까요? 예약된 보강 수업은 취소됩니다.`
      : `${lessonParticipantLabel(lesson)} 회원의 원래 정규수업을 복원할까요? 불참 처리와 보강 대기는 취소됩니다.`;
    if (!window.confirm(confirmation)) return;
    const button = $(`[data-v2-restore-absence="${CSS.escape(String(lesson.id))}"]`);
    if (button) button.disabled = true;
    setStatus("원래 정규수업을 복원하는 중입니다.");
    try {
      await bridge().rpc("tn_restore_absent_lesson", {
        target_entitlement_id: context.entitlement.id,
        target_reason: "관리자 시간표에서 회원 참석 재확인",
        target_cancel_booked_makeup: cancelBookedMakeup,
      });
      const refreshed = await refreshWorkspaceAfterWrite(bridge());
      if (refreshed) setStatus("원래 정규수업 복원 완료", "success");
      void bridge()?.refresh?.();
    } catch (error) {
      const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
      const message = code.includes("absence_original_slot_occupied")
        ? "원래 시간에 다른 수업이 있어 복원할 수 없습니다."
        : code.includes("absence_original_lesson_already_started")
          ? "이미 시작한 정규수업은 복원할 수 없습니다."
          : code.includes("absence_booked_makeup_locked")
            ? "이미 시작하거나 완료된 보강이 있어 복원할 수 없습니다."
            : "정규수업 복원에 실패했습니다. 시간표를 새로고침해 주세요.";
      setStatus(message, "error");
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  async function restoreCancelledLesson(lessonId) {
    if (localDemoMode || !requireWritableServer("status")) return;
    const lesson = state.payload?.lessons.find((item) => String(item.id) === String(lessonId));
    if (!lessonStaffCancellationCanBeRestored(lesson)) {
      setStatus("복구 가능한 관리자 취소 수업이 아닙니다. 시간표를 새로고침해 주세요.", "warning");
      return;
    }
    const confirmation = `${lessonParticipantLabel(lesson)} 회원의 취소 수업을 같은 날짜와 시간으로 복구할까요?`;
    if (!window.confirm(confirmation)) return;
    const button = $(`[data-v2-restore-cancelled="${CSS.escape(String(lesson.id))}"]`);
    if (button) button.disabled = true;
    setStatus("취소 수업을 원래 자리로 복구하는 중입니다.");
    try {
      await bridge().rpc("tn_schedule_v2_restore_cancelled_lesson", {
        target_lesson_id: lesson.id,
        target_expected_revision: lesson.revision,
        target_operation_key: operationKey("admin-cancel-restore"),
        target_reason: "관리자 시간표에서 취소 수업 복구",
      });
      const refreshed = await refreshWorkspaceAfterWrite(bridge());
      if (refreshed) setStatus("취소 수업 복구 완료 · 기존 수업 기록을 그대로 살렸습니다.", "success");
      void bridge()?.refresh?.();
    } catch (error) {
      const code = String(error?.payload?.message || error?.payload?.code || error?.message || "server_error");
      const message = code.includes("original_slot_occupied")
        ? "원래 시간에 다른 수업이 있어 복구할 수 없습니다. 새 수업으로 등록해 주세요."
        : code.includes("already_started")
          ? "이미 시작한 수업은 복구할 수 없습니다."
          : code.includes("ticket_unavailable")
            ? "회원권이 만료·소진·중지되어 복구할 수 없습니다. 회원권을 먼저 확인해 주세요."
            : code.includes("approved_coach_required")
              ? "담당 코치가 현재 유효하지 않아 복구할 수 없습니다."
              : code.includes("branch_closed") || code.includes("blocked_time") || code.includes("outside_working_hours")
                ? "현재 휴무 또는 코치 수업 불가 시간이라 복구할 수 없습니다."
                : code.includes("concurrent_update")
                  ? "다른 변경이 먼저 반영되었습니다. 시간표를 새로고침한 뒤 다시 시도해 주세요."
                  : code.includes("absence_flow_required")
                    ? "불참 수업은 ‘원래 수업 복원’ 기능을 이용해 주세요."
                    : "취소 수업 복구에 실패했습니다. 시간표를 새로고침해 주세요.";
      setStatus(message, "error");
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  async function deleteLesson() {
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 수업을 삭제하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const lesson = state.editingLesson || state.reopeningLesson;
    if (!lesson) return;
    const participantNames = lessonParticipantLabel(lesson) || "선택한 회원";
    const confirmation = lesson.oneDayBooking
      ? `${participantNames} ${dateLabel(lesson.lessonDate)} ${lesson.startTime} 원데이 예약을 삭제할까요?`
      : `${participantNames} ${dateLabel(lesson.lessonDate)} ${lesson.startTime} 수업을 삭제할까요?\n\n완료·노쇼 수업의 차감 횟수는 복원되고 삭제 사실은 변경 이력에 남습니다.`;
    if (!window.confirm(confirmation)) return;
    const api = bridge();
    const button = $("#scheduleV2DeleteLessonButton");
    button.disabled = true;
    setEditorMessage(lesson.oneDayBooking ? "원데이 예약을 삭제하는 중입니다." : "수업 기록과 차감 횟수를 확인해 삭제하는 중입니다.", "info");
    try {
      const result = lesson.oneDayBooking
        ? await api.archiveOneDayBooking?.(lesson.oneDayBookingId)
        : await api.rpc("tn_admin_force_delete_lesson", {
          target_lesson_id: lesson.id,
          target_reason: "관리자 V2 시간표 수업 삭제",
        });
      const restoredSessions = Number(result?.restoredSessions || 0);
      if (history.state?.tennisNoteScheduleV2Editor) history.replaceState({ ...(history.state || {}), tennisNoteScheduleV2Editor: false }, "");
      state.deferredRefresh = false;
      actualCloseEditor();
      if (lesson.oneDayBooking) {
        if (state.payload) {
          const bookingId = String(lesson.oneDayBookingId || lesson.one_day_booking_id || lesson.id || "");
          state.payload = {
            ...state.payload,
            lessons: (state.payload.lessons || []).filter((item) => String(
              item.oneDayBookingId || item.one_day_booking_id || item.id || "",
            ) !== bookingId),
          };
        }
        if (api.refresh) await Promise.allSettled([api.refresh({ allowWhileDirty: true })]);
      }
      const refreshed = await refreshWorkspaceAfterWrite(api);
      if (refreshed) setStatus(lesson.oneDayBooking ? "원데이 예약 삭제 완료" : `수업 삭제 완료${restoredSessions ? ` · ${restoredSessions}회 복원` : ""}`, "success");
      if (!lesson.oneDayBooking) void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  async function assignSubstitute() {
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 대타 정보를 저장하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const lesson = state.editingLesson;
    const api = bridge();
    const form = $("#scheduleV2EditorForm");
    const button = $("#scheduleV2AssignSubstituteButton");
    if (!lesson || !api?.rpc) return;
    const substituteCoachRoleId = form.elements.substituteCoachRoleId.value;
    const settlementMode = form.elements.substituteSettlementMode.value;
    const hourlyAmount = Number(form.elements.substituteHourlyAmount.value) || null;
    if (!substituteCoachRoleId) {
      setEditorMessage("대타 코치를 선택해 주세요.");
      return;
    }
    if (settlementMode === "hourly" && !hourlyAmount) {
      setEditorMessage("시급 정산 금액을 입력해 주세요.");
      return;
    }
    button.disabled = true;
    setEditorMessage("대타 정보를 저장하는 중입니다.", "info");
    try {
      await api.rpc("tn_schedule_v2_assign_substitutes", {
        target_lesson_ids: [lesson.id],
        target_substitute_coach_role_id: substituteCoachRoleId,
        target_settlement_mode: settlementMode,
        target_hourly_amount: settlementMode === "hourly" ? hourlyAmount : null,
        target_reason: form.elements.substituteReason.value.trim() || null,
        target_expected_revisions: { [lesson.id]: lesson.revision },
        target_operation_key: operationKey("admin-substitute"),
      });
      setStatus("대타를 저장했습니다. 수업은 원 담당 코치 열에 유지됩니다.", "success");
      if (history.state?.tennisNoteScheduleV2Editor) history.replaceState({ ...(history.state || {}), tennisNoteScheduleV2Editor: false }, "");
      state.deferredRefresh = false;
      actualCloseEditor();
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ force: true });
      void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  async function cancelSubstitute() {
    if (localDemoMode) {
      setEditorMessage("로컬 데모에서는 대타 지정을 취소하지 않습니다.", "info");
      return;
    }
    if (!requireWritableServer()) return;
    const lesson = state.editingLesson;
    const api = bridge();
    const form = $("#scheduleV2EditorForm");
    const button = $("#scheduleV2CancelSubstituteButton");
    if (!lesson?.substitute || !api?.rpc) return;
    button.disabled = true;
    setEditorMessage("대타 지정을 취소하는 중입니다.", "info");
    try {
      await api.rpc("tn_schedule_v2_cancel_substitutes", {
        target_lesson_ids: [lesson.id],
        target_expected_revisions: { [lesson.id]: lesson.revision },
        target_reason: form.elements.substituteReason.value.trim() || "관리자 시간표에서 취소",
        target_operation_key: operationKey("admin-substitute-cancel"),
      });
      setStatus("대타 지정을 취소했습니다.", "success");
      if (history.state?.tennisNoteScheduleV2Editor) history.replaceState({ ...(history.state || {}), tennisNoteScheduleV2Editor: false }, "");
      state.deferredRefresh = false;
      actualCloseEditor();
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      await loadWorkspace({ force: true });
      void api.refresh?.();
    } catch (error) {
      setEditorMessage(errorMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  async function savePolicy() {
    if (localDemoMode) {
      setStatus("로컬 데모에서는 운영 규칙을 저장하지 않습니다.", "warning");
      return;
    }
    if (!requireWritableServer("status")) return;
    const api = bridge();
    const snapshot = api?.snapshot?.() || {};
    const panel = $("#scheduleV2PolicyPanel");
    const button = $("#scheduleV2PolicySaveButton");
    if (!snapshot.branchId || !api?.rpc) return;
    const panelValue = (name, fallback = "") => panel.querySelector(`[name="${name}"]`)?.value ?? fallback;
    const gapInput = panel.querySelector('[name="makeupAnchorGapMinutes"]');
    const makeupGapMinutes = Number(gapInput?.value);
    if (!Number.isInteger(makeupGapMinutes) || makeupGapMinutes < 0 || makeupGapMinutes > 100) {
      setStatus("보강 인접 간격은 0~100분으로 설정해 주세요.", "error");
      gapInput?.focus();
      return;
    }
    const autoHoursInput = panel.querySelector('[name="memberAutoApproveBeforeHours"]');
    const memberAutoApproveBeforeHours = autoHoursInput ? Number(autoHoursInput.value) : 24;
    if (!Number.isInteger(memberAutoApproveBeforeHours) || memberAutoApproveBeforeHours < 1 || memberAutoApproveBeforeHours > 168) {
      setStatus("자동 변경 기준은 1~168시간으로 설정해 주세요.", "error");
      autoHoursInput?.focus();
      return;
    }
    button.disabled = true;
    setStatus("운영 규칙을 저장하는 중입니다.");
    try {
      const saved = await api.rpc("tn_admin_save_schedule_v2_policy_v2", {
        target_branch_id: snapshot.branchId,
        target_revision: Number(state.payload?.policy?.revision) || 0,
        target_policy: {
          coach_single_add_mode: panelValue("coachSingleAddMode", "approval"),
          coach_regular_change_mode: panelValue("coachRegularChangeMode", "approval"),
          allow_cross_coach_member_edit: panelValue("allowCrossCoachMemberEdit", "false") === "true",
          allow_coach_locked_time_override: panelValue("allowCoachLockedTimeOverride", "true") === "true",
          allow_coach_holiday_override: panelValue("allowCoachHolidayOverride", "false") === "true",
          makeup_anchor_gap_minutes: makeupGapMinutes,
          member_change_enabled: panelValue("memberChangeEnabled", "true") === "true",
          member_auto_change_enabled: panelValue("memberAutoChangeEnabled", "true") === "true",
          member_auto_approve_before_hours: memberAutoApproveBeforeHours,
          member_within_cutoff_mode: panelValue("memberWithinCutoffMode", "coach_approval"),
          member_auto_reason_mode: panelValue("memberAutoReasonMode", "none"),
          member_approval_reason_mode: panelValue("memberApprovalReasonMode", "required"),
          group_member_change_mode: panelValue("groupMemberChangeMode", "coach_approval"),
        },
      });
      state.payload.policy = Array.isArray(saved) ? saved[0] || {} : saved || {};
      state.policyEditorDirty = false;
      setStatus("운영 규칙을 저장했습니다.", "success");
      renderPolicy({ force: true });
    } catch (error) {
      setStatus(errorMessage(error), "error");
    } finally {
      button.disabled = false;
    }
  }

  function requestLiveRefresh() {
    if (state.editorOpen) {
      state.deferredRefresh = true;
      return;
    }
    if (state.refreshTimer) window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      state.refreshTimer = null;
      if (state.postSaveRefreshPending) return;
      if (state.editorOpen) {
        state.deferredRefresh = true;
        return;
      }
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      void loadWorkspace({ quiet: true, force: true });
    }, 250);
  }

  async function refreshWorkspaceAfterWrite(api = bridge(), viewState = captureWorkspaceViewState()) {
    if (state.refreshTimer) {
      window.clearTimeout(state.refreshTimer);
      state.refreshTimer = null;
    }
    state.deferredRefresh = false;
    state.postSaveRefreshPending = true;
    invalidateCurrentWorkspaceCache();
    try {
      const refreshed = await loadWorkspace({
        quiet: true,
        force: true,
        absorbRevisionRefresh: true,
        preserveViewState: viewState,
      });
      if (refreshed && state.payload) return true;
      setStatus("저장은 완료됐습니다. 화면을 유지한 채 서버 최신값만 다시 확인해 주세요.", "warning", { retry: true });
      return false;
    } catch (error) {
      console.warn("[Tennis Note] schedule saved but refresh failed", error?.message || "schedule_v2_saved_refresh_failed");
      setStatus("저장은 완료됐습니다. 화면을 유지한 채 서버 최신값만 다시 확인해 주세요.", "warning", { retry: true });
      return false;
    } finally {
      state.postSaveRefreshPending = false;
    }
  }

  function installScheduleRevisionWatcher() {
    if (state.revisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
    state.revisionWatcher = window.TennisNoteScheduleRevision.watch({
      branchId: () => bridge()?.snapshot?.()?.branchId || "",
      active: () => root.classList.contains("is-active") && state.engine === "v2",
      onChange: () => {
        if (!state.absorbingRevisionRefresh) requestLiveRefresh();
      },
    });
  }

  async function openLessonFromExternal({ lessonId, lessonDate = "", mode = "outcome" } = {}) {
    if (!lessonId) return false;
    setEngine("v2");
    if (lessonDate) {
      state.weekStart = mondayOf(lessonDate);
      state.selectedDate = localDateKey(lessonDate);
      state.payload = null;
    }
    const loaded = await loadWorkspace({ quiet: true, force: true });
    if (!loaded || !state.payload) return false;
    const lesson = state.payload.lessons.find((item) => String(item.id) === String(lessonId));
    if (!lesson || !["scheduled", "pending_change", "completed", "no_show"].includes(String(lesson.status || ""))) return false;
    state.selectedDate = lesson.lessonDate;
    renderWorkspace();
    openEditor({
      date: lesson.lessonDate,
      time: lesson.startTime,
      coachRoleId: lesson.coachRoleId,
      lesson,
    });
    setEditorMode(mode, lesson);
    window.setTimeout(() => {
      const outcomePanel = $("#scheduleV2OutcomePanel");
      outcomePanel?.querySelector("textarea, input[type='search'], input[data-v2-curriculum]")?.focus();
    }, 0);
    return true;
  }

  function initializeEvents() {
    $("#scheduleV2DayTabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-v2-date]");
      if (!button) return;
      state.selectedDate = button.dataset.v2Date;
      if (localDemoMode) state.payload = demoWorkspacePayload();
      renderWorkspace();
    });
    $("#scheduleV2Workspace").addEventListener("pointermove", (event) => {
      const run = event.target.closest("[data-v2-add-run]");
      if (!run) return;
      const slotCount = Math.max(1, Number(run.dataset.slotCount) || 1);
      const bounds = run.getBoundingClientRect();
      const slotIndex = Math.max(0, Math.min(slotCount - 1, Math.floor(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * slotCount)));
      run.style.setProperty("--v2-hover-row", String(slotIndex));
    });
    $("#scheduleV2Workspace").addEventListener("click", (event) => {
      const cancelledRestoreButton = event.target.closest("[data-v2-restore-cancelled]");
      if (cancelledRestoreButton) {
        void restoreCancelledLesson(cancelledRestoreButton.dataset.v2RestoreCancelled);
        return;
      }
      const restoreButton = event.target.closest("[data-v2-restore-absence]");
      if (restoreButton) {
        void restoreAbsentLesson(restoreButton.dataset.v2RestoreAbsence);
        return;
      }
      const reconcileButton = event.target.closest("[data-v2-reconcile-ticket]");
      if (reconcileButton) {
        const sourceLesson = timetableLessons().find((item) => String(item.id) === String(reconcileButton.dataset.v2SourceLessonId));
        void repairExpectedRegularSlot({
          ticketId: reconcileButton.dataset.v2ReconcileTicket,
          branchId: state.payload?.branchId || state.payload?.branch?.id || "",
          participants: sourceLesson?.participants || [],
          memberLabel: lessonParticipantLabel(sourceLesson || {}),
        });
        return;
      }
      const add = event.target.closest("[data-v2-add]");
      if (add) {
        let time = add.dataset.time;
        if (add.dataset.v2AddRun != null && event.detail !== 0) {
          const slotCount = Math.max(1, Number(add.dataset.slotCount) || 1);
          const bounds = add.getBoundingClientRect();
          const slotIndex = Math.max(0, Math.min(slotCount - 1, Math.floor(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * slotCount)));
          time = minutesTime(timeMinutes(add.dataset.startTime || add.dataset.time) + slotIndex * 10);
        }
        openEditor({
          date: add.dataset.date,
          time,
          coachRoleId: add.dataset.coachRoleId,
          kind: add.dataset.v2Kind || null,
        });
        return;
      }
      const lessonButton = event.target.closest("[data-v2-lesson-id]");
      if (lessonButton) {
        const lesson = timetableLessons().find((item) => String(item.id) === String(lessonButton.dataset.v2LessonId));
        if (lesson?.expectedRegularSlot) void repairExpectedRegularSlot(lesson);
        else if (lesson) openEditor({ date: lesson.lessonDate, time: lesson.startTime, coachRoleId: lesson.coachRoleId, lesson });
        return;
      }
      const queueButton = event.target.closest("[data-v2-queue-ticket]");
      if (queueButton) {
        state.pendingTicketId = queueButton.dataset.v2QueueTicket;
        const ticket = ticketById(state.pendingTicketId);
        setStatus(`${ticketMemberLabel(ticket)} 배정 중 · 시간표의 빈칸 +를 눌러 주세요.`, "success");
        $("#scheduleV2Grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    $("#scheduleV2MemberResults").addEventListener("click", (event) => {
      const oneDayButton = event.target.closest("[data-v2-one-day-user-id]");
      if (oneDayButton) {
        toggleSelectedOneDayMember(oneDayButton.dataset.v2OneDayUserId);
        return;
      }
      const button = event.target.closest("[data-v2-ticket-id]");
      if (button) toggleSelectedTicket(button.dataset.v2TicketId, button.dataset.v2UserId || "");
    });
    $("#scheduleV2SelectedTicket").addEventListener("click", (event) => {
      const button = event.target.closest("[data-v2-remove-user]");
      if (button) removeSelectedParticipant(button.dataset.v2RemoveUser);
    });
    $("#scheduleV2MemberSearch").addEventListener("input", renderMemberResults);
    $("#scheduleV2LessonSearch").addEventListener("input", () => applyLessonSearchFilter({ scrollToMatch: true }));
    $("#scheduleV2FeedbackFilter")?.addEventListener("click", () => {
      state.feedbackOnly = !state.feedbackOnly;
      syncFeedbackFilterButton();
      applyLessonSearchFilter();
    });
    const selectEditorMode = (event) => {
      const button = event.target.closest("[data-v2-editor-mode]");
      if (!button || button.disabled) return;
      setEditorMode(button.dataset.v2EditorMode);
    };
    $("#scheduleV2EditorModes").addEventListener("click", selectEditorMode);
    $("#scheduleV2EditorForm").addEventListener("change", (event) => {
      state.cancelConfirmationKey = "";
      if (event.target.name === "regularEditScope") {
        syncRegularEditScope();
        setEditorMessage("");
        return;
      }
      if (event.target.name === "durationMinutes") {
        updateSeriesGuidance();
        renderMemberResults();
        syncEditorPlacementAvailability();
        return;
      }
      if (["lessonDate", "startTime", "coachRoleId"].includes(event.target.name)) {
        syncEditorPlacementAvailability();
        return;
      }
      if (event.target.name === "scheduleKind") {
        $("#scheduleV2SeriesOption").hidden = Boolean(state.editingLesson) || selectedKind() !== "regular";
        state.selectedTicketId = "";
        state.selectedParticipants = [];
        $("#scheduleV2MemberSearch").value = "";
        syncMemberPickerMode();
        renderSelectedTicket();
        renderMemberResults();
        syncRegularEditScope();
        return;
      }
      if (["oneDayBookingSource", "oneDayPaymentStatus", "oneDayPaymentMethod", "oneDayPaymentAmount"].includes(event.target.name)) syncOneDayIntake();
    });
    $("#scheduleV2EditorForm").addEventListener("submit", saveEditor);
    $("#scheduleV2CancelLessonButton").addEventListener("click", cancelLesson);
    $("#scheduleV2DeleteLessonButton").addEventListener("click", deleteLesson);
    $("#scheduleV2AssignSubstituteButton").addEventListener("click", assignSubstitute);
    $("#scheduleV2CancelSubstituteButton").addEventListener("click", cancelSubstitute);
    $("#scheduleV2OutcomeList").addEventListener("change", (event) => {
      if (!event.target.matches("[data-v2-outcome]")) return;
      syncOutcomeRow(event.target.closest("[data-v2-outcome-user]"), { setDefault: true });
    });
    $("#scheduleV2OutcomeList").addEventListener("click", (event) => {
      const curriculumButton = event.target.closest("[data-v2-curriculum-code]");
      if (curriculumButton) {
        selectV2CurriculumSuggestion(curriculumButton);
        return;
      }
      const button = event.target.closest("[data-v2-generate-comment]");
      if (button) {
        generateOutcomeComment(button.closest("[data-v2-outcome-user]"));
        return;
      }
      const correctionButton = event.target.closest("[data-v2-correct-deduction]");
      if (correctionButton) {
        void correctParticipantDeduction(
          correctionButton.closest("[data-v2-outcome-user]"),
          correctionButton.dataset.v2CorrectDeduction === "deduct",
        );
        return;
      }
      const openRevisionButton = event.target.closest("[data-v2-open-feedback-revision]");
      if (openRevisionButton) {
        openParticipantFeedbackRevision(openRevisionButton.closest("[data-v2-outcome-user]"));
        return;
      }
      if (event.target.closest("[data-v2-cancel-feedback-revision]")) {
        cancelParticipantFeedbackRevision();
        return;
      }
      const saveRevisionButton = event.target.closest("[data-v2-save-feedback-revision]");
      if (saveRevisionButton) {
        void saveParticipantFeedbackRevision(saveRevisionButton.closest("[data-v2-outcome-user]"));
      }
    });
    $("#scheduleV2OutcomeList").addEventListener("input", (event) => {
      const curriculumInput = event.target.closest("[data-v2-curriculum]");
      if (curriculumInput) {
        renderV2CurriculumSuggestions(curriculumInput);
        updateV2CurriculumDetailLink(curriculumInput);
      }
    });
    $("#scheduleV2OutcomeList").addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      const row = event.target.closest("[data-v2-outcome-user]");
      if (!row) return;
      if (event.target.matches("[data-v2-comment-keywords]") && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        generateOutcomeComment(row);
        return;
      }
      if (!event.target.matches("[data-v2-curriculum]")) return;
      const suggestions = row.querySelector("[data-v2-curriculum-suggestions]");
      if (event.key === "Escape") {
        if (suggestions) suggestions.hidden = true;
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      suggestions?.querySelector("[data-v2-curriculum-code]")?.click();
    });
    $("#scheduleV2FinalizeOutcomeButton").addEventListener("click", () => processLessonOutcome());
    $("#scheduleV2LessonHistoryPanel")?.addEventListener("toggle", loadLessonHistory);
    $("#scheduleV2EditorForm").elements.substituteSettlementMode.addEventListener("change", (event) => {
      $("#scheduleV2SubstituteHourlyField").hidden = event.currentTarget.value !== "hourly";
    });
    $$('[data-v2-close-editor]').forEach((button) => button.addEventListener("click", closeEditor));
    $$('[data-v2-week-step]').forEach((button) => button.addEventListener("click", () => {
      state.weekStart = addDays(state.weekStart, Number(button.dataset.v2WeekStep) * 7);
      state.selectedDate = localDateKey(state.weekStart);
      state.payload = null;
      void loadWorkspace();
    }));
    $("#scheduleV2TodayButton").addEventListener("click", () => {
      state.weekStart = mondayOf(new Date());
      state.selectedDate = localDateKey(new Date());
      state.payload = null;
      void loadWorkspace();
    });
    $("#scheduleV2RefreshButton").addEventListener("click", () => {
      state.payload = null;
      invalidateCurrentWorkspaceCache();
      void loadWorkspace({ force: true });
    });
    $("#scheduleV2RefreshAfterSaveButton")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const viewState = captureWorkspaceViewState();
      button.disabled = true;
      state.postSaveRefreshPending = true;
      try {
        const refreshed = await loadWorkspace({ quiet: true, force: true, absorbRevisionRefresh: true, preserveViewState: viewState });
        if (!refreshed) setStatus("서버 최신값을 아직 확인하지 못했습니다. 저장된 화면을 유지하고 다시 시도해 주세요.", "warning", { retry: true });
      } finally {
        state.postSaveRefreshPending = false;
        button.disabled = false;
      }
    });
    $("#scheduleV2IntegrityButton")?.addEventListener("click", runScheduleV2MemberIntegrityPreview);
    $("#scheduleV2IntegrityApplyButton")?.addEventListener("click", applyScheduleV2IntegrityRepairs);
    $("#scheduleV2ArchivedHistoryToggle")?.addEventListener("click", () => {
      state.showArchivedHistory = !state.showArchivedHistory;
      renderWorkspace();
    });
    $("#scheduleV2PolicyButton").addEventListener("click", (event) => {
      const panel = $("#scheduleV2PolicyPanel");
      const opening = panel.hidden;
      panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
      if (opening) {
        state.policyEditorDirty = false;
        renderPolicy({ force: true });
      }
    });
    $("#scheduleV2PolicySaveButton").addEventListener("click", savePolicy);
    const policyPanel = $("#scheduleV2PolicyPanel");
    const markPolicyEditorDirty = () => {
      state.policyEditorDirty = true;
      renderMemberChangePolicyPreview();
    };
    policyPanel?.addEventListener("input", markPolicyEditorDirty);
    policyPanel?.addEventListener("change", markPolicyEditorDirty);
    $("#scheduleV2ClosureButton")?.addEventListener("click", openClosureEditor);
    $("#scheduleV2ClosureForm")?.addEventListener("submit", saveClosure);
    $("#scheduleV2ClosureForm")?.addEventListener("change", (event) => {
      if (event.target.name === "closureRange") syncClosureTimeFields();
      if (event.target.name === "operationMode") {
        const form = event.currentTarget;
        const mode = form.elements.operationMode.value;
        form.elements.closureLabel.value = operationModeLabel(mode);
        if (mode === "shortened") {
          form.elements.closureStartTime.value ||= "09:00";
          form.elements.closureEndTime.value ||= "18:00";
        }
        state.editingClosureId = "";
        syncClosureTimeFields();
      }
      if (event.target.name === "closureDate") {
        state.editingClosureId = "";
        state.editingOperationDayId = "";
        $("#scheduleV2ClosureSaveButton").textContent = "운영일 저장";
        renderOperationList();
        renderClosureList();
        setClosureMessage("");
      }
    });
    $("#scheduleV2ClosureResetButton")?.addEventListener("click", () => resetClosureForm({ keepDate: true }));
    $("#scheduleV2ClosureKeepLessonsButton")?.addEventListener("click", () => void applyClosureTreatment("keep"));
    $("#scheduleV2ClosureApplyHolidayButton")?.addEventListener("click", () => void applyClosureTreatment("holiday_no_deduction"));
    $("#scheduleV2ClosureList")?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-v2-edit-closure]");
      if (editButton) {
        editClosure(editButton.dataset.v2EditClosure);
        return;
      }
      const deleteButton = event.target.closest("[data-v2-delete-closure]");
      if (deleteButton) void deleteClosure(deleteButton.dataset.v2DeleteClosure);
    });
    $("#scheduleV2OperationList")?.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-v2-edit-operation]");
      if (editButton) {
        editOperationDay(editButton.dataset.v2EditOperation);
        return;
      }
      const deleteButton = event.target.closest("[data-v2-delete-operation]");
      if (deleteButton) void deleteOperationDay(deleteButton.dataset.v2DeleteOperation);
    });
    $$('[data-v2-close-closure]').forEach((button) => button.addEventListener("click", closeClosureEditor));
    window.addEventListener("popstate", () => {
      if (state.closureEditorOpen) actualCloseClosureEditor();
      else if (state.editorOpen) actualCloseEditor();
    });
    document.addEventListener("keydown", (event) => {
      const activeEditor = state.closureEditorOpen ? closureEditor : state.editorOpen ? editor : null;
      if (!activeEditor) return;
      if (event.key === "Escape") {
        if (state.closureEditorOpen) closeClosureEditor();
        else closeEditor();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = $$("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])", activeEditor)
        .filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    window.addEventListener("tennisnote:admin-view-change", (event) => {
      if (event.detail?.view !== "schedule" || state.engine !== "v2" || state.loading || state.payload) return;
      void loadWorkspace();
    });
    window.addEventListener("tennisnote:admin-live-data", () => {
      if (state.engine !== "v2" || state.loading) return;
      if (state.postSaveRefreshPending) return;
      if (!scheduleWorkspaceIsActive() || state.payload) return;
      void loadWorkspace({ quiet: true });
    });
    let resizeTimer = null;
    window.addEventListener("resize", () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        const nextMode = usesDesktopWeeklyView() ? "weekly" : "daily";
        if (state.payload && state.renderMode !== nextMode) renderWorkspace();
      }, 120);
    });
  }

  window.TennisNoteScheduleV2Admin = Object.freeze({
    openLesson: openLessonFromExternal,
  });
  initializeEvents();
  installScheduleRevisionWatcher();
  setEngine(preferredScheduleEngine());
})();
