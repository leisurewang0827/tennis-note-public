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
  const notice = activeNotices.find((item) => (
    !noticeSessionSeenIds.has(noticeAcknowledgementIdentity(item))
    && !window.TennisNoteRuntimeEnvironment?.hasNoticeAcknowledgement?.(item, "coach")
    && !(item.showOncePerDay && hiddenToday.has(item.id))
  ));
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
  void syncCoachSettlementFromServer();
  void syncCoachSettlementHistoryFromServer();
}

function closeCoachSettlementModal() {
  resetCoachSettlementHistory();
  renderCoachSettlementHistory();
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
  renderLessonEditModal();
  openCoachModal("lessonEditModal");
  (completionParticipantsForLesson(lesson) || []).forEach((participant) => {
    if (participant.userId) void syncCoachMemberChart(participant.userId, participant.name || "회원");
  });
}

function closeLessonEditor(fromHistory = false) {
  const lesson = state.editingLessonId ? ensureCoachLessonRecord(state.editingLessonId) : null;
  if (lesson) delete lesson.scheduleEditDraft;
  state.editingLessonId = null;
  state.coachQuickAdd = null;
  state.editingMakeupId = null;
  state.writingLessonId = null;
  state.viewingCurriculumId = null;
  closeCoachModal("lessonEditModal", fromHistory);
}

function requestCloseLessonEditor() {
  const modal = $("#lessonEditModal");
  if (!modal || modal.hidden) return false;
  const closeTrigger = $("#lessonEditModal .lesson-completion-actions [data-cancel-schedule-edit]")
    || $("#lessonEditModal .lesson-detail-sheet-close")
    || $("#lessonEditModal [data-close-lesson-modal]");
  if (!closeTrigger?.isConnected) return false;
  closeTrigger.click();
  return true;
}

function coachReleasedAbsenceStatus(entitlementId, now = Date.now()) {
  const slot = state.releasedMakeupSlots.find(s => s.entitlementId === entitlementId);
  const entitlement = state.makeupEntitlements.find(e => e.id === entitlementId);
  if (!slot || !entitlement || !["open","booked"].includes(entitlement.status) || !canProcessLesson(slot)) {
    return { message:"불참 수업의 최신 상태와 담당 코치를 확인해 주세요." };
  }
  if (entitlement.futureLegacyAbsence === true && (slot.futureLegacyAbsence !== true
    || !coachPastAbsenceProofCurrent(entitlement.pastAbsenceProof, entitlement, slot)
    || slot.branchId !== entitlement.branchId || slot.sourceLessonId !== entitlement.sourceLessonId
    || slot.coachRoleId !== entitlement.coachRoleId || slot.lessonDate !== entitlement.originalDate
    || slot.time !== entitlement.originalTime || slot.durationMinutes !== entitlement.durationMinutes)) {
    return { message:"불참 수업의 최신 상태와 담당 코치를 확인해 주세요." };
  }
  const date = String(slot.lessonDate || "");
  const time = String(slot.time || "").slice(0,5);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? Date.parse(`${date}T${time}:00+09:00`) : NaN;
  if (slot.historicalReleasedSlot || !Number.isFinite(start) || start <= now) return { message:"이미 시작했거나 지난 수업입니다." };
  const a = minutesFromTime(time), duration = Number(slot.durationMinutes);
  if (!Number.isFinite(a) || !Number.isSafeInteger(duration) || duration <= 0) return { message:"원래 수업 시간을 확인할 수 없습니다." };
  const occupied = state.liveLessons.some(other => {
    if (other.lessonDate !== date || other.coachRoleId !== slot.coachRoleId) return false;
    const b = minutesFromTime(other.time);
    return a < b + lessonDuration(other) && b < a + duration;
  });
  if (occupied) return { message:"같은 시간에 이미 다른 수업이 있습니다." };
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find(c => String(c.roleId || c.id) === String(slot.coachRoleId));
  const canAdd = coach && coachSlotAccess(coach, slot.day, time, duration, policy).allowed;
  return { slot, entitlement, canAdd, date, time, duration };
}

function openCoachReleasedAbsenceActions(id, trigger) {
  const start = coachReleasedAbsenceStatus(id);
  if (start.message) { showToast(start.message); return; }
  if (document.querySelector("#coachReleasedAbsenceActions")?.open) return;
  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") { showToast("이 앱에서 불참 상세를 열 수 없습니다."); return; }
  dialog.id = "coachReleasedAbsenceActions";
  dialog.setAttribute("aria-labelledby", "coachReleasedAbsenceTitle");
  dialog.style.cssText = "width:min(100%,28rem);border:1px solid var(--line,GrayText);box-sizing:border-box;padding:16px 16px calc(12px + env(safe-area-inset-bottom));margin:auto auto 0;border-radius:16px 16px 0 0;color:var(--ink,CanvasText);background:var(--paper,Canvas);color-scheme:inherit;max-height:85vh";
  dialog.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 id="coachReleasedAbsenceTitle" style="margin:0;font-size:1.2rem">불참 수업 상세</h2><button type="button" data-absence-close>닫기</button></header>
    <p><strong>${escapeHtml(start.slot.member || "회원")}</strong><br>${escapeHtml(start.date)} · ${escapeHtml(start.time)} · 불참</p>
    ${start.canAdd ? '<button type="button" class="approve-button" data-absence-new aria-describedby="coachReleasedAbsenceReason" style="min-height:44px;width:100%">다른 회원 수업 등록</button>' : '<p id="coachReleasedAbsenceReason" role="status">이 시간에는 다른 회원의 수업을 등록할 수 없습니다.</p>'}
    ${start.canAdd ? '<span id="coachReleasedAbsenceReason" hidden></span>' : ''}
    <details class="coach-absence-manage"><summary>원래 수업 변경</summary>
      <p class="coach-absence-restore-note">수업 시작 전입니다.</p>
      <button type="button" class="approve-button" data-absence-restore style="min-height:44px;width:100%">다시 참석으로 변경</button></details><p data-absence-status role="status"></p>`;
  const message = dialog.querySelector("[data-absence-status]");
  dialog.addEventListener("close",()=>{dialog.remove();if (trigger?.isConnected) trigger.focus();},{once:true});
  dialog.querySelector("[data-absence-close]").onclick=()=>dialog.close();
  dialog.querySelector("[data-absence-restore]").onclick=()=>{
    const current=coachReleasedAbsenceStatus(id);
    if (current.message) { message.textContent=current.message; return; }
    dialog.close();
    void restoreCoachLessonAbsence(id);
  };
  const add=dialog.querySelector("[data-absence-new]");
  if (add) add.onclick=()=>{
    const current=coachReleasedAbsenceStatus(id);
    if (current.message || !current.canAdd) { message.textContent=current.message || "이 시간에는 수업을 등록할 수 없습니다."; return; }
    dialog.close();
    openCoachQuickAdd({dataset:{date:current.date,day:current.slot.day,time:current.time,coachRoleId:current.slot.coachRoleId}});
  };
  (trigger?.closest?.("#r4ScopedCoachApp, .coach-shell") || document.body).append(dialog);
  dialog.showModal();
}

function openCoachPastAbsenceDetail(id, trigger) {
  const context = coachPastAbsenceDetailContext(id);
  if (!context) { showToast("불참 수업의 최신 상태와 담당 코치를 확인해 주세요."); return; }
  if (document.querySelector("#coachPastAbsenceDetail")?.open) return;
  const dialog = document.createElement("dialog");
  if (typeof dialog.showModal !== "function") { showToast("이 앱에서 불참 상세를 열 수 없습니다."); return; }
  dialog.id = "coachPastAbsenceDetail";
  dialog.setAttribute("aria-labelledby", "coachPastAbsenceDetailTitle");
  dialog.setAttribute("aria-describedby", "coachPastAbsenceReason");
  dialog.style.cssText = "width:min(calc(100% - 24px),28rem);border:1px solid var(--line,GrayText);box-sizing:border-box;padding:16px 16px calc(12px + env(safe-area-inset-bottom));margin:auto auto 0;border-radius:16px 16px 0 0;color:var(--ink,CanvasText);background:var(--paper,Canvas);color-scheme:inherit;max-height:85vh;overflow:auto";
  const makeup = context.entitlement.status === "booked" ? "보강 예약됨" : "보강 대기";
  dialog.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 id="coachPastAbsenceDetailTitle" style="margin:0;font-size:1.2rem">불참 수업 상세</h2><button type="button" data-coach-past-absence-close style="min-height:44px;min-width:44px">닫기</button></header>
    <p><strong>${escapeHtml(context.slot.member || "회원")}</strong><br>${escapeHtml(context.date)} · ${escapeHtml(context.time)} · 불참</p>
    <p id="coachPastAbsenceReason">이미 시작했거나 지난 수업입니다.</p>
    <p>보강: ${escapeHtml(makeup)}</p>`;
  const closeButton = dialog.querySelector("[data-coach-past-absence-close]");
  dialog.addEventListener("close", () => {
    dialog.remove();
    const replacement = trigger?.isConnected ? trigger : [...document.querySelectorAll("[data-coach-past-absence-id]")]
      .find(element => element.dataset.coachPastAbsenceId === String(id) && !element.matches(":disabled") && element.getClientRects().length);
    const target = replacement || document.querySelector('button[data-view="fullScheduleView"]');
    target?.focus();
  }, { once: true });
  closeButton.onclick = () => dialog.close();
  (trigger?.closest?.("#r4ScopedCoachApp, .coach-shell") || document.body).append(dialog);
  dialog.showModal();
  closeButton.focus();
}

function openCoachQuickAdd(button) {
  const policy = loadCoachSchedulePolicy();
  const coach = policy.coaches.find((item) => String(item.roleId || item.id) === String(button.dataset.coachRoleId || ""));
  const access = coach ? coachSlotAccess(coach, button.dataset.day, button.dataset.time, scheduleBlockMinutes, policy) : { allowed: false };
  if (!coach || !access.allowed) {
    showToast(access.reason === "holiday_locked"
      ? "휴무일에는 관리자만 수업을 등록할 수 있습니다."
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
    kind: "regular",
    durationMinutes: 20,
    ticketId: "",
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
