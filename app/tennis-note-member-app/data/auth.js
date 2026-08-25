// 로그인·로그아웃과 신원 정보를 서버와 주고받는 함수들.
//
// 서버(Supabase)에 붙는다. 권한은 여기가 아니라 RLS 정책이 책임진다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function installOAuthReturnStatusReset() {
  const reset = () => {
    window.setTimeout(() => {
      const status = $("#memberEmailLoginStatus");
      if (
        document.hidden
        || !status?.textContent.includes("로그인 화면을 여는 중")
        || !$("#appScreen")?.hidden
        || window.location.hash.includes("access_token=")
        || window.TennisNoteDataClient?.getSession?.()?.access_token
      ) return;
      status.textContent = "로그인이 취소되었습니다. 다시 로그인 수단을 선택해주세요.";
    }, 500);
  };
  window.addEventListener("focus", reset);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reset();
  });
}

function hasLiveMemberSession() {
  const client = window.TennisNoteDataClient;
  return Boolean(client?.readiness?.().ready && client.getSession?.()?.access_token);
}

function markTicketSyncLoginNeeded() {
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    if (hasLiveMemberSession()) {
      state.ticketSyncStatus = {
        tone: "alert",
        text: "서버 회원 연결 확인 필요 · 관리자 승인/회원권 확인",
      };
      return;
    }
    state.ticketSyncStatus = {
      tone: "wait",
      text: "서버 로그인 필요 · 간편 로그인 후 실제 회원권 확인",
    };
    return;
  }
  state.ticketSyncStatus = { tone: "alert", text: "실사용 데이터 연결 설정이 필요합니다" };
}

async function checkNicknameAvailability(inputId, statusId) {
  const nickname = normalizeIdentityText($(`#${inputId}`)?.value || "");
  if (nickname.length < 2 || nickname.length > 20) {
    setNicknameStatus(statusId, "닉네임은 2~20자로 입력해 주세요.", "unavailable");
    return false;
  }
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) {
    setNicknameStatus(statusId, "실사용 로그인 후 중복을 확인할 수 있습니다.", "unavailable");
    return false;
  }
  setNicknameStatus(statusId, "중복 여부를 확인하고 있습니다.");
  try {
    const rawResult = await client.rpc("tn_check_nickname_available", { target_nickname: nickname });
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (result?.available) {
      setNicknameStatus(statusId, "사용할 수 있는 닉네임입니다.", "available");
      return true;
    }
    setNicknameStatus(statusId, identityErrorMessage(result?.reason || "nickname_already_taken"), "unavailable");
    return false;
  } catch (error) {
    setNicknameStatus(statusId, identityErrorMessage(error), "unavailable");
    return false;
  }
}

async function loadIdentityConsentPreferences() {
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) return {};
  const rawResult = await retryTransientNetwork(() => client.rpc("tn_my_consent_preferences"));
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  applyConsentPreferences(result || {});
  return result || {};
}

async function persistConsentPreferences({ marketingPush, marketingSms, marketingEmail }) {
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.rpc) {
    applyConsentPreferences({
      termsVersion: identityTermsVersion,
      termsConsentedAt: new Date().toISOString(),
      privacyVersion: identityPrivacyVersion,
      privacyConsentedAt: new Date().toISOString(),
      marketingPush,
      marketingSms,
      marketingEmail,
    });
    return { ok: true, offlinePreview: true };
  }
  const rawResult = await retryTransientNetwork(() => client.rpc("tn_save_my_consent_preferences", {
    target_terms_version: identityTermsVersion,
    target_privacy_version: identityPrivacyVersion,
    target_terms_consent: true,
    target_privacy_consent: true,
    target_marketing_push: marketingPush === true,
    target_marketing_sms: marketingSms === true,
    target_marketing_email: marketingEmail === true,
  }));
  const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
  if (!result?.ok) throw new Error("consent_update_not_confirmed");
  applyConsentPreferences(result);
  return result;
}

async function persistIdentityProfile({ realName, nickname, phone, birthYear, neighborhood, gender }) {
  const normalizedRealName = normalizeIdentityText(realName);
  const normalizedNickname = normalizeIdentityText(nickname);
  const normalizedPhone = normalizeIdentityPhone(phone);
  const normalizedBirthYear = Number(birthYear) || 0;
  const normalizedNeighborhood = normalizeIdentityText(neighborhood);
  const normalizedGender = String(gender || "");
  if (!normalizedRealName || normalizedRealName.length > 40) throw new Error("real_name_invalid");
  if (normalizedNickname.length < 2 || normalizedNickname.length > 20) throw new Error("nickname_invalid");
  if (!/^01[0-9]{8,9}$/u.test(normalizedPhone)) throw new Error("phone_invalid");
  if (normalizedBirthYear < 1900 || normalizedBirthYear > new Date().getFullYear()) throw new Error("birth_year_invalid");
  if (!["female", "male", "other", "prefer_not"].includes(normalizedGender)) throw new Error("gender_invalid");

  const client = window.TennisNoteDataClient;
  if (hasLiveMemberSession() && client?.rpc) {
    const rawResult = await retryTransientNetwork(() => client.rpc("tn_update_my_identity_profile_v2", {
      target_real_name: normalizedRealName,
      target_nickname: normalizedNickname,
      target_phone: normalizedPhone,
      target_birth_year: normalizedBirthYear,
      target_neighborhood: normalizedNeighborhood,
      target_gender: normalizedGender,
      target_privacy_version: identityPrivacyVersion,
    }));
    const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
    if (!result?.ok || !result?.profile) throw new Error("identity_profile_update_not_confirmed");
    applySavedIdentity(result.profile);
    return result;
  }

  const profile = {
    name: normalizedRealName,
    nickname: normalizedNickname,
    phone: normalizedPhone,
    birth_year: normalizedBirthYear,
    neighborhood: normalizedNeighborhood,
    gender: normalizedGender,
    profile_completed_at: new Date().toISOString(),
    privacy_consent_version: identityPrivacyVersion,
    privacy_consented_at: new Date().toISOString(),
  };
  applySavedIdentity(profile);
  return { ok: true, profile, linkStatus: "offline_preview" };
}

function activateLiveMemberProfile(profileId) {
  const nextProfileId = String(profileId || "");
  const previousProfileId = String(state.liveProfileId || state.member?.profileId || "");
  const sameProfile = Boolean(nextProfileId && previousProfileId === nextProfileId);

  state.dataMode = "live";
  state.liveProfileId = nextProfileId;
  state.demoPresentationVersion = 0;
  if (sameProfile) return;
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.coachModeAllowed = false;
  state.remaining = 0;
  state.profile = {
    ...state.profile,
    name: "",
    nickname: "",
    phone: "",
    profileCompletedAt: "",
    privacyConsentVersion: "",
    privacyConsentedAt: "",
    suggestedNickname: "",
    branch: "",
    mainCoach: "",
    ticket: "현재 이용권 없음",
    photoDataUrl: "",
    hand: "",
    backhand: "",
    startedAt: "",
    goal: "",
    styleMemo: "",
    selfNtrp: "",
    coachNtrp: "측정 전",
    ntrpCheckRequested: false,
  };
  state.makeupRequests = [];
  state.lessonLogs = [];
  state.practiceLogs = [];
  state.paymentRequests = [];
  state.livePaymentOptions = { allowedMethods: ["tosspay"], bankTransferEnabled: false, paymentMethods: [], settingsVersion: 0, features: { threeMonth: true, oneDay: true, coupons: true } };
  state.discountCoupons = [];
  state.expiredTickets = [];
  state.ticketHistory = [];
  state.liveMembershipProducts = [];
  state.liveTickets = [];
  memberScheduleV2WorkspaceCache = null;
  state.liveLessons = [];
  state.liveLessonsLoaded = false;
  state.groupAccount = null;
  state.liveNotifications = [];
  state.accountDeletionRequest = null;
  state.ticketSyncStatus = { tone: "wait", text: "서버 회원권 확인 중" };
  state.pendingPaymentCheckStatus = null;
  state.lastLiveTicketKey = "";
  state.lastLiveNotificationKey = "";
  state.activeJournalMonth = localDateKey().slice(0, 7);
  state.selectedJournalDate = localDateKey();
  lessons.splice(0, lessons.length);
  localStorage.removeItem(sharedStorageKey);
}

async function login(provider) {
  const client = window.TennisNoteDataClient;
  if (!beginOAuthLogin(provider)) {
    setEmailAuthStatus(`${oauthLoginInFlightProvider} 로그인을 진행하고 있습니다.`);
    return;
  }
  if (client?.readiness?.().ready) {
    try {
      setEmailAuthStatus(`${provider} 로그인 화면을 여는 중입니다.`);
      await client.signInWithOAuth(provider);
      return;
    } catch (error) {
      finishOAuthLogin();
      setEmailAuthStatus(oauthLoginErrorMessage(error, provider), "alert");
      return;
    }
  }
  finishOAuthLogin();
  setEmailAuthStatus("실사용 로그인 연결 설정을 확인해 주세요.", "alert");
}

async function syncAppleLoginAvailability() {
  const buttons = $$('[data-login-provider="Apple"]');
  if (!buttons.length) return;
  let ready = true;
  const client = window.TennisNoteDataClient;
  if (client?.readiness?.().ready) {
    try {
      const settings = await client.getAuthSettings();
      ready = Boolean(settings?.external?.apple);
    } catch {
      // A temporary settings lookup failure must not hide the compliant login option.
      ready = true;
    }
  }
  buttons.forEach((button) => {
    const label = button.querySelector("[data-apple-login-label]");
    if (oauthLoginInFlightProvider && button.dataset.oauthDisabledBefore) {
      button.dataset.oauthDisabledBefore = ready ? "false" : "true";
      button.disabled = true;
    } else {
      button.disabled = !ready;
    }
    button.classList.toggle("is-preparing", !ready);
    const buttonLabel = ready ? button.dataset.readyLabel : "Apple 로그인 설정 중";
    if (label) label.textContent = buttonLabel;
    button.setAttribute("aria-label", buttonLabel);
  });
}

async function loginWithEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setEmailAuthStatus("로그인 확인 중");
  try {
    const client = window.TennisNoteDataClient;
    await client.signInWithPassword($("#memberLoginEmail").value, $("#memberLoginPassword").value);
    const opened = await applySupabaseMemberSession(true);
    if (!opened) throw new Error("profile_bootstrap_failed");
    form.reset();
    setEmailAuthStatus();
  } catch (error) {
    setEmailAuthStatus(emailLoginErrorMessage(error), "alert");
  } finally {
    submitButton.disabled = false;
  }
}

async function logout() {
  await disableNativePushForLogout();
  try {
    await window.TennisNoteDataClient?.signOut?.();
  } catch {
    state.ticketHistory.unshift({ text: "외부 로그인 해제 확인 필요 · 앱에서는 로그아웃 처리", tone: "wait" });
  }
  state.member = null;
  state.memberEnrollment = null;
  state.pendingPurchaseProductId = "";
  state.liveTickets = [];
  state.liveLessons = [];
  state.liveMakeupEntitlements = [];
  state.liveReleasedMakeupSlots = [];
  state.ticketSyncStatus = { tone: "wait", text: "로그인 후 실제 회원권을 확인합니다" };
  state.lastLiveTicketKey = "";
  sessionStorage.removeItem(appModePreferenceKey);
  sessionStorage.removeItem("tennis-note-coach-mode-entry");
  $("#appScreen").hidden = true;
  $("#loginScreen").hidden = false;
  if ($("#identitySetupModal")) $("#identitySetupModal").hidden = true;
  document.body.classList.remove("identity-setup-required");
  delete document.body.dataset.screen;
  document.body.classList.remove("member-pending-approval");
  if ($("#pendingApprovalGate")) $("#pendingApprovalGate").hidden = true;
  updateCoachModeAccess();
  jumpToTop();
  saveSnapshot();
}

async function signUpWithEmail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const email = $("#memberSignupEmail").value.trim().toLowerCase();
  const password = $("#memberSignupPassword").value;
  const passwordConfirm = $("#memberSignupPasswordConfirm").value;
  if (password.length < 8) {
    setEmailAuthStatus("비밀번호는 8자 이상 입력해주세요.", "alert");
    $("#memberSignupPassword").focus();
    return;
  }
  if (password !== passwordConfirm) {
    setEmailAuthStatus("비밀번호 확인이 일치하지 않습니다.", "alert");
    $("#memberSignupPasswordConfirm").focus();
    return;
  }
  if (!$("#memberSignupConsent").checked) {
    setEmailAuthStatus("이용약관과 개인정보 처리방침에 동의해주세요.", "alert");
    $("#memberSignupConsent").focus();
    return;
  }
  submitButton.disabled = true;
  setEmailAuthStatus("회원가입 처리 중");
  try {
    const client = window.TennisNoteDataClient;
    const result = await client.signUpWithPassword(email, password);
    if (result?.access_token) {
      const opened = await applySupabaseMemberSession(true);
      if (!opened) throw new Error("profile_bootstrap_failed");
      form.reset();
      setEmailAuthStatus();
      return;
    }
    $("#memberLoginEmail").value = email;
    form.reset();
    setEmailAuthMode("login", {
      message: "인증 메일을 보냈습니다. 메일에서 인증한 뒤 이메일로 로그인해주세요.",
      tone: "done",
      focus: false,
    });
  } catch (error) {
    setEmailAuthStatus(emailSignupErrorMessage(error), "alert");
  } finally {
    submitButton.disabled = false;
  }
}

async function requestPasswordReset() {
  const emailInput = $("#memberLoginEmail");
  const button = $("#memberPasswordResetButton");
  const email = emailInput?.value.trim().toLowerCase() || "";
  if (!email) {
    setEmailAuthStatus("가입한 이메일을 먼저 입력해주세요.", "alert");
    emailInput?.focus();
    return;
  }
  button.disabled = true;
  setEmailAuthStatus("비밀번호 재설정 메일을 보내는 중입니다.");
  try {
    await window.TennisNoteDataClient.sendPasswordResetEmail(email);
    setEmailAuthStatus("가입 여부와 관계없이 재설정 안내를 보냈습니다. 이메일을 확인해주세요.", "done");
  } catch {
    setEmailAuthStatus("재설정 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.", "alert");
  } finally {
    button.disabled = false;
  }
}

async function updateRecoveredPassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const password = $("#memberRecoveryPassword").value;
  const passwordConfirm = $("#memberRecoveryPasswordConfirm").value;
  if (password.length < 8) {
    setEmailAuthStatus("새 비밀번호는 8자 이상 입력해주세요.", "alert");
    $("#memberRecoveryPassword").focus();
    return;
  }
  if (password !== passwordConfirm) {
    setEmailAuthStatus("새 비밀번호 확인이 일치하지 않습니다.", "alert");
    $("#memberRecoveryPasswordConfirm").focus();
    return;
  }
  submitButton.disabled = true;
  setEmailAuthStatus("새 비밀번호를 저장하는 중입니다.");
  try {
    const client = window.TennisNoteDataClient;
    await client.updatePassword(password);
    await client.signOut?.().catch(() => {});
    emailPasswordRecoveryPending = false;
    form.reset();
    setEmailAuthMode("login", {
      message: "비밀번호가 변경됐습니다. 새 비밀번호로 로그인해주세요.",
      tone: "done",
      focus: false,
    });
  } catch (error) {
    setEmailAuthStatus(passwordUpdateErrorMessage(error), "alert");
  } finally {
    submitButton.disabled = false;
  }
}
