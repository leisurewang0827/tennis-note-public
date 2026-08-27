// 로그인 세션과 화면 전환처럼 앱 전체에 걸친 처리.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function saveSnapshot() {
  const serialized = JSON.stringify({ state, lessons }, (key, value) => {
    if (key === "photoDataUrl" && typeof value === "string" && value.startsWith("data:")) return "";
    if (key === "url" && typeof value === "string" && (value.startsWith("blob:") || value.startsWith("data:"))) return "";
    return value;
  });
  if (safeLocalStorageSet(storageKey, serialized)) return;
  localStorage.removeItem(storageKey);
  const compact = {
    state: {
      dataMode: state.dataMode,
      member: state.member,
      profile: { ...state.profile, photoDataUrl: "" },
      coachModeAllowed: state.coachModeAllowed,
      selectedPaymentMethod: state.selectedPaymentMethod,
      pendingPurchaseProductId: state.pendingPurchaseProductId,
      purchaseFlow: state.purchaseFlow,
    },
    lessons: [],
  };
  safeLocalStorageSet(storageKey, JSON.stringify(compact));
}

function updatePwaInstallButtons() {
  const canInstall = Boolean(deferredPwaInstallPrompt) && !isStandalonePwa();
  $$("[data-install-pwa]").forEach((button) => {
    button.hidden = !canInstall;
  });
}

function applyScheduleV2MemberWorkspace(workspace = {}, releasedMakeupSlots = [], oneDaySlots = [], ownOneDayBookingIds = new Set()) {
  if (!workspace?.actorUserId || !Array.isArray(workspace.lessons)) return false;
  state.scheduleOperationDays = Array.isArray(workspace.operationDays) ? workspace.operationDays : [];
  const ticketsById = new Map((workspace.tickets || []).map((ticket) => [ticket.id, ticket]));
  const coachesById = new Map((workspace.coaches || []).map((coach) => [coach.roleId, coach]));
  const mappedLessons = workspace.lessons.map((lesson) => {
    const isOwnLesson = lesson.isOwnLesson === true;
    const ticket = ticketsById.get(lesson.memberTicketId) || {};
    const laneCoach = coachesById.get(lesson.coachRoleId) || {};
    const substitute = lesson.substitute && lesson.substitute.coachRoleId ? lesson.substitute : null;
    const lessonDate = String(lesson.lessonDate || "");
    const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
    const lessonKind = String(lesson.scheduleKind || "regular");
    const participantRecord = lesson.participantRecord && typeof lesson.participantRecord === "object"
      ? lesson.participantRecord
      : null;
    const ownStatus = scheduleV2MemberOutcomeStatus(participantRecord, lesson.status);
    return {
      ...lesson,
      serverStatus: isOwnLesson ? ownStatus : lesson.status,
      serverLessonId: lesson.id,
      serverRevision: Number(lesson.revision) || 0,
      lessonDate,
      day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
      time: String(lesson.startTime || "").slice(0, 5),
      coach: substitute?.coachName || laneCoach.name || "담당 코치",
      coachRoleId: lesson.coachRoleId,
      coach_role_id: lesson.coachRoleId,
      originalCoachRoleId: substitute ? lesson.coachRoleId : "",
      originalCoach: substitute ? (laneCoach.name || "담당 코치") : "",
      isSubstitute: Boolean(substitute),
      member: isOwnLesson ? currentMemberName() : "",
      type: `${scheduleV2MemberLessonKind(lessonKind)} ${Number(lesson.durationMinutes) || 20}분`,
      lessonSource: lessonKind,
      durationMinutes: Number(lesson.durationMinutes) || 20,
      ticketId: ticket.id || lesson.memberTicketId || "",
      ticketTotalSessions: Number(ticket.totalSessions) || 0,
      ticketUsedSessions: Number(ticket.usedSessions) || 0,
      ticketRemainingSessions: Number(ticket.remainingSessions) || 0,
      ticketLessonMinutes: Number(ticket.lessonMinutes) || Number(lesson.durationMinutes) || 20,
      participantRecord,
      recordStatus: participantRecord?.recordStatus || "",
      outcome: participantRecord?.outcome || "",
      deductedSessions: Number(participantRecord?.deductedSessions) || 0,
      coachComment: participantRecord?.coachComment || "",
      status: isOwnLesson
        ? ownStatus === "pending_change" ? "requested" : ownStatus
        : "occupied",
      isOwnLesson,
      scheduleV2: true,
    };
  });

  state.liveMakeupEntitlements = (workspace.makeupEntitlements || []).map((entitlement) => {
    const sourceLesson = workspace.lessons.find((lesson) => lesson.id === entitlement.sourceLessonId) || {};
    const lessonDate = String(sourceLesson.lessonDate || "");
    const date = lessonDate ? new Date(`${lessonDate}T00:00:00`) : null;
    return {
      id: entitlement.id,
      sourceLessonId: entitlement.sourceLessonId,
      ticketId: entitlement.ticketId,
      coachRoleId: entitlement.coachRoleId,
      coach: coachesById.get(entitlement.coachRoleId)?.name || "담당 코치",
      lessonDate,
      day: date ? days[date.getDay() === 0 ? 6 : date.getDay() - 1] : "",
      time: String(sourceLesson.startTime || "").slice(0, 5),
      durationMinutes: Number(entitlement.durationMinutes) || Number(sourceLesson.durationMinutes) || 20,
      status: entitlement.status,
      reason: entitlement.reason || "회원 불참",
      markedAt: entitlement.markedAt || "",
      bookedLessonId: entitlement.bookedLessonId || "",
      bookedAt: entitlement.bookedAt || "",
    };
  });
  state.liveReleasedMakeupSlots = (releasedMakeupSlots || []).map((slot) => ({
    id: slot.slot_id,
    coachRoleId: slot.coach_role_id,
    lessonDate: slot.lesson_date,
    time: String(slot.start_time || "").slice(0, 5),
    durationMinutes: Number(slot.duration_minutes) || 20,
  }));
  const oneDayOccupancy = (oneDaySlots || []).map((slot) => memberOneDayLessonFromSlot(
    slot,
    coachesById.get(slot.coach_role_id)?.name || "담당 코치",
    ownOneDayBookingIds,
    currentMemberName(),
  ));
  const retainedLessons = (state.liveLessons || []).filter((lesson) => (
    lesson.lessonDate
    && (lesson.lessonDate < workspace.from || lesson.lessonDate > workspace.to)
  ));
  state.liveLessons = [...retainedLessons, ...mappedLessons, ...oneDayOccupancy]
    .filter((lesson, index, items) => items.findIndex((candidate) => candidate.id === lesson.id) === index);
  mergeScheduleV2MemberRecords(mappedLessons);
  state.liveLessonsLoaded = true;
  state.scheduleV2WorkspaceLoaded = true;
  state.scheduleV2SyncError = "";
  state.scheduleV2SyncErrorCode = "";
  state.scheduleV2LastSyncedAt = new Date().toISOString();
  renderMemberRuntimeDiagnostics();
  void memberScheduleRevisionWatcher?.check?.();
  return true;
}

function updateCoachModeAccess() {
  const button = $("#coachModeButton");
  if (!button) return;
  button.hidden = !canUseCoachMode();
  renderBankNotificationBridge();
}

function applyRequestedMemberView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  if (requestedView && $(`#${requestedView}`)) setView(requestedView);
}

function handleHomeAction(action) {
  const viewMap = {
    "lesson-log": "lessonLogView",
    curriculum: "curriculumView",
    makeup: "scheduleView",
    ticket: "shopView",
    shop: "shopView",
  };
  const viewId = viewMap[action];
  if (!viewId) return;
  if (action === "makeup") {
    const makeupSource = memberMakeupDueLessons()[0];
    const couponSource = memberBookableCouponTickets()[0];
    if (makeupSource) openMemberChangeTimetable(makeupSource.id);
    else if (couponSource) startCouponBooking(couponSource.ticketId);
    else openMemberChangeTimetable("");
    return;
  }
  navigateMemberView(viewId);
  if (action === "curriculum") {
    renderCurriculum();
    requestAnimationFrame(() => $("#curriculumGuide")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return;
  }
  jumpToTop();
}

function handleSummaryAction(action) {
  if (action === "schedule") {
    navigateMemberView("scheduleView");
    jumpToTop();
    return;
  }
  if (action === "shop") {
    navigateMemberView("shopView");
    jumpToTop();
    return;
  }
  if (action === "change" || action === "makeup") {
    const firstDue = memberMakeupDueLessons()[0];
    const firstCoupon = memberBookableCouponTickets()[0];
    if (firstDue) openMemberChangeTimetable(firstDue.id);
    else if (firstCoupon) startCouponBooking(firstCoupon.ticketId);
    else openMemberChangeTimetable("");
    return;
  }
  if (action === "comments") {
    const latest = latestMemberFeedbackLog() || state.lessonLogs[0];
    if (latest) {
      if (latest.status === "confirmed") {
        state.lastReadFeedbackId = latest.id;
        saveSnapshot();
        renderMemberHomeOverview();
      }
      openJournalDetail(latest.id);
      return;
    }
    setView("lessonLogView");
    jumpToTop();
  }
}

async function applySupabaseMemberSession(showNotice = false) {
  const client = window.TennisNoteDataClient;
  if (!client?.readiness?.().ready) return false;
  await client.consumeOAuthRedirect?.();
  const session = await client.ensureSession?.() || client.getSession?.();
  if (!session?.access_token) return false;
  if (emailPasswordRecoveryPending) {
    $("#appScreen").hidden = true;
    $("#loginScreen").hidden = false;
    setEmailAuthMode("recovery", {
      message: "이메일 인증이 완료됐습니다. 새 비밀번호를 입력해주세요.",
      tone: "done",
    });
    return false;
  }
  try {
    const current = await client.selectCurrentProfile();
    if (current?.profileBootstrapError?.code === "auth_profile_mapping_ambiguous") {
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "로그인 계정이 여러 회원 정보에 연결되어 있습니다. 관리자에게 회원 연결 확인을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (["auth_profile_mapping_stale", "auth_profile_identity_context_invalid"].includes(current?.profileBootstrapError?.code)) {
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "회원 연결 상태를 안전하게 확인하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 연결 확인을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (current?.profileBootstrapError?.code === "member_login_provider_locked") {
      const providerLabels = {
        "custom:naver": "네이버",
        "custom:kakao": "카카오",
        apple: "Apple",
        email: "이메일",
        existing: "기존",
      };
      const expectedProvider = providerLabels[current.profileBootstrapError.expectedProvider] || "처음 선택한";
      await client.signOut?.();
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = `이 회원정보는 ${expectedProvider} 로그인에 연결되어 있습니다. ${expectedProvider} 로그인을 이용해 주세요.`;
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    if (["verified_phone_member_ambiguous", "auth_switch_phone_ambiguous"].includes(current?.profileBootstrapError?.code)) {
      await client.signOut?.();
      const status = $("#memberEmailLoginStatus");
      if (status) status.textContent = "같은 휴대전화 정보의 회원 DB가 여러 개입니다. 관리자에게 계정 연결을 요청해 주세요.";
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      return false;
    }
    const { user, profile, coachRole } = current;
    activateLiveMemberProfile(profile?.id);
    const displayName = profile?.name || state.profile?.name || "가입 확인 중";
    state.member = {
      provider: session.provider || "Supabase",
      name: displayName,
      nickname: profile?.nickname || "",
      profileId: profile?.id || "",
      authUserId: user?.id || "",
      role: profile?.role || "member",
      memberKind: profile?.member_kind || "journal_only",
      status: profile?.status || "active",
      birthYear: profile?.birth_year || "",
      neighborhood: profile?.neighborhood || "",
      gender: profile?.gender || "",
      coachApproved: coachRole?.status === "approved",
    };
    state.coachModeAllowed = state.member.coachApproved;
    if (shouldOpenCoachModeByDefault()) {
      openCoachMode();
      return true;
    }
    state.profile.name = profile?.name || "가입 확인 중";
    state.profile.nickname = profile?.nickname || "";
    state.profile.phone = profile?.phone || "";
    state.profile.birthYear = profile?.birth_year || "";
    state.profile.neighborhood = profile?.neighborhood || "";
    state.profile.gender = profile?.gender || "";
    state.profile.profileCompletedAt = profile?.profile_completed_at || "";
    state.profile.termsConsentVersion = "";
    state.profile.termsConsentedAt = "";
    state.profile.privacyConsentVersion = profile?.privacy_consent_version || "";
    state.profile.privacyConsentedAt = profile?.privacy_consented_at || "";
    state.profile.marketingPushConsent = false;
    state.profile.marketingSmsConsent = false;
    state.profile.marketingEmailConsent = false;
    state.profile.suggestedNickname = suggestedNicknameFromUser(user);
    if (profile?.profile_photo_url) state.profile.photoDataUrl = profile.profile_photo_url;
    if (profile?.dominant_hand) state.profile.hand = profile.dominant_hand;
    if (profile?.backhand_style) state.profile.backhand = profile.backhand_style;
    if (profile?.tennis_started_on) state.profile.startedAt = profile.tennis_started_on;
    if (profile?.self_ntrp) state.profile.selfNtrp = String(profile.self_ntrp);
    if (profile?.coach_ntrp) state.profile.coachNtrp = String(profile.coach_ntrp);
    if (profile?.tennis_goal) state.profile.goal = profile.tennis_goal;
    if (profile?.play_style_memo) state.profile.styleMemo = profile.play_style_memo;
    if (profile?.ntrp_survey && typeof profile.ntrp_survey === "object") state.profile.ntrpSurvey = profile.ntrp_survey;
    state.profile.ntrpCheckRequested = Boolean(profile?.ntrp_requested_at && !profile?.coach_ntrp);
    openAppFromSession(false);
    renderAll();
    try {
      await loadIdentityConsentPreferences();
    } catch (consentError) {
      console.warn("[TennisNote] consent preferences could not be loaded", consentError?.message || consentError);
    }
    syncIdentitySetupModal(user);
    saveSnapshot();
    setMemberSessionRestoring(false);

    memberPurchaseDataLoaded = false;
    await Promise.allSettled([
      syncMemberTicketsFromServer(profile),
      syncMemberPendingPurchaseSchedulesFromServer(),
      syncMemberLessonsFromServer(profile),
      syncMemberAccountDeletionRequestFromServer(profile),
    ]);
    await syncLiveSchedulePolicy(currentLiveTicket()?.branchId || "");
    renderAll();
    saveSnapshot();
    await applyPendingOnboardingIntent();
    void Promise.allSettled([
      syncMemberChangeRequestsFromServer(profile),
      syncMemberJournalEntriesFromServer(profile),
      syncMemberGroupAccountFromServer(profile),
      syncMemberNotificationsFromServer(profile),
      syncNativePushRegistration(profile, false),
    ]).then(() => {
      renderAll();
      if (showNotice && !isApprovalPending()) showNoticeAfterLiveSync();
      scheduleNativePushPrimer();
      saveSnapshot();
    });
    return true;
  } catch (error) {
    const status = $("#memberEmailLoginStatus");
    const code = error?.payload?.code || error?.message || "";
    if (status && code === "verified_phone_member_ambiguous") {
      status.textContent = "같은 휴대전화 정보의 회원 DB가 여러 개입니다. 관리자에게 계정 연결을 요청해 주세요.";
    } else if (status && code) {
      status.textContent = "회원정보 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    }
    return false;
  }
}

async function handleOAuthResult(event) {
  const provider = event?.detail?.provider || "간편";
  finishOAuthLogin();
  if (event?.detail?.ok) {
    event.preventDefault();
    if (event?.detail?.callbackType === "recovery") {
      emailPasswordRecoveryPending = true;
      $("#appScreen").hidden = true;
      $("#loginScreen").hidden = false;
      setMemberSessionRestoring(false);
      setEmailAuthMode("recovery", {
        message: "이메일 인증이 완료됐습니다. 새 비밀번호를 입력해주세요.",
        tone: "done",
      });
      return;
    }
    setEmailAuthStatus(`${provider} 로그인 정보를 확인하고 있습니다.`);
    setMemberSessionRestoring(true);
    try {
      const opened = await applySupabaseMemberSession(true);
      if (!opened) throw new Error("oauth_profile_bootstrap_failed");
      setEmailAuthStatus();
    } catch (error) {
      setEmailAuthStatus(`${provider} 로그인 후 회원정보를 열지 못했습니다. 다시 시도해주세요.`, "alert");
    } finally {
      setMemberSessionRestoring(false);
    }
    return;
  }
  setEmailAuthStatus(event?.detail?.cancelled
    ? `${provider} 로그인이 취소되었습니다.`
    : oauthLoginErrorMessage({ code: event?.detail?.errorCode }, provider), "alert");
}
