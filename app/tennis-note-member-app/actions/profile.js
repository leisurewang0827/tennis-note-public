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

async function readSavedSelfProfileExactly(client, owner, targetProfile, values, saved) {
  const token = client?.getSession?.()?.access_token || "";
  const contextIsCurrent = () => window.TennisNoteDataClient === client
    && token && token === (client.getSession?.()?.access_token || "")
    && phoneVerificationOwnerCurrent(owner);
  if (!contextIsCurrent() || typeof client.selectRows !== "function") throw new Error("profile_durable_readback_unconfirmed");
  const keys = Object.keys(values).filter((key) => key !== "ntrp_requested");
  const select = [...new Set(["id", "name", "nickname", "phone", "role", "status", "updated_at",
    "ntrp_requested_at", ...keys])].join(",");
  const expectedRole = String(state.member?.role || "");
  const expectedStatus = String(state.member?.status || "");
  // RPC 반환을 저장 증거로 대체하지 않습니다. exact self 행만 새 네트워크
  // 조회하며 오프라인 캐시/자동 Auth 재시도/다른 프로필 fallback을 금지합니다.
  const rows = await client.selectRows("tn_users", { select, filters: { id: owner.profileId },
    limit: 2, requireFresh: true, requireCurrentSession: true, retryAuth: false });
  if (!contextIsCurrent() || (targetProfile && !phoneVerificationRequestCurrent(owner, targetProfile.phone, "profile")))
    throw new Error("profile_phone_context_changed");
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  const revisionKey = (value) => {
    const text = String(value || "");
    const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(text);
    return parts && Number.isFinite(Date.parse(text)) ? parts[1] + "." + (parts[2] || "").padEnd(6, "0") + "Z" : "";
  };
  const savedRevision = revisionKey(saved.profile.updated_at);
  const rowRevision = revisionKey(row?.updated_at);
  if (!row || row.id !== owner.profileId || !savedRevision || rowRevision !== savedRevision
    || (expectedRole && row.role !== expectedRole) || (expectedStatus && row.status !== expectedStatus)
    || normalizeIdentityPhone(row.phone || "") !== normalizeIdentityPhone(saved.profile.phone || "")
    || normalizeIdentityText(row.name) !== normalizeIdentityText(saved.profile.name)
    || normalizeIdentityText(row.nickname) !== normalizeIdentityText(saved.profile.nickname)
    || Object.keys(values).some((key) => key === "ntrp_requested"
      ? !row.ntrp_requested_at || row.ntrp_requested_at !== saved.profile.ntrp_requested_at
      : key === "ntrp_survey"
        ? JSON.stringify(Object.entries(row[key] || {}).sort()) !== JSON.stringify(Object.entries(values[key] || {}).sort())
        : row[key] !== values[key])) throw new Error("profile_durable_readback_unconfirmed");
  return row;
}

async function updateMemberProfileOnServer(values = {}, identity = null) {
  const client = window.TennisNoteDataClient;
  const owner = identity ? profilePhoneEditorOwner : phoneVerificationOwner();
  try {
    if (!hasLiveMemberSession() || !client?.rpc || !owner?.profileId || !phoneVerificationOwnerCurrent(owner)) throw new Error("login_required");
    const allowed = ["profile_photo_url", "dominant_hand", "backhand_style", "tennis_started_on", "tennis_goal", "play_style_memo", "self_ntrp", "ntrp_survey", "ntrp_requested"];
    if (!Object.keys(values).length || Object.keys(values).some((key) => !allowed.includes(key))) throw new Error("profile_style_input_invalid");
    const expectedPhone = identity ? profilePhoneExpectedPhone : normalizeIdentityPhone(state.profile.phone || "");
    const expectedRevision = identity ? owner.revision : state.profile.serverRevision;
    const targetProfile = { ...(identity || { name: state.profile.name, nickname: state.profile.nickname, phone: expectedPhone }), ...values };
    if (!expectedRevision) throw new Error("profile_revision_required");
    if (identity && !phoneVerificationRequestCurrent(owner, targetProfile.phone, "profile")) throw new Error("profile_phone_context_changed");
    // Keep exact request/revision in memory for response-loss replay. Never
    // infer a successful PATCH or create a new key merely because time passed.
    const fingerprint = JSON.stringify([owner.authId, owner.profileId, expectedPhone, expectedRevision, targetProfile]);
    if (selfProfileStyleOperation.fingerprint !== fingerprint) selfProfileStyleOperation = {
      fingerprint, key: crypto.randomUUID(), parameters: null,
    };
    selfProfileStyleOperation.parameters ||= {
      target_profile_id: owner.profileId, target_profile: { ...targetProfile, expected_revision: expectedRevision },
      target_expected_phone: expectedPhone, target_operation_key: selfProfileStyleOperation.key,
    };
    const raw = await client.rpc("tn_save_my_verified_profile_phone", selfProfileStyleOperation.parameters);
    if (!phoneVerificationOwnerCurrent(owner) || (identity && !phoneVerificationRequestCurrent(owner, targetProfile.phone, "profile"))) throw new Error("profile_phone_context_changed");
    const saved = Array.isArray(raw) ? raw[0] : raw;
    if (!saved?.ok || saved.profileContract !== "atomic-self-profile/1" || saved.styleSaved !== true
      || saved.profile?.id !== owner.profileId || !saved.profile.updated_at
      || normalizeIdentityPhone(saved.profile.phone || "") !== normalizeIdentityPhone(targetProfile.phone)
      || normalizeIdentityText(saved.profile.name) !== normalizeIdentityText(targetProfile.name)
      || normalizeIdentityText(saved.profile.nickname) !== normalizeIdentityText(targetProfile.nickname)
      || (targetProfile.phone !== expectedPhone && saved.phoneVerified !== true)
      || Object.keys(values).some((key) => key === "ntrp_requested" ? !saved.profile.ntrp_requested_at
        : key === "ntrp_survey" ? JSON.stringify(Object.entries(saved.profile[key] || {}).sort()) !== JSON.stringify(Object.entries(values[key]).sort())
          : saved.profile[key] !== values[key])) throw new Error("profile_atomic_readback_unconfirmed");
    const durableProfile = await readSavedSelfProfileExactly(client, owner, identity ? targetProfile : null, values, saved);
    saved.profile = { ...saved.profile, ...durableProfile };
    applySavedIdentity(saved.profile, { preserveCompletion: true });
    const profile = saved.profile;
    const savedValues = {
      profile_photo_url: ["photoDataUrl", profile.profile_photo_url || ""],
      dominant_hand: ["hand", profile.dominant_hand || ""], backhand_style: ["backhand", profile.backhand_style || ""],
      tennis_started_on: ["startedAt", profile.tennis_started_on || ""],
      tennis_goal: ["goal", profile.tennis_goal || ""], play_style_memo: ["styleMemo", profile.play_style_memo || ""],
      self_ntrp: ["selfNtrp", profile.self_ntrp == null ? "" : String(profile.self_ntrp)],
      ntrp_survey: ["ntrpSurvey", profile.ntrp_survey || {}],
      ntrp_requested: ["ntrpCheckRequested", Boolean(profile.ntrp_requested_at)],
    };
    // NTRP처럼 일부 항목만 저장할 때 관련 없는 로컬 사진·스타일 초안은 유지한다.
    Object.keys(values).forEach((key) => { const [field, value] = savedValues[key]; state.profile[field] = value; });
    return saved;
  } catch (error) {
    return { ok: false, error };
  }
}

function profileSaveErrorMessage(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (/readback_unconfirmed|context_changed|Failed to fetch|NetworkError|timeout/i.test(message)
    || code === "server_connection_failed" || [408, 502, 503, 504].includes(Number(error?.status)) || error instanceof TypeError)
    return "저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 연결을 확인한 후 같은 내용으로 다시 확인해 주세요.";
  if (/profile_revision|profile_operation_superseded/.test(message)) return "서버 정보가 바뀌었거나 확인되지 않았습니다. 입력을 유지한 채 최신 정보를 확인해 주세요.";
  if (/profile_style_input_invalid/.test(message)) return "운동정보의 항목과 길이를 확인해 주세요. 변경 내용은 저장되지 않았습니다.";
  if (code === "42501" || /permission denied/.test(message)) return "저장 권한을 확인하지 못했습니다. 입력은 유지됩니다. 관리자에게 문의해 주세요.";
  if (/profile_phone_input_invalid|PGRST202/.test(message + code)) return "서버 저장 계약이 아직 준비되지 않았습니다. 입력은 유지됩니다.";
  return identityErrorMessage(error);
}

function lockProfileMutationControls() {
  const controls = ["#saveProfileInfo", "#requestNtrpCheck"].map((selector) => $(selector)).filter(Boolean)
    .map((field) => ({ field, disabled: field.disabled }));
  controls.forEach(({ field }) => { field.disabled = true; });
  return () => controls.forEach(({ field, disabled }) => { field.disabled = disabled; });
}

let profileSaveErrorToast = null;

async function saveProfileInfo() {
  if (profileInfoSaving || ntrpCheckSaving) return false;
  // showToast는 같은 문구라도 새 Text 노드를 만듭니다. 그 노드가 유지된 오류만 이 작업 소유입니다.
  if (profileSaveErrorToast && profileSaveErrorToast.element === $("#appToast")
    && profileSaveErrorToast.textNode && profileSaveErrorToast.element?.firstChild === profileSaveErrorToast.textNode
    && profileSaveErrorToast.element.childNodes.length === 1
    && profileSaveErrorToast.element?.textContent === profileSaveErrorToast.message) {
    profileSaveErrorToast.element.classList.remove("is-visible");
    profileSaveErrorToast.element.textContent = "";
  }
  profileSaveErrorToast = null;
  profileInfoSaving = true;
  const unlockControls = lockProfileMutationControls();
  const identityFields = ["#profileRealNameInput", "#profileNicknameInput", "#profilePhoneInput"]
    .map((selector) => $(selector)).filter(Boolean).map((field) => ({ field, readOnly: field.readOnly }));
  // readonly keeps values in the ordinary draft/input-guard snapshot. Disabled
  // fields disappear from that snapshot and cause a false unsaved prompt.
  identityFields.forEach(({ field }) => { field.readOnly = true; });
  try { return await saveProfileInfoOnce(); }
  finally {
    identityFields.forEach(({ field, readOnly }) => { field.readOnly = readOnly; });
    profileInfoSaving = false;
    unlockControls();
  }
}

async function requestNtrpCheck() {
  if (profileInfoSaving || ntrpCheckSaving) return false;
  ntrpCheckSaving = true;
  const unlockControls = lockProfileMutationControls();
  const preserveEditorDraft = Boolean($("#profileEditorSheet") && !$("#profileEditorSheet").hidden);
  try {
  const survey = collectNtrpSurvey();
  const serverResult = await updateMemberProfileOnServer({
    self_ntrp: Number(survey.level),
    ntrp_survey: survey.answers,
    ntrp_requested: true,
  });
  if (!serverResult.ok) { showToast(profileSaveErrorMessage(serverResult.error)); return false; }
  if (preserveEditorDraft && phoneVerificationOwnerCurrent(profilePhoneEditorOwner)) {
    profilePhoneEditorOwner = { ...profilePhoneEditorOwner, revision: state.profile.serverRevision };
  }
  if ($("#profileSelfNtrp")) $("#profileSelfNtrp").value = survey.level;
  exportNtrpRequest(survey);
  state.ticketHistory.unshift({
    text: "코치에게 수준 확인 요청 완료",
    tone: "wait",
  });
  // 수준 확인은 열린 실명/번호/스타일 초안을 저장하거나 다시 그리지 않는다.
  if (!preserveEditorDraft) renderProfile();
  renderTickets();
  saveSnapshot();
  return true;
  } finally { ntrpCheckSaving = false; unlockControls(); }
}


async function saveProfileInfoOnce() {
  const profileStyle = {
    profile_photo_url: state.profile.photoDataUrl || null,
    dominant_hand: $("#profileHand")?.value || null,
    backhand_style: $("#profileBackhand")?.value || null,
    tennis_started_on: $("#profileStartedAt")?.value || null,
    tennis_goal: $("#profileGoal")?.value.trim() || null,
    play_style_memo: $("#profileStyleMemo")?.value.trim() || null,
    self_ntrp: Number($("#profileSelfNtrp")?.value) || null,
    ntrp_survey: collectNtrpSurvey().answers,
  };
  try {
    await persistIdentityProfile({
      realName: $("#profileRealNameInput")?.value,
      nickname: $("#profileNicknameInput")?.value,
      phone: $("#profilePhoneInput")?.value,
      birthYear: state.profile.birthYear || state.member?.birthYear,
      neighborhood: state.profile.neighborhood || state.member?.neighborhood,
      gender: state.profile.gender || state.member?.gender,
      profileEditor: true,
      profileStyle,
    });
    setNicknameStatus("profileNicknameStatus", "실명과 닉네임을 확인했습니다.", "available");
  } catch (error) {
    const errorMessage = profileSaveErrorMessage(error);
    setNicknameStatus("profileNicknameStatus", errorMessage, "unavailable");
    showToast(errorMessage);
    const element = $("#appToast");
    profileSaveErrorToast = { element, textNode: element?.firstChild, message: errorMessage };
    return false;
  }
  state.ticketHistory.unshift({ text: "내 정보와 테니스 스타일 저장 완료", tone: "done" });
  renderProfile();
  renderTickets();
  saveSnapshot();
  window.TennisNoteInputGuard?.markSaved?.("#profileEditorSheet");
  closeAppSheet("profileEditorSheet");
  profileSaveErrorToast = null;
  showToast("내 정보와 테니스 스타일을 저장했습니다.");
  return true;
}
