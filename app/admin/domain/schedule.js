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

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function shouldProtectLoadedSchedule(serverLessons, nextLessons) {
  const current = persistentScheduleLessons();
  const next = persistentScheduleLessons(nextLessons);
  if (!state.liveScheduleLoaded || !current.length) return false;

  // A normal action can replace a few future rows, but it must not erase the full
  // timetable just because a request returned an empty or incomplete lesson list.
  if (!Array.isArray(serverLessons) || !serverLessons.length) return true;
  return next.length === 0;
}

function getVisibleScheduleTimes() {
  return makeTimeRange(scheduleSettings.openStart, scheduleSettings.openEnd)
    .filter((time) => scheduleDays.some((day) => adminTimeVisibleForDay(day, time)));
}

function adminScheduleWeek(offset = 0) {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + offset * 7);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthStartOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const weekOfMonth = Math.floor((monthStartOffset + start.getDate() - 1) / 7) + 1;
  const template = offset >= 0 ? (adminScheduleWeeks[offset] || {}) : {};
  return {
    ...template,
    label: `${start.getMonth() + 1}월 ${weekOfMonth}주차`,
    range: `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`,
    note: template.note || (offset === 0 ? "이번 주 실시간 수업과 변경 요청" : "선택한 주의 실시간 수업과 변경 요청"),
    startDate: adminLocalDateKey(start),
    endDate: adminLocalDateKey(end),
  };
}

function activeAdminWeek() {
  const offset = Math.min(Math.max(Number(state.activeAdminWeekIndex) || 0, adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  state.activeAdminWeekIndex = offset;
  return adminScheduleWeek(offset);
}

function selectedAdminScheduleDay() {
  if (!scheduleDays.includes(state.selectedScheduleDay)) state.selectedScheduleDay = currentScheduleDay();
  return state.selectedScheduleDay;
}

function adminScheduleDateLabel(day) {
  const value = adminWeekDateForDay(day);
  if (!value) return day;
  const [, month, date] = value.split("-");
  return `${Number(month)}/${Number(date)}`;
}

function goToAdminScheduleToday() {
  state.activeAdminWeekIndex = 0;
  state.selectedScheduleDay = currentScheduleDay();
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function changeAdminWeek(delta) {
  state.activeAdminWeekIndex = Math.min(
    Math.max((Number(state.activeAdminWeekIndex) || 0) + delta, adminScheduleMinWeekOffset),
    adminScheduleMaxWeekOffset,
  );
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function adminScheduleMonthValue(week = activeAdminWeek()) {
  return String(week.startDate || "").slice(0, 7);
}

function operationBranchLessons(source = lessons) {
  return source.filter((lesson) => matchesActiveOperationBranch(lesson.branchId));
}

function operationBranchMakeupRequests(source = makeupRequests) {
  return source.filter((request) => {
    if (request.branchId) return matchesActiveOperationBranch(request.branchId);
    const lesson = lessons.find((item) => String(item.serverLessonId || item.id) === String(request.lessonId || request.sourceLessonId || ""));
    return lesson ? matchesActiveOperationBranch(lesson.branchId) : operationBranchAllowsLegacyRows();
  });
}

function liveSchedulePolicyPayload() {
  ensureOperationProfiles();
  updateActiveOperationProfileFromCurrent();
  return {
    version: 5,
    updatedAt: new Date().toISOString(),
    activeOperationProfileId,
    activeOperationProfileIdsByBranch: cloneOperationProfileValue(activeOperationProfileIdsByBranch),
    operationProfiles: cloneOperationProfileValue(operationProfiles),
    scheduleSettings: {
      openStart: scheduleSettings.openStart,
      openEnd: scheduleSettings.openEnd,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : [],
      breakFavorites: Array.isArray(scheduleSettings.breakFavorites) ? scheduleSettings.breakFavorites : [],
      lessonColors: scheduleSettings.lessonColors,
      lessonColorRules: scheduleSettings.lessonColorRules,
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
      memberScheduleRequestOnly: scheduleSettings.memberScheduleRequestOnly !== false,
      adminTuningMode: scheduleSettings.adminTuningMode === true,
    },
    coaches: coaches.map((coach) => ({
      id: coach.id,
      serverRoleId: coach.serverRoleId || "",
      branchId: coach.branchId || "",
      name: coach.name,
      status: coach.status || "active",
      employmentStatus: coach.employmentStatus || "active",
      archivedAt: coach.archivedAt || "",
      deletedAt: coach.deletedAt || "",
      color: coach.color || "",
      availableDays: Array.isArray(coach.availableDays) ? coach.availableDays : [],
      availableStart: coach.availableStart || "",
      availableEnd: coach.availableEnd || "",
      workBlocks: (coach.status || "active") === "active" ? normalizeCoachWorkBlocks(coach) : [],
      breakBlocks: (coach.status || "active") === "active" ? normalizeCoachBreakBlocks(coach) : [],
    })),
  };
}

async function moveLessonPolicy(policyId, direction) {
  const currentIndex = lessonPolicies.findIndex((item) => item.id === policyId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= lessonPolicies.length) return;
  const [policy] = lessonPolicies.splice(currentIndex, 1);
  lessonPolicies.splice(nextIndex, 0, policy);
  await persistLessonPolicies("수업 정책 순서를 변경했습니다");
}

function getLessonRoundLabel(lesson) {
  if (lesson?.oneDayBooking) return "원데이";
  if (isReleasedRegularMakeupSlot(lesson)) return "정규 · 불참";
  if (!isBookedLesson(lesson)) return "";
  const ticket = getTicketByLesson(lesson);
  if (!ticket) return "회차 확인";
  const range = lessonRoundRange(lesson, ticket);
  const round = range.first === range.last ? `${range.first}` : `${range.first}~${range.last}`;
  return `${round}/${ticket.total}회차`;
}

function findLesson(day, time) {
  return operationBranchLessons().find((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function findLessons(day, time) {
  return operationBranchLessons().filter((item) => item.day === day && item.time === time && lessonMatchesActiveScheduleWeek(item, day));
}

function isSameDateRegularLessonAdjustment(candidate = {}, releasedRegularSlot = null) {
  const editingLesson = getCurrentEditingLesson();
  if (
    operationsRole() !== "admin"
    || selectedLessonEditScope() !== "single"
    || !editingLesson?.serverLessonId
    || !isLessonEditableScheduled(editingLesson)
    || lessonSourceValue(editingLesson) !== "regular"
    || normalizeLessonSource(candidate.lessonSource) !== "regular"
  ) return false;
  const sourceDate = editingLesson.lessonDate || adminWeekDateForDay(editingLesson.day);
  const targetDate = candidate.lessonDate || adminWeekDateForDay(candidate.day);
  return Boolean(
    sourceDate
    && targetDate
    && sourceDate === targetDate
    && String(editingLesson.id) !== String(releasedRegularSlot?.id || "")
  );
}

function getRestorableReleasedRegularSlot(candidate) {
  if (
    state.editingLessonId
    || normalizeLessonSource(candidate?.lessonSource) !== "regular"
    || !candidate?.ticketId
  ) return null;
  return getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes)
    .find((lesson) => (
      isReleasedRegularMakeupSlot(lesson)
      && lesson.coachId === candidate.coachId
      && String(lesson.ticketId || "") === String(candidate.ticketId)
    )) || null;
}

function getOverlappingBookedLessons(day, time, durationMinutes = 20) {
  const interval = {
    start: timeToMinutes(time),
    end: timeToMinutes(time) + durationMinutes,
  };
  const targetDate = state.liveScheduleLoaded ? adminWeekDateForDay(day) : "";
  return operationBranchLessons().filter((lesson) => (
    lesson.day === day
    && (!targetDate || !lesson.lessonDate || lesson.lessonDate === targetDate)
    && isBookedLesson(lesson)
    && intervalsOverlap(interval, lessonInterval(lesson))
  ));
}

function canAddLessonAt(day, time, durationMinutes = 20, preferredCoachId = "") {
  if (!hasCourtCapacity(day, time, durationMinutes)) return false;
  if (preferredCoachId) return getAvailableCoachesForSlot(day, time, durationMinutes).some((coach) => coach.id === preferredCoachId);
  return getAvailableCoachesForSlot(day, time, durationMinutes).length > 0;
}

function getScheduleTimeOptions() {
  return getVisibleScheduleTimes();
}

function findLessonStartingInBlock(day, blockStart, blockEnd) {
  return operationBranchLessons().find((lesson) => {
    const starts = timeToMinutes(lesson.time);
    return lesson.day === day && lessonMatchesActiveScheduleWeek(lesson, day) && starts > blockStart && starts < blockEnd;
  });
}

function findOccupyingLesson(day, time) {
  const current = timeToMinutes(time);
  return operationBranchLessons().find((lesson) => {
    if (lesson.day !== day || lesson.time === time || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
    const starts = timeToMinutes(lesson.time);
    const ends = starts + lesson.durationMinutes;
    return current > starts && current < ends;
  });
}

function adminTodayLessonRows() {
  if (adminDemoMode) return operationBranchLessons();
  const today = adminLocalDateKey(new Date());
  return operationBranchLessons().filter((lesson) => lesson.lessonDate === today);
}

function ticketRegularScheduleAssignmentProgress(ticket, today = adminLocalDateKey(new Date())) {
  const requiredCount = Math.min(
    getTicketWeeklyCount(ticket),
    Math.max(0, Number(ticket?.remaining) || 0),
  );
  const assignedCount = Math.min(requiredCount, ticketFutureRegularScheduleCoverage(ticket, today));
  return {
    requiredCount,
    assignedCount,
    remainingCount: Math.max(0, requiredCount - assignedCount),
    state: assignedCount > 0 ? "partial" : "unassigned",
  };
}

function ticketRemainingRegularScheduleCount(ticket, today = adminLocalDateKey(new Date())) {
  return ticketRegularScheduleAssignmentProgress(ticket, today).remainingCount;
}

function ticketNeedsRegularSchedule(ticket, today = adminLocalDateKey(new Date())) {
  return isRegularScheduleTicket(ticket, today) && ticketRemainingRegularScheduleCount(ticket, today) > 0;
}

function scheduleAssignmentDefaultsForSlot(day, time, coachId) {
  const ticket = currentScheduleAssignmentTicket();
  if (!ticket) return {};
  if (!scheduleAssignmentAllowsCoach(coachId)) {
    return { blockedMessage: `${scheduleCoachDisplayName(getCoachName(ticket.coachId))} 담당 시간에서 선택해 주세요.` };
  }
  return {
    memberName: ticketParticipantNames(ticket)[0] || splitMemberNames(ticket.member)[0] || "",
    ticketId: ticket.id,
    coachId: ticket.coachId || coachId,
    lessonSource: state.scheduleAssignmentLessonSource || "regular",
    durationMinutes: getTicketDurationMinutes(ticket),
    day,
    time,
  };
}

function memberLessonRows(member) {
  const memberName = String(member?.name || "").trim();
  const serverUserIds = memberServerUserIds(member);
  return operationBranchLessons().filter((lesson) => {
    if (lesson.status === "cancelled") return false;
    const participantUserIds = Array.isArray(lesson.serverParticipantUserIds)
      ? lesson.serverParticipantUserIds.filter(Boolean)
      : [];
    if (serverUserIds.length && participantUserIds.length) {
      return participantUserIds.some((userId) => serverUserIds.includes(userId));
    }
    return splitMemberNames(lesson.member).includes(memberName);
  });
}

function memberScheduleSummary(member, ticket = memberCurrentTicket(member)) {
  if (!ticket) return "미배정";
  const product = membershipProductForTicket(ticket);
  const memberLessons = memberLessonRows(member);
  const today = adminLocalDateKey(new Date());
  const upcoming = memberLessons
    .filter((lesson) => !lesson.lessonDate || lesson.lessonDate >= today)
    .sort((left, right) => `${left.lessonDate || "9999-12-31"}T${left.time || "23:59"}`.localeCompare(`${right.lessonDate || "9999-12-31"}T${right.time || "23:59"}`));
  if (["pass", "coupon"].includes(product.productKind) || ["pass", "coupon"].includes(ticket.productKind)) {
    const nextLesson = upcoming[0];
    if (!nextLesson) return "쿠폰 · 다음 일정 없음";
    const dateLabel = nextLesson.lessonDate ? memberDetailDateLabel(nextLesson.lessonDate) : nextLesson.day;
    return `쿠폰 · 다음 ${dateLabel} ${nextLesson.time}`;
  }
  const regularLessons = memberLessons.filter((lesson) => !lesson.makeup && lesson.lessonSource !== "makeup");
  const scheduleLabels = [...new Set(regularLessons.map((lesson) => `${lesson.day} ${lesson.time}`))];
  if (scheduleLabels.length) return scheduleLabels.slice(0, 3).join(" · ");
  const record = memberDatabaseRecord(member, ticket);
  if (record?.lesson_days?.length || ticket?.lessonDays?.length) return memberManagementLessonDaysLabel(record, ticket);
  if (member.regularTime && member.regularTime !== "시간표에서 확인") return member.regularTime;
  return "미배정";
}

function memberScheduleDayAllowed(scope, day) {
  if (day === "" || day === null || day === undefined) return false;
  const value = Number(day);
  if (scope === "mixed") return memberScheduleDayOrder.includes(value);
  return scope === "weekend" ? [0, 6].includes(value) : value >= 1 && value <= 5;
}

function memberRegularScheduleSlots(member, ticket) {
  if (!ticket?.serverTicketId) return [];
  const rules = (adminLiveDataState.regularScheduleRules || [])
    .filter((rule) => String(rule.ticket_id || "") === String(ticket.serverTicketId)
      && rule.status === "active")
    .map((rule) => ({
      dayOfWeek: Number(rule.day_of_week),
      startTime: String(rule.start_time || "").slice(0, 5),
    }));
  const lessonSlots = memberLessonRows(member)
    .filter((lesson) => String(lesson.ticketId || "") === String(ticket.serverTicketId)
      && normalizeLessonSource(lesson.lessonSource) === "regular"
      && ["scheduled", "pending_change"].includes(lessonStatusValue(lesson)))
    .map((lesson) => ({
      dayOfWeek: lesson.lessonDate
        ? new Date(`${lesson.lessonDate}T12:00:00`).getDay()
        : ({ 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6, 일: 0 }[lesson.day]),
      startTime: String(lesson.time || "").slice(0, 5),
    }));
  const record = memberDatabaseRecord(member, ticket);
  const dayOnlySlots = (record?.lesson_days || ticket.lessonDays || [])
    .map((day) => ({ dayOfWeek: Number(day), startTime: "" }));
  const source = rules.length ? rules : lessonSlots.length ? lessonSlots : dayOnlySlots;
  return [...new Map(source
    .filter((slot) => memberScheduleDayOrder.includes(slot.dayOfWeek))
    .map((slot) => [`${slot.dayOfWeek}:${slot.startTime}`, slot])).values()]
    .sort((left, right) => (
      memberScheduleDayOrder.indexOf(left.dayOfWeek) - memberScheduleDayOrder.indexOf(right.dayOfWeek)
      || left.startTime.localeCompare(right.startTime)
    ));
}

function scheduleLessonMatches(lesson) {
  return matchesSearch([lesson.member, getCoachName(lesson.coachId), getCourtLabel(lesson.courtId), lesson.day, lesson.type])
    && scheduleLessonMatchesMemberSearch(lesson);
}

function lessonMatchesActiveScheduleWeek(lesson, day = lesson?.day) {
  if (!state.liveScheduleLoaded) return true;
  const targetDate = adminWeekDateForDay(day);
  return !targetDate || !lesson?.lessonDate || lesson.lessonDate === targetDate;
}

function selectedScheduleLessonIdSet() {
  return new Set((state.selectedScheduleLessonIds || []).map(String));
}

function selectedScheduleLessons() {
  const selected = selectedScheduleLessonIdSet();
  return lessons.filter((lesson) => (
    selected.has(String(lesson.serverLessonId || ""))
    && scheduleBulkEligible(lesson)
  ));
}

function clearScheduleBulkSelection(closeMode = false) {
  state.selectedScheduleLessonIds = [];
  state.scheduleBulkOperationKey = "";
  if (closeMode) state.scheduleBulkMode = false;
  renderSchedule();
}

function selectedScheduleOpenSlotKeys() {
  return new Set((state.selectedScheduleOpenSlots || []).map(scheduleOpenSlotKey));
}

function selectScheduleOpenSlotRange(key) {
  const orderedKeys = visibleScheduleOpenSlotKeys();
  const startIndex = orderedKeys.indexOf(String(state.scheduleOpenSlotAnchorKey || ""));
  const endIndex = orderedKeys.indexOf(String(key || ""));
  if (startIndex < 0 || endIndex < 0) return false;
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  orderedKeys.slice(from, to + 1).forEach((item) => setScheduleOpenSlotSelection(item, true));
  return true;
}

function selectScheduleLessonRange(lessonId) {
  const orderedIds = visibleScheduleLessonSelectionIds();
  const startIndex = orderedIds.indexOf(String(state.scheduleBulkAnchorLessonId || ""));
  const endIndex = orderedIds.indexOf(String(lessonId || ""));
  if (startIndex < 0 || endIndex < 0) return false;
  const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  orderedIds.slice(from, to + 1).forEach((id) => setScheduleLessonSelection(id, true));
  state.scheduleBulkOperationKey = "";
  return true;
}

function sortedSelectedScheduleOpenSlots() {
  return (state.selectedScheduleOpenSlots || [])
    .slice()
    .sort((left, right) => {
      const dayDelta = scheduleDays.indexOf(left.day) - scheduleDays.indexOf(right.day);
      if (dayDelta) return dayDelta;
      return timeToMinutes(left.time) - timeToMinutes(right.time);
    });
}

function scheduleOpenSlotPreviewText(selected = []) {
  if (!state.scheduleOpenSlotMode) return "";
  if (!selected.length) {
    return state.scheduleLessonClipboard
      ? "붙여넣을 빈 시간을 선택하세요. 같은 코치와 사용 가능한 회원권만 저장 단계로 이동합니다."
      : "주2회·주3회 정규권 시간을 먼저 찍고 회원을 선택하세요.";
  }
  const clipboard = state.scheduleLessonClipboard;
  const days = [...new Set(selected.map((slot) => slot.day).filter(Boolean))];
  const coaches = [...new Set(selected.map((slot) => scheduleCoachDisplayName(getCoachName(slot.coachId))))];
  const first = selected[0] || {};
  const last = selected[selected.length - 1] || first;
  const range = selected.length === 1
    ? `${first.day} ${first.time}`
    : `${first.day} ${first.time}~${last.day} ${last.time}`;
  const coachSummary = coaches.length > 1
    ? `${coaches[0]} 외 ${coaches.length - 1}명`
    : (coaches[0] || "코치 미지정");
  if (clipboard) {
    const readyCount = selected.filter((slot) => scheduleClipboardCanPaste(slot.day, slot.time, slot.coachId)).length;
    const blockedCount = selected.length - readyCount;
    const blockedText = blockedCount ? ` · 불가 ${blockedCount}칸` : "";
    return `${selected.length}칸 선택 · 붙여넣기 가능 ${readyCount}칸${blockedText} · ${coachSummary} · ${range}`;
  }
  const repeatHint = selected.length > 3
    ? "정규 반복 등록은 최대 3칸까지"
    : days.length > 1
      ? "요일별 반복 등록 준비"
      : "같은 요일 연속 시간 등록 준비";
  return `${selected.length}칸 선택 · ${coachSummary} · ${range} · ${repeatHint}`;
}

function copySelectedScheduleLesson() {
  const selected = selectedScheduleLessons();
  if (selected.length !== 1) {
    showToast("복사할 수업 한 개만 선택해 주세요.");
    return;
  }
  const lesson = selected[0];
  const ticket = getTicketByLesson(lesson);
  if (!ticket || Number(ticket.remaining) <= 0) {
    showToast("사용 가능한 회원권이 연결된 수업만 복사할 수 있습니다.");
    return;
  }
  state.scheduleLessonClipboard = {
    lessonId: lesson.serverLessonId,
    memberName: getEditingLessonMemberName(lesson) || getLessonParticipantNames(lesson)[0] || splitMemberNames(lesson.member)[0] || "",
    memberLabel: getLessonMembersLabel(lesson),
    ticketId: ticket.id,
    coachId: ticket.coachId || lesson.coachId,
    durationMinutes: Number(lesson.durationMinutes) || getTicketDurationMinutes(ticket),
    lessonType: lesson.type || getTicketLessonKind(ticket),
    lessonSource: normalizeLessonSource(lesson.lessonSource),
  };
  state.scheduleBulkMode = false;
  state.selectedScheduleLessonIds = [];
  state.scheduleBulkAnchorLessonId = "";
  state.scheduleBulkOperationKey = "";
  renderSchedule();
  showToast("수업을 복사했습니다. 같은 코치의 빈 시간을 선택해 확인 후 저장하세요.");
}

function clearScheduleLessonClipboard() {
  state.scheduleLessonClipboard = null;
  renderSchedule();
  showToast("수업 복사를 종료했습니다.");
}

function scheduleClipboardDefaultsForSlot(day, time, coachId) {
  const clipboard = state.scheduleLessonClipboard;
  if (!clipboard || !scheduleClipboardCanPaste(day, time, coachId)) return {};
  return {
    memberName: clipboard.memberName,
    ticketId: clipboard.ticketId,
    durationMinutes: clipboard.durationMinutes,
    lessonType: clipboard.lessonType,
    lessonSource: clipboard.lessonSource,
    pastedLesson: true,
  };
}

function scheduleTimeHasFilteredLesson(time) {
  if (state.scheduleFilter === "all") return true;
  return scheduleDays.some((day) =>
    operationBranchLessons().some((lesson) => {
      if (!scheduleFilterMatches(lesson) || !scheduleLessonMatches(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
      const start = timeToMinutes(lesson.time);
      const end = start + lesson.durationMinutes;
      const slot = timeToMinutes(time);
      return lesson.day === day && slot >= start && slot < end;
    }),
  );
}

function lessonOverlapsScheduleSlot(lesson, day, time) {
  if (lesson.day !== day || isLessonCancelled(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + scheduleBlockMinutes;
  const lessonStart = timeToMinutes(lesson.time);
  const lessonEnd = lessonStart + (Number(lesson.durationMinutes) || 20);
  return slotStart < lessonEnd && slotEnd > lessonStart;
}

function coachScheduleVisibleTimes(day, visibleCoaches) {
  const coachIds = new Set(visibleCoaches.map((coach) => coach.id));
  return makeTimeRange(scheduleSettings.openStart, scheduleSettings.openEnd).filter((time) => {
    const matchingLesson = lessons.some((lesson) => (
      coachIds.has(lesson.coachId)
      && lessonOverlapsScheduleSlot(lesson, day, time)
      && scheduleFilterMatches(lesson)
      && scheduleLessonMatches(lesson)
    ));
    if (state.scheduleFilter !== "all") return matchingLesson;
    return matchingLesson || visibleCoaches.some((coach) => isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes));
  });
}

function getAdminDurationSlotState(day, time, coach, laneLessons = null, availability = null) {
  if (coach.id?.startsWith("closed-")) {
    return {
      className: "is-closed",
      occupyingLesson: null,
      working: false,
      breakRule: null,
      canAdd: false,
      pasteReady: false,
    };
  }
  const candidateLessons = Array.isArray(laneLessons)
    ? laneLessons
    : operationBranchLessons().filter((lesson) => lessonScheduleCoachId(lesson) === coach.id);
  const occupyingLesson = candidateLessons.find((lesson) => lessonOverlapsScheduleSlot(lesson, day, time));
  const breakRule = getCoachBreakOverlapping(coach.id, day, time, 10) || getBreakRuleOverlapping(day, time, 10, coach.id);
  const working = !breakRule && isCoachAvailableForSlot(coach.id, day, time, 10);
  const canAdd = !occupyingLesson
    && working
    && (availability
      ? availability.hasCourtCapacity && availability.coachIds.has(coach.id)
      : canAddLessonAt(day, time, 20, coach.id));
  return {
    className: occupyingLesson ? "is-occupied" : breakRule ? "is-break" : working ? "is-open" : "is-closed",
    occupyingLesson,
    working,
    breakRule,
    canAdd,
    pasteReady: canAdd && scheduleClipboardCanPaste(day, time, coach.id),
  };
}

function buildAdminDurationSlotStateIndex(displayDays, visibleTimes, lanes, laneLessons, scheduleLessons) {
  const stateIndex = new Map();
  const activeCoaches = operationBranchCoaches()
    .filter((coach) => coach.status === "active");
  const bookedLessonsByDay = new Map(displayDays.map((day) => [day, []]));

  scheduleLessons.forEach((lesson) => {
    if (
      !bookedLessonsByDay.has(lesson.day)
      || !isBookedLesson(lesson)
      || isReleasedRegularMakeupSlot(lesson)
      || !lessonMatchesActiveScheduleWeek(lesson, lesson.day)
    ) return;
    bookedLessonsByDay.get(lesson.day).push(lesson);
  });

  displayDays.forEach((day) => {
    visibleTimes.forEach((time) => {
      const interval = {
        start: timeToMinutes(time),
        end: timeToMinutes(time) + 20,
      };
      const overlappingBooked = bookedLessonsByDay.get(day)
        .filter((lesson) => intervalsOverlap(interval, lessonInterval(lesson)));
      const usedCoachIds = new Set(overlappingBooked.map((lesson) => lessonScheduleCoachId(lesson)));
      const hasCourtCapacity = overlappingBooked.length < fixedCourtCount;
      const availableCoachIds = new Set(activeCoaches
        .filter((coach) => (
          !usedCoachIds.has(coach.id)
          && !getCoachBreakOverlapping(coach.id, day, time, 20)
          && !getBreakRuleOverlapping(day, time, 20, coach.id)
          && isCoachAvailableForSlot(coach.id, day, time, 20)
        ))
        .map((coach) => coach.id));

      lanes.forEach(({ day: laneDay, coach }, laneIndex) => {
        if (laneDay !== day) return;
        if (coach.id?.startsWith("closed-")) {
          stateIndex.set(`${laneIndex}|${time}`, {
            className: "is-closed",
            occupyingLesson: null,
            working: false,
            breakRule: null,
            canAdd: false,
            pasteReady: false,
          });
          return;
        }
        const occupyingLesson = laneLessons[laneIndex]
          .find((lesson) => lessonOverlapsScheduleSlot(lesson, day, time));
        const breakRule = getCoachBreakOverlapping(coach.id, day, time, 10)
          || getBreakRuleOverlapping(day, time, 10, coach.id);
        const working = !breakRule && isCoachAvailableForSlot(coach.id, day, time, 10);
        const canAdd = !occupyingLesson
          && working
          && hasCourtCapacity
          && availableCoachIds.has(coach.id);
        stateIndex.set(`${laneIndex}|${time}`, {
          className: occupyingLesson ? "is-occupied" : breakRule ? "is-break" : working ? "is-open" : "is-closed",
          occupyingLesson,
          working,
          breakRule,
          canAdd,
          pasteReady: canAdd && scheduleClipboardCanPaste(day, time, coach.id),
        });
      });
    });
  });

  return stateIndex;
}

function regularScheduleSlotIssue(slot, index, ticket, candidate, validation) {
  if (!slot?.day || !slot?.time) return "요일/시간 선택 필요";
  if (validation.duplicateDay && validation.duplicateDay === slot.day) return "요일 중복";
  if (ticket && !ticketAllowsScheduleDay(ticket, slot.day)) return "이 회원권에서 선택할 수 없는 요일";
  const internalConflict = getInternalScheduleConflict(validation.slots, candidate.durationMinutes);
  if (internalConflict && internalConflict.day === slot.day) return internalConflict.message;
  const exactDuplicate = getAdminManualExactDuplicate(getLessonFormCandidate({ day: slot.day, time: slot.time }));
  if (exactDuplicate) return "이미 같은 회원권·날짜·시간의 수업이 있습니다";
  const conflict = getLessonConflict(getLessonFormCandidate({ day: slot.day, time: slot.time }));
  if (conflict) return conflict.message;
  return "";
}

function regularScheduleIssueRows(ticket, candidate, validation) {
  const requiredCount = validation.requiredCount || 1;
  const slots = Array.from({ length: requiredCount }, (_, index) => validation.slots[index] || { day: "", time: "" });
  return slots.map((slot, index) => {
    const issue = regularScheduleSlotIssue(slot, index, ticket, candidate, validation);
    return {
      index: index + 1,
      slot,
      issue,
      label: slot.day && slot.time
        ? `${slot.day} ${slot.time}~${minutesToTime(timeToMinutes(slot.time) + candidate.durationMinutes)}`
        : "미선택",
    };
  });
}

function regularScheduleSaveCheckMessage(ticket, candidate, validation) {
  const issueRows = regularScheduleIssueRows(ticket, candidate, validation).filter((row) => row.issue);
  if (!issueRows.length) return "";
  return issueRows
    .slice(0, 3)
    .map((row) => `${row.index}번 ${row.label}: ${row.issue}`)
    .join(" / ");
}

function getSelectedLessonSchedules() {
  return getLessonScheduleSlots().filter((item) => item.day && item.time);
}

function getSelectedLessonDays() {
  return getSelectedLessonSchedules().map((item) => item.day);
}

function isTwoOnOneLessonType() {
  const selectedTicket = getSelectedTicket();
  return getTicketLessonKind(selectedTicket) === "2대1";
}

function getLessonTypeFromForm() {
  const ticket = getSelectedTicket();
  const ticketKind = getTicketLessonKind(ticket);
  if (ticketKind) return ticketKind;
  return "개인";
}

function matchingAdminMakeupEntitlements(memberName = $("#lessonMember")?.value, coachId = $("#lessonCoach")?.value) {
  return openAdminMakeupEntitlements().filter((item) => {
    const memberMatches = !memberName || item.memberNames.includes(memberName) || item.member === memberName;
    const coachMatches = !coachId || item.coachId === coachId;
    return memberMatches && coachMatches;
  });
}

function ticketMatchesLessonSource(ticket, source = $("#lessonSource")?.value) {
  if (!ticket) return false;
  const normalizedSource = normalizeLessonSource(source);
  if (["admin", "coach_change", "makeup"].includes(normalizedSource)) return true;
  return allowedLessonSourcesForTicket(ticket).includes(normalizedSource);
}

function getCurrentEditingLesson() {
  return state.editingLessonId ? lessons.find((lesson) => lesson.id === state.editingLessonId) : null;
}

function adminForceDeleteLessonTarget(candidate = getLessonFormCandidate()) {
  const editingLesson = getCurrentEditingLesson();
  if (editingLesson) return editingLesson;
  if (operationsRole() !== "admin" || !candidate?.day || !candidate?.time) return null;
  const exactDuplicate = getAdminManualExactDuplicate(candidate);
  if (exactDuplicate) return exactDuplicate;
  const conflict = isPastLessonCorrectionMode(candidate)
    ? getPastLessonCorrectionConflict(candidate)
    : getLessonConflict(candidate);
  return conflict?.lesson || null;
}

function isPastLessonCorrectionMode(candidate = {}) {
  if (!state.liveScheduleLoaded || operationsRole() !== "admin") return false;
  const editingLesson = getCurrentEditingLesson();
  if (editingLesson && !["scheduled", "completed", "no_show", "cancelled"].includes(lessonStatusValue(editingLesson))) {
    return false;
  }
  const endTimestamp = adminLessonEndTimestamp(candidate);
  return Number.isFinite(endTimestamp) && endTimestamp <= Date.now();
}

function getPastLessonCorrectionConflict(candidate) {
  const lessonDate = adminWeekDateForDay(candidate.day);
  const duplicate = lessons.find((lesson) => (
    lesson.id !== candidate.id
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed"].includes(lessonStatusValue(lesson))
  ));
  if (duplicate) {
    return { lesson: duplicate, message: "같은 회원권·날짜·시간의 수업 기록이 이미 있습니다." };
  }

  const overlappingLessons = getOverlappingBookedLessons(candidate.day, candidate.time, candidate.durationMinutes);
  const releasedRegularSlot = overlappingLessons.find((lesson) => (
    lesson.id !== candidate.id
    && isReleasedRegularMakeupSlot(lesson)
    && lesson.coachId === candidate.coachId
  ));
  if (
    releasedRegularSlot
    && candidate.lessonSource !== "makeup"
    && !isSameDateRegularLessonAdjustment(candidate, releasedRegularSlot)
  ) {
    return {
      lesson: releasedRegularSlot,
      message: "불참으로 비워진 정규 자리는 보강 또는 기존 정규수업의 같은 날 시간조정만 가능합니다.",
    };
  }

  const coachConflict = overlappingLessons
    .find((lesson) => (
      lesson.id !== candidate.id
      && !isReleasedRegularMakeupSlot(lesson)
      && lesson.coachId === candidate.coachId
      && ["scheduled", "pending_change", "completed"].includes(lessonStatusValue(lesson))
    ));
  if (coachConflict) {
    return { lesson: coachConflict, message: `${getCoachName(candidate.coachId)}의 기존 수업과 시간이 겹칩니다.` };
  }
  return null;
}

function releasedAbsenceEntitlement() {
  return state.makeupEntitlements.find((item) => item.id === state.releasedAbsenceEntitlementId) || null;
}

function matchingRegularLessonSeries(editingLesson = getCurrentEditingLesson()) {
  if (!editingLesson) return [];
  const sourceDate = editingLesson.lessonDate || adminWeekDateForDay(editingLesson.day);
  return lessons.filter((lesson) => (
    String(lesson.ticketId || lesson.serverTicketId || "") === String(editingLesson.ticketId || editingLesson.serverTicketId || "")
    && normalizeLessonSource(lesson.lessonSource) === "regular"
    && lessonStatusValue(lesson) === "scheduled"
    && (lesson.lessonDate || adminWeekDateForDay(lesson.day)) >= sourceDate
    && lesson.day === editingLesson.day
    && lesson.time === editingLesson.time
  ));
}

function expectedLiveLessonRows(ticket, candidates = []) {
  return candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminWeekDateForDay(candidate.day),
    day: candidate.day,
    time: candidate.time,
    durationMinutes: Number(candidate.durationMinutes),
    lessonSource: liveLessonSource(candidate),
    ticketId: ticket?.serverTicketId || "",
  }));
}

function liveLessonWriteVerificationDetails(ticket, candidates = []) {
  const ticketId = ticket?.serverTicketId || "";
  const requiredParticipantIds = ticket?.participantUserIds || [];
  const expectedLessons = expectedLiveLessonRows(ticket, candidates)
    .map((item) => ({ ...item, ticketId }));
  const missing = expectedLessons.filter((expected) => !liveLessonExistsAfterWrite(expected, requiredParticipantIds));
  return { expectedLessons, missing };
}

function liveLessonWriteVerification(ticket, candidates = []) {
  const details = liveLessonWriteVerificationDetails(ticket, candidates);
  if (!details.missing.length) return "";
  const missingLabel = details.missing
    .slice(0, 3)
    .map((item) => `${item.day || item.lessonDate} ${item.time}`)
    .join(", ");
  return `live_lesson_write_not_confirmed: ${missingLabel} 시간표 반영 확인 실패`;
}

function regularScheduleProtectionMessage(ticket, candidates = []) {
  if (ticket?.productKind !== "regular" || liveLessonSource(candidates[0]) !== "regular") return "";
  const targetSchedules = candidates.map((candidate) => ({
    lessonDate: candidate.lessonDate || adminLessonDateForCandidate(candidate.day),
    startTime: candidate.time,
  }));
  const existing = existingFutureRegularLessons(ticket.serverTicketId, targetSchedules);
  if (!existing.length) return "";
  return "기존 정규 시간표가 보호되어 새 등록은 진행하지 않았습니다. 기존 수업 카드를 눌러 해당 수업만 수정해 주세요.";
}

function pendingLessonChangeApprovals() {
  return operationBranchMakeupRequests()
    .filter((request) => request.makeupType !== "entitlement" && request.serverRequestId && request.status === "pending")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

function pendingLessonRecords(context) {
  const completedLessonIds = new Set((adminLiveDataState.lessonRecords || []).map((record) => record.lesson_id));
  const participantRecordsByLessonId = context?.participantRecordsByLessonId || new Map();
  const now = Date.now();
  const ownRoleIds = currentOperationsCoachRoleIds();
  return lessons
    .filter((lesson) => {
      const endedAt = lessonEndTimestamp(lesson);
      return (
        lesson.serverLessonId
        && !lesson.oneDayBooking
        && lesson.serverStatus === "scheduled"
        && endedAt > 0
        && endedAt <= now
        && !completedLessonIds.has(lesson.serverLessonId)
        && (operationsRole() === "admin" || ownRoleIds.has(lesson.coachRoleId))
      );
    })
    .flatMap((lesson) => {
      const lessonRecords = participantRecordsByLessonId.get(String(lesson.serverLessonId)) || [];
      const targets = lessonParticipantTargets(lesson, context);
      if (!targets.length) return lessonRecords.length ? [] : [pendingLessonRecord(lesson)];
      return targets
        .filter((target) => !lessonRecords.some((record) => String(record.user_id || "") === target.userId))
        .map((target) => pendingLessonRecord(lesson, target));
    });
}

function adminWeeklyScheduleExportRows() {
  const week = activeAdminWeek();
  const rows = [
    ["주차", "기간", "날짜", "요일", "시간", "종료", "회원명", "회차", "수업구분", "상태", "담당코치", "실수업코치", "수업분", "메모"],
  ];
  const weekLessons = lessons
    .filter((lesson) => lesson.day && lesson.time && !isLessonCancelled(lesson) && lessonMatchesActiveScheduleWeek(lesson, lesson.day))
    .sort((left, right) => {
      const dayDiff = scheduleDays.indexOf(left.day) - scheduleDays.indexOf(right.day);
      if (dayDiff) return dayDiff;
      const timeDiff = timeToMinutes(left.time) - timeToMinutes(right.time);
      if (timeDiff) return timeDiff;
      return String(lessonScheduleCoachLabel(left)).localeCompare(String(lessonScheduleCoachLabel(right)), "ko");
    });
  weekLessons.forEach((lesson) => {
    const start = timeToMinutes(lesson.time);
    const duration = Number(lesson.durationMinutes) || 20;
    const scheduleCoachId = lessonScheduleCoachId(lesson);
    rows.push([
      week.label || "",
      week.range || "",
      lesson.lessonDate || adminWeekDateForDay(lesson.day),
      lesson.day,
      lesson.time,
      minutesToTime(start + duration),
      getLessonMembersLabel(lesson),
      getLessonRoundLabel(lesson) || "",
      lesson.oneDayBooking ? "원데이" : isMakeupLesson(lesson) ? "보강" : lesson.type || "정규",
      getLessonStatusLabel(lesson),
      scheduleCoachDisplayName(getCoachName(scheduleCoachId)),
      scheduleCoachDisplayName(getCoachName(lesson.coachId || scheduleCoachId)),
      duration,
      scheduleLessonExceptionLabel(lesson) || lesson.changeNote || "",
    ]);
  });
  if (rows.length === 1) {
    rows.push([week.label || "", week.range || "", "", "", "", "", "현재 주차에 내보낼 수업이 없습니다.", "", "", "", "", "", "", ""]);
  }
  return rows;
}

function adminWeekDateForDay(day) {
  const week = activeAdminWeek();
  const dayIndex = scheduleDays.indexOf(day);
  if (!week.startDate || dayIndex < 0) return "";
  const date = new Date(`${week.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return adminLocalDateKey(date);
}

function adminLessonDateForCandidate(day) {
  const editingLesson = getCurrentEditingLesson();
  if (
    editingLesson?.lessonDate
    && selectedLessonEditScope() === "single"
    && day === editingLesson.day
  ) {
    return editingLesson.lessonDate;
  }
  return adminWeekDateForDay(day);
}

function adminLiveLessonWindow() {
  const targetWeek = state.view === "schedule" ? activeAdminWeek() : adminScheduleWeek(0);
  const today = adminLocalDateKey(new Date());
  const targetStart = targetWeek.startDate || today;
  const targetEnd = targetWeek.endDate || shiftedAdminDateKey(targetStart, 6);
  return {
    from: shiftedAdminDateKey(targetStart, -7),
    to: shiftedAdminDateKey(targetEnd, 7),
  };
}

function activeAdminWeekIsLoaded() {
  return adminWeekIsLoaded(activeAdminWeek());
}
