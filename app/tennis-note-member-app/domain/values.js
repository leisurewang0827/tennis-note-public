// 한 가지 값을 다듬거나 재는 작은 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function numericValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDateTimeLabel(value = "") {
  if (!value) return "방금 전";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMemberName(name = "") {
  return String(name).replace(/\s*회원$/u, "").trim();
}

function isCurrentMemberName(name = "") {
  const normalized = normalizeMemberName(name);
  const current = currentMemberName();
  return Boolean(normalized && current && normalized === current);
}

function memberLessonTimestamp(lesson = {}) {
  const lessonDate = lesson.lessonDate || memberScheduleDateForDay(lesson.day);
  if (!lessonDate || !lesson.time) return Number.NaN;
  return new Date(`${lessonDate}T${lesson.time}:00`).getTime();
}

function memberDateUtcValue(dateKey = "") {
  const parts = String(dateKey || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return NaN;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function memberInclusiveDateDays(startsOn = "", expiresOn = "") {
  const start = memberDateUtcValue(startsOn);
  const end = memberDateUtcValue(expiresOn);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function memberReadableDate(dateKey = "") {
  const parts = String(dateKey || "").slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "";
  return `${parts[1]}월 ${parts[2]}일`;
}

function compactLessonDateLabel(dateValue = "", fallbackDay = "") {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fallbackDay ? `${dayName(fallbackDay)}` : "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const day = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${Number(match[2])}월 ${Number(match[3])}일(${day})`;
}

function lessonDateTimeLabel(lesson = {}, fallback = "수업") {
  const date = compactLessonDateLabel(lesson.lessonDate || lesson.journalDate, lesson.day);
  const time = String(lesson.displayTimeRange || lesson.time || "").trim();
  return [date || fallback, time].filter(Boolean).join(" ");
}

function dayName(day) {
  return { 월: "월요일", 화: "화요일", 수: "수요일", 목: "목요일", 금: "금요일", 토: "토요일", 일: "일요일" }[day] || day;
}

function shortCoachName(name = "") {
  return name.replace(" 코치", "");
}

function timeFromMinutes(minutes) {
  const normalized = Math.max(0, Number(minutes) || 0);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function paginateItems(items, page) {
  return items.slice(page * listPageSize, page * listPageSize + listPageSize);
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / listPageSize));
}

function pageStateKey(type) {
  if (type === "lesson") return "lessonLogPage";
  if (type === "ticket") return "ticketHistoryPage";
  if (type === "practice") return "practiceLogPage";
  return "expiredTicketPage";
}

function focusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getClientRects().length > 0);
}

function isTransientNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return error instanceof TypeError
    || message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("load failed")
    || message.includes("temporarily_unavailable");
}
