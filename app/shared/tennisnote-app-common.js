// 회원앱과 코치앱이 함께 쓰는 함수들.
//
// 두 앱에 글자 하나까지 같은 사본이 있어서 한쪽만 고치면 다른 쪽이 깨진 채
// 남았다. 그래서 한곳으로 모았다. 본문은 두 앱에 있던 것 그대로다.
//
// ⚠ 이 파일은 app/shared/ 의 다른 파일과 달리 IIFE 로 감싸지 않는다.
// 전역 함수 선언 그대로여야 두 앱의 호출부를 한 줄도 안 바꾼다.
// 그리고 그래야 tests/global-scope.test.js 가 이름 충돌을 볼 수 있다.
//
// ⚠ 관리자 페이지에는 싣지 마세요. 관리자는 $ 와 $$ 를 const 화살표 함수로
// 선언하므로, 여기 function 선언과 만나면 SyntaxError 로 페이지가 죽습니다.
// (global-scope 검사가 막습니다.)

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function minutesFromTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function lessonDuration(lesson) {
  if (Number(lesson?.durationMinutes) > 0) return Number(lesson.durationMinutes);
  const text = `${lesson.type || ""} ${lesson.ticket || ""}`;
  const matched = text.match(/(\d+)\s*분/);
  return matched ? Number(matched[1]) : 20;
}

function scheduleTimeRangeOptions() {
  return [
    { id: "lesson", label: "추천" },
    { id: "morning", label: "오전" },
    { id: "evening", label: "저녁" },
    { id: "all", label: "전체" },
  ];
}

function parseServerJournalBody(body = "") {
  try {
    const payload = JSON.parse(body || "{}");
    return payload?.schema === serverJournalSchema ? payload : null;
  } catch {
    return null;
  }
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

function resolveLiveSchedulePolicyForBranch(value = {}, branchId = "") {
  const normalizedBranchId = String(branchId || "");
  const profiles = Array.isArray(value.operationProfiles) ? value.operationProfiles : [];
  const activeProfile = profiles.find((item) => String(item?.id || "") === String(value.activeOperationProfileId || ""));
  const branchActiveProfileId = String(value.activeOperationProfileIdsByBranch?.[normalizedBranchId] || "");
  const branchActiveProfile = profiles.find((item) => (
    String(item?.id || "") === branchActiveProfileId
    && String(item?.branchId || item?.branch_id || "") === normalizedBranchId
  ));
  const profile = normalizedBranchId
    ? (branchActiveProfile
      || (String(activeProfile?.branchId || activeProfile?.branch_id || "") === normalizedBranchId
      ? activeProfile
      : profiles.find((item) => String(item?.branchId || item?.branch_id || "") === normalizedBranchId)))
    : activeProfile;
  if (!profile) {
    return {
      scheduleSettings: value.scheduleSettings || {},
      coaches: Array.isArray(value.coaches) ? value.coaches : [],
      branchId: normalizedBranchId,
    };
  }
  const profileBranchId = String(profile.branchId || profile.branch_id || normalizedBranchId);
  const sourceCoaches = Array.isArray(profile.coaches) && profile.coaches.length
    ? profile.coaches
    : Array.isArray(value.coaches) ? value.coaches : [];
  const hasExplicitCoachBranches = sourceCoaches.some((coach) => Boolean(coach?.branchId));
  return {
    scheduleSettings: {
      ...(value.scheduleSettings || {}),
      ...(profile.scheduleSettings || {}),
    },
    coaches: sourceCoaches.filter((coach) => (
      !profileBranchId
      || (!hasExplicitCoachBranches && !coach?.branchId)
      || String(coach.branchId) === profileBranchId
    )),
    branchId: profileBranchId,
  };
}

function filterSchedulePolicyByLiveCoachRoles(value = {}, coachRows = []) {
  const activeRoles = (coachRows || []).filter((role) => (
    role.status === "approved"
    && (role.employment_status || "active") === "active"
    && !role.archived_at
    && !role.deleted_at
  ));
  const activeIds = new Set(activeRoles.map((role) => String(role.id)));
  const activeNames = new Set(activeRoles.map((role) => String(role.display_name || "").trim()).filter(Boolean));
  const filterCoaches = (coaches = []) => (Array.isArray(coaches) ? coaches : [])
    .filter((coach) => (
      coach.serverRoleId
        ? activeIds.has(String(coach.serverRoleId))
        : activeNames.has(String(coach.name || "").trim())
    ))
    .map((coach) => ({
      ...coach,
      status: "active",
      employmentStatus: "active",
      archivedAt: "",
      deletedAt: "",
    }));
  return {
    ...(value || {}),
    coaches: filterCoaches(value?.coaches),
    operationProfiles: Array.isArray(value?.operationProfiles)
      ? value.operationProfiles.map((profile) => ({
        ...profile,
        coaches: filterCoaches(profile?.coaches),
      }))
      : [],
  };
}

function readAdminSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(adminStorageKey) || "null");
  } catch {
    localStorage.removeItem(adminStorageKey);
    return null;
  }
}

function purgeLegacyDemoStorage() {
  legacyDemoStorageKeys.forEach((key) => localStorage.removeItem(key));
}

function showToast(message) {
  let toast = document.querySelector("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = String(message || "");
  toast.classList.add("is-visible");
  window.clearTimeout(appToastTimer);
  appToastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function jumpToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function setNoticeDialogOpen(open) {
  const dialog = $("#noticeDialog");
  if (!dialog) return;
  if (open) {
    if (dialog.hidden) {
      noticePreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    dialog.hidden = false;
    document.body.classList.add("notice-open");
    window.requestAnimationFrame(() => {
      if (!dialog.hidden) $("#noticeClose")?.focus({ preventScroll: true });
    });
    return;
  }
  dialog.hidden = true;
  document.body.classList.remove("notice-open");
  if (noticePreviousFocus?.isConnected) noticePreviousFocus.focus({ preventScroll: true });
  noticePreviousFocus = null;
}

function closeNotice(hideToday = false) {
  const noticeId = $("#noticeDialog")?.dataset.noticeId || "";
  if (noticeId) noticeSessionSeenIds.add(noticeId);
  if (hideToday) {
    const today = localDateKey();
    const previousIds = state.noticeHiddenDate === today && Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : [];
    state.noticeHiddenDate = today;
    state.noticeHiddenId = noticeId;
    state.noticeHiddenIds = [...new Set([...previousIds, noticeId].filter(Boolean))];
  }
  setNoticeDialogOpen(false);
  saveSnapshot();
  window.setTimeout(showNoticeIfNeeded, 0);
}

async function syncLiveNotices() {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const rows = await client.selectRows("tn_notice_popups", {
      select: "id,title,body,audience,priority,status,starts_on,ends_on,show_once_per_day,display_order,image_url,image_alt,action_label,action_url,created_at,updated_at",
      limit: 100,
    });
    const notices = (rows || [])
      .map((row) => noticeRowToAppNotice(row))
      .sort((a, b) => a.displayOrder - b.displayOrder || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const shared = loadSharedData();
    if (!notices.length) {
      shared.notices = [];
      shared.noticeSource = "server";
      saveSharedData(shared);
      return true;
    }
    shared.notices = notices.slice(0, 100);
    shared.noticeSource = "server";
    saveSharedData(shared);
    return true;
  } catch (error) {
    return false;
  }
}

async function syncLiveSchedulePolicy(branchId = "") {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready || !client.selectRows) return false;
  try {
    const [rows, coachRows] = await Promise.all([
      client.selectRows("tn_admin_settings", {
        select: "key,value,updated_at",
        filters: { key: liveSchedulePolicyKey },
        limit: 1,
      }),
      client.selectRows("tn_coach_roles", {
        select: "id,branch_id,display_name,status,employment_status,archived_at,deleted_at",
        limit: 100,
      }),
    ]);
    return writeLiveSchedulePolicySnapshot(
      filterSchedulePolicyByLiveCoachRoles(rows?.[0]?.value, coachRows),
      branchId,
    );
  } catch (error) {
    return false;
  }
}

async function showNoticeAfterLiveSync() {
  await syncLiveNotices();
  showNoticeIfNeeded();
}
