// 화면별 모달과 패널을 여닫는 함수들.
//
// DOM 을 직접 만진다. app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라
// 호출부는 예전과 같다.

function openCoachApp(showFromLogin = false) {
  if (!state.coach) return;
  setCoachAccessMessage("");
  $("#coachLoginLabel").textContent = `${state.coach.provider} 로그인 유지`;
  $("#coachName").textContent = state.coach.name;
  renderPersonAvatar($("#coachTopAvatar"), state.coach, "small");
  $("#coachLoginScreen").hidden = true;
  $("#coachAppScreen").hidden = false;
  document.body.dataset.screen = "coach-app";
  jumpToTop();
  const requestedView = new URLSearchParams(window.location.search).get("view");
  setView(showFromLogin ? "todayView" : requestedView || document.body.dataset.activeView || "todayView", { replaceHistory: true });
  window.setTimeout(showNoticeAfterLiveSync, 0);
}

function showNoticeIfNeeded() {
  if (!state.coach) {
    setNoticeDialogOpen(false);
    return;
  }
  const today = localDateKey();
  const activeNotices = activeNoticesForApp("coach");
  const hiddenToday = new Set(state.noticeHiddenDate === today
    ? [...(Array.isArray(state.noticeHiddenIds) ? state.noticeHiddenIds : []), state.noticeHiddenId].filter(Boolean)
    : []);
  const notice = activeNotices.find((item) => !noticeSessionSeenIds.has(item.id) && !(item.showOncePerDay && hiddenToday.has(item.id)));
  if (!notice) {
    setNoticeDialogOpen(false);
    return;
  }
  const noticeIndex = activeNotices.findIndex((item) => item.id === notice.id);
  $("#noticeTitle").textContent = notice.title;
  $("#noticeBody").textContent = notice.body;
  $("#noticeMeta").textContent = `${noticeMetaText(notice)} · ${noticeIndex + 1}/${activeNotices.length}`;
  const noticeImage = $("#noticeImage");
  noticeImage.hidden = !notice.imageUrl;
  noticeImage.src = notice.imageUrl || "";
  noticeImage.alt = notice.imageAlt || notice.title;
  const noticeAction = $("#noticeAction");
  const safeActionUrl = /^https?:\/\//i.test(notice.actionUrl) ? notice.actionUrl : "";
  const hasAction = Boolean(safeActionUrl);
  noticeAction.hidden = !hasAction;
  noticeAction.href = hasAction ? safeActionUrl : "#";
  noticeAction.textContent = notice.actionLabel || "자세히 보기";
  $("#noticeDialog").dataset.noticeId = notice.id;
  setNoticeDialogOpen(true);
}

function openUserMode(event) {
  event?.preventDefault?.();
  sessionStorage.setItem(appModePreferenceKey, "member");
  sessionStorage.setItem("tennis-note-member-mode-transition", String(Date.now()));
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  saveSnapshot();
  const url = new URL(memberModeUrl(true), window.location.href).href;
  if (!window.TennisNoteModeTransition?.navigate(url, {
    from: "coach",
    to: "member",
    sourceView: document.body.dataset.activeView || "coachProfileView",
    targetView: "profileView",
    label: "회원 화면을 여는 중",
  })) window.location.replace(url);
}

function openCoachNotificationTarget(data = {}, route = "today") {
  const requestId = String(data.requestId || data.request_id || "").trim();
  if (requestId) {
    const request = (state.makeupRequests || []).find((item) => (
      String(item.serverRequestId || item.id || "") === requestId
    ));
    if (request) {
      openMakeupApprovalModal(request.id);
      return true;
    }
  }

  const lesson = coachNotificationLesson(data);
  if (lesson) {
    const templateKey = String(data.templateKey || data.template_key || "").trim();
    if (route === "feedback" || templateKey === "coach_feedback_missing") {
      openLessonRecordWriter(lesson.id);
      return true;
    }
    if (route === "schedule") state.selectedFullScheduleDay = lesson.day || state.selectedFullScheduleDay;
    openLessonEditor(lesson.id);
    return true;
  }

  if (requestId || String(data.lessonId || data.lesson_id || "").trim()) {
    showToast("알림에 연결된 수업이나 요청을 찾지 못했습니다. 최신 레슨표를 다시 확인해 주세요.");
  }
  jumpToTop();
  return false;
}

async function toggleNativeCoachPush() {
  if (coachPushUiState.permission === "granted" && coachPushPreferenceEnabled()) {
    await disableNativeCoachPush().catch(() => {
      setCoachPushNotificationState("unknown", "알림 끄기 실패", "네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    });
    return;
  }
  if (coachPushUiState.permission === "denied") {
    showToast("휴대폰 설정에서 Tennis Note 알림을 허용한 뒤 다시 눌러 주세요.");
    return;
  }
  await enableNativeCoachPush();
}

function openTodayTaskTab(tab, shouldScroll = true) {
  state.todayTaskTab = ["lessons", "makeup", "records"].includes(tab) ? tab : "lessons";
  setView("todayView");
  renderAll();
  if (shouldScroll) {
    requestAnimationFrame(() => {
      document.querySelector("#todayView")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function toggleTodayTaskList(tab) {
  state.expandedTodayTasks = {
    ...(state.expandedTodayTasks || {}),
    [tab]: !isTodayTaskExpanded(tab),
  };
  renderAll();
}

function openCoachSettlement() {
  if (document.body.dataset.activeView !== "membersView") setView("membersView", { pushHistory: true });
  renderCoachSettlement();
  openCoachModal("coachSettlementModal");
}

function closeCoachSettlementModal() {
  closeCoachModal("coachSettlementModal");
}

function openMemberDetail(memberId, groupName = "") {
  const member = findMemberDetail(memberId, groupName);
  if (!member) return;
  state.viewingMemberDetailId = memberId;
  state.viewingMemberGroupName = groupName;
  renderMemberDetailModal(member);
}

function closeMemberDetailModal() {
  closeCoachModal("memberDetailModal");
}

function openMakeupDetail(id) {
  state.focusedMakeupId = id;
  openMakeupApprovalModal(id);
}

function openLinkedLog(id) {
  const request = state.makeupRequests.find((item) => item.id === id);
  if (!request) return;
  const log = getMakeupLinkedLog(request.member);
  if (log) state.focusedLogId = log.id;
  state.todayTaskTab = "records";
  if (!$("#lessonEditModal")?.hidden) closeLessonEditor();
  renderAll();
  setView("todayView");
  requestAnimationFrame(() => {
    const selector = log ? `#todayRecordPanel [data-log-card="${log.id}"]` : "#todayRecordPanel";
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function openLessonEditor(id) {
  const lesson = ensureCoachLessonRecord(id);
  const lessonModal = $("#lessonEditModal");
  if (lessonModal) lessonModal.dataset.tnInputGuard = `coach-lesson-record:${id}`;
  state.coachQuickAdd = null;
  state.editingLessonId = id;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  state.groupFeedbackReviewLessonId = "";
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
  (completionParticipantsForLesson(lesson) || []).forEach((participant) => {
    if (participant.userId) void syncCoachMemberChart(participant.userId, participant.name || "회원");
  });
}

function closeLessonEditor(fromHistory = false) {
  const lesson = state.editingLessonId ? ensureCoachLessonRecord(state.editingLessonId) : null;
  if (lesson) {
    if (!lessonChartFinalized(lesson) && !lesson.completionSubmitting) captureLessonChartDraft(lesson.id);
    delete lesson.scheduleEditDraft;
  }
  state.groupFeedbackReviewLessonId = "";
  state.editingLessonId = null;
  state.coachQuickAdd = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  closeCoachModal("lessonEditModal", fromHistory);
}

function openCoachQuickAdd(button) {
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id) === String(button.dataset.coachRoleId || ""));
  const bookingEntitlement = activeCoachMakeupBookingEntitlement();
  const bookingGuard = bookingEntitlement
    ? coachMakeupEntitlementBookingGuard(bookingEntitlement, state.bookingMakeupSnapshot)
    : { ok: true };
  if (!bookingGuard.ok) {
    showToast(bookingGuard.message);
    clearCoachMakeupBooking();
    renderAll();
    return;
  }
  const targetDuration = bookingEntitlement ? Number(bookingEntitlement.durationMinutes) || scheduleBlockMinutes : scheduleBlockMinutes;
  const access = coach ? coachSlotAccess(coach, button.dataset.day, button.dataset.time, targetDuration, policy) : { allowed: false };
  const exactBookingCoach = !bookingEntitlement || String(bookingEntitlement.coachRoleId || "") === String(button.dataset.coachRoleId || "");
  const targetStart = minutesFromTime(button.dataset.time);
  const localConflict = bookingEntitlement && (state.liveLessons || []).some((lesson) => (
    String(lesson.coachRoleId || "") === String(button.dataset.coachRoleId || "")
    && String(lesson.lessonDate || "") === String(button.dataset.date || "")
    && !lesson.releasedMakeupSlot
    && !["cancel", "cancelled", "canceled", "취소"].includes(String(lesson.serverStatus || lesson.status || "").toLowerCase())
    && targetStart < minutesFromTime(lesson.time) + lessonDuration(lesson)
    && minutesFromTime(lesson.time) < targetStart + targetDuration
  ));
  if (localConflict) {
    showToast("선택한 시간에 다른 수업이 있습니다. 다른 빈 시간을 선택해 주세요.");
    return;
  }
  if (!coach || !access.allowed || !exactBookingCoach) {
    showToast(access.reason === "holiday_locked"
      ? "휴무일에는 관리자만 수업을 등록할 수 있습니다."
      : bookingEntitlement
        ? "이 보강권의 담당 코치 근무시간에서 선택해 주세요."
        : "본인 수업 시간 또는 허용된 브레이크·상담 시간만 등록할 수 있습니다.");
    return;
  }
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  state.coachQuickAdd = {
    date: button.dataset.date,
    day: button.dataset.day,
    time: button.dataset.time,
    coachRoleId: button.dataset.coachRoleId,
    coachName: coach.name,
    kind: bookingEntitlement ? "makeup" : "regular",
    durationMinutes: bookingEntitlement ? targetDuration : 20,
    ticketId: bookingEntitlement?.ticketId || "",
    makeupEntitlementId: bookingEntitlement?.id || "",
    makeupSnapshot: bookingEntitlement ? state.bookingMakeupSnapshot : "",
    operationKey: bookingEntitlement ? state.bookingMakeupOperationKey : "",
    submitting: false,
    note: "",
    validationMessage: "",
  };
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function openMakeupApprovalModal(id) {
  state.editingLessonId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  state.editingMakeupId = id || ownPendingMakeupRequests()[0]?.id || "__none__";
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function openLessonRecordWriter(id) {
  const firstLesson = recordableCoachLessons()[0];
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.viewingCurriculumId = null;
  state.writingLessonId = id || firstLesson?.id || "__none__";
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

async function completeLessonFromModal(id) {
  const lesson = ensureCoachLessonRecord(id);
  if (!lesson || !canProcessLesson(lesson) || lesson.completionSubmitting) return;
  const feedbackParticipantCount = completionParticipantsForLesson(lesson).filter(lessonParticipantNeedsFeedback).length;
  if (feedbackParticipantCount > 1 && state.groupFeedbackReviewLessonId !== id) {
    reviewGroupLessonFeedback(id);
    return;
  }
  if (!lessonOutcomeWindowOpen(lesson)) {
    lesson.validationMessage = lessonOutcomeGuardMessage();
    renderLessonEditModal();
    return;
  }
  const content = `${lesson.member} ${lesson.type} 수업 진행`;
  const participantResults = captureLessonChartDraft(id);
  const primaryResult = participantResults[0] || {};
  const existingLog = state.lessonLogs.find((item) => item.serverLessonId && item.serverLessonId === lesson.serverLessonId && item.status !== "확인 완료");
  const logId = existingLog?.id || `coach-complete-${Date.now()}`;
  const log = existingLog || {
    id: logId,
    serverLessonId: lesson.serverLessonId || "",
    serverJournalId: "",
    member: lesson.member,
    lesson: `${lesson.day} ${lesson.time} ${lesson.type}`,
    content,
    selfMemo: "회원 운동노트 미작성이어도 코치가 기록/차감 확인을 진행했습니다.",
    curriculumId: primaryResult.nextCurriculumId || "",
    nextCurriculumId: primaryResult.nextCurriculumId || "",
    coachComment: primaryResult.coachComment || "",
    participantResults,
    validationMessage: "",
    status: "확인 대기",
    curriculumRegistered: false,
    ticketDeducted: false,
  };
  Object.assign(log, {
    content,
    curriculumId: primaryResult.nextCurriculumId || "",
    nextCurriculumId: primaryResult.nextCurriculumId || "",
    coachComment: primaryResult.coachComment || "",
    participantResults,
    validationMessage: "",
  });
  const usesV2Participants = Array.isArray(lesson.v2Participants) && lesson.v2Participants.length > 0;
  const missingParticipant = participantResults.find((result) => (
    !result.coachComment
    || !result.nextCurriculumId
    || (usesV2Participants && (!result.userId || !result.ticketId))
  ));
  if (!participantResults.length || missingParticipant) {
    lesson.validationMessage = missingParticipant
      ? `${missingParticipant.name} 회원의 코치 코멘트와 다음 커리큘럼을 입력해 주세요.`
      : "수업 참여자와 회원권 연결을 확인해 주세요.";
    renderLessonEditModal();
    return;
  }
  const invalidParticipant = participantResults
    .map((result) => ({
      name: result.name,
      message: coachCommentValidationMessage({
        id: `${logId}:${result.userId}:${result.ticketId}`,
        member: result.name,
        coachComment: result.coachComment,
      }),
    }))
    .find((result) => result.message);
  if (invalidParticipant) {
    lesson.validationMessage = `${invalidParticipant.name}: ${invalidParticipant.message}`;
    renderLessonEditModal();
    return;
  }
  if (!existingLog) state.lessonLogs.unshift(log);
  lesson.validationMessage = "";
  lesson.completionSubmitting = true;
  const submit = activeViewField(`[data-complete-lesson-from-modal="${id}"]`);
  if (submit) {
    submit.disabled = true;
    submit.textContent = "저장 중";
  }
  const completed = await confirmLog(log.id, { skipDraft: true });
  lesson.completionSubmitting = false;
  if (!completed) {
    lesson.validationMessage = log.validationMessage || "완료 처리에 실패했습니다. 같은 화면에서 다시 시도해 주세요.";
    renderLessonEditModal();
    return;
  }
  delete state.lessonChartDrafts?.[id];
  state.groupFeedbackReviewLessonId = "";
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#lessonEditModal");
  state.todayTaskTab = "lessons";
  state.focusedLogId = "";
  closeLessonEditor();
  renderAll();
  setView("todayView");
}

function filterCurriculumOptions(input) {
  const select = input?.closest("label")?.querySelector("select");
  if (!select) return;
  const selectedId = select.value || "";
  select.innerHTML = `<option value="">검색·선택</option>${curriculumOptions(selectedId, input.value, true)}`;
  if ([...select.options].some((option) => option.value === selectedId)) select.value = selectedId;
  renderCoachCurriculumSuggestions(input);
  updateCoachCurriculumDetailLink(input);
}

function openCurriculumDetail(id) {
  state.viewingCurriculumId = id;
  state.editingLessonId = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
}

function toggleCurriculumFavorite(id) {
  const favorites = new Set(state.favoriteCurriculums || []);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  state.favoriteCurriculums = [...favorites];
  renderCurriculums();
  saveSnapshot();
}

async function openCoachExternalPortal(kind = "coach") {
  const adminRequested = kind === "admin";
  if (adminRequested && state.coach?.role !== "admin") {
    showToast("관리자 권한이 있는 계정에서만 열 수 있습니다.");
    return;
  }
  const targetUrl = adminRequested ? adminWebPortalUrl : coachWebPortalUrl;
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    showToast("웹 화면 주소를 확인하지 못했습니다.");
    return;
  }
  const allowedOrigins = new Set([
    "https://tennisnote-app.pages.dev",
    "https://tennisnote-admin.pages.dev",
  ]);
  if (!allowedOrigins.has(parsedUrl.origin)) {
    showToast("허용되지 않은 웹 화면 주소입니다.");
    return;
  }
  try {
    const browserPlugin = window.Capacitor?.Plugins?.Browser;
    if (nativeCoachAppPlatform() !== "web" && browserPlugin?.open) {
      await browserPlugin.open({ url: parsedUrl.href });
      return;
    }
    const opened = window.open(parsedUrl.href, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(parsedUrl.href);
  } catch {
    showToast("웹 화면을 열지 못했습니다. 네트워크를 확인해 주세요.");
  }
}
