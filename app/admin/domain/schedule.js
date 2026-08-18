// 시간표(schedule) 값 판정·계산을 하는 순수 함수들.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function persistentScheduleLessons(source = lessons) {
  return (Array.isArray(source) ? source : []).filter((lesson) => (
    lesson?.serverLessonId || lesson?.serverOneDayBookingId
  ));
}

function currentScheduleDay(allScheduleDays = scheduleDays) {
  const dayIndex = new Date().getDay();
  return allScheduleDays[dayIndex === 0 ? 6 : dayIndex - 1];
}

function currentOperationScheduleSettings(allScheduleSettings = scheduleSettings) {
  return {
    openStart: allScheduleSettings.openStart,
    openEnd: allScheduleSettings.openEnd,
    breakRules: cloneOperationProfileValue(Array.isArray(allScheduleSettings.breakRules) ? allScheduleSettings.breakRules : []),
    breakFavorites: cloneOperationProfileValue(Array.isArray(allScheduleSettings.breakFavorites) ? allScheduleSettings.breakFavorites : []),
    lessonColors: { ...(allScheduleSettings.lessonColors || {}) },
    lessonColorRules: cloneOperationProfileValue(Array.isArray(allScheduleSettings.lessonColorRules) ? allScheduleSettings.lessonColorRules : []),
    coachWorkPolicyVersion: allScheduleSettings.coachWorkPolicyVersion || 2,
    memberScheduleRequestOnly: allScheduleSettings.memberScheduleRequestOnly !== false,
    adminTuningMode: allScheduleSettings.adminTuningMode === true,
  };
}

function scheduleBreakSummaryForDay(day, allScheduleSettings = scheduleSettings) {
  const rules = allScheduleSettings.breakRules.filter((rule) => rule.days?.includes(day));
  if (!rules.length) return "브레이크 없음";
  return rules.map((rule) => {
    const coachNames = breakRuleCoachNames(rule);
    return `${rule.label || "브레이크"} ${rule.start}~${rule.end}${coachNames ? ` · ${coachNames}` : ""}`;
  }).join(" / ");
}

function isLessonEditableScheduled(lesson = {}) {
  return ["scheduled", "pending_change"].includes(lessonStatusValue(lesson));
}

function intervalsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function scheduleAddButtonGridPosition(button) {
  const slot = button?.closest?.(".admin-duration-slot");
  if (!slot) return null;
  const row = Number.parseInt(slot.style.gridRow, 10);
  const column = Number.parseInt(slot.style.gridColumn, 10);
  return Number.isFinite(row) && Number.isFinite(column) ? { row, column } : null;
}

function memberManagementScheduleScopeLabel(scope) {
  if (scope === "mixed") return "혼합 (월~일)";
  return scope === "weekend" ? "주말 (토·일)" : "평일 (월~금)";
}

function memberManagementProductScheduleScope(product) {
  const name = String(product?.name || "");
  if (name.includes("주말")) return "weekend";
  if (name.includes("평일")) return "weekday";
  const configuredScope = product?.schedule_scope || product?.scheduleScope;
  return ["weekday", "weekend", "mixed"].includes(configuredScope) ? configuredScope : "weekday";
}

function memberManagementProductIsCoupon(product) {
  return Boolean(product?.is_coupon === true || String(product?.product_kind || "").toLowerCase() === "coupon");
}

function memberManagementProductSupportsRegularSchedule(product) {
  return ["regular", "group"].includes(String(product?.product_kind || "regular").toLowerCase())
    && !memberManagementProductIsCoupon(product);
}

function memberRegularScheduleFrequency(product = null, ticket = null) {
  const productLabel = String(product?.name || product?.title || "");
  const labelFrequency = Number(productLabel.match(/(?:평일|주말|혼합)[^0-9]*([1-7])\s*회/)?.[1] || 0);
  const configuredFrequency = Number(product?.frequency_per_week || 0);
  if (product) return Math.max(1, Math.min(7, Math.max(configuredFrequency, labelFrequency)));
  return Math.max(1, Math.min(7, Number(ticket?.weeklyCount || 1)));
}

function memberInlineScheduleValues(form, allLiveData = adminLiveDataState) {
  const product = (allLiveData.products || []).find((item) => item.id === form?.elements.productId?.value);
  if (!product || String(product.product_kind || "regular") !== "regular") return [];
  const ticket = [...tickets, ...expiredTickets].find((item) => item.serverTicketId === form?.dataset.ticketId);
  const frequency = memberRegularScheduleFrequency(product, ticket);
  return Array.from({ length: frequency }, (_, offset) => {
    const rawDay = form.elements[`scheduleDay${offset + 1}`]?.value;
    return {
      dayOfWeek: rawDay === "" || rawDay === undefined ? null : Number(rawDay),
      startTime: String(form.elements[`scheduleTime${offset + 1}`]?.value || "").slice(0, 5),
    };
  }).filter((slot) => slot.dayOfWeek !== null || slot.startTime);
}

function memberInlineScheduleChanged(form, schedules = memberInlineScheduleValues(form)) {
  let initial = [];
  try {
    initial = JSON.parse(decodeURIComponent(form?.dataset.initialSchedule || ""));
  } catch {
    initial = [];
  }
  return JSON.stringify(schedules) !== JSON.stringify(initial);
}

function normalizedScheduleMemberSearch(value = "") {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function scheduleMemberLinesMarkup(value = "") {
  const label = String(value || "회원").trim() || "회원";
  const names = splitMemberNames(label);
  const lines = names.length ? names : [label];
  return `<span class="schedule-member-lines" aria-label="${escapeHtml(label)}">${lines.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</span>`;
}

function scheduleBulkEligible(lesson) {
  const status = String(lesson?.serverStatus || lesson?.status || "");
  return Boolean(
    lesson?.serverLessonId
    && !lesson?.oneDayBooking
    && !isReleasedRegularMakeupSlot(lesson)
    && status === "scheduled"
    && lesson?.lessonDate
    && lesson.lessonDate >= adminLocalDateKey(new Date())
  );
}

function scheduleOpenSlotKey(slot = {}) {
  return [slot.day || "", slot.time || "", slot.coachId || ""].join("|");
}

function parseScheduleOpenSlotKey(key = "") {
  const [day = "", time = "", coachId = ""] = String(key).split("|");
  return { day, time, coachId };
}

function normalizeScheduleSheetCell(value) {
  return String(value || "").trim();
}

function normalizeScheduleSheetDay(value, allScheduleDays = scheduleDays) {
  const token = normalizeScheduleSheetCell(value).replace(/요일$/u, "");
  return allScheduleDays.includes(token) ? token : "";
}

function scheduleSheetBaseIssues(row = {}) {
  const issues = [];
  if (!normalizeScheduleSheetDay(row.day)) issues.push("요일 확인");
  if (!/^\d{1,2}:\d{2}$/u.test(row.time || "")) issues.push("시간 확인");
  if (!row.coachId || !scheduleSheetCoachOptions().some((coach) => String(coach.id) === String(row.coachId))) issues.push("코치 확인");
  if (!normalizeScheduleSheetCell(row.memberName)) issues.push("회원 확인");
  if (![20, 30, 40, 60].includes(Number(row.durationMinutes))) issues.push("분 확인");
  return issues;
}

function normalizeScheduleSheetLessonSource(value) {
  const token = normalizeScheduleSheetCell(value).replace(/\s+/g, "");
  if (!token) return "regular";
  if (["보강", "수업변경", "변경"].some((label) => token.includes(label))) return "makeup";
  if (["쿠폰", "횟수권"].some((label) => token.includes(label))) return "coupon";
  if (["원데이", "체험"].some((label) => token.includes(label))) return "one_day";
  if (["대타", "코치변경"].some((label) => token.includes(label))) return "coach_change";
  return normalizeLessonSource(token);
}

function scheduleSheetRowKey(row) {
  return `${row.day}|${row.time}|${row.coachId}|${row.durationMinutes}|${row.ticketId}|${row.lessonSource}`;
}

function scheduleSheetSelectOptions(options = [], selectedValue = "") {
  return options.map((option) => `
    <option value="${escapeHtml(String(option.value))}" ${String(option.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(option.label)}</option>
  `).join("");
}

function scheduleSheetDayField(row, index, allScheduleDays = scheduleDays) {
  return `<select data-schedule-sheet-field="day" data-row-index="${index}" aria-label="요일">
    <option value="">요일</option>
    ${scheduleSheetSelectOptions(allScheduleDays.map((day) => ({ value: day, label: day })), row.day)}
  </select>`;
}

function scheduleSheetSourceOptions() {
  return [
    { value: "regular", label: "정규" },
    { value: "makeup", label: "보강" },
    { value: "coupon", label: "쿠폰" },
    { value: "one_day", label: "원데이" },
    { value: "coach_change", label: "대타" },
  ];
}

function scheduleSheetSourceField(row, index) {
  return `<select data-schedule-sheet-field="lessonSource" data-row-index="${index}" aria-label="수업종류">
    ${scheduleSheetSelectOptions(scheduleSheetSourceOptions(), row.lessonSource)}
  </select>`;
}

function scheduleSheetDurationField(row, index) {
  return `<select data-schedule-sheet-field="durationMinutes" data-row-index="${index}" aria-label="수업분">
    ${scheduleSheetSelectOptions([20, 30, 40, 60].map((minutes) => ({ value: minutes, label: `${minutes}분` })), row.durationMinutes)}
  </select>`;
}

function scheduleSheetPasteRowSelectionKey(row, index) {
  return String(row?.rowNumber || index + 1);
}

function scheduleBulkErrorMessage(error) {
  const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
  const messages = {
    lesson_concurrent_update: "다른 화면에서 수업이 먼저 변경되었습니다. 최신 시간표를 불러왔으니 다시 선택해 주세요.",
    lesson_expected_revision_required: "수업의 최신 상태를 확인할 수 없습니다. 시간표를 새로고침해 주세요.",
    bulk_shift_conflict: "이동할 시간에 다른 수업이 있어 전체 변경을 취소했습니다.",
    bulk_shift_coach_not_working: "코치 근무시간 밖인 수업이 있어 전체 변경을 취소했습니다.",
    bulk_shift_blocked: "브레이크 또는 수업 불가 시간이 포함되어 전체 변경을 취소했습니다.",
    bulk_shift_outside_day: "날짜를 넘어가는 이동은 할 수 없습니다.",
    bulk_shift_lesson_required: "이동할 수업을 다시 선택해 주세요.",
    bulk_shift_invalid_delta: "시간 이동은 10분 단위로만 가능합니다.",
    bulk_shift_lesson_closed: "예정 상태가 아닌 수업이 포함되어 전체 변경을 취소했습니다.",
    operation_key_reused_with_different_payload: "선택 내용이 바뀌었습니다. 다시 선택한 뒤 실행해 주세요.",
  };
  return Object.entries(messages).find(([code]) => raw.includes(code))?.[1]
    || "수업 시간을 변경하지 못했습니다. 시간표를 새로고침한 뒤 다시 시도해 주세요.";
}

function isPendingScheduleLesson(lesson) {
  return isLessonPendingChange(lesson);
}

function getInternalScheduleConflict(schedules, durationMinutes) {
  for (let leftIndex = 0; leftIndex < schedules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < schedules.length; rightIndex += 1) {
      const left = schedules[leftIndex];
      const right = schedules[rightIndex];
      if (left.day !== right.day || !left.time || !right.time) continue;
      if (intervalsOverlap(
        { start: timeToMinutes(left.time), end: timeToMinutes(left.time) + durationMinutes },
        { start: timeToMinutes(right.time), end: timeToMinutes(right.time) + durationMinutes },
      )) {
        return { day: left.day, time: left.time, message: `${left.day}요일 안에서 시간이 서로 겹칩니다.` };
      }
    }
  }
  return null;
}

function importScheduleSampleRows() {
  return [
    ["AUG-S-001", "AUG-001", "2026-08-04", "18:40", 20, "예정", "가상 작성 예시"],
    ["AUG-S-002", "AUG-002", "2026-08-01", "09:00", 20, "예정", "1:2는 두 회원 중 한 원본번호만 입력"],
  ];
}

function scheduleV2IntegrityReasonLabel(reason = "") {
  return {
    regular_schedule_rule_missing: "정규 요일·시간 설정 필요",
    regular_schedule_rule_incomplete: "주간 수업 설정 확인 필요",
    regular_schedule_coach_unavailable: "담당 코치 상태 확인 필요",
    ticket_not_started: "시작 예정 회원권",
    ticket_no_remaining_sessions: "잔여 횟수 없음",
    conflicts_only: "시간 충돌 확인 필요",
    no_future_occurrence: "기간 안에 생성할 날짜 없음",
  }[String(reason || "").replace(/^blocked:/, "")] || "관리자 확인 필요";
}
