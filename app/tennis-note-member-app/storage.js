// 브라우저 로컬 저장소를 읽고 쓰는 함수들.
//
// localStorage 는 사용자가 지울 수 있고 사파리 프라이빗 모드에서는 던진다.
// 그래서 읽기·쓰기를 여기 한곳에 모아 감싼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function readAdminProducts() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    const source = snapshot?.membershipProducts || snapshot?.membershipProductDrafts;
    if (!Array.isArray(source) || !source.length) return [];
    return source
      .map((product) => normalizeProduct(product, defaultProducts.find((item) => item.id === product.id)));
  } catch {
    return [];
  }
}

function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") console.warn("임시 저장 실패", error);
    return false;
  }
}

function loadSharedData() {
  try {
    const shared = JSON.parse(localStorage.getItem(sharedStorageKey) || "null") || {};
    return {
      lessonLogs: shared.lessonLogs || [],
      feedbackRequests: shared.feedbackRequests || [],
      ntrpRequests: shared.ntrpRequests || [],
      paymentRequests: shared.paymentRequests || [],
      makeupRequests: shared.makeupRequests || [],
      holdingRequests: shared.holdingRequests || [],
      notices: shared.notices || [],
      noticeSource: shared.noticeSource || "",
    };
  } catch {
    localStorage.removeItem(sharedStorageKey);
    return { lessonLogs: [], feedbackRequests: [], ntrpRequests: [], paymentRequests: [], makeupRequests: [], holdingRequests: [], notices: [], noticeSource: "" };
  }
}

function restoreSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!snapshot) return;
    if (snapshot.state) Object.assign(state, snapshot.state);
    if (Array.isArray(snapshot.lessons)) lessons.splice(0, lessons.length, ...snapshot.lessons);
    const visibleLessons = lessons.filter((lesson) => !["무인", "볼머신"].some((word) => `${lesson.coach} ${lesson.type}`.includes(word)));
    lessons.splice(0, lessons.length, ...visibleLessons);
    state.lessonLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    state.practiceLogs.forEach((log) => {
      if (!Array.isArray(log.mediaItems)) log.mediaItems = mediaItemsFromNames(log.mediaNames || []);
    });
    if (!Array.isArray(state.expiredTickets)) state.expiredTickets = [];
    if (!Array.isArray(state.liveMembershipProducts)) state.liveMembershipProducts = [];
    if (!state.livePaymentOptions || typeof state.livePaymentOptions !== "object") {
      state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, settingsAppliedAt: "", methodAvailability: [], features: { threeMonth: true, oneDay: true, coupons: true } };
    }
    state.livePaymentOptions.allowedMethods = paymentMethodIdList(state.livePaymentOptions.allowedMethods || ["tosspay"]);
    state.livePaymentOptions.bankTransferEnabled = state.livePaymentOptions.bankTransferEnabled === true;
    if (!Array.isArray(state.livePaymentOptions.paymentMethods)) state.livePaymentOptions.paymentMethods = [];
    state.livePaymentOptions.settingsVersion = Math.max(0, Number(state.livePaymentOptions.settingsVersion) || 0);
    state.livePaymentOptions.settingsAppliedAt = String(state.livePaymentOptions.settingsAppliedAt || "");
    if (!Array.isArray(state.livePaymentOptions.methodAvailability)) state.livePaymentOptions.methodAvailability = [];
    state.livePaymentOptions.features = { threeMonth: true, oneDay: true, coupons: true, ...(state.livePaymentOptions.features || {}) };
    if (!Array.isArray(state.discountCoupons)) state.discountCoupons = [];
    state.membershipPricingQuotes = {};
    if (!Array.isArray(state.liveTickets)) state.liveTickets = [];
    if (!state.memberEnrollment || typeof state.memberEnrollment !== "object") state.memberEnrollment = null;
    state.pendingPurchaseProductId = String(state.pendingPurchaseProductId || "");
    state.purchaseFlow = {
      open: false,
      step: 1,
      familyId: "weekday-regular",
      productId: "",
      renewalTicketId: "",
      scheduleMode: "keep",
      coachRoleId: "",
      coachName: "",
      preferredDate: "",
      preferredDay: "",
      preferredTime: "",
      preferredSchedules: [],
      discountIssueId: "",
      discountSelectionMode: "auto",
      paymentErrorCode: "",
      paymentErrorMessage: "",
      completionStatus: "",
      ...(state.purchaseFlow && typeof state.purchaseFlow === "object" ? state.purchaseFlow : {}),
    };
    // Purchase UI is transient. Never reopen a half-finished checkout after an app relaunch.
    state.purchaseFlow.open = false;
    state.purchaseFlow.step = Math.min(4, Math.max(1, Number(state.purchaseFlow.step) || 1));
    if (!Array.isArray(state.purchaseFlow.preferredSchedules)) state.purchaseFlow.preferredSchedules = [];
    if (["weekday-coupon", "weekend-coupon"].includes(state.purchaseFlow.familyId)) state.purchaseFlow.familyId = "coupon";
    if (["weekday-coupon", "weekend-coupon"].includes(state.membershipSelectedFamilyId)) state.membershipSelectedFamilyId = "coupon";
    state.selectedLessonDetailId = String(state.selectedLessonDetailId || "");
    if (!["card", "tosspay", "bank_transfer", "naverpay", "kakaopay"].includes(state.selectedPaymentMethod)) state.selectedPaymentMethod = "tosspay";
    state.selectedPaymentMethod = normalizeSelectedPaymentMethod();
    if (!state.pushNotifications || typeof state.pushNotifications !== "object") {
      state.pushNotifications = {
        permission: "unknown",
        status: "checking",
        detail: "수업 일정과 회원권 만료를 알려드립니다.",
      };
    }
    if (!state.ticketSyncStatus || typeof state.ticketSyncStatus !== "object") {
      state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
    }
    if (state.pendingPaymentCheckStatus && typeof state.pendingPaymentCheckStatus !== "object") {
      state.pendingPaymentCheckStatus = null;
    }
    state.lastLiveTicketKey = state.lastLiveTicketKey || "";
    state.lastReadFeedbackId = String(state.lastReadFeedbackId || "");
    state.lessonLogPage = Number(state.lessonLogPage) || 0;
    state.ticketHistoryPage = Number(state.ticketHistoryPage) || 0;
    state.expiredTicketPage = Number(state.expiredTicketPage) || 0;
    state.practiceLogPage = Number(state.practiceLogPage) || 0;
    syncConfirmationsFromCoach();
    syncPracticeFeedbackFromCoach();
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function bankNotificationDevicePublicId() {
  let value = String(localStorage.getItem(bankNotificationDeviceStorageKey) || "").trim();
  if (value.length >= 16) return value;
  value = `tn-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  localStorage.setItem(bankNotificationDeviceStorageKey, value);
  return value;
}

function currentPushDeviceId() {
  let deviceId = localStorage.getItem(pushDeviceStorageKey) || "";
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeLocalStorageSet(pushDeviceStorageKey, deviceId);
  }
  return deviceId;
}

function pushPreferenceEnabled() {
  return localStorage.getItem(pushPreferenceStorageKey) !== "false";
}

function pushPrimerWasRecentlyDeferred() {
  const deferredAt = Number(localStorage.getItem(pushPrimerDeferredStorageKey) || 0);
  return deferredAt > 0 && Date.now() - deferredAt < 7 * 24 * 60 * 60 * 1000;
}

function deferNativePushPrimer() {
  safeLocalStorageSet(pushPrimerDeferredStorageKey, String(Date.now()));
  pushPrimerAttempts = 0;
  closeAppModal("pushPrimerModal");
}

async function enableNativePushFromPrimer() {
  localStorage.removeItem(pushPrimerDeferredStorageKey);
  closeAppModal("pushPrimerModal");
  setPushPreferenceEnabled(true);
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  try {
    await syncNativePushRegistration(null, true);
  } catch {
    setPushNotificationState("unknown", "알림 연결 실패", "네트워크와 휴대폰 알림 설정을 확인한 뒤 내 정보에서 다시 시도해 주세요.");
  }
}

function loadAdminSchedulePolicy() {
  const fallback = defaultMemberCoachPolicy();
  let resolved = fallback;
  try {
    const snapshot = readAdminSnapshot();
    if (snapshot) {
      const scheduleSettings = snapshot.scheduleSettings || {};
      const storedPolicyVersion = Number(scheduleSettings.coachWorkPolicyVersion) || 0;
      const savedCoaches = storedPolicyVersion >= 2 && Array.isArray(snapshot.coaches)
        ? snapshot.coaches
        : fallback.coaches;
      resolved = {
        openStart: storedPolicyVersion < 2 ? fallback.openStart : scheduleSettings.openStart || fallback.openStart,
        openEnd: storedPolicyVersion < 2 ? fallback.openEnd : scheduleSettings.openEnd || fallback.openEnd,
        breakRules: storedPolicyVersion < 2 ? fallback.breakRules : Array.isArray(scheduleSettings.breakRules) ? scheduleSettings.breakRules : fallback.breakRules,
        lessonColors: { ...fallback.lessonColors, ...(scheduleSettings.lessonColors || {}) },
        lessonColorRules: Array.isArray(scheduleSettings.lessonColorRules) ? scheduleSettings.lessonColorRules : [],
        memberScheduleRequestOnly: scheduleSettings.memberScheduleRequestOnly !== false,
        requireMakeupDayAnchor: scheduleSettings.requireMakeupDayAnchor
          ?? scheduleSettings.require_makeup_day_anchor
          ?? fallback.requireMakeupDayAnchor,
        makeupAnchorGapMinutes: (() => {
          const configured = scheduleSettings.makeupAnchorGapMinutes
            ?? scheduleSettings.makeup_anchor_gap_minutes
            ?? fallback.makeupAnchorGapMinutes;
          if (configured === null || String(configured).toLowerCase() === "unlimited") return null;
          return Math.min(100, Math.max(0, Number(configured) || 0));
        })(),
        coaches: savedCoaches
        .filter((coach) => (
          (coach.status || "active") === "active"
          && (coach.employmentStatus || "active") === "active"
          && !coach.archivedAt
          && !coach.deletedAt
        ))
        .map(normalizeMemberCoach),
      };
    }
  } catch {
    localStorage.removeItem(adminStorageKey);
  }
  const workspace = memberScheduleV2WorkspaceCache?.workspace;
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
        days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: "근무",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    const blockedBlocks = (coach.availability || [])
      .filter((block) => block.type === "blocked")
      .map((block, blockIndex) => ({
        id: `${coach.roleId}-server-blocked-${blockIndex}`,
        days: [days[Number(block.dayOfWeek) === 0 ? 6 : Number(block.dayOfWeek) - 1]].filter(Boolean),
        start: String(block.startTime || "").slice(0, 5),
        end: String(block.endTime || "").slice(0, 5),
        label: block.note || "브레이크·상담",
      }))
      .filter((block) => block.days.length && minutesFromTime(block.start) < minutesFromTime(block.end));
    return normalizeMemberCoach({
      id: coach.roleId,
      serverRoleId: coach.roleId,
      roleId: coach.roleId,
      name: coach.name || "이름 없음",
      status: "active",
      laneOrder,
      scheduleLaneOrder: laneOrder,
      workBlocks,
      blockedBlocks,
    });
  });
  return {
    ...resolved,
    coaches: serverCoaches,
  };
}

function memberHoldingPolicy() {
  const fallback = {
    personalMaxDays: 7,
    fourWeekPersonalMaxDays: 7,
    threeMonthPersonalMaxDays: 14,
    couponPersonalMaxDays: 0,
    injuryMaxDays: 30,
    emergencyRetroactiveDays: 3,
    evidenceRequired: true,
    evidenceRetentionDays: 30,
  };
  let saved = fallback;
  try {
    const snapshot = JSON.parse(localStorage.getItem(adminStorageKey) || "null");
    saved = { ...fallback, ...(state.holdingPolicySettings || {}), ...(snapshot?.holdingPolicySettings || {}) };
  } catch {
    saved = fallback;
  }
  const ticketTitle = String(currentHoldingTicket()?.title || "");
  const personalMaxDays = /쿠폰/.test(ticketTitle)
    ? Number(saved.couponPersonalMaxDays) || 0
    : /3개월|12주/.test(ticketTitle)
      ? Number(saved.threeMonthPersonalMaxDays) || 14
      : Number(saved.fourWeekPersonalMaxDays ?? saved.personalMaxDays) || 7;
  return { ...saved, personalMaxDays };
}

function paymentGatewayConfig() {
  const localConfig = (() => {
    try {
      return JSON.parse(localStorage.getItem(paymentConfigKey) || "{}");
    } catch {
      localStorage.removeItem(paymentConfigKey);
      return {};
    }
  })();
  const browserConfig = window.TENNIS_NOTE_PAYMENT_CONFIG || {};
  const liveOptions = state.livePaymentOptions || {};
  // Once the member is connected to the live service, the authenticated
  // branch response is the source of truth. Static/native config is only a
  // bootstrap fallback; otherwise it can expose bank transfer even when the
  // branch has no saved active deposit account.
  const liveOptionsAreAuthoritative = state.dataMode === "live"
    || Number(liveOptions.settingsVersion || 0) > 0;
  const requestedMode = String(browserConfig.mode || localConfig.mode || defaultPaymentOperatingMode).trim().toLowerCase();
  const mode = requestedMode === "multi" ? "multi" : defaultPaymentOperatingMode;
  return {
    enabled: browserConfig.enabled !== false,
    provider: "portone",
    mode,
    allowedMethods: paymentMethodIdList(liveOptionsAreAuthoritative
      ? liveOptions.allowedMethods || []
      : browserConfig.allowedMethods || localConfig.allowedMethods || defaultAllowedPaymentMethods),
    storeId: browserConfig.storeId || localConfig.storeId || "",
    naverPayCategoryType: browserConfig.naverPayCategoryType || localConfig.naverPayCategoryType || "",
    naverPayCategoryId: browserConfig.naverPayCategoryId || localConfig.naverPayCategoryId || "",
    bankTransfer: {
      enabled: liveOptionsAreAuthoritative
        ? liveOptions.bankTransferEnabled === true
        : browserConfig.bankTransfer?.enabled === true || localConfig.bankTransfer?.enabled === true,
    },
    channels: {
      card: browserConfig.channels?.card || browserConfig.channelKey || localConfig.channels?.card || localConfig.channelKey || "",
      tosspay: browserConfig.channels?.tosspay || browserConfig.tossPayChannelKey || localConfig.channels?.tosspay || localConfig.tossPayChannelKey || "",
      naverpay: browserConfig.channels?.naverpay || browserConfig.naverPayChannelKey || localConfig.channels?.naverpay || localConfig.naverPayChannelKey || "",
      kakaopay: browserConfig.channels?.kakaopay || browserConfig.kakaoPayChannelKey || localConfig.channels?.kakaopay || localConfig.kakaoPayChannelKey || "",
    },
  };
}

function memberModeOverrideActive() {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  if (requestedMode === "member") sessionStorage.setItem(appModePreferenceKey, "member");
  return requestedMode === "member" || sessionStorage.getItem(appModePreferenceKey) === "member";
}

function storedOnboardingIntent() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(onboardingIntentStorageKey) || "null");
    if (!parsed || !normalizeOnboardingStart(parsed.start)) return null;
    const preferredSchedules = Array.isArray(parsed.preferredSchedules)
      ? parsed.preferredSchedules.map((schedule) => ({
        lessonDate: String(schedule?.lessonDate || ""),
        day: String(schedule?.day || ""),
        startTime: String(schedule?.startTime || "").slice(0, 5),
        coachRoleId: String(schedule?.coachRoleId || ""),
        coachName: String(schedule?.coachName || ""),
        durationMinutes: Math.max(10, Number(schedule?.durationMinutes) || 20),
      })).filter((schedule) => schedule.lessonDate && schedule.startTime && schedule.coachRoleId)
      : [];
    return {
      start: normalizeOnboardingStart(parsed.start),
      source: normalizeOnboardingSource(parsed.source) || "direct",
      choiceKind: ["one-day", "regular"].includes(parsed.choiceKind) ? parsed.choiceKind : "",
      scheduleScope: ["weekday", "weekend"].includes(parsed.scheduleScope) ? parsed.scheduleScope : "",
      frequency: Math.max(0, Math.min(3, Number(parsed.frequency) || 0)),
      familyId: String(parsed.familyId || ""),
      productId: String(parsed.productId || ""),
      coachRoleId: String(parsed.coachRoleId || ""),
      coachName: String(parsed.coachName || ""),
      preferredSchedules,
      capturedAt: String(parsed.capturedAt || ""),
      applied: parsed.applied === true,
    };
  } catch {
    sessionStorage.removeItem(onboardingIntentStorageKey);
    return null;
  }
}

function saveOnboardingIntent(intent = null) {
  if (!intent) {
    sessionStorage.removeItem(onboardingIntentStorageKey);
    return;
  }
  sessionStorage.setItem(onboardingIntentStorageKey, JSON.stringify(intent));
}

function markOnboardingIntentApplied(intent = storedOnboardingIntent()) {
  if (!intent) return;
  saveOnboardingIntent({ ...intent, applied: true });
}

function captureOnboardingIntent() {
  const params = new URLSearchParams(window.location.search);
  const start = normalizeOnboardingStart(params.get("start"));
  if (!start) return storedOnboardingIntent();
  const source = normalizeOnboardingSource(params.get("source")) || "direct";
  const existing = storedOnboardingIntent();
  const returningFromExternalFlow = Boolean(
    params.get("code")
    || params.get("error")
    || params.get("paymentId")
    || window.location.hash.includes("access_token="),
  );
  const sameIntent = existing?.start === start && existing?.source === source;
  const alreadyCapturedInEntry = history.state?.tennisNoteOnboardingCaptured === true;
  const shouldReset = !sameIntent || (!returningFromExternalFlow && !alreadyCapturedInEntry);
  const seededChoice = start === "one-day" ? "one-day" : start === "membership" ? "regular" : "";
  const intent = shouldReset
    ? { start, source, choiceKind: seededChoice, capturedAt: new Date().toISOString(), applied: false }
    : existing;
  saveOnboardingIntent(intent);
  const currentState = typeof history.state === "object" && history.state ? history.state : {};
  if (!currentState.tennisNoteOnboardingCaptured) {
    history.replaceState({ ...currentState, tennisNoteOnboardingCaptured: true }, "", window.location.href);
  }
  return intent;
}
