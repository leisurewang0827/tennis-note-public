// 주제를 하나로 묶기 어려운 공용 순수 함수들.
// 주제가 뚜렷해지면 해당 파일로 옮기세요.
//
// 전역도 DOM 도 서버도 참조하지 않는다. 필요한 데이터는 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function makeTimeRange(startTime, endTime, stepMinutes = scheduleBlockMinutes, allScheduleSettings = scheduleSettings) {
  const times = [];
  for (let current = timeToMinutes(startTime); current <= timeToMinutes(endTime); current += stepMinutes) {
    times.push(minutesToTime(current));
  }
  return times;
}

function adminWeekOffsetForDate(value) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const dayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset);
  const today = new Date();
  const currentDayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + currentDayOffset);
  return Math.round((targetMonday - currentMonday) / 604800000);
}

function normalizeLayoutOrder(value, definitions) {
  const ids = definitions.map((item) => item.id);
  const requested = Array.isArray(value) ? value.filter((id) => ids.includes(id)) : [];
  return [...new Set([...requested, ...ids])];
}

function replaceArray(target, source) {
  if (Array.isArray(source)) target.splice(0, target.length, ...source);
}

function adminSecurityConfigPayload(source = adminLockSettings) {
  return {
    enabled: Boolean(source.enabled),
    timeoutMinutes: Math.min(Math.max(numericValue(source.timeoutMinutes, 10), 1), 120),
    lockedViews: [...new Set(Array.isArray(source.lockedViews) ? source.lockedViews : [])],
    pastAbsenceRequirePinEveryTime: source.pastAbsenceRequirePinEveryTime !== false,
  };
}

function operationBranchOptions(allLiveData = adminLiveDataState) {
  const liveBranches = (allLiveData.branches || [])
    .filter((branch) => branch?.id)
    .map((branch) => ({
      id: String(branch.id),
      name: String(branch.name || "지점"),
      status: branch.status || "active",
    }));
  if (liveBranches.length) {
    return liveBranches.sort((left, right) => (
      Number(left.status !== "active") - Number(right.status !== "active")
      || left.name.localeCompare(right.name, "ko")
    ));
  }
  const inferredIds = [...new Set([
    ...(allLiveData.products || []).map((product) => product.branch_id),
    ...(allLiveData.coachRoles || []).map((role) => role.branch_id),
  ].filter(Boolean).map(String))];
  return inferredIds.map((id, index) => ({
    id,
    name: inferredIds.length === 1 ? "현재 지점" : `지점 ${index + 1}`,
    status: "active",
  }));
}

function defaultOperationBranch() {
  const activeBranches = operationBranchOptions().filter((branch) => branch.status === "active");
  return activeBranches.length === 1 ? activeBranches[0] : null;
}

function operationBranchAllowsLegacyRows() {
  return operationBranchOptions().filter((branch) => branch.status === "active").length <= 1;
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sqlLiteral(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function moneyFromLabel(label = "") {
  const number = Number(String(label).replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function postgresDayOfWeek(day) {
  return { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }[day];
}

function dayLabelForPostgres(day) {
  return { 0: "일", 1: "월", 2: "화", 3: "수", 4: "목", 5: "금", 6: "토" }[Number(day)] || "";
}

function reflectLessonPoliciesInActiveVersion(allLessonPolicies = lessonPolicies) {
  const policy = activePolicyVersion();
  if (!policy) return;
  const rules = allLessonPolicies
    .filter((item) => item.status === "active")
    .map((item) => `${item.title}: ${item.detail}`);
  const sectionIndex = policy.sections.findIndex((section) => section.id === "lesson-operation");
  if (!rules.length) {
    if (sectionIndex >= 0) policy.sections.splice(sectionIndex, 1);
    return;
  }
  const nextSection = { id: "lesson-operation", title: "수업 운영", rules };
  if (sectionIndex >= 0) policy.sections.splice(sectionIndex, 1, nextSection);
  else policy.sections.unshift(nextSection);
}

function upsertBreakRule(id, days, start, end, label = "브레이크", allScheduleSettings = scheduleSettings) {
  allScheduleSettings.breakRules = allScheduleSettings.breakRules.filter((rule) => rule.id !== id);
  allScheduleSettings.breakRules.push({ id, days, start, end, label });
}

function getCourtLabel(courtId) {
  return courtId?.replace("court-", "코트 ") || "코트 미정";
}

function lessonRoundSortKey(lesson, allScheduleDays = scheduleDays) {
  const dayIndex = Math.max(0, allScheduleDays.indexOf(lesson?.day));
  const dateKey = lesson?.lessonDate || `9999-12-${String(dayIndex + 1).padStart(2, "0")}`;
  const timeKey = String(lesson?.time || "00:00").padStart(5, "0");
  return `${dateKey}T${timeKey}:${String(lesson?.id || "")}`;
}

function lessonCssStatusClass(lesson = {}) {
  const status = lessonStatusValue(lesson);
  if (status === "pending_change") return "pending";
  return status;
}

function getLessonStateClass(lesson) {
  if (lessonStatusValue(lesson) === "completed") return Number(lesson.deductedSessions) > 0 ? "status-completed status-deducted" : "status-completed status-not-deducted";
  if (lessonStatusValue(lesson) === "no_show") return Number(lesson.deductedSessions) > 0 ? "status-no-show status-deducted" : "status-no-show status-not-deducted";
  if (isReleasedRegularMakeupSlot(lesson)) return "status-released-makeup";
  if (isMakeupLesson(lesson) && isLessonPendingChange(lesson)) return "status-makeup-pending";
  if (isMakeupLesson(lesson)) return "status-makeup";
  if (isLessonPendingChange(lesson)) return "status-pending";
  return "";
}

function lessonInterval(lesson) {
  const start = timeToMinutes(lesson.time);
  return {
    start,
    end: start + lesson.durationMinutes,
  };
}

function getBreakRuleForSlot(day, time, coachId = "", allScheduleSettings = scheduleSettings) {
  const current = timeToMinutes(time);
  return allScheduleSettings.breakRules.find((rule) => {
    if (!rule.days?.includes(day) || !breakRuleAppliesToCoach(rule, coachId)) return false;
    return current >= timeToMinutes(rule.start) && current < timeToMinutes(rule.end);
  });
}

function getBreakRuleOverlapping(day, time, durationMinutes = 20, coachId = "", allScheduleSettings = scheduleSettings) {
  const start = timeToMinutes(time);
  const end = start + durationMinutes;
  return allScheduleSettings.breakRules.find((rule) => {
    if (!rule.days?.includes(day) || !breakRuleAppliesToCoach(rule, coachId)) return false;
    const ruleStart = timeToMinutes(rule.start);
    const ruleEnd = timeToMinutes(rule.end);
    return start < ruleEnd && ruleStart < end;
  });
}

function isBreakSlot(day, time, coachId = "") {
  return Boolean(getBreakRuleForSlot(day, time, coachId));
}

function isBreakOverlapping(day, time, durationMinutes = 20, coachId = "") {
  return Boolean(getBreakRuleOverlapping(day, time, durationMinutes, coachId));
}

function normalizeDashboardPage(total, page, pageSize = dashboardPageSize) {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  return Math.min(Math.max(Number(page) || 0, 0), lastPage);
}

function buildAuthCandidateSql(member, role = "member") {
  const clauses = [`name ilike '%' || ${sqlLiteral(member.name)} || '%'`];
  if (role) clauses.push(`role = ${sqlLiteral(role)}`);
  return `-- 1. Find the Tennis Note profile row.
select
  u.id,
  u.name,
  u.role,
  u.status,
  u.auth_user_id is not null as direct_linked,
  count(l.id)::integer as provider_links
from public.tn_users
left join public.tn_user_auth_links l on l.user_id = u.id
where ${clauses.map((clause) => clause.replace(/\bname\b/g, "u.name").replace(/\brole\b/g, "u.role")).join(" and ")}
group by u.id, u.name, u.role, u.status, u.auth_user_id, u.created_at
order by u.created_at desc
limit 20;`;
}

function buildAuthLinkSql(member, { authUserId, tnUserId, role, provider }) {
  return `-- Tennis Note auth role link SQL
-- Review in Supabase SQL Editor before running.
-- Do not commit real auth UUIDs or private member data.

${buildAuthCandidateSql(member, role)}

-- 2. Link the signed-in Supabase Auth user to the selected Tennis Note profile.
update public.tn_users
set
  auth_user_id = coalesce(auth_user_id, ${sqlLiteral(authUserId)}::uuid),
  role = ${sqlLiteral(role)},
  status = 'active',
  updated_at = now()
where id = ${sqlLiteral(tnUserId)}::uuid
returning id, name, role, status, auth_user_id is not null as direct_linked;

-- 3. Add this provider as a login method without overwriting another provider.
insert into public.tn_user_auth_links (
  user_id,
  auth_user_id,
  provider,
  email_kind,
  is_primary,
  linked_by_user_id,
  linked_at,
  created_at,
  updated_at
)
values (
  ${sqlLiteral(tnUserId)}::uuid,
  ${sqlLiteral(authUserId)}::uuid,
  ${sqlLiteral(provider || "supabase")},
  'unknown',
  false,
  ${sqlLiteral(tnUserId)}::uuid,
  now(),
  now(),
  now()
)
on conflict (auth_user_id) do update
set
  user_id = excluded.user_id,
  provider = excluded.provider,
  updated_at = now()
returning user_id, provider, auth_user_id is not null as linked;

-- 4. Verify that this auth user reaches exactly one profile.
select u.id, u.name, u.role, u.status, l.provider, l.auth_user_id is not null as linked
from public.tn_users
join public.tn_user_auth_links l on l.user_id = u.id
where l.auth_user_id = ${sqlLiteral(authUserId)}::uuid;`;
}

function normalizedAuthProvider(provider = "") {
  const value = String(provider || "").toLowerCase();
  if (["naver", "custom:naver"].includes(value)) return "custom:naver";
  if (["kakao", "custom:kakao"].includes(value)) return "custom:kakao";
  if (["direct", "supabase", "email"].includes(value)) return "email";
  if (value === "apple") return value;
  return value;
}

function authProviderLabel(provider = "") {
  return {
    "custom:naver": "네이버",
    "custom:kakao": "카카오",
    apple: "Apple",
    email: "이메일",
  }[normalizedAuthProvider(provider)] || "";
}

function authProviderList(entity = {}) {
  return [...new Set((entity.authProviders || []).map(normalizedAuthProvider).filter(Boolean))];
}

function authProvidersFromLinks(links = []) {
  return [...new Set([...links]
    .sort((left, right) => Number(Boolean(right.is_primary)) - Number(Boolean(left.is_primary)))
    .map((link) => link.provider)
    .filter(Boolean))];
}

function pendingAuthSwitch(entity = {}) {
  const request = entity.authSwitch;
  if (!request || request.status !== "pending") return null;
  if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) return null;
  return request;
}

function authSwitchExpiryLabel(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "24시간 안에 로그인";
  return `${date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지`;
}

function adminAccountControlErrorMessage(code = "") {
  return {
    active_admin_role_required: "관리자 계정으로 로그인해 주세요.",
    invalid_user_id: "회원 계정 정보를 다시 불러와 주세요.",
    invalid_coach_role_id: "코치 권한 정보를 다시 불러와 주세요.",
    coach_role_not_found: "코치 권한을 찾지 못했습니다.",
    verified_member_phone_required_for_switch: "회원 휴대전화 번호를 먼저 정확히 등록해 주세요.",
    current_login_provider_required: "현재 연결된 로그인 수단이 없습니다.",
    different_target_provider_required: "현재와 다른 로그인 수단을 선택해 주세요.",
    source_provider_link_not_found: "해제할 기존 로그인 수단을 찾지 못했습니다.",
    target_provider_already_linked: "이미 연결된 로그인 수단입니다.",
    member_login_provider_locked: "이 회원은 이미 다른 로그인 수단을 사용 중입니다. 로그인 변경을 먼저 준비해 주세요.",
    replacement_login_required_before_unlink: "다른 로그인 수단을 먼저 연결해야 기존 수단을 해제할 수 있습니다.",
    auth_provider_link_not_found: "해제할 로그인 연결을 찾지 못했습니다.",
    pending_auth_switch_not_found: "변경 대기가 이미 끝났습니다. 새로고침 후 확인해 주세요.",
  }[code] || `처리하지 못했습니다: ${code || "server_error"}`;
}

function holdingRequestDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function accountDeletionStatusLabel(status) {
  if (status === "reviewing") return "검토중";
  if (status === "processing") return "삭제 처리중";
  if (status === "failed") return "재시도 필요";
  if (status === "completed") return "처리완료";
  if (status === "cancelled") return "취소";
  return "접수";
}

function accountDeletionDateTime(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "접수 시각 미확인" : date.toLocaleString("ko-KR");
}

function normalizedRpcResult(result) {
  return Array.isArray(result) ? result[0] || {} : result || {};
}

function notificationTemplateLabel(templateKey = "") {
  return ({
    lesson_day_before: "수업 하루 전",
    lesson_30_minutes_before: "수업 30분 전",
    coupon_next_booking: "쿠폰 다음 일정",
    ticket_low_remaining: "잔여횟수",
    ticket_expiring: "만료 임박",
    ticket_expired: "만료일",
    payment_cancelled: "결제취소",
    payment_refunded: "환불",
    lesson_substitute_assigned: "대타 코치 지정",
    substitute_lesson_assigned: "대타 수업 배정",
    substitute_lesson_transferred: "대타 처리 일정",
    lesson_substitute_cancelled: "원 담당 코치 복원",
    coach_feedback_missing: "피드백 작성 필요",
    coach_feedback_overdue_admin: "피드백 미작성",
    lesson_feedback_ready: "코치 피드백 등록",
    lesson_change_staff: "수업 변경",
    makeup_booking_staff: "보강 신청",
  })[templateKey] || "앱 알림";
}

function normalizeNotificationOverview(payload = {}, source = "server") {
  const recent = Array.isArray(payload.recent) ? payload.recent : [];
  return {
    status: source === "server" ? "ready" : "limited",
    queued: Number(payload.queued) || 0,
    sentToday: Number(payload.sentToday ?? payload.sent_today) || 0,
    failed: Number(payload.failed) || 0,
    activeDevices: payload.activeDevices === null || payload.activeDevices === undefined
      ? null
      : Number(payload.activeDevices),
    recent,
    checkedAt: payload.generatedAt || payload.generated_at || new Date().toISOString(),
    message: source === "server" ? "실서버 발송 현황" : "기본 발송 현황",
  };
}

function normalizedPartnerSearchValue(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s-]+/g, "");
}

function chunkedValues(values = [], size = 200) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function adminManualOverrideReason() {
  return "관리자 수동 예외 처리";
}

function adminPastCorrectionReason() {
  return "관리자 과거 수업 보정";
}

function lessonSourceLabel(value) {
  return {
    regular: "정규수업",
    makeup: "보강",
    coupon: "쿠폰수업",
    one_day: "원데이",
    coach_change: "코치변경",
    admin: "과거수업 보정",
  }[normalizeLessonSource(value)];
}

function getLessonParticipantNames(lesson, allLiveData = adminLiveDataState) {
  if (!lesson) return [];
  const namesById = (Array.isArray(lesson.serverParticipantUserIds) ? lesson.serverParticipantUserIds : [])
    .map((userId) => (allLiveData.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set(namesById.length ? namesById : splitMemberNames(lesson.member))];
}

function lessonSaveRecoverySteps(isWriteConfirmFailure = false) {
  if (!isWriteConfirmFailure) {
    return ["입력값을 확인한 뒤 같은 창에서 다시 저장해 주세요."];
  }
  return [
    "같은 내용을 바로 다시 저장하지 말고 시간표를 새로고침해 주세요.",
    "해당 요일·시간 칸에 수업이 보이면 추가 저장하지 마세요.",
    "칸이 비어 있으면 최근 안전 스냅샷과 서버 삭제 스냅샷에서 복구 여부를 확인하세요.",
  ];
}

function substituteLessonsForDate(date = "", allLessons = lessons) {
  return allLessons
    .filter((lesson) => lesson.serverLessonId && !lesson.oneDayBooking)
    .filter((lesson) => lesson.lessonDate === date)
    .filter((lesson) => ["scheduled", "pending_change"].includes(lesson.serverStatus || "scheduled"))
    .sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time));
}

function oneDayBookingForId(bookingId, allLessons = lessons) {
  return allLessons.find((lesson) => lesson.oneDayBooking && String(lesson.serverOneDayBookingId) === String(bookingId)) || null;
}

function liveLessonSource(candidate = {}) {
  if (candidate.lessonSource) return normalizeLessonSource(candidate.lessonSource);
  if (`${candidate.type || ""}`.includes("보강")) return "makeup";
  if (`${candidate.type || ""}`.includes("대타")) return "coach_change";
  return "regular";
}

function isMissingRpcError(error, functionName) {
  const raw = `${error?.payload?.message || ""} ${error?.payload?.code || ""} ${error?.message || ""}`;
  return raw.includes("PGRST202")
    || (
      raw.includes("Could not find the function")
      && raw.includes(functionName)
    );
}

function liveLessonExistsAfterWrite(expected, requiredParticipantIds = [], allLessons = lessons) {
  return allLessons.some((lesson) => (
    lesson.ticketId === expected.ticketId
    && lesson.lessonDate === expected.lessonDate
    && lesson.time === expected.time
    && Number(lesson.durationMinutes) === expected.durationMinutes
    && lesson.lessonSource === expected.lessonSource
    && ["scheduled", "pending_change"].includes(lesson.serverStatus)
    && requiredParticipantIds.every((id) => lesson.serverParticipantUserIds?.includes(id))
  ));
}

function liveLessonWriteFailureMessage(errorText = "") {
  if (!String(errorText).includes("live_lesson_write_not_confirmed")) return "";
  const detail = String(errorText).split("live_lesson_write_not_confirmed:")[1]?.trim();
  const suffix = detail ? ` (${detail})` : "";
  return `서버 저장 결과를 시간표에서 다시 확인하지 못했습니다${suffix}. 중복 저장하지 말고 새로고침 후 해당 칸을 확인해 주세요.`;
}

function existingFutureRegularLessons(ticketId, targetSchedules = [], allLessons = lessons) {
  const replaceFromDate = targetSchedules.map((item) => item.lessonDate).filter(Boolean).sort()[0] || "";
  if (!replaceFromDate) return [];
  return allLessons.filter((lesson) => (
    String(lesson.ticketId || "") === String(ticketId || "")
    && normalizeLessonSource(lesson.lessonSource) === "regular"
    && lesson.serverStatus === "scheduled"
    && lesson.lessonDate >= replaceFromDate
  ));
}

function billingMonthLabel(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  return match ? `${Number(match[1])}년 ${Number(match[2])}월 회원권 매출` : "선택 월 회원권 매출";
}

function searchableAdminCurriculumChoice(choice) {
  const step = choice.step || {};
  return {
    ...step,
    id: step.id || choice.value,
    title: step.title || choice.label,
    trackTitle: step.trackTitle || step.category || choice.label,
    goal: step.goal || choice.label,
    __choiceValue: choice.value,
  };
}

function csvCell(value = "") {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function importSampleRows() {
  return [
    ["회원", "홍길동", "010-0000-0000", "", "", "수강중", "노코치", "주2회 개인 20분", 20, 2, 8, 2, 6, "2026-07-10", "카드", 165000, "월", "18:40", "수", "19:20", "신규 등록 예시"],
    ["회원", "김테니스", "010-1111-1111", "이파트너", "010-2222-2222", "수강중", "강코치", "주1회 2대1 20분", 20, 1, 8, 0, 8, "2026-07-10", "현금", 150000, "토", "09:00", "", "", "2대1 공동 시간표 예시"],
  ];
}

function defaultMonthlyImportMonth() {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + (today.getDate() >= 20 ? 1 : 0), 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function parseDelimitedRows(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeImportHeader(value = "") {
  return String(value).replace(/\s+/g, "").trim();
}

function rowObjectFromHeaders(headers, row) {
  return headers.reduce((acc, header, index) => {
    acc[header] = row[index] ?? "";
    return acc;
  }, {});
}

function importCell(row, column) {
  return String(row[column] ?? "").trim();
}

function isNumericImportValue(value) {
  if (String(value ?? "").trim() === "") return true;
  return Number.isFinite(Number(String(value).replaceAll(",", "")));
}

function nonEmptyWorkbookRows(rows = []) {
  return rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()));
}

function importRowsAsObjects(rawRows = []) {
  const headerRow = rawRows[0] || [];
  const headers = headerRow.map((header) => normalizeImportHeader(header));
  return nonEmptyWorkbookRows(rawRows.slice(1)).map((row, index) => ({
    rowNumber: index + 2,
    values: rowObjectFromHeaders(headers, row),
  }));
}

function importGuideMetadata(rawRows = []) {
  return Object.fromEntries(nonEmptyWorkbookRows(rawRows).slice(1).map((row) => [
    normalizeImportHeader(row[0]),
    String(row[1] ?? "").trim(),
  ]));
}

function normalizedImportNumber(value) {
  const text = String(value ?? "").replaceAll(",", "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function liveLessonStatus(status = "scheduled") {
  if (status === "pending_change") return "pending";
  if (["completed", "no_show"].includes(status)) return "confirmed";
  return "scheduled";
}

function shiftedAdminDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return adminLocalDateKey(date);
}

function adminWeekIsLoaded(week, allLiveData = adminLiveDataState) {
  const loadedWindow = allLiveData.lessonWindow || {};
  return Boolean(
    loadedWindow.from
    && loadedWindow.to
    && week.startDate >= loadedWindow.from
    && week.endDate <= loadedWindow.to
  );
}

function serverPreviewStatus(summary = {}) {
  if (Number(summary.errorRows || 0) > 0) return "error";
  if (Number(summary.reviewRows || 0) > 0) return "review";
  return "ready";
}

function serverPreviewMessage(status, summary = {}) {
  if (status === "ready") return `서버 검증 통과. ${summary.readyRows || 0}행이 실제 반영 후보입니다.`;
  if (status === "review") return `서버 확인 필요. ${summary.reviewRows || 0}행을 확인한 뒤 진행하세요.`;
  return `서버 검증 오류. ${summary.errorRows || 0}행을 수정해야 합니다.`;
}

function managementReportMonthLabel(month = "") {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return match ? `${Number(match[1])}년 ${Number(match[2])}월` : "선택 월";
}

function managementReportEmptyMarkup(message = "현재 확인이 필요한 항목이 없습니다.") {
  return `<div class="management-report-empty"><strong>확인 완료</strong><span>${escapeHtml(message)}</span></div>`;
}

function managementReportListMarkup(items = [], emptyMessage = "현재 확인이 필요한 항목이 없습니다.") {
  if (!items.length) return managementReportEmptyMarkup(emptyMessage);
  return items.map((item) => `
    <article class="management-report-row ${escapeHtml(item.tone || "")}">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(item.detail || "")}</small>
      </div>
      <span>${escapeHtml(item.value)}</span>
    </article>`).join("");
}

function adminDriveReportErrorState(error) {
  const code = String(error?.payload?.code || error?.message || "drive_report_read_failed");
  if (code.includes("drive_report_not_configured") || code.includes("drive_report_sources_invalid")) {
    return { status: "not_configured", message: "서버의 Drive 읽기 전용 연결값이 아직 없습니다." };
  }
  if (code.includes("drive_report_source_not_found")) {
    return { status: "unavailable", message: "선택한 지점과 월의 Drive 집계 설정이 없습니다." };
  }
  if (error?.status === 401 || error?.status === 403) {
    return { status: "error", message: "대표 관리자 권한으로 다시 로그인해 주세요." };
  }
  return { status: "error", message: "Drive 원본 권한, 집계 셀 또는 서버 연결을 확인해 주세요." };
}

function favoriteBreakFromRule(rule) {
  return {
    id: `favorite-${rule.id}`,
    sourceRuleId: rule.id,
    days: [...(rule.days || [])],
    start: rule.start,
    end: rule.end,
    label: rule.label || "브레이크",
    coachRoleIds: [...breakRuleCoachRoleIds(rule)],
  };
}

function toggleBreakFavorite(ruleId, allScheduleSettings = scheduleSettings) {
  const favoriteIndex = allScheduleSettings.breakFavorites.findIndex((favorite) => favorite.sourceRuleId === ruleId);
  if (favoriteIndex >= 0) {
    allScheduleSettings.breakFavorites.splice(favoriteIndex, 1);
    return;
  }
  const rule = allScheduleSettings.breakRules.find((item) => item.id === ruleId);
  if (rule) allScheduleSettings.breakFavorites.push(favoriteBreakFromRule(rule));
}

function notificationDateTimeLabel(value = "") {
  if (!value) return "기록 없음";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "기록 없음";
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeNoticeFileName(fileName = "notice-image") {
  const extension = String(fileName).split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
  return `notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;
}

function permissionMessage(error) {
  const message = error?.message || "";
  if (error?.status === 401 || error?.status === 403 || message.includes("permission denied") || message.includes("JWT")) {
    return "권한 필요";
  }
  return "확인 실패";
}

function authProviderItems(settings = {}) {
  const external = settings.external || {};
  return [
    {
      id: "kakao",
      title: "Kakao",
      status: external.kakao ? "ready" : "setup",
      label: external.kakao ? "켜짐" : "설정 필요",
      detail: external.kakao ? "통합앱 카카오 로그인 연결 가능" : "Supabase Authentication > Providers에서 Kakao를 켜야 합니다.",
    },
    {
      id: "naver",
      title: "Naver",
      status: external.naver ? "ready" : "setup",
      label: external.naver ? "켜짐" : "설정 필요",
      detail: external.naver ? "통합앱 네이버 로그인 연결 가능" : "Supabase Authentication > Providers에서 Naver를 켜야 합니다.",
    },
    {
      id: "role-link",
      title: "역할 연결",
      status: "setup",
      label: "사용자 로그인 후",
      detail: "로그인한 사용자 UUID를 tn_users.auth_user_id에 연결하면 회원/코치 권한이 열립니다.",
    },
  ];
}
