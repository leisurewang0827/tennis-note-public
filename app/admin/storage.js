// 브라우저 로컬 저장소를 읽고 쓰는 함수들.
//
// localStorage 는 사용자가 지울 수 있고 사파리 프라이빗 모드에서는 던진다.
// 그래서 읽기·쓰기를 여기 한곳에 모아 감싼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function saveScheduleSafetySnapshot(source = lessons, reason = "refresh") {
  const today = new Date();
  const rangeStart = new Date(today);
  const rangeEnd = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 14);
  rangeEnd.setDate(rangeEnd.getDate() + 63);
  const startDate = rangeStart.toISOString().slice(0, 10);
  const endDate = rangeEnd.toISOString().slice(0, 10);
  const savedLessons = persistentScheduleLessons(source)
    .filter((lesson) => !lesson.lessonDate || (lesson.lessonDate >= startDate && lesson.lessonDate <= endDate))
    .sort((left, right) => `${left.lessonDate || ""}T${left.time || ""}`.localeCompare(`${right.lessonDate || ""}T${right.time || ""}`))
    .slice(0, scheduleSafetySnapshotLimit);
  if (!savedLessons.length) return;
  try {
    localStorage.setItem(scheduleSafetySnapshotKey, JSON.stringify({
      version: adminSnapshotVersion,
      savedAt: new Date().toISOString(),
      reason,
      lessons: savedLessons,
    }));
  } catch {
    // Storage is a secondary safety net. The Supabase schedule remains canonical.
  }
}

function writeCachedOperationsIdentity(user, profile) {
  if (!user?.id || !["admin", "coach"].includes(profile?.role)) return false;
  const cached = {
    user: { id: user.id },
    profile: {
      id: profile.id || "",
      name: profile.name || "",
      role: profile.role,
    },
  };
  const activeStorage = operationsProfileCacheStores()[0];
  try {
    activeStorage.setItem(operationsProfileCacheStorageKey, JSON.stringify(cached));
    [localStorage, sessionStorage]
      .filter((storage) => storage !== activeStorage)
      .forEach((storage) => storage.removeItem(operationsProfileCacheStorageKey));
    return true;
  } catch (error) {
    return false;
  }
}

function clearCachedOperationsIdentity() {
  [localStorage, sessionStorage].forEach((storage) => {
    try {
      storage.removeItem(operationsProfileCacheStorageKey);
    } catch (error) {
      // Clearing either available store is sufficient.
    }
  });
}

function restoreCachedOperationsIdentity() {
  const session = window.TennisNoteDataClient?.getSession?.();
  if (!session?.access_token || adminImportAuthState.profile) return false;
  const cached = readCachedOperationsIdentity();
  if (!cached) return false;
  Object.assign(adminImportAuthState, {
    loading: true,
    loaded: true,
    user: cached.user,
    profile: cached.profile,
    message: "저장된 로그인으로 운영 화면을 복원하고 있습니다.",
  });
  return true;
}

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: Array.isArray(shared.lessonLogs) ? shared.lessonLogs : [],
      feedbackRequests: Array.isArray(shared.feedbackRequests) ? shared.feedbackRequests : [],
      ntrpRequests: Array.isArray(shared.ntrpRequests) ? shared.ntrpRequests : [],
      paymentRequests: Array.isArray(shared.paymentRequests) ? shared.paymentRequests : [],
      makeupRequests: Array.isArray(shared.makeupRequests) ? shared.makeupRequests : [],
      holdingRequests: Array.isArray(shared.holdingRequests) ? shared.holdingRequests : [],
      notices: Array.isArray(shared.notices) ? shared.notices : [defaultPopupNotice],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], paymentRequests: [], makeupRequests: [], holdingRequests: [], notices: [defaultPopupNotice], noticeSource: "" };
  }
}

function saveSharedData(shared) {
  localStorage.setItem(sharedStorageKey, JSON.stringify(shared));
}

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) {
      normalizeDemoData();
      reflectLessonPoliciesInActiveVersion();
      saveSnapshot();
      return;
    }
    if (snapshot.state) {
      const { courtCount, ...restoredState } = snapshot.state;
      Object.assign(state, restoredState);
      state.view = "dashboard";
      state.memberSearch = "";
      state.selectedMemberId = null;
      state.inlineMemberId = null;
      state.inlineMemberTicketId = "";
      state.liveScheduleLoaded = false;
      state.liveScheduleLoading = false;
      state.liveScheduleMessage = "실서버 시간표 재확인 중";
    }
    replaceArray(coaches, snapshot.coaches);
    replaceArray(members, snapshot.members);
    replaceArray(lessons, snapshot.lessons);
    replaceArray(makeupRequests, snapshot.makeupRequests);
    replaceArray(tickets, snapshot.tickets);
    replaceArray(groupAccounts, snapshot.groupAccounts);
    replaceArray(billings, snapshot.billings);
    replaceArray(billingLogs, snapshot.billingLogs);
    replaceArray(lessonNotes, snapshot.lessonNotes);
    const savedDiscountPolicies = Array.isArray(snapshot.discountPolicies) && snapshot.discountPolicies.length
      ? snapshot.discountPolicies
      : discountPolicyDefaults.map((policy) => ({ ...policy, issued: 0, used: 0 }));
    replaceArray(discountPolicies, savedDiscountPolicies.map((policy) => normalizeDiscountPolicy(policy)));
    replaceArray(discountIssueLogs, Array.isArray(snapshot.discountIssueLogs) ? snapshot.discountIssueLogs : []);
    const savedPolicyVersions = Array.isArray(snapshot.policyVersions) && snapshot.policyVersions.length
      ? snapshot.policyVersions
      : policyVersionDefaults;
    replaceArray(policyVersions, savedPolicyVersions.map((policy) => normalizePolicyVersion(policy)));
    const savedLessonPolicies = Array.isArray(snapshot.lessonPolicies)
      ? snapshot.lessonPolicies
      : lessonPolicyDefaults;
    replaceArray(lessonPolicies, savedLessonPolicies.map((policy, index) => normalizeLessonPolicy(policy, index)));
    if (snapshot.refundPolicySettings) Object.assign(refundPolicySettings, normalizeRefundPolicySettings(snapshot.refundPolicySettings));
    if (snapshot.holdingPolicySettings) Object.assign(holdingPolicySettings, snapshot.holdingPolicySettings);
    if (snapshot.notificationPolicySettings) Object.assign(notificationPolicySettings, normalizeNotificationPolicy(snapshot.notificationPolicySettings));
    if (snapshot.newCoachSettlementSettings) Object.assign(newCoachSettlementSettings, snapshot.newCoachSettlementSettings);
    replaceArray(coachSettlementRules, snapshot.coachSettlementRules);
    replaceArray(
      deletedMembershipProductIds,
      Array.isArray(snapshot.deletedMembershipProductIds) ? snapshot.deletedMembershipProductIds : [],
    );
    refreshMembershipProductDrafts(snapshot.membershipProductDrafts || snapshot.membershipProducts);
    if (snapshot.scheduleSettings) {
      scheduleSettings.openStart = snapshot.scheduleSettings.openStart || scheduleSettings.openStart;
      scheduleSettings.openEnd = snapshot.scheduleSettings.openEnd || scheduleSettings.openEnd;
      replaceArray(scheduleSettings.breakRules, snapshot.scheduleSettings.breakRules);
      replaceArray(scheduleSettings.breakFavorites, snapshot.scheduleSettings.breakFavorites || []);
      scheduleSettings.lessonColors = { ...scheduleSettings.lessonColors, ...(snapshot.scheduleSettings.lessonColors || {}) };
      scheduleSettings.lessonColorRules = Array.isArray(snapshot.scheduleSettings.lessonColorRules) ? snapshot.scheduleSettings.lessonColorRules : [];
      scheduleSettings.memberScheduleRequestOnly = snapshot.scheduleSettings.memberScheduleRequestOnly !== false;
      scheduleSettings.adminTuningMode = snapshot.scheduleSettings.adminTuningMode === true;
    }
    replaceArray(
      operationProfiles,
      Array.isArray(snapshot.operationProfiles)
        ? snapshot.operationProfiles.map((profile, index) => normalizeOperationProfile(profile, index))
        : [],
    );
    activeOperationProfileId = snapshot.activeOperationProfileId || "";
    replaceOperationProfileBranchMap(snapshot.activeOperationProfileIdsByBranch);
    ensureOperationProfiles();
    Object.assign(adminLockSettings, normalizeAdminLockSettings(snapshot.adminLockSettings));
    const storedPolicyVersion = Number(snapshot.scheduleSettings?.coachWorkPolicyVersion) || 0;
    if (storedPolicyVersion < 2) applySchedulePreset("clubhouse-current");
    scheduleSettings.coachWorkPolicyVersion = 2;
    normalizeDemoData();
    reflectLessonPoliciesInActiveVersion();
    saveSnapshot();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function writeSnapshotNow() {
  if (state.snapshotStorageUnavailable) return false;
  const {
    accountDeletionRequests,
    makeupEntitlements,
    scheduleSheetPasteRows,
    selectedMemberIds,
    selectedMembershipProductIds,
    selectedSubstituteLessonIds,
    selectedScheduleLessonIds,
    selectedScheduleOpenSlots,
    ...persistedState
  } = state;
  const snapshot = {
    version: adminSnapshotVersion,
    cacheMode: "settings-only",
    state: {
      ...persistedState,
      snapshotStorageUnavailable: false,
      liveScheduleLoaded: false,
      liveScheduleLoading: false,
      liveScheduleMessage: "실서버 시간표 재확인 중",
    },
    discountPolicies,
    policyVersions,
    lessonPolicies,
    refundPolicySettings,
    holdingPolicySettings,
    notificationPolicySettings,
    newCoachSettlementSettings,
    membershipProductDrafts,
    deletedMembershipProductIds,
    membershipProducts: membershipProductsForMemberApp(),
    scheduleSettings,
    operationProfiles,
    activeOperationProfileId,
    activeOperationProfileIdsByBranch,
    adminLockSettings: serializableAdminLockSettings(),
  };
  try {
    localStorage.setItem(storageKey, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    // Remove only the replaceable admin caches. Authentication and user
    // preferences stored under other keys must remain intact.
    localStorage.removeItem(storageKey);
    localStorage.removeItem(scheduleSafetySnapshotKey);
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      state.snapshotStorageUnavailable = false;
      return true;
    } catch {
      // The local snapshot is a convenience cache only. A full browser storage
      // must never disable the live Supabase schedule connection or server saves.
      state.snapshotStorageUnavailable = true;
    }
    console.warn("Admin snapshot was not saved", error?.name || "storage_error");
    return false;
  }
}

function resetNoticeDismissals() {
  [
    "tennis-note-member-live-v1",
    "tennis-note-coach-live-v1",
    "tennis-note-member-demo-v1",
    "tennis-note-coach-demo-v1",
  ].forEach((key) => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(key) || "null");
      if (!snapshot?.state) return;
      snapshot.state.noticeHiddenDate = "";
      snapshot.state.noticeHiddenId = "";
      snapshot.state.noticeHiddenIds = [];
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      localStorage.removeItem(key);
    }
  });
}

function paymentGatewayConfig() {
  try {
    return JSON.parse(localStorage.getItem(paymentConfigKey) || "{}") || {};
  } catch {
    localStorage.removeItem(paymentConfigKey);
    return {};
  }
}

function savePaymentGatewayConfig() {
  const storeId = $("#paymentStoreId")?.value.trim() || "";
  const channelKey = $("#paymentChannelKey")?.value.trim() || "";
  const nextConfig = {
    provider: "portone",
    storeId,
    channelKey,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(paymentConfigKey, JSON.stringify(nextConfig));
  renderServiceReadiness();
  showToast(storeId && channelKey ? "결제 연결값 저장 완료" : "결제 연결값 임시 저장 완료");
}

function clearPaymentGatewayConfig() {
  localStorage.removeItem(paymentConfigKey);
  renderServiceReadiness();
  showToast("결제 연결값 삭제 완료");
}

function persistAdminLayoutLocal() {
  localStorage.setItem(adminLayoutLocalKey, JSON.stringify(adminLayoutSettings));
}
