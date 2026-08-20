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

// ── 아래는 2차 정리에서 app.js 에서 더 옮겨온 것들 ──

function adminTimeVisibleForDay(day, time) {
  const slotStart = timeToMinutes(time);
  const slotEnd = slotStart + scheduleBlockMinutes;
  const hasLesson = lessons.some((lesson) => {
    if (lesson.day !== day || isLessonCancelled(lesson) || !lessonMatchesActiveScheduleWeek(lesson, day)) return false;
    const lessonStart = timeToMinutes(lesson.time);
    return slotStart < lessonStart + (Number(lesson.durationMinutes) || 20) && slotEnd > lessonStart;
  });
  if (hasLesson) return true;
  return getScheduleCoachLanes(day)
    .filter((coach) => coach.id !== "coach-machine")
    .some((coach) => isCoachAvailableForSlot(coach.id, day, time, scheduleBlockMinutes));
}

function changeAdminMonth(delta) {
  const currentStart = new Date(`${activeAdminWeek().startDate}T12:00:00`);
  const targetMonthStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + delta, 1);
  const targetLastDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const target = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), Math.min(currentStart.getDate(), targetLastDay));
  state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(target), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function selectAdminMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return;
  const [year, month] = value.split("-").map(Number);
  const currentStart = new Date(`${activeAdminWeek().startDate}T12:00:00`);
  const targetLastDay = new Date(year, month, 0).getDate();
  const target = new Date(year, month - 1, Math.min(currentStart.getDate(), targetLastDay));
  state.activeAdminWeekIndex = Math.min(Math.max(adminWeekOffsetForDate(target), adminScheduleMinWeekOffset), adminScheduleMaxWeekOffset);
  syncAdminScheduleWeek();
  renderSchedule();
  saveSnapshot();
  void ensureActiveAdminWeekLoaded();
}

function operationsViewAllowed(view) {
  return operationsRole() === "admin" || coachOperationsViews.has(view);
}

function memberFromAdminDirectoryRow(row, sourceMembers = members) {
  const userId = String(row?.user_id || "");
  if (!userId) return null;
  const existing = sourceMembers.find((member) => String(member.serverUserId || "") === userId);
  if (existing) {
    existing.directoryRow = row;
    return existing;
  }
  const nextId = Math.max(1000, ...sourceMembers.map((member) => Number(member.id) || 0)) + 1;
  const status = String(row.directory_status || "expired");
  const member = {
    id: nextId,
    name: row.name || "회원",
    status,
    statusLabel: status === "active" ? "수강중" : status === "pending" ? "가입대기" : status === "journal" ? "운동노트 회원" : status === "inactive" ? "삭제회원" : "만료회원",
    memberKind: status === "journal" ? "journal_only" : status === "pending" ? "lesson_pending" : status === "active" ? "lesson_member" : "former_lesson_member",
    serverStatus: row.user_status || "active",
    serverUserId: userId,
    serverUserIds: [userId],
    branchId: row.branch_id || "",
    branchIds: row.branch_id ? [String(row.branch_id)] : [],
    phone: row.phone || "",
    photoUrl: row.profile_photo_url || "",
    coach: row.coach_name || "미배정",
    lessonType: row.product_name || "회원권 없음",
    remaining: Number(row.remaining_sessions) || 0,
    authLinked: Boolean(row.auth_user_id),
    authRole: row.user_role || "member",
    directoryRow: row,
    source: "Supabase 회원 목록",
    note: "",
  };
  members.push(member);
  return member;
}

function operationalSharedData() {
  const shared = loadSharedData();
  if (adminDemoMode) return shared;
  return {
    ...shared,
    lessonLogs: [],
    feedbackRequests: [],
    ntrpRequests: [],
    paymentRequests: [],
    makeupRequests: [],
    holdingRequests: shared.holdingRequests.filter((item) => item.source === "server"),
  };
}

function prepareAdminLiveMode() {
  if (adminDemoMode) return;
  [coaches, members, lessons, makeupRequests, tickets, expiredTickets, billings, billingLogs, groupAccounts, lessonNotes]
    .forEach((items) => replaceArray(items, []));
  Object.assign(state, {
    selectedMemberId: null,
    liveScheduleLoaded: false,
    liveScheduleLoading: true,
    liveScheduleMessage: "관리자 로그인 후 실데이터를 불러옵니다.",
  });
}

function fallbackAdminPinHash(value) {
  const text = `${adminPinHashVersion}:${value || ""}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function currentAdminSecurityDraft() {
  if (!adminSecurityDraft) adminSecurityDraft = { ...adminSecurityConfigPayload(), lockedViews: [...adminLockSettings.lockedViews] };
  return adminSecurityDraft;
}

function adminSecurityIsDirty() {
  const draft = currentAdminSecurityDraft();
  const saved = adminSecurityConfigPayload();
  return draft.enabled !== saved.enabled
    || draft.timeoutMinutes !== saved.timeoutMinutes
    || draft.pastAbsenceRequirePinEveryTime !== saved.pastAbsenceRequirePinEveryTime
    || draft.lockedViews.length !== saved.lockedViews.length
    || draft.lockedViews.some((view) => !saved.lockedViews.includes(view));
}

function adminSecurityMode(source = currentAdminSecurityDraft()) {
  if (adminSecurityModeOverride === "custom") return "custom";
  const payload = adminSecurityConfigPayload(source);
  return Object.entries(adminSecurityPresets).find(([, preset]) => (
    payload.enabled === preset.enabled
    && payload.timeoutMinutes === preset.timeoutMinutes
    && payload.pastAbsenceRequirePinEveryTime === preset.pastAbsenceRequirePinEveryTime
    && payload.lockedViews.length === preset.lockedViews.length
    && payload.lockedViews.every((view) => preset.lockedViews.includes(view))
  ))?.[0] || "custom";
}

function adminPinNeedsSetup() {
  const pinHash = `${adminLockSettings.pinHash || ""}`.trim();
  const legacyPin = `${adminLockSettings.legacyPin || ""}`.trim();
  return (!pinHash && !legacyPin && !adminLockSettings.pinConfigured) || legacyPin === legacyDefaultAdminPin || legacyDefaultAdminPinHashes.has(pinHash);
}

function adminLockViewName(view) {
  return adminLockViewOptions.find((item) => item.id === view)?.label || "관리자 영역";
}

function isAdminLockActive() {
  return Boolean(adminLockSettings.enabled);
}

function isAdminViewLocked(view) {
  return isAdminLockActive() && !adminPinNeedsSetup() && adminLockSettings.lockedViews.includes(view);
}

function isAdminUnlocked() {
  return !isAdminLockActive() || Date.now() < Number(adminLockSession.unlockedUntil || 0);
}

function adminUnlockRemainingText() {
  if (!isAdminUnlocked() || !adminLockSettings.enabled) return "잠김";
  const remainingMs = Math.max(0, Number(adminLockSession.unlockedUntil || 0) - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `${minutes}분 남음`;
}

function lockAdminNow() {
  adminLockSession.unlockedUntil = 0;
  adminLockSession.pendingView = "";
  adminLockSession.pendingAction = "";
  adminLockSession.pendingLabel = "";
  adminLockSession.oneTimeGrant = "";
  adminLockSession.error = "";
  adminLockSession.afterUnlock = null;
  if (isAdminViewLocked(state.view)) setView("dashboard", { skipLock: true });
}

function consumeAdminActionGrant(action) {
  if (!action || adminLockSession.oneTimeGrant !== action) return false;
  adminLockSession.oneTimeGrant = "";
  return true;
}

function normalizeDemoData() {
  if (state.scheduleFilter === "available") state.scheduleFilter = "all";
  if (state.view === "rackettime" || state.view === "community") state.view = "dashboard";
  if (state.view === "tickets") state.view = "members";
  if (state.view === "makeup") state.view = "schedule";
  if (state.view === "import" || state.view === "data") state.view = "members";
  if (!["operation", "membership", "notifications", "coach", "layout", "security"].includes(state.settingsTab)) state.settingsTab = "operation";
  if (!["active", "expiring", "expired", "pending", "inactive"].includes(state.memberFilter)) state.memberFilter = "active";
  if (!coaches.some((coach) => coach.id === "coach-park")) {
    coaches.push({ id: "coach-park", name: "박창준 코치", role: "주말 레슨", status: "active", account: "박창준", coachMode: "approved", availability: "weekend", photoUrl: "" });
  }
  coaches.forEach((coach) => {
    if (coach.id === "coach-machine") coach.status = "inactive";
    if (typeof coach.photoUrl !== "string") coach.photoUrl = "";
    if (!coach.availability) coach.availability = coach.id === "coach-hwang" ? "weekday-am" : coach.id === "coach-kang" ? "weekday-pm" : coach.id === "coach-park" ? "weekend" : "split";
    const availability = getCoachAvailabilityDefaults(coach);
    if (!Array.isArray(coach.availableDays) || !coach.availableDays.length) coach.availableDays = availability.days;
    if (!coach.availableStart) coach.availableStart = availability.start;
    if (!coach.availableEnd) coach.availableEnd = availability.end;
    normalizeCoachWorkBlocks(coach);
    ensureCoachSettlementRule(coach);
  });
  members.forEach((member) => {
    if (typeof member.photoUrl !== "string") member.photoUrl = "";
  });
  for (let index = lessons.length - 1; index >= 0; index -= 1) {
    if (lessons[index].status === "available" || lessons[index].coachId === "coach-machine") lessons.splice(index, 1);
  }
  lessons.forEach((lesson) => {
    if (lesson.day === "토" || lesson.day === "일") lesson.coachId = "coach-park";
  });
  scheduleWeeks.forEach((week) => {
    week.lessons?.forEach((lesson) => {
      if (lesson.day === "토" || lesson.day === "일") lesson.coachId = "coach-park";
    });
  });
  lessons.forEach((lesson, index) => {
    if (!lesson.courtId) lesson.courtId = `court-${(index % fixedCourtCount) + 1}`;
  });
  tickets.forEach((ticket, index) => {
    if (!ticket.id) ticket.id = `ticket-${ticket.member}-${index}`.replace(/\s+/g, "-");
    if (!ticket.coachId) ticket.coachId = inferCoachIdForMember(ticket.member);
    if (ticket.member === "박민재" && ticket.product?.includes("황 코치 주 1회 개인 30분")) {
      ticket.coachId = "coach-park";
      ticket.product = "박창준 코치 주 1회 개인 30분";
    }
    if (!ticket.weeklyCount) ticket.weeklyCount = getTicketWeeklyCount(ticket);
    delete ticket.partner;
    delete ticket.groupPartner;
  });
  billings.forEach((billing) => {
    if (billing.method === "청구서") billing.method = "결제요청";
    if (billing.note?.includes("청구")) billing.note = billing.note.replaceAll("청구", "결제요청");
  });
  [
    { id: "ticket-seojun-no-pair-a", member: "김서준&이하린", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 3, remaining: 5, expires: "2026-07-25", lessonKind: "2대1" },
    { id: "ticket-seojun-no-pair-b", member: "김서준&최유나", coachId: "coach-no", product: "노 코치 주 1회 2대1 20분", weeklyCount: 1, total: 8, used: 1, remaining: 7, expires: "2026-08-01", lessonKind: "2대1" },
    { id: "ticket-harin-kang", member: "이하린&최유나", coachId: "coach-kang", product: "강 코치 주 2회 그룹 20분", weeklyCount: 2, total: 8, used: 7, remaining: 1, expires: "2026-07-04", lessonKind: "그룹" },
  ].forEach((requiredTicket) => {
    const ticket = tickets.find((item) => item.id === requiredTicket.id);
    if (ticket) Object.assign(ticket, requiredTicket);
    else tickets.push(requiredTicket);
  });
  tickets.forEach((ticket) => {
    if (!ticket.member.includes("&") || members.some((member) => member.name === ticket.member)) return;
    members.push({
      id: Date.now() + members.length,
      name: ticket.member,
      status: "active",
      statusLabel: "수강중",
      coach: getCoachName(ticket.coachId),
      regularTime: "팀 수업",
      remaining: ticket.remaining,
      lessonType: ticket.product,
      source: "수강권",
      note: "2대1/그룹 수업용 팀 회원",
      photoUrl: "",
    });
  });
  lessons.forEach((lesson) => {
    if (lesson.partner) {
      lesson.member = `${lesson.member}&${lesson.partner}`;
      delete lesson.partner;
      delete lesson.partnerLinked;
      delete lesson.partnerNotification;
    }
    if (lesson.member === "이하린" && lesson.type?.includes("그룹")) {
      lesson.member = "이하린&최유나";
      lesson.ticketId = "ticket-harin-kang";
    }
    if (lesson.id === 5) Object.assign(lesson, { type: "보강 요청", status: "pending", makeup: true });
    if (lesson.id === 6) Object.assign(lesson, { type: "보강", status: "scheduled", makeup: true });
    if (lesson.id === 7) Object.assign(lesson, { type: "보강 요청", status: "pending", makeup: true });
  });
  lessons.forEach((lesson) => {
    if (!lesson.ticketId) {
      const ticket = getTicketByLesson(lesson);
      if (ticket) lesson.ticketId = ticket.id;
    }
    if (lesson.ticketId) {
      const ticket = tickets.find((item) => item.id === lesson.ticketId);
      if (ticket?.member?.includes("&")) lesson.member = ticket.member;
    }
  });
  scheduleSettings.breakRules = scheduleSettings.breakRules.filter((rule) => !["break-weekday-a", "break-weekday-b"].includes(rule.id));
}

function operationBranchBillings(source = billings) {
  return source.filter((billing) => {
    if (billing.branchId) {
      if (matchesActiveOperationBranch(billing.branchId)) return true;
      if (billing.serverPaymentId && operationBranchAllowsLegacyRows()) return true;
      return false;
    }
    const ticket = [...tickets, ...expiredTickets].find((item) => (
      String(item.serverTicketId || item.id) === String(billing.ticketId || "")
    ));
    if (ticket) return matchesActiveOperationBranch(ticket.branchId);
    const product = (adminLiveDataState.products || []).find((item) => (
      String(item.id) === String(billing.productId || "")
    ));
    if (product?.branch_id) return matchesActiveOperationBranch(product.branch_id);
    const member = members.find((item) => (
      (billing.serverUserId && memberServerUserIds(item).includes(billing.serverUserId))
      || item.name === billing.member
    ));
    return member ? operationBranchMembers([member]).length > 0 : operationBranchAllowsLegacyRows();
  });
}

function operationProfileWorkspaceBackup() {
  ensureOperationProfiles();
  updateActiveOperationProfileFromCurrent();
  return {
    profiles: cloneOperationProfileValue(operationProfiles),
    activeId: activeOperationProfileId,
    activeIdsByBranch: cloneOperationProfileValue(activeOperationProfileIdsByBranch),
    scheduleSettings: currentOperationScheduleSettings(),
    coaches: currentOperationCoachPolicies(),
  };
}

function normalizePopupNotice(notice = {}) {
  const fallback = defaultPopupNotice;
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status)
    ? notice.status
    : fallback.status;
  return {
    ...fallback,
    ...notice,
    id: notice.id || fallback.id,
    title: String(notice.title || fallback.title).trim(),
    body: String(notice.body || fallback.body).trim(),
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : fallback.audience,
    status: normalizedStatus,
    priority: ["normal", "important", "urgent"].includes(notice.priority) ? notice.priority : fallback.priority,
    startDate: notice.startDate || "",
    endDate: notice.endDate || "",
    showOncePerDay: notice.showOncePerDay !== false,
    displayOrder: Math.max(0, Number(notice.displayOrder ?? notice.display_order) || fallback.displayOrder),
    imageUrl: String(notice.imageUrl || notice.image_url || "").trim(),
    imageStoragePath: String(notice.imageStoragePath || notice.image_storage_path || "").trim(),
    imageAlt: String(notice.imageAlt || notice.image_alt || "").trim(),
    actionLabel: String(notice.actionLabel || notice.action_label || "").trim(),
    actionUrl: String(notice.actionUrl || notice.action_url || "").trim(),
    updatedAt: notice.updatedAt || new Date().toISOString(),
    updatedBy: notice.updatedBy || "admin",
  };
}

function noticeRowToAppNotice(row = {}) {
  return normalizePopupNotice({
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    status: row.status,
    priority: row.priority,
    startDate: row.starts_on || "",
    endDate: row.ends_on || "",
    showOncePerDay: row.show_once_per_day !== false,
    displayOrder: row.display_order,
    imageUrl: row.image_url || "",
    imageStoragePath: row.image_storage_path || "",
    imageAlt: row.image_alt || "",
    actionLabel: row.action_label || "",
    actionUrl: row.action_url || "",
    updatedAt: row.updated_at || row.created_at || "",
    updatedBy: "server",
  });
}

function appNoticeToDbRow(notice = {}) {
  const normalized = normalizePopupNotice(notice);
  return {
    title: normalized.title,
    body: normalized.body,
    audience: normalized.audience,
    priority: normalized.priority,
    status: normalized.status,
    starts_on: normalized.startDate || null,
    ends_on: normalized.endDate || null,
    show_once_per_day: normalized.showOncePerDay !== false,
    display_order: normalized.displayOrder,
    image_url: normalized.imageUrl || null,
    image_storage_path: normalized.imageStoragePath || null,
    image_alt: normalized.imageAlt || null,
    action_label: normalized.actionLabel || null,
    action_url: normalized.actionUrl || null,
  };
}

function popupNotices() {
  const shared = loadSharedData();
  return (Array.isArray(shared.notices) ? shared.notices : [])
    .map((notice) => normalizePopupNotice(notice))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function currentPopupNotice() {
  const savedNotices = popupNotices();
  return savedNotices.find((notice) => notice.status === "active")
    || savedNotices.find((notice) => notice.status === "disabled")
    || defaultPopupNotice;
}

function editingPopupNotice() {
  const selectedId = state.noticeEditingId || "";
  if (state.noticeDraft?.id === selectedId) return normalizePopupNotice(state.noticeDraft);
  return popupNotices().find((notice) => notice.id === selectedId)
    || currentPopupNotice();
}

function writePopupNotice(notice) {
  const shared = loadSharedData();
  const normalized = normalizePopupNotice({
    ...notice,
    updatedAt: new Date().toISOString(),
    updatedBy: "admin",
  });
  const previous = (shared.notices || []).filter((item) => item.id !== normalized.id);
  shared.notices = [normalized, ...previous]
    .map((item) => normalizePopupNotice(item))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .slice(0, 100);
  saveSharedData(shared);
  state.noticeDraft = null;
  state.noticeEditingId = normalized.id;
  return normalized;
}

function isAuthUuid(value = "") {
  return authUuidPattern.test(String(value).trim());
}

function getCourtOptions() {
  return Array.from({ length: fixedCourtCount }, (_, index) => {
    const id = `court-${index + 1}`;
    return { value: id, label: `${index + 1}번 코트` };
  });
}

function lessonRoundRange(lesson, ticket) {
  const ticketStartsOn = String(ticket?.starts || ticket?.purchased || "").slice(0, 10);
  const ticketLessons = lessons
    .filter((item) => {
      if (!isBookedLesson(item) || isLessonCancelled(item) || isLessonAvailable(item)) return false;
      if (getTicketByLesson(item)?.id !== ticket.id) return false;
      const lessonDate = String(item?.lessonDate || "").slice(0, 10);
      return !ticketStartsOn || !lessonDate || lessonDate >= ticketStartsOn;
    })
    .sort((left, right) => lessonRoundSortKey(left).localeCompare(lessonRoundSortKey(right)));
  const targetKey = lessonRoundSortKey(lesson);
  const targetUnits = lessonTicketUnits(lesson, ticket);
  const deductedLessons = ticketLessons.filter(isDeductedLesson);
  let firstRound;

  if (isDeductedLesson(lesson)) {
    const visibleDeductedUnits = deductedLessons.reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    const importedUsedBaseline = Math.max(0, Number(ticket.used) - visibleDeductedUnits);
    const previousUnits = deductedLessons
      .filter((item) => lessonRoundSortKey(item).localeCompare(targetKey) < 0)
      .reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    firstRound = importedUsedBaseline + previousUnits + 1;
  } else {
    const previousReservedUnits = ticketLessons
      .filter((item) => !isDeductedLesson(item) && lessonRoundSortKey(item).localeCompare(targetKey) < 0)
      .reduce((sum, item) => sum + lessonTicketUnits(item, ticket), 0);
    firstRound = Number(ticket.used) + previousReservedUnits + 1;
  }

  return { first: firstRound, last: firstRound + targetUnits - 1 };
}

function lessonVisualKind(lesson) {
  const source = lessonSourceValue(lesson);
  const status = lessonStatusValue(lesson);
  if (["no_show", "cancelled_late"].includes(status)) return "noShow";
  if (lesson?.oneDayBooking) return "coupon";
  if (isReleasedRegularMakeupSlot(lesson)) return "released";
  if (isMakeupLesson(lesson)) return "makeup";
  if (source === "coupon" || source === "one_day") return "coupon";
  const customRule = (scheduleSettings.lessonColorRules || []).find((rule) => rule.match && `${lesson.type || ""} ${source}`.includes(rule.match));
  if (customRule) return customRule.id;
  if (Number(lesson.durationMinutes) === 30) return "regular30";
  const ticket = getTicketByLesson(lesson);
  const productKind = ticket ? membershipProductForTicket(ticket).productKind : "regular";
  return ["pass", "coupon"].includes(productKind) ? "coupon" : "regular";
}

function lessonColorStyle(lesson) {
  const kind = lessonVisualKind(lesson);
  if (kind === "released") return "--lesson-color:#111827";
  const fallback = { regular: "#2f6fc4", regular30: "#6b5fc7", makeup: "#17805d", coupon: "#b7791f", noShow: "#c2413b" };
  const customColor = (scheduleSettings.lessonColorRules || []).find((rule) => rule.id === kind)?.color;
  const saved = customColor || scheduleSettings.lessonColors?.[kind] || "";
  const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback[kind];
  return `--lesson-color:${color}`;
}

function hasCourtCapacity(day, time, durationMinutes = 20) {
  return getOverlappingBookedLessons(day, time, durationMinutes)
    .filter((lesson) => !isReleasedRegularMakeupSlot(lesson)).length < fixedCourtCount;
}

function lessonAddAttrs(day, time, durationMinutes = 20, preferredCoachId = "") {
  const coachId = getAvailableCoachId(day, time, durationMinutes, preferredCoachId);
  const coachLabel = scheduleCoachDisplayName(getCoachName(coachId)) || "코치 미정";
  const ariaLabel = escapeHtml(`${day}요일 ${time} ${coachLabel} 수업 추가`);
  return `data-add-lesson-day="${day}" data-add-lesson-time="${time}" data-add-lesson-court="${getAvailableCourtId(day, time, durationMinutes)}" data-add-lesson-coach="${coachId}" data-quick-lesson-entry="true" aria-label="${ariaLabel}"`;
}

function adminViewUiSignature(view) {
  const common = [operationsRole(), activeOperationBranchId()];
  if (view === "members") {
    return JSON.stringify(common.concat([
      state.memberFilter,
      state.memberSearch,
      state.memberCoachFilter,
      state.memberTicketFilter,
      state.memberListPage,
      state.inlineMemberId,
      state.inlineMemberTicketId,
      memberAdminEditEnabled,
      adminMemberDirectoryState.signature,
      adminMemberDirectoryState.requestId,
      adminMemberDirectoryState.loading,
    ]));
  }
  if (view === "schedule") {
    return JSON.stringify(common.concat([
      state.scheduleView,
      state.scheduleFilter,
      state.scheduleCoachFilter,
      state.scheduleMemberSearch,
      state.activeAdminWeekIndex,
      state.selectedScheduleDay,
      state.scheduleEditMode,
      state.scheduleOpenSlotMode,
      state.liveScheduleLoaded,
      state.liveScheduleLoading,
    ]));
  }
  if (view === "billing") {
    return JSON.stringify(common.concat([
      state.billingFilter,
      state.billingMonth,
      state.billingPage,
      state.settlementPage,
      state.rechargePage,
    ]));
  }
  if (view === "reports") {
    return JSON.stringify(common.concat([state.managementReportMonth]));
  }
  if (view === "notes") {
    return JSON.stringify(common.concat([
      state.recordFilter,
      state.recordCoachFilter,
      state.recordPendingType,
      state.recordSearch,
      state.recordPage,
    ]));
  }
  if (view === "settings") {
    return JSON.stringify(common.concat([
      state.settingsTab,
      state.membershipSettingsSection,
      state.membershipProductSearch,
      state.membershipProductStatusFilter,
      state.membershipProductPage,
    ]));
  }
  return JSON.stringify(common.concat([
    state.adminTaskPage,
    state.memberStatusPage,
  ]));
}

function canReuseAdminView(view) {
  const cached = adminViewRenderCache.get(view);
  return Boolean(
    cached
    && cached.revision === adminViewRenderRevision
    && cached.signature === adminViewUiSignature(view)
  );
}

function rememberAdminViewRender(view) {
  adminViewRenderCache.set(view, {
    revision: adminViewRenderRevision,
    signature: adminViewUiSignature(view),
  });
}

function matchesSearch(values) {
  const query = getSearchText();
  if (!query) return true;
  return values.join(" ").toLowerCase().includes(query);
}

function globalSearchItems() {
  const branchMembers = operationBranchMembers();
  const branchCoaches = operationBranchCoaches();
  const branchLessons = operationBranchLessons();
  const branchMakeups = operationBranchMakeupRequests();
  const branchBillings = operationBranchBillings();
  const branchTickets = operationBranchTickets();
  const navigationItems = [
    { kind: "메뉴", title: "대시보드", detail: "오늘 수업과 운영 처리 현황", view: "dashboard" },
    { kind: "메뉴", title: "회원관리", detail: "수강중·승인대기·만료 회원", view: "members" },
    { kind: "메뉴", title: "레슨시간표", detail: "코치별 수업과 보강·변경 요청", view: "schedule" },
    { kind: "메뉴", title: "결제/정산", detail: "결제 상태와 코치 정산", view: "billing" },
    { kind: "메뉴", title: "경영 리포트", detail: "매출·회원·수업 품질과 장부 자료 상태", view: "reports" },
    { kind: "메뉴", title: "기록/차감 확인", detail: "수업 코멘트·커리큘럼·횟수 처리", view: "notes" },
    { kind: "메뉴", title: "운영 설정", detail: "수업 정책·회원권 규정·관리자 보안", view: "settings" },
  ];
  const memberItems = branchMembers.map((member) => ({
    kind: "회원",
    title: member.name,
    detail: `${memberStatusLabel(member)} · ${member.coach} · ${member.regularTime} · ${member.lessonType}`,
    view: "members",
    memberId: member.id,
  }));
  const coachItems = branchCoaches.map((coach) => ({
    kind: "코치",
    title: coach.name,
    detail: `${coach.role} · ${coachModeLabel(coach)} · ${coach.status === "active" ? "운영중" : "사용중지"}`,
    view: "members",
  }));
  const lessonItems = branchLessons.map((lesson) => ({
    kind: "수업",
    title: `${lesson.day}요일 ${lesson.time} · ${lesson.member}`,
    detail: `${getCoachName(lesson.coachId)} · ${lessonTypeLabel(lesson)} · ${getLessonStatusLabel(lesson)}`,
    view: "schedule",
  }));
  const makeupItems = branchMakeups.map((request) => ({
    kind: "변경요청",
    title: request.member,
    detail: `${request.original} → ${request.requested} · ${request.statusLabel}`,
    view: "schedule",
  }));
  const billingItems = branchBillings.map((billing) => ({
    kind: "결제",
    title: billing.member,
    detail: `${billing.item} · ${billing.method} · ${billing.status}`,
    view: "billing",
  }));
  const ticketItems = branchTickets.map((ticket) => {
    const member = branchMembers.find((item) => item.name === ticket.member);
    return {
      kind: "회원권",
      title: ticket.member,
      detail: `${getTicketDisplayProduct(ticket)} · 잔여 ${ticket.remaining}회 · ${ticket.expires || "만료일 미정"}`,
      view: "members",
      memberId: member?.id,
    };
  });

  return [...navigationItems, ...memberItems, ...coachItems, ...lessonItems, ...makeupItems, ...billingItems, ...ticketItems];
}

function getGlobalSearchResults(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return globalSearchItems()
    .filter((item) => [item.kind, item.title, item.detail].join(" ").toLowerCase().includes(normalized))
    .slice(0, 12);
}

function billingNeedsAdminAction(item = {}) {
  if (["draft", "check", "unverified", "refund_processing", "refund_reconcile"].includes(item.status)) return true;
  if (item.status === "server_ready") return isStaleReadyPayment(item);
  return item.status === "paid" && !item.ticketId && !isHistoricalImportedPayment(item);
}

function scheduleAssignmentQueueCandidates({ respectUiFilters = true, excludeTicketId = "" } = {}) {
  const query = respectUiFilters ? normalizedScheduleMemberSearch(state.scheduleAssignmentSearch) : "";
  const filter = respectUiFilters ? state.scheduleAssignmentFilter : "all";
  return unassignedRegularTickets()
    .filter((ticket) => String(ticket.id || "") !== String(excludeTicketId || ""))
    .filter((ticket) => {
      const progress = ticketRegularScheduleAssignmentProgress(ticket);
      if (filter !== "all" && progress.state !== filter) return false;
      if (!query) return true;
      const searchValue = normalizedScheduleMemberSearch([
        ...ticketParticipantNames(ticket),
        getCoachName(ticket.coachId),
        getTicketDisplayProduct(ticket),
      ].join(" "));
      return searchValue.includes(query);
    })
    .sort((left, right) => {
      const leftProgress = ticketRegularScheduleAssignmentProgress(left);
      const rightProgress = ticketRegularScheduleAssignmentProgress(right);
      const stateOrder = Number(leftProgress.state !== "partial") - Number(rightProgress.state !== "partial");
      if (stateOrder) return stateOrder;
      const coachOrder = String(getCoachName(left.coachId) || "").localeCompare(String(getCoachName(right.coachId) || ""), "ko");
      if (coachOrder) return coachOrder;
      return ticketParticipantNames(left).join(" & ").localeCompare(ticketParticipantNames(right).join(" & "), "ko");
    });
}

function scheduleAssignmentRemainingCount(ticket = currentScheduleAssignmentTicket()) {
  if (!ticket) return 0;
  return state.scheduleAssignmentLessonSource === "regular"
    ? ticketRemainingRegularScheduleCount(ticket)
    : 1;
}

function memberStatusLabel(member) {
  const status = memberListStatus(member);
  if (status === "inactive") return "삭제회원";
  if (status === "pending") return memberRegistrationStage(member)?.label || "가입 대기";
  if (status === "journal") return "운동노트 회원";
  return status === "expired" ? "만료회원" : "수강중";
}

function memberStatusBadge(member) {
  return badge(memberListStatus(member), memberStatusLabel(member));
}

function ticketParticipantNames(ticket) {
  if (!ticket) return [];
  const ticketKey = String(ticket.serverTicketId || ticket.id || "");
  const cached = ticketKey ? ticketParticipantNamesIndex.get(ticketKey) : null;
  if (cached) return cached;
  if (!adminUserNameIndex) {
    adminUserNameIndex = new Map((adminLiveDataState.users || []).map((user) => [user.id, user.name]));
  }
  const namesById = ticketParticipantUserIds(ticket)
    .map((userId) => adminUserNameIndex.get(userId))
    .filter(Boolean);
  const names = [...new Set([...namesById, ...splitMemberNames(ticket.member)])];
  if (ticketKey) ticketParticipantNamesIndex.set(ticketKey, names);
  return names;
}

function ticketIsSharedGroup(ticket) {
  if (!ticket) return false;
  const configuredAsGroup = Number(ticket.groupSize) === 2 || ticket.lessonKind === "2대1";
  return configuredAsGroup && Math.max(ticketParticipantUserIds(ticket).length, ticketParticipantNames(ticket).length) >= 2;
}

function ticketUsesPerParticipantGroupOwnership(ticket) {
  const ticketId = String(ticket?.serverTicketId || ticket?.id || "");
  if (!ticketId || !ticketIsSharedGroup(ticket)) return false;
  const activeLinks = (adminLiveDataState.groupTicketLinks || []).filter((link) => (
    ["active", "linked"].includes(String(link.status || "active").toLowerCase())
    && String(link.ticket_id || "") === ticketId
    && link.group_account_id
  ));
  if (!activeLinks.length) return false;
  return activeLinks.some((link) => {
    const accountTicketIds = new Set((adminLiveDataState.groupTicketLinks || [])
      .filter((candidate) => (
        ["active", "linked"].includes(String(candidate.status || "active").toLowerCase())
        && String(candidate.group_account_id || "") === String(link.group_account_id)
      ))
      .map((candidate) => String(candidate.ticket_id || ""))
      .filter(Boolean));
    return accountTicketIds.size > 1;
  });
}

function ticketPartnerNames(ticket, memberReference) {
  const memberRecords = memberRecordsForReference(memberReference);
  const memberUserIds = [...new Set(memberRecords.flatMap(memberServerUserIds))];
  const memberNames = memberRecords.length
    ? memberRecords.map((member) => member.name)
    : splitMemberNames(memberReference);
  const partnerNamesById = ticketParticipantUserIds(ticket)
    .filter((userId) => !memberUserIds.includes(userId))
    .map((userId) => (adminLiveDataState.users || []).find((user) => user.id === userId)?.name)
    .filter(Boolean);
  return [...new Set([
    ...partnerNamesById,
    ...ticketParticipantNames(ticket).filter((name) => !memberNames.includes(name)),
  ])];
}

function memberPartnerNames(member) {
  return [...new Set(ticketsForMember(member).flatMap((ticket) => (
    ticketIsSharedGroup(ticket) ? ticketPartnerNames(ticket, member) : []
  )))];
}

function memberManagementDayLabel(day) {
  return memberManagementDayLabels[Number(day)] || "";
}

function memberSearchValues(member) {
  const memberTickets = ticketsForMember(member);
  const ticket = memberTickets[0] || null;
  const record = memberDatabaseRecord(member, ticket);
  const unlinkedPayment = memberUnlinkedVerifiedPayment(member);
  return [
    member.name,
    member.phone,
    member.birthYear,
    member.neighborhood,
    memberGenderLabel(member.gender),
    member.coach,
    member.regularTime,
    member.lessonType,
    memberManagementLessonMethodLabel(record, ticket),
    memberManagementLessonTypeLabel(record?.lesson_type || ticket?.lessonTypeCode),
    memberManagementLessonDaysLabel(record, ticket),
    record?.lesson_start_on,
    record?.payment_recorded_on,
    paymentMethodLabel(record?.payment_method),
    record?.payment_amount,
    record?.admin_note,
    unlinkedPayment?.amount,
    unlinkedPayment?.method,
    ...memberPartnerNames(member),
    ...memberTickets.flatMap((ticket) => [ticket.member, ticket.product]),
  ];
}

function memberDirectoryDisplayName(member, ticket = memberCurrentTicket(member)) {
  if (!member) return "회원";
  if (ticketIsSharedGroup(ticket)) {
    const participantNames = ticketParticipantNames(ticket);
    if (participantNames.length > 1) return participantNames.join(" & ");
  }
  return member.name;
}

function memberDirectoryUnitKey(member) {
  const ticket = memberCurrentTicket(member);
  if (ticketIsSharedGroup(ticket)) return `group:${ticket.serverTicketId || ticket.id}`;
  return `member:${member.serverUserId || member.id}`;
}

function memberRemainingCount(member) {
  const currentTickets = memberCurrentTickets(member);
  if (currentTickets.length) {
    return Math.min(...currentTickets.map((ticket) => Math.max(0, Number(ticket.remaining) || 0)));
  }
  return Math.max(0, Number(member.remaining) || 0);
}

function memberRegistrationStage(member = {}) {
  const ticket = memberCurrentTicket(member);
  const record = member.memberRecord || null;
  const enrollmentStatus = String(member.enrollment?.status || "");
  const hasEnrollment = Boolean(member.enrollment);
  const hasVerifiedPayment = Boolean(member.unlinkedVerifiedPayment);

  if (ticket && ["active", "paused"].includes(String(ticket.status || "")) && Number(ticket.remaining) > 0) {
    return {
      code: "completed",
      label: "등록 완료",
      detail: "회원권과 수업 정보가 연결되어 있습니다.",
      action: "",
      actionLabel: "",
    };
  }
  if (member.authLinked && hasEnrollment && !record) {
    return {
      code: "link_required",
      label: "연결 필요",
      detail: "앱 가입 정보와 기존 수강 DB를 확인해 연결해 주세요.",
      action: "link_existing",
      actionLabel: "기존 회원 연결",
    };
  }
  if (hasVerifiedPayment) {
    return {
      code: "pending",
      label: "가입 대기",
      detail: "결제는 확인됐으며 회원권 발급이 필요합니다.",
      action: "assign",
      actionLabel: "회원권 발급",
    };
  }
  if (record || hasEnrollment || ["submitted", "needs_update", "approved"].includes(enrollmentStatus)) {
    return {
      code: "pending",
      label: "가입 대기",
      detail: record ? "회원권·코치·수업시간을 등록해 주세요." : "가입서를 확인하고 기존 회원 연결 여부를 결정해 주세요.",
      action: record ? "assign" : "link_existing",
      actionLabel: record ? "회원권 등록" : "기존 회원 확인",
    };
  }
  return null;
}

function accountDeletionProcessingIsStale(request, now = Date.now()) {
  if (request?.status !== "processing") return false;
  const startedAt = Date.parse(request.executionStartedAt || "");
  return Number.isFinite(startedAt) && startedAt + ACCOUNT_DELETION_STALE_MS <= now;
}

function memberIsExpiring(member) {
  return memberListStatus(member) === "active"
    && memberCurrentTickets(member).some((ticket) => Math.max(0, Number(ticket.remaining) || 0) <= 2);
}

function memberMatchesStatusFilter(member, filter) {
  return filter === "expiring"
    ? memberIsExpiring(member)
    : memberListStatus(member) === filter;
}

function memberStatusCounts() {
  return operationBranchMembers().reduce((counts, member) => {
    const status = memberListStatus(member);
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    if (memberIsExpiring(member)) counts.expiring += 1;
    return counts;
  }, { active: 0, expiring: 0, expired: 0, pending: 0, inactive: 0 });
}

function memberManagementActionAllowed(action, ticket = null) {
  const role = operationsRole();
  if (role === "admin") return true;
  if (role !== "coach" || !ticket?.serverTicketId) return false;
  const policyAllows = action === "correct"
    ? memberManagementPolicy.coachCanCorrectTicket
    : action === "expire"
      ? memberManagementPolicy.coachCanExpireTicket
      : action === "reenroll" && memberManagementPolicy.coachCanReenroll;
  return Boolean(policyAllows && currentOperationsCoachRoleIds().has(ticket.coachRoleId));
}

function memberManagementWriteVerification(action, payload, result, statusAction = "keep") {
  const normalizedResult = normalizedRpcResult(result);
  const userId = normalizedResult.userId || payload?.userId || "";
  const ticketId = normalizedResult.ticketId || payload?.ticketId || "";
  const serverUser = (adminLiveDataState.users || []).find((user) => user.id === userId);
  const serverTicket = (adminLiveDataState.tickets || []).find((ticket) => ticket.serverTicketId === ticketId);

  if (action === "create") {
    if (!serverUser || !memberManagementTicketMatchesPayload(serverTicket, payload)) {
      return "member_management_write_not_confirmed:create";
    }
    if (payload?.lessonType === "one_on_two") {
      const partnerUserId = normalizedResult.partnerUserId || payload?.partnerUserId || "";
      const partnerUser = (adminLiveDataState.users || []).find((user) => user.id === partnerUserId);
      const participantIds = serverTicket.participantUserIds || [];
      if (!partnerUser || !partnerUserId || !participantIds.includes(userId) || !participantIds.includes(partnerUserId)) {
        return "member_management_write_not_confirmed:create_partner";
      }
    }
    return "";
  }
  if (action === "assign") {
    return serverUser && memberManagementTicketMatchesPayload(serverTicket, payload)
      ? ""
      : "member_management_write_not_confirmed:assign";
  }
  if (action === "link_existing") {
    return serverUser?.auth_user_id ? "" : "member_management_write_not_confirmed:link_existing";
  }
  if (action === "app_link") {
    return serverUser?.auth_user_id ? "" : "member_management_write_not_confirmed:app_link";
  }
  if (action === "profile") {
    if (!serverUser) return "member_management_write_not_confirmed:profile_user";
    if (serverUser.name !== payload?.name
      || String(serverUser.nickname || "") !== String(payload?.nickname || "")
      || normalizedMemberPhone(serverUser.phone) !== normalizedMemberPhone(payload?.phone)) {
      return "member_management_write_not_confirmed:profile_fields";
    }
    if (statusAction === "deactivate" && serverUser.status !== "inactive") return "member_management_write_not_confirmed:deactivate";
    if (statusAction === "restore" && serverUser.status !== "active") return "member_management_write_not_confirmed:restore";
    if (payload?.lessonType === "one_on_two") {
      const requiredParticipantIds = [payload?.userId, payload?.partnerUserId].filter(Boolean);
      const futureLessons = lessons.filter((lesson) => (
        lesson.ticketId === ticketId
        && ["scheduled", "pending_change"].includes(lesson.serverStatus)
        && lesson.lessonDate >= adminLocalDateKey(new Date())
      ));
      if (!serverTicket || requiredParticipantIds.some((id) => !serverTicket.participantUserIds?.includes(id))) {
        return "member_management_write_not_confirmed:partner";
      }
      if (futureLessons.some((lesson) => requiredParticipantIds.some((id) => !lesson.serverParticipantUserIds?.includes(id)))) {
        return "member_management_write_not_confirmed:partner_schedule";
      }
    }
    return "";
  }
  if (action === "correct") {
    const ticketValuesSaved = memberManagementTicketMatchesPayload(serverTicket, payload);
    if (!ticketValuesSaved) return "member_management_write_not_confirmed:ticket";
    if (payload?.lessonType === "one_on_two") {
      const requiredParticipantIds = [payload?.userId, payload?.partnerUserId].filter(Boolean);
      const futureLessons = lessons.filter((lesson) => (
        lesson.ticketId === ticketId
        && ["scheduled", "pending_change"].includes(lesson.serverStatus)
        && lesson.lessonDate >= adminLocalDateKey(new Date())
      ));
      if (requiredParticipantIds.some((id) => !serverTicket.participantUserIds?.includes(id))) {
        return "member_management_write_not_confirmed:partner";
      }
      if (futureLessons.some((lesson) => requiredParticipantIds.some((id) => !lesson.serverParticipantUserIds?.includes(id)))) {
        return "member_management_write_not_confirmed:partner_schedule";
      }
    }
    return "";
  }
  if (action === "extend") {
    return serverTicket?.expires === payload?.expiresOn ? "" : "member_management_write_not_confirmed:extend";
  }
  if (action === "expire") return serverTicket?.status === "expired" ? "" : "member_management_write_not_confirmed:expire";
  if (action === "close") {
    const refreshedMember = members.find((item) => memberServerUserIds(item).includes(userId));
    if (!serverUser || serverUser.status !== "active" || serverUser.member_kind !== "former_lesson_member") {
      return "member_management_write_not_confirmed:close_member";
    }
    if (!refreshedMember || memberListStatus(refreshedMember) !== "expired") {
      return "member_management_write_not_confirmed:close_status";
    }
    if (memberManagementTickets(refreshedMember).some((item) => (
      ["active", "paused", "pending_payment"].includes(item.status) || Number(item.remaining) > 0
    ))) {
      return "member_management_write_not_confirmed:close_ticket";
    }
    return "";
  }
  if (action === "force_delete") return serverTicket ? "member_management_write_not_confirmed:force_delete" : "";
  if (action === "permanent_delete") return !serverUser || serverUser.permanently_deleted_at ? "" : "member_management_write_not_confirmed:permanent_delete";
  if (action === "reenroll") return serverTicket && ["active", "paused"].includes(serverTicket.status) ? "" : "member_management_write_not_confirmed:reenroll";
  if (action === "deactivate") return serverUser?.status === "inactive" ? "" : "member_management_write_not_confirmed:deactivate";
  if (action === "restore") return serverUser?.status === "active" ? "" : "member_management_write_not_confirmed:restore";
  return "";
}

function memberEditorAuditIssues(member, ticket = memberCurrentTicket(member)) {
  const issues = [];
  const status = memberListStatus(member);
  if (["active", "expiring"].includes(status) && !ticket) issues.push("사용 중 회원권 없음");
  if (!member.coach && ticket) issues.push("담당 코치 없음");
  if (ticket) {
    const total = Number(ticket.total);
    const used = Number(ticket.used);
    const remaining = Number(ticket.remaining);
    if (![total, used, remaining].every(Number.isFinite) || total < 0 || used < 0 || remaining < 0) {
      issues.push("회차 숫자 확인");
    } else if (used + remaining !== total) {
      issues.push("총·소진·잔여 불일치");
    }
    if (!ticket.productId) issues.push("상품 연결 없음");
    if (ticket.lessonTypeCode === "one_on_two" && memberServerUserIds(member).length < 2
      && !memberTicketPartnerUserId(ticket, member)) issues.push("1:2 파트너 없음");
    if (["active", "paused"].includes(ticket.status) && ticket.expires
      && ticket.expires < adminLocalDateKey(new Date())) issues.push("만료일 경과");
  }
  return issues;
}

function memberUsageDisplayLabel(member, ticket = memberCurrentTicket(member)) {
  if (ticket) return ticketUsageLabel(ticket);
  const row = member?.directoryRow;
  if (!row || row.total_sessions == null) return "-";
  const total = Number(row.total_sessions) || 0;
  const used = Number(row.used_sessions) || 0;
  const remaining = Number(row.remaining_sessions) || 0;
  return `총 ${total} / 소진 ${used} / 잔여 ${remaining}`;
}

function memberRemarkLabel(member) {
  const records = memberOperationalTickets(member)
    .map((ticket) => memberDatabaseRecord(member, ticket))
    .filter(Boolean);
  const payment = latestMemberPayment(member);
  const parts = [];
  const notes = [...new Set([
    ...records.map((record) => String(record.admin_note || "").trim()),
    String(member.note || "").trim(),
  ].filter((note) => note && !["실서버 회원권 연결", "회원권 등록 또는 연장 확인 필요", "운동노트만 이용 중", "가입서 제출 완료 · 결제 확인 필요"].includes(note)))];
  parts.push(...notes);
  if (Number(payment?.discountAmount || 0) > 0) parts.push(`할인 ${money.format(Number(payment.discountAmount))}원`);
  return parts.join(" · ") || "-";
}

function lessonActionAttrs(lesson) {
  if (lesson?.oneDayBooking) {
    return `data-edit-one-day-booking-id="${lesson.serverOneDayBookingId || lesson.id}"`;
  }
  if (isReleasedRegularMakeupSlot(lesson)) {
    return [
      'data-open-released-makeup-slot="true"',
      `data-released-slot-day="${lesson.day}"`,
      `data-released-slot-time="${lesson.time}"`,
      `data-released-slot-coach="${lesson.coachId}"`,
      `data-released-slot-court="${lesson.courtId || "court-1"}"`,
      `data-released-slot-historical="${lesson.historicalReleasedSlot ? "true" : "false"}"`,
    ].join(" ");
  }
  if (state.scheduleBulkMode && scheduleBulkEligible(lesson)) {
    const selected = selectedScheduleLessonIdSet().has(String(lesson.serverLessonId));
    return `data-select-schedule-lesson="${lesson.serverLessonId}" aria-pressed="${selected}"`;
  }
  return `data-edit-lesson-id="${lesson.id}"`;
}

function scheduleBulkPreviewText(selected = []) {
  if (!selected.length) return "수업을 선택하면 상태와 처리 가능 여부를 먼저 확인합니다.";
  const statusCounts = selected.reduce((map, lesson) => {
    const label = getLessonStatusLabel(lesson);
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map());
  const sourceCounts = selected.reduce((map, lesson) => {
    const sourceLabel = lessonTypeLabel(lesson).replace(/\s*수업\s*$/, "") || "수업";
    map.set(sourceLabel, (map.get(sourceLabel) || 0) + 1);
    return map;
  }, new Map());
  const coaches = [...new Set(selected.map((lesson) => scheduleCoachDisplayName(getCoachName(lesson.coachId))))];
  const dates = [...new Set(selected.map((lesson) => lesson.lessonDate).filter(Boolean))];
  const minutes = selected.reduce((sum, lesson) => sum + (Number(lesson.durationMinutes) || 20), 0);
  const statusSummary = [...statusCounts].map(([label, count]) => `${label} ${count}`).join(" · ");
  const sourceSummary = [...sourceCounts].map(([label, count]) => `${label} ${count}`).join(" · ");
  const coachSummary = coaches.length > 1 ? `${coaches[0]} 외 ${coaches.length - 1}명` : (coaches[0] || "코치 미배정");
  const substituteReady = dates.length === 1 ? "대타 가능" : "대타는 같은 날짜만";
  return `${statusSummary} / ${sourceSummary} / ${coachSummary} / ${minutes}분 / ${substituteReady}`;
}

function scheduleClipboardCanPaste(day, time, coachId) {
  const clipboard = state.scheduleLessonClipboard;
  const ticket = scheduleClipboardTicket();
  if (!clipboard || !ticket || ticket.remaining <= 0) return false;
  if (String(ticket.coachId || clipboard.coachId) !== String(coachId || "")) return false;
  return canAddLessonAt(day, time, clipboard.durationMinutes, coachId);
}

function scheduleSheetRowCandidate(row) {
  if (!row?.ticketId || !row.day || !row.time || !row.coachId) return null;
  const ticket = scheduleTicketById(row.ticketId);
  const participantNames = ticketParticipantNames(ticket);
  return {
    id: `sheet-${row.rowNumber}`,
    day: row.day,
    time: row.time,
    courtId: getAvailableCourtId(row.day, row.time, row.durationMinutes),
    coachId: row.coachId,
    member: participantNames.length ? participantNames.join("&") : row.memberName,
    ticketId: row.ticketId,
    type: getTicketLessonKind(ticket) || row.lessonSourceLabel || "개인",
    lessonSource: row.lessonSource,
    durationMinutes: row.durationMinutes,
    status: "scheduled",
  };
}

function scheduleFilterMatches(lesson) {
  return (
    state.scheduleFilter === "all" ||
    (state.scheduleFilter === "available" && isLessonAvailable(lesson)) ||
    (state.scheduleFilter === "pending" && isPendingScheduleLesson(lesson))
  );
}

function adminManualOverrideAvailable() {
  return state.liveScheduleLoaded && operationsRole() === "admin";
}

function getAdminManualExactDuplicate(candidate) {
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  return lessons.find((lesson) => (
    String(lesson.id) !== String(candidate.id)
    && String(lesson.ticketId || "") === String(candidate.ticketId || "")
    && (!lessonDate || !lesson.lessonDate || lesson.lessonDate === lessonDate)
    && lesson.time === candidate.time
    && ["scheduled", "pending_change", "completed", "no_show"].includes(lessonStatusValue(lesson))
  )) || null;
}

function getAdminManualOverrideWarnings(candidate, ticket, pastCorrection = false) {
  const warnings = [];
  const lessonDate = candidate.lessonDate || adminLessonDateForCandidate(candidate.day);
  const addWarning = (message) => {
    if (message && !warnings.includes(message)) warnings.push(message);
  };
  if (!ticket) return ["연결할 회원권이 없어 저장할 수 없습니다."];
  if (!ticketMatchesLessonSource(ticket, candidate.lessonSource)) addWarning("회원권 종류와 선택한 수업 종류가 다릅니다.");
  if (!["active", "paused"].includes(ticket.status)) addWarning(`회원권 상태가 ${memberTicketStatusLabel(ticket)}입니다.`);
  if (lessonDate && (lessonDate < (ticket.purchased || "") || lessonDate > (ticket.expires || "9999-12-31"))) {
    addWarning("회원권 사용기간 밖의 날짜입니다.");
  }
  if (!ticketAllowsScheduleDay(ticket, candidate.day)) addWarning(`${memberManagementScheduleScopeLabel(getTicketScheduleScope(ticket))} 범위 밖의 요일입니다.`);
  const ticketDuration = getTicketDurationMinutes(ticket);
  if (![ticketDuration, ticketDuration * 2].includes(candidate.durationMinutes)) addWarning("회원권 기준과 수업 시간이 다릅니다.");
  if (candidate.lessonSource === "makeup" && !state.editingLessonId && !selectedAdminMakeupEntitlement()) {
    addWarning("연결된 보강 대기 없이 보강수업을 직접 등록합니다.");
  }
  if (pastCorrection && !state.editingLessonId && candidate.lessonSource === "regular") {
    addWarning("새 과거 수업을 정규수업으로 직접 등록합니다.");
  }
  if (pastCorrection && Number(ticket.remaining) <= 0) addWarning("잔여 횟수가 없어 완료 기록만 남고 차감은 0회가 될 수 있습니다.");
  const conflict = pastCorrection ? getPastLessonCorrectionConflict(candidate) : getLessonConflict(candidate);
  if (conflict && !getAdminManualExactDuplicate(candidate)) addWarning(conflict.message);
  return warnings;
}

function oneDayDateForDefaults(defaults = {}) {
  if (defaults.bookingDate) return defaults.bookingDate;
  if (defaults.day) return adminWeekDateForDay(defaults.day);
  const selectedDay = state.selectedScheduleDay || currentScheduleDay();
  return adminWeekDateForDay(selectedDay) || adminLocalDateKey(new Date());
}

function settlementRuleFor(coachName) {
  return coachSettlementRules.find((rule) => rule.coach === coachName) || coachSettlementRules[0];
}

function settlementAmountFor(item) {
  if (item.linkedTicket === false) return 0;
  if (Number.isFinite(Number(item.fixedSettlementAmount))) return Math.max(0, Math.round(Number(item.fixedSettlementAmount)));
  const settlementCoach = settlementCoachNameFor(item);
  const rule = settlementRuleFor(settlementCoach);
  const completedLessons = Math.max(0, Number(item.lessonCount) || 0);
  if (!completedLessons || !rule) return 0;
  if (rule.method === "hourly") {
    const minutes = Math.max(0, Number(item.minutes || item.durationMinutes) || 0);
    const hourlyRate = Math.max(0, Number(rule.hourly) || 0);
    if (!minutes || !hourlyRate) return 0;
    return Math.round((minutes / 60) * hourlyRate * completedLessons);
  }
  const totalLessons = Math.max(completedLessons, Number(item.totalLessons) || completedLessons);
  const baseAmount = Number(rule.cardBase === "paid" ? item.paidAmount : item.settlementBase) || 0;
  if (rule.calculationMode === "monthly_payment") {
    return Math.round(baseAmount * (Number(rule.ratio) || 0));
  }
  const perLessonBase = baseAmount / totalLessons;
  return Math.round(perLessonBase * completedLessons * (Number(rule.ratio) || 0));
}

function settlementRowsForBilling(billing, indexes = {}) {
  const ticket = indexes.ticketById?.get(String(billing.ticketId || ""))
    || [...tickets, ...expiredTickets].find((item) => item.serverTicketId === billing.ticketId || item.id === billing.ticketId)
    || {};
  const ticketId = ticket.serverTicketId || ticket.id;
  const base = {
    member: billing.member,
    coach: ticketId ? getCoachName(ticket.coachId || "") : "회원권 미연결",
    linkedTicket: Boolean(ticketId),
    paidAmount: Number(billing.finalAmount || billing.amount) || 0,
    settlementBase: settlementBaseAmountForBilling(billing),
    paymentMethod: String(billing.method || "").toLowerCase().includes("card") ? "카드" : "현금",
    discount: Number(billing.discountAmount) > 0 ? `할인 ${money.format(billing.discountAmount)}원` : "할인 없음",
    totalLessons: Number(ticket.total) || 0,
    minutes: Number(ticket.durationMinutes) || 20,
  };
  if (indexes.recordProgressByTicket) {
    if (!ticketId) return [{ ...base, actualCoach: base.coach, lessonCount: 0, summaryPaidAmount: base.paidAmount }];
    const progress = indexes.recordProgressByTicket.get(String(ticketId)) || {
      recordedSessions: 0,
      byCoachRole: new Map(),
      substituteGroups: new Map(),
    };
    const originalCoachRoleId = String(ticket.coachRoleId || "");
    const originalProgress = progress.byCoachRole.get(originalCoachRoleId) || { sessions: 0, minutes: 0 };
    const fallbackSessions = Math.max(0, (Number(ticket.used) || 0) - (Number(progress.recordedSessions) || 0));
    const lessonCount = Math.min(
      Math.max(0, Number(ticket.total) || 0),
      Math.max(0, Number(originalProgress.sessions) || 0) + fallbackSessions,
    );
    const originalMinutes = Math.max(0, Number(originalProgress.minutes) || 0)
      + fallbackSessions * Math.max(0, Number(base.minutes) || 0);
    const originalRule = settlementRuleFor(base.coach);
    const ownRow = {
      ...base,
      actualCoach: base.coach,
      lessonCount,
      minutes: lessonCount ? originalMinutes / lessonCount : base.minutes,
      sessionKey: `${ticketId}|${originalCoachRoleId}|own`,
      summaryPaidAmount: base.paidAmount,
      fixedSettlementAmount: originalRule?.method === "hourly"
        ? Math.round(originalMinutes / 60 * Math.max(0, Number(originalRule.hourly) || 0))
        : undefined,
    };
    const substituteRows = [...progress.substituteGroups.values()].map((substitute) => {
      const actualCoach = coachNameForRoleId(substitute.coachRoleId);
      const actualRule = settlementRuleFor(actualCoach);
      const fixedSettlementAmount = substitute.mode === "none"
        ? 0
        : substitute.mode === "hourly"
          ? Math.round(substitute.minutes / 60 * substitute.hourlyAmount)
          : actualRule?.method === "hourly"
            ? Math.round(substitute.minutes / 60 * Math.max(0, Number(actualRule.hourly) || 0))
            : undefined;
      return {
        ...base,
        actualCoach,
        forceActualCoach: true,
        lessonCount: substitute.sessions,
        minutes: substitute.sessions ? substitute.minutes / substitute.sessions : base.minutes,
        sessionKey: `${ticketId}|${substitute.coachRoleId}|${substitute.mode}|${substitute.hourlyAmount}`,
        summaryPaidAmount: 0,
        fixedSettlementAmount,
        substituteHourlyRate: substitute.mode === "hourly" ? substitute.hourlyAmount : 0,
        substituteSettlementMode: substitute.mode,
      };
    });
    return [ownRow, ...substituteRows];
  }
  const completedLessons = indexes.completedLessonsByTicket?.get(String(ticketId || ""))
    || (adminLiveDataState.lessons || []).filter((lesson) => (
      String(lesson.ticketId || "") === String(ticketId || "")
      && lesson.serverStatus === "completed"
    ));
  if (!completedLessons.length) return [{ ...base, actualCoach: base.coach, lessonCount: Number(ticket.used) || 0 }];

  const assignments = adminLiveDataState.substituteAssignments || [];
  const grouped = new Map();
  completedLessons.forEach((lesson) => {
    const assignment = indexes.assignmentByLesson?.get(String(lesson.serverLessonId || ""))
      || assignments.find((item) => (
        String(item.lesson_id) === String(lesson.serverLessonId)
        && ["assigned", "completed"].includes(item.status)
      ));
    const actualCoach = assignment
      ? coachNameForRoleId(assignment.substitute_coach_role_id)
      : getCoachName(lesson.coachId || ticket.coachId || "");
    const mode = assignment?.settlement_mode || "actual_coach";
    const key = `${actualCoach}|${mode}|${assignment?.hourly_amount || 0}`;
    const row = grouped.get(key) || {
      ...base,
      actualCoach,
      forceActualCoach: Boolean(assignment),
      lessonCount: 0,
      fixedSettlementAmount: ["hourly", "none"].includes(mode) ? 0 : undefined,
      substituteHourlyRate: mode === "hourly" ? Number(assignment?.hourly_amount || 0) : 0,
      substituteSettlementMode: mode,
    };
    row.lessonCount += 1;
    if (mode === "hourly") {
      row.fixedSettlementAmount += Math.round((Number(lesson.durationMinutes || base.minutes) / 60) * Number(assignment.hourly_amount || 0));
    }
    grouped.set(key, row);
  });
  const missingCompleted = Math.max(0, (Number(ticket.used) || 0) - completedLessons.length);
  if (missingCompleted) {
    const key = `${base.coach}|actual_coach|0`;
    const row = grouped.get(key) || { ...base, actualCoach: base.coach, lessonCount: 0 };
    row.lessonCount += missingCompleted;
    grouped.set(key, row);
  }
  return [...grouped.values()];
}

function settlementOrphanSubstituteRows(indexes = {}, billedTicketIds = new Set()) {
  const rows = [];
  (indexes.recordProgressByTicket || new Map()).forEach((progress, ticketId) => {
    if (billedTicketIds.has(String(ticketId)) || !progress?.substituteGroups?.size) return;
    const ticket = indexes.ticketById?.get(String(ticketId));
    if (!ticket) return;
    const syntheticBilling = {
      member: ticket.member || "대타 수업",
      ticketId,
      amount: 0,
      finalAmount: 0,
      method: "cash",
    };
    rows.push(...settlementRowsForBilling(syntheticBilling, indexes).slice(1));
  });
  return rows;
}

function paymentDisplayStatus(item = {}) {
  if (isStaleReadyPayment(item)) {
    return {
      status: "warn",
      label: "오래된 결제 대기",
      detail: "결제창 생성 후 1시간 이상 완료 확인이 없습니다. 자동 취소하지 말고 결제 상태를 확인하세요.",
    };
  }
  return {
    status: item.status,
    label: item.statusLabel,
    detail: "",
  };
}

function billingFilterGroup(item = {}) {
  if (["cancelled", "refunded", "refund_processing", "refund_reconcile", "cancel_reconcile"].includes(item.status)) return "refund";
  if (isStaleReadyPayment(item)) return "action";
  if (["server_ready", "unverified"].includes(item.status)) return "verifying";
  if (item.status === "paid") return "done";
  return "action";
}

function paymentCancellationAuditDetail(item = {}) {
  if (!["cancelled", "refunded"].includes(item.status)) return "";
  const amount = Number(item.refundedAmount || (item.status === "cancelled" ? paymentFullCancelAmount(item) : 0));
  const parts = [];
  if (amount > 0) parts.push(`${money.format(amount)}원`);
  if (item.refundReason) parts.push(`사유: ${item.refundReason}`);
  const completedAt = paymentAuditDateTimeLabel(item.refundedAt);
  if (completedAt) parts.push(completedAt);
  return parts.join(" · ");
}

function paymentCancellationAuditLog(item = {}) {
  const detail = paymentCancellationAuditDetail(item);
  if (!detail) return "";
  return `${item.member || "회원"} · ${item.item || "결제"} · ${item.status === "refunded" ? "환불" : "PG 전액취소"} · ${detail}`;
}

function downloadRowsAsCsv(filename, rows) {
  downloadTextFile(filename, `\ufeff${rowsToCsv(rows)}`, "text/csv;charset=utf-8");
}

async function downloadImportTemplate() {
  await downloadWorkbook("tennis-note-monthly-import-simple-v2.1.xlsx", [
    {
      name: importMemberSheetName,
      rows: [importMemberColumns],
      columns: importMemberColumns.map((_, index) => ({
        wch: index < importVisibleMemberColumns.length ? ([7, 15].includes(index) ? 30 : 14) : 12,
        hidden: index >= importVisibleMemberColumns.length,
      })),
      autoFilter: "A1:Y1",
    },
    { name: "작성안내", rows: importGuideRows(), columns: [{ wch: 14 }, { wch: 72 }] },
    { name: "선택값", rows: importCodeRows(), columns: [{ wch: 16 }, { wch: 42 }, { wch: 14 }, { wch: 40 }] },
  ]);
  billingLogs.unshift(`월별 데이터 이관 양식 ${importWorkbookVersion} 다운로드`);
  renderAll();
  showToast("엑셀 양식 다운로드 완료");
}

function completeMonthlyImportWorkbook(workbookPayload) {
  const rawRows = workbookPayload?.members?.rows || [];
  if (!rawRows.length) return workbookPayload;
  const guide = importGuideMetadata(workbookPayload?.guide?.rows || []);
  const branchName = String(guide[normalizeImportHeader("지점명")] || activeOperationBranchName() || "").trim();
  const inputHeaders = rawRows[0].map((header) => String(header ?? "").trim());
  const headers = [...inputHeaders];
  importMemberColumns.forEach((column) => {
    if (!headers.some((header) => normalizeImportHeader(header) === normalizeImportHeader(column))) headers.push(column);
  });
  const headerIndex = new Map(headers.map((header, index) => [normalizeImportHeader(header), index]));
  const sourceIndex = new Map(inputHeaders.map((header, index) => [normalizeImportHeader(header), index]));
  const rows = rawRows.slice(1).map((row) => {
    const next = headers.map((header) => {
      const source = sourceIndex.get(normalizeImportHeader(header));
      return source === undefined ? "" : row[source] ?? "";
    });
    const get = (column) => String(next[headerIndex.get(normalizeImportHeader(column))] ?? "").trim();
    const setDefault = (column, value) => {
      const index = headerIndex.get(normalizeImportHeader(column));
      if (index !== undefined && !String(next[index] ?? "").trim()) next[index] = value;
    };
    const phone = get("연락처").replace(/[^0-9]/g, "");
    const partnerPhone = get("파트너연락처").replace(/[^0-9]/g, "");
    const memberStatus = importMemberStatus(get("회원상태"));
    const total = normalizedImportNumber(get("총횟수"));
    const used = normalizedImportNumber(get("소진횟수"));
    const amount = normalizedImportNumber(get("결제금액")) || 0;
    const productDefaults = monthlyImportProductDefaults(get("회원권명"));
    setDefault("원본번호", phone);
    setDefault("지점명", branchName);
    setDefault("적용방식", "현재 회원권 갱신");
    setDefault("레슨방식", productDefaults.lessonWay);
    setDefault("레슨종류", productDefaults.lessonType);
    setDefault("파트너원본번호", partnerPhone);
    if (total !== null && used !== null) setDefault("잔여횟수", Math.max(0, total - used));
    setDefault("결제상태", amount > 0
      ? "결제완료"
      : ["active", "paused"].includes(memberStatus) ? "결제대기" : "해당없음");
    return next;
  });
  return {
    ...workbookPayload,
    members: { ...workbookPayload.members, rows: [headers, ...rows] },
  };
}

function validateMonthlyImportWorkbook(workbookPayload, sourceName = "") {
  const memberRows = workbookPayload?.members?.rows || [];
  const scheduleRows = workbookPayload?.schedules?.rows || [];
  const reviewSheetRows = importRowsAsObjects(workbookPayload?.reviews?.rows || []);
  const paymentReviewSheetRows = importRowsAsObjects(workbookPayload?.paymentReviews?.rows || []);
  const guide = importGuideMetadata(workbookPayload?.guide?.rows || []);
  const importMonth = String(guide[normalizeImportHeader("이관월")] || "").trim();
  const finalizeRoster = normalizeImportHeader(guide[normalizeImportHeader("명단적용")] || "") === normalizeImportHeader("이 명단 기준 전환");
  const workbookBranchName = String(guide[normalizeImportHeader("지점명")] || "").trim();
  const currentBranchName = activeOperationBranchName();
  const importBranchId = activeOperationBranchId() || defaultOperationBranch()?.id || "";
  const memberHeaders = (memberRows[0] || []).map((header) => normalizeImportHeader(header));
  const scheduleHeaders = (scheduleRows[0] || []).map((header) => normalizeImportHeader(header));
  const workbookSchemaVersion = String(workbookPayload?.schemaVersion || "2.0");
  const expectedMemberColumns = workbookSchemaVersion === "2.0"
    ? importMemberColumns.filter((column) => column !== "결제상태")
    : importMemberColumns;
  const missingMemberHeaders = expectedMemberColumns
    .map((column) => normalizeImportHeader(column))
    .filter((column) => !memberHeaders.includes(column));
  const missingScheduleHeaders = importScheduleColumns
    .map((column) => normalizeImportHeader(column))
    .filter((column) => scheduleRows.length && !scheduleHeaders.includes(column));
  const memberObjects = importRowsAsObjects(memberRows);
  const scheduleObjects = importRowsAsObjects(scheduleRows);
  const issues = [
    ...missingMemberHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `회원DB 필수 컬럼 누락: ${column}` })),
    ...missingScheduleHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `정규시간표 필수 컬럼 누락: ${column}` })),
  ];
  const sourceNumbers = new Set();
  const phoneNumbers = new Set();
  const scheduleSourceNumbers = new Set();
  const scheduleSlots = new Set();
  let errorRows = 0;
  let reviewRows = 0;
  if (!importBranchId) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "현재 운영 지점을 먼저 선택하세요." });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(importMonth)) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "작성안내의 이관월을 YYYY-MM 형식으로 입력하세요." });
  }
  if (!workbookBranchName) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "작성안내의 지점명을 입력하세요." });
  } else if (currentBranchName && normalizeImportHeader(workbookBranchName) !== normalizeImportHeader(currentBranchName)) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: `양식 지점(${workbookBranchName})과 현재 운영 지점(${currentBranchName})이 다릅니다.` });
  }
  if (reviewSheetRows.length) {
    reviewRows += reviewSheetRows.length;
    issues.push({
      rowNumber: importReviewSheetName,
      level: "review",
      message: `검토대기 ${reviewSheetRows.length}행을 정리해 회원DB로 옮기거나 제외 근거를 남겨야 합니다.`,
    });
  }
  if (paymentReviewSheetRows.length) {
    reviewRows += paymentReviewSheetRows.length;
    issues.push({
      rowNumber: importPaymentReviewSheetName,
      level: "review",
      message: `결제검토 ${paymentReviewSheetRows.length}행을 정리해야 실제 반영할 수 있습니다.`,
    });
  }
  const liveImportCoachNames = (adminLiveDataState.coachRoles || [])
    .filter((role) => (
      role?.id
      && role.status === "approved"
      && !["ended", "archived"].includes(role.employment_status)
      && !role.archived_at
      && (!importBranchId || String(role.branch_id || "") === String(importBranchId))
    ))
    .map((role) => normalizeImportHeader(role.display_name || role.name || role.coach_name || ""))
    .filter(Boolean);

  memberObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    const sourceNumber = importCell(values, "원본번호");
    const phone = importCell(values, "연락처").replace(/[^0-9]/g, "");
    const status = importMemberStatus(importCell(values, "회원상태"));
    const rowBranchName = importCell(values, "지점명");
    requiredImportMemberColumns.forEach((column) => {
      if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
    });
    if (sourceNumber && sourceNumbers.has(sourceNumber)) rowIssues.push("원본번호 중복");
    if (sourceNumber) sourceNumbers.add(sourceNumber);
    if (phone && phoneNumbers.has(phone)) rowIssues.push("연락처 중복");
    if (phone) phoneNumbers.add(phone);
    if (phone.length < 10 || phone.length > 11) rowIssues.push("연락처 형식 오류");
    const birthYear = normalizedImportNumber(importCell(values, "출생연도"));
    if (!birthYear || birthYear < 1900 || birthYear > 2100) rowIssues.push("출생연도 오류");
    if (!status) rowIssues.push("회원상태 선택 오류");
    if (
      rowBranchName
      && workbookBranchName
      && normalizeImportHeader(rowBranchName) !== normalizeImportHeader(workbookBranchName)
    ) {
      rowIssues.push("작성안내 지점명과 회원 행 지점명이 다름");
    }
    if (["active", "paused"].includes(status)) {
      requiredActiveImportMemberColumns.forEach((column) => {
        if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
      });
    }
    ["총횟수", "소진횟수", "잔여횟수", "결제금액"].forEach((column) => {
      const value = importCell(values, column);
      if (value && normalizedImportNumber(value) === null) rowIssues.push(`${column} 숫자 오류`);
    });
    const total = normalizedImportNumber(importCell(values, "총횟수"));
    const used = normalizedImportNumber(importCell(values, "소진횟수"));
    const remaining = normalizedImportNumber(importCell(values, "잔여횟수"));
    if ([total, used, remaining].every((value) => value !== null) && total - used !== remaining) {
      rowIssues.push("총횟수-소진횟수와 잔여횟수 불일치");
    }
    const amount = normalizedImportNumber(importCell(values, "결제금액")) || 0;
    const paymentStatus = importPaymentStatus(importCell(values, "결제상태"));
    if (workbookPayload.schemaVersion === "2.1" && !paymentStatus) rowIssues.push("결제상태 선택 오류");
    if (paymentStatus === "paid" && (amount <= 0 || !importCell(values, "결제일") || !importCell(values, "결제수단"))) {
      rowIssues.push("결제완료는 결제일·결제수단·결제금액 필요");
    }
    if (["pending", "not_applicable"].includes(paymentStatus) && amount > 0) rowIssues.push("결제대기·해당없음은 결제금액을 비워야 함");
    if (workbookPayload.schemaVersion === "2.0" && amount > 0 && (!importCell(values, "결제일") || !importCell(values, "결제수단"))) {
      rowIssues.push("결제금액이 있으면 결제일·결제수단 필요");
    }
    const lessonType = importCell(values, "레슨종류");
    const partnerSourceNumber = importCell(values, "파트너원본번호");
    const partnerPhone = importCell(values, "파트너연락처").replace(/[^0-9]/g, "");
    if (["active", "paused"].includes(status) && ["1:2", "2대1"].includes(lessonType) && (!partnerSourceNumber || partnerPhone.length < 10)) {
      rowIssues.push("1:2 파트너 정보 필요");
    }
    const coachName = importCell(values, "담당코치");
    if (
      coachName
      && liveImportCoachNames.length
      && !liveImportCoachNames.some((name) => (
        name.includes(normalizeImportHeader(coachName))
        || normalizeImportHeader(coachName).includes(name)
      ))
    ) {
      rowIssues.push("등록되지 않은 코치명 확인 필요");
    }
    if (rowIssues.length) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "error", message }));
    }
  });

  scheduleObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    ["시간표원본번호", "회원원본번호", "수업일", "시작시간", "수업분", "상태"].forEach((column) => {
      if (!importCell(values, column)) rowIssues.push(`${column} 없음`);
    });
    const memberSourceNumber = importCell(values, "회원원본번호");
    const scheduleSourceNumber = importCell(values, "시간표원본번호");
    const lessonDate = importCell(values, "수업일");
    const startTime = importCell(values, "시작시간");
    const scheduleStatus = importCell(values, "상태");
    if (memberSourceNumber && !sourceNumbers.has(memberSourceNumber)) rowIssues.push("회원DB에 없는 회원원본번호");
    if (scheduleSourceNumber && scheduleSourceNumbers.has(scheduleSourceNumber)) rowIssues.push("시간표원본번호 중복");
    if (scheduleSourceNumber) scheduleSourceNumbers.add(scheduleSourceNumber);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) rowIssues.push("수업일 형식 오류");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)) rowIssues.push("시작시간 형식 오류");
    if (![20, 30, 40, 60].includes(normalizedImportNumber(importCell(values, "수업분")))) rowIssues.push("수업분은 20·30·40·60만 가능");
    if (scheduleStatus !== "예정") rowIssues.push("신규 시간표 상태는 예정만 가능");
    const scheduleSlot = `${memberSourceNumber}::${lessonDate}::${startTime}`;
    if (memberSourceNumber && lessonDate && startTime && scheduleSlots.has(scheduleSlot)) rowIssues.push("같은 회원의 같은 시간표가 중복됨");
    if (memberSourceNumber && lessonDate && startTime) scheduleSlots.add(scheduleSlot);
    if (rowIssues.length) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber: `${importScheduleSheetName} ${rowNumber}`, level: "error", message }));
    }
  });

  if (!memberObjects.length) {
    errorRows += 1;
    issues.push({ rowNumber: "-", level: "error", message: "회원DB에 입력된 회원이 없습니다." });
  }
  if (!scheduleObjects.length) {
    issues.push({ rowNumber: "-", level: "info", message: "정규시간표가 비어 있어 기존 서버 시간표를 그대로 보존합니다." });
  }

  const sourceMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(importMonth) ? importMonth : "invalid-month";
  return {
    sourceName,
    schemaVersion: workbookSchemaVersion,
    columns: memberHeaders,
    rowCount: memberObjects.length + scheduleObjects.length,
    memberRowCount: memberObjects.length,
    scheduleRowCount: scheduleObjects.length,
    readyRows: Math.max(0, memberObjects.length + scheduleObjects.length - errorRows),
    reviewRows,
    errorRows: errorRows + (missingMemberHeaders.length || missingScheduleHeaders.length ? 1 : 0),
    issues,
    workbookPayload: {
      schemaVersion: workbookSchemaVersion,
      sourceName,
      targetBranchId: importBranchId,
      importMonth: sourceMonth,
      finalizeRoster,
      effectiveOn: `${sourceMonth}-01`,
      branchName: workbookBranchName,
      sourceSheetId: `tennisnote-monthly-workbook:${importBranchId || "unassigned"}:${sourceMonth}`,
      sourceTabName: sourceMonth,
      members: { columns: memberHeaders, rows: memberRows.slice(1) },
      schedules: { columns: scheduleHeaders, rows: scheduleRows.slice(1) },
      reviews: {
        columns: (workbookPayload?.reviews?.rows?.[0] || []).map((header) => normalizeImportHeader(header)),
        rows: workbookPayload?.reviews?.rows?.slice(1) || [],
      },
      paymentReviews: {
        columns: (workbookPayload?.paymentReviews?.rows?.[0] || []).map((header) => normalizeImportHeader(header)),
        rows: workbookPayload?.paymentReviews?.rows?.slice(1) || [],
      },
    },
  };
}

function validateImportRows(rawRows, sourceName = "") {
  const headerRow = rawRows[0] || [];
  const headers = headerRow.map((header) => normalizeImportHeader(header));
  const requiredHeaders = importTemplateColumns.map((column) => normalizeImportHeader(column));
  const missingHeaders = requiredHeaders.filter((column) => !headers.includes(column));
  const rowObjects = rawRows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, index) => ({ rowNumber: index + 2, values: rowObjectFromHeaders(headers, row) }));
  const issues = missingHeaders.map((column) => ({ rowNumber: "-", level: "error", message: `필수 컬럼 누락: ${column}` }));
  let errorRows = 0;
  let reviewRows = 0;

  rowObjects.forEach(({ rowNumber, values }) => {
    const rowIssues = [];
    requiredImportColumns.forEach((column) => {
      if (!importCell(values, normalizeImportHeader(column))) rowIssues.push(`${column} 없음`);
    });
    numericImportColumns.forEach((column) => {
      const value = importCell(values, normalizeImportHeader(column));
      if (!isNumericImportValue(value)) rowIssues.push(`${column} 숫자 오류`);
    });
    const total = Number(importCell(values, "총횟수").replaceAll(",", ""));
    const used = Number(importCell(values, "사용횟수").replaceAll(",", ""));
    const remaining = Number(importCell(values, "잔여횟수").replaceAll(",", ""));
    if ([total, used, remaining].every(Number.isFinite) && total - used !== remaining) {
      rowIssues.push("총횟수-사용횟수와 잔여횟수 불일치");
    }
    const coachName = importCell(values, "담당코치");
    if (coachName && !coaches.some((coach) => coach.name.includes(coachName) || coachName.includes(coach.name.replace("코치", "").trim()))) {
      rowIssues.push("등록되지 않은 코치명 확인 필요");
    }
    if (rowIssues.some((issue) => issue.includes("없음") || issue.includes("숫자 오류") || issue.includes("불일치"))) {
      errorRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "error", message }));
    } else if (rowIssues.length) {
      reviewRows += 1;
      rowIssues.forEach((message) => issues.push({ rowNumber, level: "review", message }));
    }
  });

  return {
    sourceName,
    columns: headers,
    rowCount: rowObjects.length,
    readyRows: Math.max(0, rowObjects.length - errorRows - reviewRows),
    reviewRows,
    errorRows: errorRows + (missingHeaders.length ? rowObjects.length || 1 : 0),
    issues,
  };
}

function dataImportServerTone() {
  if (["ready", "committed"].includes(dataImportState.serverStatus)) return "good";
  if (dataImportState.serverStatus === "review") return "warn";
  if (dataImportState.serverStatus === "error") return "danger";
  if (dataImportState.serverStatus === "checking") return "neutral";
  return "";
}

function adminImportAuthTone() {
  if (adminImportAuthState.loading) return "neutral";
  if (adminImportAuthState.profile?.role === "admin") return "good";
  if (adminImportAuthState.user) return "warn";
  return "danger";
}

function adminImportAuthBadgeText() {
  if (adminImportAuthState.loading) return "확인중";
  if (adminImportAuthState.profile?.role === "admin") return "관리자";
  if (adminImportAuthState.user) return "권한 확인";
  return "로그인 필요";
}

function hasDataImportPayload() {
  if (supportedImportWorkbookVersions.has(dataImportState.schemaVersion)) {
    return Boolean(dataImportState.workbookPayload?.members?.rows?.length > 1);
  }
  return Array.isArray(dataImportState.rawRows) && dataImportState.rawRows.length > 0;
}

function dataImportRequestBody(mode) {
  const common = {
    mode,
    sourceName: dataImportState.fileName,
    knownCoaches: knownCoachNamesForImport(),
  };
  if (supportedImportWorkbookVersions.has(dataImportState.schemaVersion)) {
    return { ...common, workbook: dataImportState.workbookPayload };
  }
  return { ...common, rows: dataImportState.rawRows };
}

function blockServerPreview(message, serverPreview = null) {
  setDataImportState({
    serverStatus: "error",
    serverMessage: message,
    serverPreview,
  });
  showToast(message);
}

function downloadSafeBackup() {
  const payload = {
    createdAt: new Date().toISOString(),
    note: "Demo backup without raw private source files.",
    counts: {
      members: members.length,
      tickets: tickets.length,
      lessons: lessons.length,
      payments: billings.length,
      products: membershipProductDrafts.length,
      coaches: coaches.filter((coach) => coach.id !== "coach-machine").length,
    },
    data: Object.fromEntries(Object.entries(exportRowsByDataset(false)).map(([key, value]) => [key, value.rows])),
  };
  downloadTextFile(`tennis-note-safe-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  billingLogs.unshift("안전 백업 JSON 다운로드 생성");
  renderAll();
  showToast("안전 백업 다운로드 완료");
}

function managementReportVisibleItems(widgetId, items = []) {
  return adminLayoutSettings.reportWidgetFilters?.[widgetId] === "attention"
    ? items.filter((item) => item.needsAttention === true)
    : items;
}

function managementDriveReportStatusInfo() {
  const status = adminDriveReportState.status;
  if (adminDriveReportState.loading || status === "loading") {
    return { label: "Drive 확인 중", detail: "집계 셀을 읽고 있습니다.", tone: "neutral", pillTone: "" };
  }
  if (status === "fresh") {
    return { label: "최신 자료", detail: "읽기 전용 집계 정상", tone: "ready", pillTone: "ready" };
  }
  if (status === "stale") {
    return { label: "갱신 지연", detail: "원본 갱신시각을 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "provisional") {
    return { label: "검증 필요", detail: "미입력·작성 중·수식 오류를 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "not_configured") {
    return { label: "Drive 연결 전", detail: "서버의 읽기 전용 연결값을 설정해야 합니다.", tone: "neutral", pillTone: "" };
  }
  if (status === "unavailable") {
    return { label: "선택 월 자료 없음", detail: "해당 지점·월의 집계 셀 설정을 확인해 주세요.", tone: "warning", pillTone: "warn" };
  }
  if (status === "error") {
    return { label: "Drive 읽기 실패", detail: adminDriveReportState.message || "연결과 원본 권한을 확인해 주세요.", tone: "warning", pillTone: "danger" };
  }
  return { label: "Drive 연결 전", detail: "Drive 확인을 누르면 읽기 전용 집계 상태를 확인합니다.", tone: "neutral", pillTone: "" };
}

function managementDriveReportMetric(id) {
  const value = Number(adminDriveReportState.snapshot?.metrics?.[id]);
  return Number.isFinite(value) ? value : null;
}

function managementDriveSourceDetail() {
  const source = adminDriveReportState.snapshot?.source || {};
  const updatedAt = source.updatedAt ? new Date(source.updatedAt) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(updatedAt)
    : "갱신시각 없음";
  const closeLabels = { closed: "마감", review: "검토 중", draft: "작성 중", error: "오류" };
  const closeLabel = closeLabels[source.closeStatus] || "마감상태 없음";
  const issueCount = Number(source.qualityIssueCount) || 0;
  return `${updatedLabel} · ${closeLabel}${issueCount ? ` · 품질 이슈 ${issueCount}건` : ""}`;
}

function managementDriveFinanceRows() {
  const statusInfo = managementDriveReportStatusInfo();
  const totalCost = managementDriveReportMetric("totalCost");
  const operatingProfit = managementDriveReportMetric("operatingProfit");
  const debtBalance = managementDriveReportMetric("debtBalance");
  const startupCost = managementDriveReportMetric("startupCost");
  const hasSnapshot = Boolean(adminDriveReportState.snapshot && ["fresh", "stale", "provisional"].includes(adminDriveReportState.status));
  return [
    {
      label: "Drive 원본 상태",
      value: statusInfo.label,
      detail: hasSnapshot ? managementDriveSourceDetail() : statusInfo.detail,
      tone: statusInfo.tone,
      needsAttention: adminDriveReportState.status !== "fresh",
    },
    {
      label: "비용·영업이익",
      value: totalCost !== null && operatingProfit !== null
        ? `비용 ${money.format(totalCost)}원 · 이익 ${money.format(operatingProfit)}원`
        : statusInfo.label,
      detail: hasSnapshot ? "Google Sheets 집계 셀 · 원본 행 비저장" : "장부 원본을 DB에 저장하지 않는 읽기 전용 집계",
      tone: totalCost !== null && operatingProfit !== null ? statusInfo.tone : "neutral",
      needsAttention: adminDriveReportState.status !== "fresh",
    },
    {
      label: "대출·창업비",
      value: debtBalance !== null && startupCost !== null
        ? `대출 ${money.format(debtBalance)}원 · 창업비 ${money.format(startupCost)}원`
        : statusInfo.label,
      detail: hasSnapshot ? "대표 관리자에게만 노출되는 집계값" : "관리자 권한의 서버 어댑터 연결 필요",
      tone: debtBalance !== null && startupCost !== null ? statusInfo.tone : "neutral",
      needsAttention: adminDriveReportState.status !== "fresh",
    },
  ];
}

function coachLaneOrderItems() {
  const byRoleId = new Map(scheduleLaneActiveCoaches().map((coach) => [String(coach.serverRoleId), coach]));
  return coachLaneOrderEditorState.roleIds.map((roleId) => byRoleId.get(String(roleId))).filter(Boolean);
}

function coachLaneOrderPreviewText(day, time) {
  const names = coachLaneOrderItems()
    .filter((coach) => coachWorksAtPreviewTime(coach, day, time))
    .map((coach) => String(coach.name || "코치").replace(/\s*코치$/u, ""));
  return names.length ? names.join(" | ") : "근무 코치 없음";
}

function selectNoticeImage(file) {
  if (!file) return;
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    showToast("JPG, PNG, WebP 이미지만 첨부할 수 있습니다");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("공지 이미지는 5MB 이하로 첨부해주세요");
    return;
  }
  resetNoticeImageDraft();
  noticeImageDraftFile = file;
  noticeImageDraftUrl = URL.createObjectURL(file);
  renderNoticePopupSettings();
}

async function uploadNoticeDraftImage(notice) {
  if (!noticeImageDraftFile) return { notice, uploadedPath: "" };
  const client = liveNoticeClient();
  if (!client?.uploadObject) throw new Error("관리자 로그인 후 이미지를 첨부할 수 있습니다");
  const current = await client.selectCurrentProfile?.();
  const authUser = current?.user || await client.getAuthUser?.();
  const ownerId = current?.profile?.id || authUser?.id;
  if (!ownerId) throw new Error("관리자 계정을 확인할 수 없습니다");
  const objectPath = `${ownerId}/${safeNoticeFileName(noticeImageDraftFile.name)}`;
  await client.uploadObject(noticeMediaBucket, objectPath, noticeImageDraftFile);
  const imageUrl = noticeStoragePublicUrl(objectPath);
  if (!imageUrl) {
    await client.deleteObject?.(noticeMediaBucket, objectPath).catch(() => {});
    throw new Error("공지 이미지 주소를 만들 수 없습니다");
  }
  return {
    notice: normalizePopupNotice({ ...notice, imageUrl, imageStoragePath: objectPath }),
    uploadedPath: objectPath,
  };
}

function bankNotificationDateTime(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function moveAdminLayoutItem(kind, itemId, direction, group = "") {
  const order = kind === "menu"
    ? adminLayoutSettings.menuOrder
    : kind === "group"
      ? adminLayoutSettings.groupOrder
      : kind === "reportWidget"
        ? adminLayoutSettings.reportWidgetOrder
        : adminLayoutSettings.widgetOrder[group];
  if (!order) return;
  const index = order.indexOf(itemId);
  const nextIndex = index + Number(direction);
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  adminLayoutSaveState = "local";
  persistAdminLayoutLocal();
  renderAdminLayoutSettings();
}

function adminLayoutPresetId() {
  return Object.entries(adminLayoutPresets).find(([, preset]) => (
    preset.menuOrder.length === adminLayoutSettings.menuOrder.length
    && preset.menuOrder.every((id, index) => adminLayoutSettings.menuOrder[index] === id)
    && preset.moreMenus.length === adminLayoutSettings.moreMenus.length
    && preset.moreMenus.every((id) => adminLayoutSettings.moreMenus.includes(id))
    && adminLayoutSettings.hiddenMenus.length === 0
  ))?.[0] || "custom";
}

function scheduleV2AdminBridgeSnapshot() {
  const branchTickets = operationBranchTickets([...tickets, ...expiredTickets]);
  const branchTicketIds = new Set(branchTickets.map((ticket) => String(ticket.serverTicketId || ticket.id || "")));
  const branchLessonIds = new Set(operationBranchLessons().map((lesson) => String(lesson.serverLessonId || lesson.id || "")));
  return {
    branchId: activeOperationBranchId(),
    branchName: activeOperationBranchName(),
    role: operationsRole(),
    accessReady: operationsAccessReady(),
    liveLoaded: state.liveScheduleLoaded,
    liveLoading: state.liveScheduleLoading,
    liveMessage: state.liveScheduleMessage,
    week: { ...activeAdminWeek() },
    coaches: operationBranchCoaches().map((coach) => ({
      id: coach.id,
      roleId: coach.serverRoleId || "",
      name: coach.name,
      color: coach.color || "",
      status: coach.status,
      workBlocks: normalizeCoachWorkBlocks(coach).map((block) => ({ ...block, days: [...block.days] })),
      breakBlocks: normalizeCoachBreakBlocks(coach).map((block) => ({ ...block, days: [...block.days] })),
    })),
    members: operationBranchMembers().map((member) => ({
      id: member.id,
      userId: member.serverUserId || "",
      userIds: [...(member.serverUserIds || [])],
      name: member.name,
      status: member.status,
      phoneLast4: String(member.phone || "").replace(/\D/g, "").slice(-4),
      birthYear: member.birthYear || "",
    })),
    tickets: branchTickets.map((ticket) => ({
      id: ticket.serverTicketId || ticket.id || "",
      ownerUserId: ticket.serverUserId || "",
      participantUserIds: [...(ticket.participantUserIds || [])],
      coachRoleId: ticket.coachRoleId || "",
      productId: ticket.productId || "",
      productName: ticket.product || "회원권",
      productKind: ticket.productKind || "regular",
      groupSize: Number(ticket.groupSize) || 1,
      lessonMinutes: Number(ticket.durationMinutes) || 20,
      frequencyPerWeek: Number(ticket.weeklyCount) || 1,
      totalSessions: Number(ticket.total) || 0,
      usedSessions: Number(ticket.used) || 0,
      remainingSessions: Number(ticket.remaining) || 0,
      startsOn: ticket.purchased || "",
      expiresOn: ticket.expires || "",
      status: ticket.status || "",
    })),
    lessons: operationBranchLessons().map((lesson) => ({
      id: lesson.serverLessonId || lesson.id || "",
      revision: Number(lesson.serverRevision) || null,
      coachRoleId: lesson.coachRoleId || "",
      originalCoachRoleId: lesson.originalCoachRoleId || "",
      lessonDate: lesson.lessonDate || "",
      startTime: lesson.time || "",
      durationMinutes: Number(lesson.durationMinutes) || 20,
      status: (isLessonCancelled(lesson) || isReleasedRegularMakeupSlot(lesson))
        ? "cancelled"
        : lesson.serverStatus || lesson.status || "scheduled",
      scheduleKind: lesson.scheduleV2Kind || normalizeLessonSource(lesson.lessonSource) || "regular",
      memberLabel: lesson.member || "회원 확인 필요",
      oneDayBooking: Boolean(lesson.oneDayBooking),
      oneDayBookingId: lesson.serverOneDayBookingId || "",
      linkedUserId: lesson.linkedUserId || "",
      guestPhoneLast4: String(lesson.guestPhone || "").replace(/\D/g, "").slice(-4),
      note: lesson.oneDayNote || "",
      oneDayBookingSource: lesson.oneDayBookingSource || "walk_in",
      oneDayPaymentStatus: lesson.oneDayPaymentStatus || "unpaid",
      oneDayPaymentMethod: lesson.oneDayPaymentMethod || "",
      oneDayPaymentAmount: Math.max(0, Number(lesson.oneDayPaymentAmount) || 0),
    })),
    participantRows: (adminLiveDataState.participantRows || [])
      .filter((row) => branchLessonIds.has(String(row.lesson_id || "")))
      .map((row) => ({ lessonId: row.lesson_id, userId: row.user_id, ticketId: row.ticket_id })),
    products: (adminLiveDataState.products || [])
      .filter((product) => !product.branch_id || matchesActiveOperationBranch(product.branch_id))
      .map((product) => ({ ...product })),
    ticketIds: [...branchTicketIds],
  };
}
