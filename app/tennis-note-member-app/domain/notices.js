// 공지와 알림을 정규화하고 고르는 함수들.
//
// 전역 상태도 DOM 도 서버도 참조하지 않는다. 필요한 값은 인자로 받는다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function normalizeAppNotice(notice = {}) {
  const normalizedStatus = ["active", "disabled", "archived"].includes(notice.status) ? notice.status : "active";
  return {
    id: notice.id || `notice-${Date.now()}`,
    title: notice.title || notices[0]?.title || "공지사항",
    body: notice.body || notices[0]?.body || "",
    audience: ["all", "member", "coach"].includes(notice.audience) ? notice.audience : "all",
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

function activeNoticesForApp(audience = "member") {
  const today = localDateKey();
  const shared = loadSharedData();
  const source = shared.noticeSource === "server" ? shared.notices : (shared.notices?.length ? shared.notices : notices);
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

function normalizeLiveNotification(row = {}) {
  const templateKey = String(row.template_key || "");
  const isRefund = ["payment_cancelled", "payment_request_cancelled", "payment_refunded"].includes(templateKey);
  const isMakeupRequired = templateKey === "lesson_absence_makeup_required";
  const isMakeupBooked = templateKey === "makeup_booking_completed";
  const title = row.title || (templateKey === "payment_refunded" ? "환불 완료" : isRefund ? "결제취소 완료" : "앱 알림");
  const body = row.body || (templateKey === "payment_request_cancelled"
    ? "결제 대기건이 취소되었습니다. 실제 결제가 완료된 건은 아닙니다."
    : isRefund
      ? "결제취소와 회원권 환불 처리가 완료되었습니다. 이용권 내역에서 환불완료 상태를 확인할 수 있습니다."
      : "새 알림이 도착했습니다.");
  return {
    id: row.id || `${templateKey}-${row.created_at || Date.now()}`,
    templateKey,
    title,
    body,
    status: row.status || "sent",
    createdAt: row.sent_at || row.created_at || row.scheduled_at || "",
    payload: row.payload && typeof row.payload === "object" ? row.payload : {},
    tone: isRefund || isMakeupRequired ? "alert" : isMakeupBooked ? "done" : "wait",
  };
}

async function showNoticeAfterLiveSync() {
  await syncLiveNotices();
  showNoticeIfNeeded();
}

function accountDeletionBlocksNotifications(status) {
  return ["pending", "reviewing", "processing", "failed", "completed"].includes(status || "");
}

function setPushPreferenceEnabled(enabled) {
  safeLocalStorageSet(pushPreferenceStorageKey, enabled ? "true" : "false");
}

function nativeNotificationData(action = {}) {
  const data = action?.notification?.data;
  return data && typeof data === "object" ? data : {};
}

function memberNotificationRoute(data = {}) {
  const route = String(data.route || "").trim().toLowerCase();
  return ["home", "schedule", "membership", "feedback", "journal"].includes(route) ? route : "home";
}

function memberNotificationJournalEntry(data = {}) {
  const lessonId = String(data.lessonId || data.lesson_id || "").trim();
  if (!lessonId) return null;
  return journalEntries().find((entry) => (
    String(entry.serverLessonId || entry.lessonId || "") === lessonId
  )) || null;
}
