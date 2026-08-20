// 브라우저 로컬 저장소를 읽고 쓰는 함수들.
//
// localStorage 는 사용자가 지울 수 있고 사파리 프라이빗 모드에서는 던진다.
// 그래서 읽기·쓰기를 여기 한곳에 모아 감싼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: shared.lessonLogs || [],
      feedbackRequests: shared.feedbackRequests || [],
      ntrpRequests: shared.ntrpRequests || [],
      makeupRequests: shared.makeupRequests || [],
      notices: shared.notices || [],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    localStorage.removeItem(sharedStorageKey);
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], makeupRequests: [], notices: [], noticeSource: "" };
  }
}

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) return;
    if (snapshot.state) Object.assign(state, snapshot.state);
    if (state.dataMode === "live") {
      if (!Array.isArray(state.liveLessons)) state.liveLessons = [];
      if (!Array.isArray(state.releasedMakeupSlots)) state.releasedMakeupSlots = [];
      if (!Array.isArray(state.members)) state.members = [];
      return;
    }
    ensureTodayLessonDashboard();
    ensureMemberLists();
    ensureCoachDemoConsistency();
    importMemberLessonLogs();
    importPracticeFeedbackRequests();
    importMakeupRequests();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function writeLiveSchedulePolicySnapshot(value = {}, branchId = "") {
  if (!value || typeof value !== "object") return false;
  const existing = readAdminSnapshot() || {};
  const resolved = resolveLiveSchedulePolicyForBranch(value, branchId);
  const scheduleSettings = resolved.scheduleSettings;
  const coaches = resolved.coaches;
  if (!scheduleSettings.openStart && !scheduleSettings.openEnd && !coaches.length) return false;
  localStorage.setItem(adminStorageKey, JSON.stringify({
    ...existing,
    scheduleSettings: {
      ...(existing.scheduleSettings || {}),
      ...scheduleSettings,
      breakRules: Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : existing.scheduleSettings?.breakRules || [],
      coachWorkPolicyVersion: scheduleSettings.coachWorkPolicyVersion || 2,
    },
    coaches,
    operationPolicyBranchId: resolved.branchId || "",
  }));
  return true;
}

function loadCoachSchedulePolicy() {
  const fallback = defaultCoachSchedulePolicy();
  let resolved = fallback;
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    if (snapshot) {
      const scheduleSettings = snapshot.scheduleSettings || {};
      const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
      const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches) ? snapshot.coaches : fallback.coaches;
      resolved = {
        openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
        openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
        breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
        lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
        lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
        coaches: savedCoaches
          .filter((coach) => (
            (coach.status || "active") === "active"
            && (coach.employmentStatus || "active") === "active"
            && !coach.archivedAt
            && !coach.deletedAt
            && coach.name !== "무인"
          ))
          .map(normalizeCoachPolicyItem),
      };
    }
  } catch {
    localStorage.removeItem(adminStorageKey);
  }
  const workspace = scheduleV2CoachWorkspace();
  if (!workspace?.coaches?.length) return resolved;
  const serverCoaches = workspace.coaches.map((coach, coachIndex) => {
    const serverLaneOrder = Number(coach.laneOrder);
    const laneOrder = Number.isFinite(serverLaneOrder) && serverLaneOrder !== 1000
      ? serverLaneOrder
      : 1000 + coachIndex;
    const workBlocks = (coach.availability || [])
      .filter((block) => block.type === "available")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-${blockIndex}`,
        days: [scheduleDays[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: "근무",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    const blockedBlocks = (coach.availability || [])
      .filter((block) => block.type === "blocked")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-blocked-${blockIndex}`,
        days: [scheduleDays[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: block.note || "브레이크·상담",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    return {
      id: coach.roleId,
      roleId: coach.roleId,
      name: coach.name || "이름 없음",
      status: "active",
      laneOrder,
      sortIndex: laneOrder,
      workBlocks,
      blockedBlocks,
    };
  });
  return {
    ...resolved,
    allowCoachLockedTimeOverride: workspace.policy?.allow_coach_locked_time_override !== false,
    allowCoachHolidayOverride: workspace.policy?.allow_coach_holiday_override === true,
    allowCrossCoachMemberEdit: workspace.policy?.allow_cross_coach_member_edit === true,
    coachSingleAddMode: workspace.policy?.coach_single_add_mode || "approval",
    coaches: serverCoaches,
  };
}

function currentCoachPushDeviceId() {
  let deviceId = localStorage.getItem(coachPushDeviceStorageKey) || "";
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem(coachPushDeviceStorageKey, deviceId);
    } catch {
      return deviceId;
    }
  }
  return deviceId;
}

function coachPushPreferenceEnabled() {
  return localStorage.getItem(coachPushPreferenceStorageKey) !== "false";
}

function setCoachPushPreferenceEnabled(enabled) {
  try {
    localStorage.setItem(coachPushPreferenceStorageKey, enabled ? "true" : "false");
  } catch {
    // The server device state remains authoritative when browser storage is unavailable.
  }
}

function coachPushPrimerWasRecentlyDeferred() {
  const deferredAt = Number(localStorage.getItem(coachPushPrimerDeferredStorageKey) || 0);
  return deferredAt > 0 && Date.now() - deferredAt < 7 * 24 * 60 * 60 * 1000;
}

function deferNativeCoachPushPrimer() {
  try {
    localStorage.setItem(coachPushPrimerDeferredStorageKey, String(Date.now()));
  } catch {
    // Closing the primer is still enough for the current session.
  }
  coachPushPrimerAttempts = 0;
  closeCoachModal("coachPushPrimerModal");
}

async function enableNativeCoachPush() {
  try {
    localStorage.removeItem(coachPushPrimerDeferredStorageKey);
  } catch {
    // Continue with the native permission request.
  }
  setCoachPushPreferenceEnabled(true);
  closeCoachModal("coachPushPrimerModal");
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  await syncNativeCoachPushRegistration(null, true).catch(() => {
    setCoachPushNotificationState("unknown", "알림 연결 실패", "네트워크와 휴대폰 알림 설정을 확인한 뒤 다시 시도해 주세요.");
  });
}
