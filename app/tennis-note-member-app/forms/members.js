// members 관련 함수들.
//
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function syncMemberVisualViewport() {
  const { height, offsetTop } = memberViewportGeometry();
  document.documentElement.style.setProperty("--tn-visual-viewport-height", `${height}px`);
  document.documentElement.style.setProperty("--tn-visual-viewport-offset-top", `${offsetTop}px`);
  document.documentElement.style.setProperty("--tn-sheet-viewport-height", `${Math.round(height * 0.86)}px`);
}

async function refreshMemberRuntimeDiagnostics() {
  const platform = nativeAppPlatform();
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (platform !== "web" && appPlugin?.getInfo) {
    try {
      const info = await appPlugin.getInfo();
      memberNativeAppInfo = {
        platform,
        version: String(info?.version || ""),
        build: String(info?.build || ""),
      };
    } catch {
      memberNativeAppInfo = { platform, version: "", build: "" };
    }
  }
  renderMemberRuntimeDiagnostics();
}

function mergeMemberScheduleWindows(windows) {
  return windows
    .map((window) => ({ ...window, startMinutes: minutesFromTime(window.start), endMinutes: minutesFromTime(window.end) }))
    .filter((window) => window.startMinutes < window.endMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes)
    .reduce((merged, window) => {
      const previous = merged.at(-1);
      if (!previous || window.startMinutes > previous.endMinutes) {
        merged.push({ ...window });
      } else {
        previous.endMinutes = Math.max(previous.endMinutes, window.endMinutes);
        previous.end = `${String(Math.floor(previous.endMinutes / 60)).padStart(2, "0")}:${String(previous.endMinutes % 60).padStart(2, "0")}`;
      }
      return merged;
    }, []);
}

function setEnrollmentInputValue(selector, value = "") {
  const input = $(selector);
  if (input) input.value = value ?? "";
}

function runMemberHelpAction(action) {
  closeMemberHelpModal();
  window.setTimeout(() => {
    if (action === "schedule" || action === "shop") {
      navigateMemberView(action === "schedule" ? "scheduleView" : "shopView");
      jumpToTop();
      return;
    }
    if (action === "notification") {
      navigateMemberView("profileView");
      $("#pushNotificationButton")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (action === "refresh") {
      $("#memberRefreshButton")?.click();
      return;
    }
    if (action === "support") openKakaoInquiryModal();
  }, 80);
}

async function refreshSelectedMemberScheduleWeek() {
  if (state.dataMode !== "live" || !state.member?.profileId) {
    renderSelectedMemberScheduleWeek();
    return false;
  }
  const requestId = ++memberScheduleV2RequestSequence;
  const week = { ...activeMemberWeek() };
  const context = memberScheduleV2Context(state.profile, week);
  memberScheduleV2WorkspaceCache = null;
  state.scheduleV2SyncStatus = "loading";
  state.scheduleV2TargetKey = context.key;
  state.scheduleV2SyncError = "";
  state.scheduleV2SyncErrorCode = "";
  renderSelectedMemberScheduleWeek();
  try {
    const synced = await syncMemberLessonsFromServer(state.profile, { force: true, requestId, week });
    if (requestId !== memberScheduleV2RequestSequence || memberScheduleV2Context().key !== context.key) return false;
    state.scheduleV2SyncStatus = synced ? "ready" : "error";
    if (synced) state.scheduleV2LoadedKey = context.key;
    renderSelectedMemberScheduleWeek();
    if (state.memberScheduleMode === "availability" || !$("#changeRequestModal")?.hidden) {
      const source = currentScheduledLessonsForChange().find((lesson) => (
        lesson.id === (state.selectedMemberChangeSourceId || $("#absenceLesson")?.value)
      ));
      if (synced || source?.couponBooking) await syncMemberChangeCandidates(source);
    }
    saveSnapshot();
    return synced;
  } catch (_error) {
    if (requestId !== memberScheduleV2RequestSequence) return false;
    state.scheduleV2SyncStatus = "error";
    state.scheduleV2SyncError = "시간표를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
    renderSelectedMemberScheduleWeek();
    const source = currentScheduledLessonsForChange().find((lesson) => (
      lesson.id === (state.selectedMemberChangeSourceId || $("#absenceLesson")?.value)
    ));
    if (source?.couponBooking && (state.memberScheduleMode === "availability" || !$("#changeRequestModal")?.hidden)) {
      await syncMemberChangeCandidates(source);
      renderSelectedMemberScheduleWeek();
    }
    return false;
  }
}

async function editMemberChangeRequest(requestId) {
  const request = state.makeupRequests.find((item) => (
    String(item.serverRequestId || item.id || "") === String(requestId || "")
    && item.rawStatus === "pending"
  ));
  if (!request) {
    showToast("수정할 승인 대기 요청을 찾지 못했습니다. 새로고침 후 다시 확인해 주세요.");
    return;
  }
  state.editingChangeRequestId = request.serverRequestId;
  const source = [
    ...memberScheduleLessons(),
    ...loadedFutureScheduledLessonsForChange(),
    ...(state.liveLessons || []),
  ].find((lesson) => (
    isOwnMemberScheduleLesson(lesson)
    && String(lesson.serverLessonId || "") === String(request.lessonId || "")
  ));
  if (!source) {
    state.editingChangeRequestId = "";
    showToast("원래 수업을 찾지 못했습니다. 시간표를 새로고침해 주세요.");
    return;
  }
  closeAppModal("requestHistoryModal");
  if ($("#changeReason")) $("#changeReason").value = request.reason || "";
  await openChangeRequestModal(source.id, { editing: true });
}

function setNicknameStatus(targetId, message, tone = "") {
  const target = $(`#${targetId}`);
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-available", tone === "available");
  target.classList.toggle("is-unavailable", tone === "unavailable");
}

function setIdentityPhoneStatus(message, tone = "") {
  const target = $("#identityPhoneStatus");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("is-verified", tone === "verified");
  target.classList.toggle("is-error", tone === "error");
}

function resetIdentityPhoneVerification(message = "휴대전화 인증이 필요합니다.") {
  identityPhoneVerification = { phone: "", status: "unverified", source: "" };
  if ($("#identityPhoneCode")) $("#identityPhoneCode").value = "";
  if ($("#identityPhoneCodeRow")) $("#identityPhoneCodeRow").hidden = true;
  if ($("#identityPhoneSendButton")) $("#identityPhoneSendButton").disabled = false;
  setIdentityPhoneStatus(message);
}

function markIdentityPhoneVerified(phone, source = "sms") {
  const normalizedPhone = normalizeIdentityPhone(phone);
  identityPhoneVerification = { phone: normalizedPhone, status: "verified", source };
  if ($("#identityPhone")) $("#identityPhone").value = formatIdentityPhone(normalizedPhone);
  if ($("#identityPhoneCodeRow")) $("#identityPhoneCodeRow").hidden = true;
  if ($("#identityPhoneSendButton")) $("#identityPhoneSendButton").disabled = true;
  setIdentityPhoneStatus(
    source === "provider"
      ? "로그인 제공자가 확인한 번호입니다. 기존 회원 DB 연결에 사용합니다."
      : "휴대전화 인증이 완료되었습니다. 기존 회원 DB 연결에 사용합니다.",
    "verified",
  );
}

function populateIdentitySetup(user = null) {
  const realName = state.profile.name === "가입 확인 중" ? "" : state.profile.name || "";
  const suggestedNickname = state.profile.nickname || state.profile.suggestedNickname || suggestedNicknameFromUser(user);
  const providerPhone = verifiedPhoneFromAuthUser(user || {});
  const initialPhone = providerPhone || state.profile.phone || "";
  if ($("#identityRealName")) $("#identityRealName").value = realName;
  if ($("#identityNickname")) $("#identityNickname").value = suggestedNickname;
  if ($("#identityPhone")) $("#identityPhone").value = formatIdentityPhone(initialPhone);
  if ($("#identityBirthYear")) $("#identityBirthYear").value = state.profile.birthYear || state.member?.birthYear || "";
  if ($("#identityNeighborhood")) $("#identityNeighborhood").value = state.profile.neighborhood || state.member?.neighborhood || "";
  if ($("#identityGender")) $("#identityGender").value = state.profile.gender || state.member?.gender || "";
  if ($("#identityTermsConsent")) {
    $("#identityTermsConsent").checked = state.profile.termsConsentVersion === identityTermsVersion;
  }
  if ($("#identityPrivacyConsent")) {
    $("#identityPrivacyConsent").checked = state.profile.privacyConsentVersion === identityPrivacyVersion;
  }
  if ($("#identityMarketingPush")) $("#identityMarketingPush").checked = state.profile.marketingPushConsent === true;
  if ($("#identityMarketingSms")) $("#identityMarketingSms").checked = state.profile.marketingSmsConsent === true;
  if ($("#identityMarketingEmail")) $("#identityMarketingEmail").checked = state.profile.marketingEmailConsent === true;
  const naverPhoneButton = $("#identityNaverPhoneButton");
  if (naverPhoneButton) {
    naverPhoneButton.hidden = Boolean(providerPhone) || !authUserHasProvider(user || {}, "custom:naver");
    naverPhoneButton.disabled = false;
  }
  setNicknameStatus("identityNicknameStatus", "닉네임은 모든 회원 사이에서 중복될 수 없습니다.");
  if (providerPhone) markIdentityPhoneVerified(providerPhone, "provider");
  else if (authUserHasProvider(user || {}, "custom:naver")) {
    resetIdentityPhoneVerification("네이버 번호를 다시 받거나 문자 인증 후 기존 회원 DB와 연결합니다.");
  } else resetIdentityPhoneVerification("휴대전화 인증 후 기존 회원 DB와 안전하게 연결합니다.");
  if ($("#identitySetupMessage")) $("#identitySetupMessage").textContent = "";
}

function setMemberSessionRestoring(restoring) {
  const indicator = $("#memberSessionRestoring");
  document.body.classList.toggle("member-session-restoring", restoring);
  if (indicator) indicator.hidden = !restoring;
}

function activeMemberViewId() {
  return $(".view.is-active")?.id || "homeView";
}

function installMemberLiveScheduleRefresh() {
  if (memberLiveScheduleRefreshTimer) return;
  const refresh = () => refreshMemberLiveSchedule().catch(() => false);
  const forceRefresh = () => refreshMemberLiveSchedule({ force: true }).catch(() => false);
  window.addEventListener("focus", forceRefresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) forceRefresh();
  });
  memberLiveScheduleRefreshTimer = window.setInterval(refresh, 60_000);
}

function installMemberScheduleRevisionWatcher() {
  if (memberScheduleRevisionWatcher || !window.TennisNoteScheduleRevision?.watch) return;
  memberScheduleRevisionWatcher = window.TennisNoteScheduleRevision.watch({
    branchId: memberRevisionBranchId,
    active: () => !$("#appScreen")?.hidden,
    onChange: async () => {
      memberScheduleV2WorkspaceCache = null;
      memberLiveScheduleLastRefreshAt = 0;
      await refreshMemberLiveSchedule({ force: true, render: true });
    },
  });
}

function installMemberConnectivityStatus() {
  renderMemberConnectivityStatus(false);
  window.addEventListener("offline", () => renderMemberConnectivityStatus(false));
  window.addEventListener("online", () => {
    memberScheduleV2WorkspaceCache = null;
    memberLiveScheduleLastRefreshAt = 0;
    void refreshMemberLiveSchedule({ force: true, render: true }).finally(() => {
      renderMemberConnectivityStatus(true);
    });
  });
}
