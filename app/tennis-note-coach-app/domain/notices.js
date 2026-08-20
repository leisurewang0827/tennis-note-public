// 공지와 알림을 정규화하고 고르는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function normalizeAppNotice(notice = {}) {
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status) ? notice.status : "active";
  return {
    ...defaultCoachNotice,
    ...notice,
    id: notice.id || defaultCoachNotice.id,
    title: notice.title || defaultCoachNotice.title,
    body: notice.body || defaultCoachNotice.body,
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : "coach",
    status: normalizedStatus,
    priority: notice.priority || "normal",
    startDate: notice.startDate || "",
    endDate: notice.endDate || "",
    showOncePerDay: notice.showOncePerDay !== false,
    displayOrder: Math.max(0, Number(notice.displayOrder ?? notice.display_order) || 10),
    imageUrl: String(notice.imageUrl || notice.image_url || "").trim(),
    imageAlt: String(notice.imageAlt || notice.image_alt || "").trim(),
    actionLabel: String(notice.actionLabel || notice.action_label || "").trim(),
    actionUrl: String(notice.actionUrl || notice.action_url || "").trim(),
    updatedAt: notice.updatedAt || "",
  };
}

function activeNoticesForApp(audience = "coach") {
  const today = localDateKey();
  const shared = loadSharedData();
  const source = shared.noticeSource === "server" ? shared.notices : (shared.notices?.length ? shared.notices : [defaultCoachNotice]);
  return source
    .map((notice) => normalizeAppNotice(notice))
    .filter((notice) => (
      notice.status === "active"
      && ["all", audience].includes(notice.audience)
      && (!notice.startDate || notice.startDate <= today)
      && (!notice.endDate || notice.endDate >= today)
    ))
    .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function noticeMetaText(notice = {}) {
  const audienceLabel = notice.audience === "coach" ? "코치용" : notice.audience === "member" ? "회원용" : "회원/코치 공통";
  const priorityLabel = notice.priority === "urgent" ? "긴급" : notice.priority === "important" ? "중요" : "일반";
  return `${audienceLabel} · ${priorityLabel}`;
}

function noticeRowToAppNotice(row = {}) {
  return normalizeAppNotice({
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
    imageAlt: row.image_alt || "",
    actionLabel: row.action_label || "",
    actionUrl: row.action_url || "",
    updatedAt: row.updated_at || row.created_at || "",
  });
}

function coachNotificationData(action = {}) {
  const data = action?.notification?.data;
  return data && typeof data === "object" ? data : {};
}

function coachNotificationRoute(data = {}) {
  const route = String(data.route || "").trim().toLowerCase();
  return ["today", "dashboard", "schedule", "feedback", "member", "membership"].includes(route) ? route : "today";
}

function coachNotificationLesson(data = {}) {
  const lessonId = String(data.lessonId || data.lesson_id || "").trim();
  if (!lessonId) return null;
  return [...(state.liveLessons || []), ...(state.todayLessons || []), ...weekLessons()].find((lesson) => (
    String(lesson.serverLessonId || lesson.id || "") === lessonId
  )) || null;
}
