// 프로필·NTRP·계정 삭제를 저장하고 요청하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

async function submitAccountDeletionRequest(event) {
  event?.preventDefault?.();
  const message = $("#accountDeletionMessage");
  if (!$("#accountDeletionConfirm")?.checked) {
    if (message) message.textContent = "탈퇴 및 알림 중단 확인에 체크해 주세요.";
    return;
  }

  const client = window.TennisNoteDataClient;
  if (!client?.rpc || !client.getSession?.()?.access_token || !state.member?.profileId) {
    if (message) message.textContent = "회원 로그인과 서버 연결을 확인해 주세요.";
    return;
  }

  try {
    await client.rpc("tn_request_account_deletion", {
      target_reason: $("#accountDeletionReason")?.value?.trim() || "",
    });
    await syncMemberAccountDeletionRequestFromServer();
    window.TennisNoteInputGuard?.markSaved?.("#accountDeletionModal");
    closeAccountDeletionModal();
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("회원 탈퇴 및 데이터 삭제 요청이 접수되었습니다");
  } catch {
    if (message) message.textContent = "요청 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}

async function cancelAccountDeletionRequest() {
  const request = state.accountDeletionRequest;
  const client = window.TennisNoteDataClient;
  if (!request?.id || request.status !== "pending" || !client?.rpc) return;
  if (!window.confirm("회원 탈퇴 및 데이터 삭제 요청을 취소할까요?")) return;
  try {
    await client.rpc("tn_cancel_account_deletion", { target_request_id: request.id });
    await syncMemberAccountDeletionRequestFromServer();
    await syncNativePushRegistration(null, false).catch(() => false);
    renderAccountDeletionSettings();
    renderPushNotificationSettings();
    saveSnapshot();
    showToast("탈퇴 요청을 취소했습니다");
  } catch {
    showToast("검토가 시작된 요청은 앱에서 취소할 수 없습니다");
  }
}

function handleProfilePhotoChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.profile.photoDataUrl = String(reader.result || "");
    renderProfile();
    saveSnapshot();
  };
  reader.readAsDataURL(file);
}

function removeProfilePhoto() {
  state.profile.photoDataUrl = "";
  if ($("#profilePhotoInput")) $("#profilePhotoInput").value = "";
  renderProfile();
  saveSnapshot();
}

async function updateMemberProfileOnServer(values = {}) {
  const client = window.TennisNoteDataClient;
  const profileId = state.member?.profileId || "";
  if (!client?.readiness?.().ready || !client.updateRows || !profileId) return { skipped: true };
  try {
    const rows = await client.updateRows("tn_users", { id: profileId }, {
      ...values,
      updated_at: new Date().toISOString(),
    });
    if (!Array.isArray(rows) || !rows[0]?.id) throw new Error("profile_update_not_confirmed");
    return { ok: true, profile: rows[0] };
  } catch (error) {
    return { ok: false, error };
  }
}

async function saveProfileInfo() {
  try {
    await persistIdentityProfile({
      realName: $("#profileRealNameInput")?.value,
      nickname: $("#profileNicknameInput")?.value,
      phone: $("#profilePhoneInput")?.value,
      birthYear: state.profile.birthYear || state.member?.birthYear,
      neighborhood: state.profile.neighborhood || state.member?.neighborhood,
      gender: state.profile.gender || state.member?.gender,
    });
    setNicknameStatus("profileNicknameStatus", "실명과 닉네임을 확인했습니다.", "available");
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    setNicknameStatus("profileNicknameStatus", errorMessage, "unavailable");
    showToast(errorMessage);
    return;
  }
  state.profile.hand = $("#profileHand")?.value || state.profile.hand;
  state.profile.backhand = $("#profileBackhand")?.value || state.profile.backhand;
  state.profile.startedAt = $("#profileStartedAt")?.value || "";
  state.profile.goal = $("#profileGoal")?.value.trim() || "";
  state.profile.styleMemo = $("#profileStyleMemo")?.value.trim() || "";
  state.profile.selfNtrp = $("#profileSelfNtrp")?.value || state.profile.selfNtrp;
  state.profile.ntrpSurvey = collectNtrpSurvey().answers;
  const serverResult = await updateMemberProfileOnServer({
    profile_photo_url: state.profile.photoDataUrl || null,
    dominant_hand: state.profile.hand || null,
    backhand_style: state.profile.backhand || null,
    tennis_started_on: state.profile.startedAt || null,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
    self_ntrp: Number(state.profile.selfNtrp) || null,
    ntrp_survey: state.profile.ntrpSurvey || {},
  });
  if (serverResult.ok === false) {
    state.ticketHistory.unshift({ text: "내 정보 서버 저장 실패 · 연결 확인 필요", tone: "alert" });
    renderProfile();
    renderTickets();
    saveSnapshot();
    showToast("서버 저장에 실패했습니다. 다시 시도해주세요.");
    return;
  }
  state.ticketHistory.unshift({ text: "내 정보와 테니스 스타일 저장 완료", tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#profileEditorSheet");
  closeAppSheet("profileEditorSheet");
}

async function requestNtrpCheck() {
  const survey = collectNtrpSurvey();
  state.profile.ntrpCheckRequested = true;
  state.profile.ntrpSurvey = survey.answers;
  state.profile.selfNtrp = survey.level;
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  const requestedAt = new Date().toISOString();
  const serverResult = await updateMemberProfileOnServer({
    self_ntrp: Number(survey.level),
    ntrp_survey: survey.answers,
    ntrp_requested_at: requestedAt,
    tennis_goal: state.profile.goal || null,
    play_style_memo: state.profile.styleMemo || null,
  });
  exportNtrpRequest(survey);
  state.ticketHistory.unshift({
    text: serverResult.ok === false ? "수준 확인 요청 전송 실패 · 다시 시도 필요" : "코치에게 수준 확인 요청 완료",
    tone: serverResult.ok === false ? "alert" : "wait",
  });
  renderProfile();
  renderTickets();
  saveSnapshot();
}
