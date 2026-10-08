// 수강 신청과 신원 확인을 제출하는 함수들.
//
// 사용자가 누른 것을 처리한다. 화면을 읽고 서버를 부르고 상태를 바꾼다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function updateEnrollmentPartnerFields(product = null) {
  const selectedProduct = product || membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const isGroup = isGroupMembershipProduct(selectedProduct || {});
  const fields = $("#enrollmentPartnerFields");
  if (fields) fields.hidden = !isGroup;
  ["#enrollmentPartnerName", "#enrollmentPartnerPhone"].forEach((selector) => {
    const input = $(selector);
    if (input) input.required = isGroup;
  });
}

async function submitMemberEnrollment(event) {
  event.preventDefault();
  const product = membershipProducts().find((item) => item.id === state.pendingPurchaseProductId);
  const message = $("#memberEnrollmentMessage");
  if (!product || !message) return;
  const isGroup = isGroupMembershipProduct(product);
  const birthYear = Number($("#enrollmentBirthYear")?.value || 0);
  const partnerBirthYear = Number($("#enrollmentPartnerBirthYear")?.value || 0) || null;
  const maxBirthYear = new Date().getFullYear() - 5;
  const payload = {
    target_product_id: product.id,
    target_form_version: memberEnrollmentFormVersion,
    target_applicant_name: $("#enrollmentName")?.value.trim() || "",
    target_phone: $("#enrollmentPhone")?.value.trim() || "",
    target_birth_year: birthYear,
    target_neighborhood: $("#enrollmentNeighborhood")?.value.trim() || "",
    target_gender: $("#enrollmentGender")?.value || "",
    target_experience_level: memberEnrollmentLegacyDefaults.experienceLevel,
    target_lesson_goal: memberEnrollmentLegacyDefaults.lessonGoal,
    target_preferred_schedule: memberEnrollmentLegacyDefaults.preferredSchedule,
    target_partner_name: isGroup ? $("#enrollmentPartnerName")?.value.trim() || "" : "",
    target_partner_phone: isGroup ? $("#enrollmentPartnerPhone")?.value.trim() || "" : "",
    target_partner_birth_year: isGroup ? partnerBirthYear : null,
    target_partner_neighborhood: isGroup ? $("#enrollmentPartnerNeighborhood")?.value.trim() || "" : "",
    target_partner_gender: isGroup ? $("#enrollmentPartnerGender")?.value || "" : "",
    target_privacy_consent: Boolean($("#enrollmentPrivacyConsent")?.checked),
    target_terms_consent: Boolean($("#enrollmentTermsConsent")?.checked),
  };
  if (!payload.target_applicant_name || payload.target_phone.replace(/\D/g, "").length < 9) {
    message.textContent = "이름과 연락처를 확인해 주세요.";
    return;
  }
  if (birthYear < 1900 || birthYear > maxBirthYear) {
    message.textContent = "출생연도를 확인해 주세요.";
    return;
  }
  if (isGroup && (!payload.target_partner_name || payload.target_partner_phone.replace(/\D/g, "").length < 9)) {
    message.textContent = "2대1 파트너 이름과 연락처를 입력해 주세요.";
    return;
  }
  if (!payload.target_privacy_consent || !payload.target_terms_consent) {
    message.textContent = "필수 안내 두 가지를 확인하고 동의해 주세요.";
    return;
  }

  const submitButton = $("#memberEnrollmentForm button[type='submit']");
  if (submitButton) submitButton.disabled = true;
  message.textContent = "가입서를 안전하게 저장하는 중입니다.";
  try {
    const client = window.TennisNoteDataClient;
    if (hasLiveMemberSession() && client?.rpc) {
      await client.rpc("tn_submit_member_enrollment", payload);
      if (state.member) state.member.memberKind = state.member.memberKind === "lesson_member" ? "lesson_member" : "lesson_pending";
      await syncMemberEnrollmentFromServer();
    } else {
      state.memberEnrollment = {
        id: `demo-enrollment-${Date.now()}`,
        user_id: state.member?.profileId || "demo-member",
        requested_product_id: product.id,
        form_version: memberEnrollmentFormVersion,
        status: "submitted",
        applicant_name: payload.target_applicant_name,
        phone: payload.target_phone,
        birth_year: payload.target_birth_year,
        neighborhood: payload.target_neighborhood,
        gender: payload.target_gender,
        experience_level: payload.target_experience_level,
        lesson_goal: payload.target_lesson_goal,
        preferred_schedule: payload.target_preferred_schedule,
        group_size: isGroup ? 2 : 1,
        partner_name: payload.target_partner_name,
        partner_phone: payload.target_partner_phone,
        submitted_at: new Date().toISOString(),
      };
      if (state.member) state.member.memberKind = "lesson_pending";
    }
    state.profile.name = payload.target_applicant_name;
    state.profile.phone = payload.target_phone;
    state.ticketHistory.unshift({ text: `${product.title} 수강 가입서 제출 완료`, tone: "done" });
    saveSnapshot();
    renderAll();
    window.TennisNoteInputGuard?.markSaved?.("#memberEnrollmentModal");
    closeMemberEnrollmentModal();
    if (hasLiveMemberSession()) {
      await startProductPayment(product.id, { skipEnrollmentGate: true });
    } else {
      state.pendingPaymentCheckStatus = { tone: "done", text: "데모 가입서 제출 완료 · 실제 로그인 후 결제로 이어집니다." };
      renderAll();
      setView("shopView");
    }
  } catch (error) {
    message.textContent = memberEnrollmentErrorMessage(error);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function applySavedIdentity(profile = {}, { preserveCompletion = false } = {}) {
  state.profile.name = normalizeIdentityText(profile.name || state.profile.name);
  state.profile.nickname = normalizeIdentityText(profile.nickname || state.profile.nickname);
  state.profile.phone = normalizeIdentityPhone(Object.prototype.hasOwnProperty.call(profile, "phone") ? profile.phone || "" : state.profile.phone);
  state.profile.birthYear = profile.birth_year || state.profile.birthYear || "";
  state.profile.neighborhood = normalizeIdentityText(profile.neighborhood || state.profile.neighborhood || "");
  state.profile.gender = profile.gender || state.profile.gender || "";
  state.profile.profileCompletedAt = preserveCompletion ? profile.profile_completed_at || "" : profile.profile_completed_at || state.profile.profileCompletedAt || new Date().toISOString();
  state.profile.privacyConsentVersion = preserveCompletion ? profile.privacy_consent_version || "" : profile.privacy_consent_version || state.profile.privacyConsentVersion || identityPrivacyVersion;
  state.profile.privacyConsentedAt = preserveCompletion ? profile.privacy_consented_at || "" : profile.privacy_consented_at || state.profile.privacyConsentedAt || new Date().toISOString();
  if (profile.updated_at) state.profile.serverRevision = profile.updated_at;
  if (state.member) {
    state.member.name = state.profile.name;
    state.member.nickname = state.profile.nickname;
  }
}

function applyConsentPreferences(preferences = {}) {
  state.profile.termsConsentVersion = preferences.termsVersion || state.profile.termsConsentVersion || "";
  state.profile.termsConsentedAt = preferences.termsConsentedAt || state.profile.termsConsentedAt || "";
  state.profile.privacyConsentVersion = preferences.privacyVersion || state.profile.privacyConsentVersion || "";
  state.profile.privacyConsentedAt = preferences.privacyConsentedAt || state.profile.privacyConsentedAt || "";
  state.profile.marketingPushConsent = preferences.marketingPush === true;
  state.profile.marketingSmsConsent = preferences.marketingSms === true;
  state.profile.marketingEmailConsent = preferences.marketingEmail === true;
}

async function requestIdentityPhoneVerification(surface = "signup") {
  if (!signupSmsEnabled) return false;
  const controls = phoneVerificationControls(surface);
  const button = controls.send;
  if (!button || identityPhoneRequestInFlight || identityPhoneConfirmInFlight) return false;
  const phone = normalizeIdentityPhone(controls.input?.value || "");
  const e164Phone = identityPhoneE164(phone);
  if (!/^01[0-9]{8,9}$/u.test(phone) || !e164Phone) {
    setIdentityPhoneStatus("휴대전화 번호를 010부터 정확히 입력해 주세요.", "error", surface);
    controls.input?.focus();
    return false;
  }
  const client = window.TennisNoteDataClient;
  if (!hasLiveMemberSession() || !client?.requestPhoneChangeVerification) {
    setIdentityPhoneStatus("로그인 상태를 다시 확인해 주세요.", "error", surface);
    return false;
  }
  identityPhoneRequestInFlight = true;
  button.disabled = true;
  const owner = phoneVerificationOwner();
  try {
    const currentUser = await client.getAuthUser?.();
    if (!phoneVerificationRequestCurrent(owner, phone, surface)
      || (owner.authId && currentUser?.id && currentUser.id !== owner.authId)) return false;
    if (verifiedPhoneFromAuthUser(currentUser || {}, surface === "profile") === phone) {
      markIdentityPhoneVerified(phone, "provider", surface);
      return true;
    }
    const capabilities = await refreshAuthProviderCapabilities({ force: true });
    if (!phoneVerificationRequestCurrent(owner, phone, surface)) return false;
    if (capabilities.providers.phone === false || capabilities.status === "unavailable") {
      setIdentityPhoneStatus(phoneAuthUnavailableMessage(), "error", surface);
      return false;
    }
    if (capabilities.status !== "ready") {
      setIdentityPhoneStatus("문자 인증 설정을 확인하지 못했습니다. 입력은 유지되며 다시 시도할 수 있습니다.", "error", surface);
      return false;
    }
    setIdentityPhoneStatus("인증번호를 보내고 있습니다.", "", surface);
    await client.requestPhoneChangeVerification(e164Phone);
    if (!phoneVerificationRequestCurrent(owner, phone, surface)) return false;
    const verification = { phone, status: "pending", source: "sms", owner };
    if (surface === "profile") profilePhoneVerification = verification;
    else identityPhoneVerification = verification;
    if (controls.code) controls.code.value = "";
    if (controls.row) controls.row.hidden = false;
    setIdentityPhoneStatus("문자로 받은 인증번호 6자리를 입력해 주세요.", "", surface);
    window.setTimeout(() => { if (phoneVerificationRequestCurrent(owner, phone, surface)) controls.code?.focus(); }, 40);
    return true;
  } catch (error) {
    if (phoneVerificationRequestCurrent(owner, phone, surface)) {
      resetIdentityPhoneVerification(identityErrorMessage(error), surface);
      setIdentityPhoneStatus(identityErrorMessage(error), "error", surface);
    }
    return false;
  } finally {
    identityPhoneRequestInFlight = false;
    syncIdentityPhoneCapabilityControl();
  }
}

async function requestNaverPhoneConsent() {
  const button = $("#identityNaverPhoneButton");
  const client = window.TennisNoteDataClient;
  if (!button || !hasLiveMemberSession() || !client?.signInWithOAuth) {
    setIdentityPhoneStatus("로그인 상태를 다시 확인해 주세요.", "error");
    return false;
  }
  button.disabled = true;
  setIdentityPhoneStatus("네이버에서 휴대전화번호 제공 동의 화면을 여는 중입니다.");
  try {
    await client.signInWithOAuth("Naver", { authType: "reprompt" });
    return true;
  } catch (error) {
    button.disabled = false;
    setIdentityPhoneStatus(oauthLoginErrorMessage(error, "네이버"), "error");
    return false;
  }
}

async function confirmIdentityPhoneVerification(surface = "signup") {
  if (!signupSmsEnabled) return false;
  const controls = phoneVerificationControls(surface);
  const button = controls.verify;
  if (!button || identityPhoneConfirmInFlight || identityPhoneRequestInFlight) return false;
  const phone = normalizeIdentityPhone(controls.input?.value || "");
  const code = normalizeIdentityPhone(controls.code?.value || "");
  const verification = phoneVerificationState(surface);
  if (verification.status !== "pending" || verification.phone !== phone || !phoneVerificationOwnerCurrent(verification.owner)) {
    setIdentityPhoneStatus("휴대전화 번호가 바뀌었습니다. 인증번호를 다시 받아 주세요.", "error", surface);
    return false;
  }
  if (!/^[0-9]{6}$/u.test(code)) {
    setIdentityPhoneStatus("인증번호 6자리를 입력해 주세요.", "error", surface);
    controls.code?.focus();
    return false;
  }
  const client = window.TennisNoteDataClient;
  const owner = phoneVerificationOwner();
  identityPhoneConfirmInFlight = true;
  button.disabled = true;
  setIdentityPhoneStatus("인증번호를 확인하고 있습니다.", "", surface);
  try {
    await client.verifyPhoneChange(identityPhoneE164(phone), code);
    if (!phoneVerificationRequestCurrent(owner, phone, surface)) return false;
    const authUser = await client.getAuthUser?.();
    if (!phoneVerificationRequestCurrent(owner, phone, surface)
      || (owner.authId && authUser?.id && authUser.id !== owner.authId)) return false;
    const verifiedPhone = verifiedPhoneFromAuthUser(authUser || {}, surface === "profile");
    if (verifiedPhone !== phone) throw new Error("phone_verification_not_confirmed");
    markIdentityPhoneVerified(phone, "sms", surface);
    return true;
  } catch (error) {
    if (phoneVerificationRequestCurrent(owner, phone, surface)) {
      if (normalizedIdentityErrorCode(error).includes("otp_expired")) resetIdentityPhoneVerification(identityErrorMessage(error), surface);
      setIdentityPhoneStatus(identityErrorMessage(error), "error", surface);
    }
    return false;
  } finally {
    identityPhoneConfirmInFlight = false;
    syncIdentityPhoneCapabilityControl();
  }
}

let signupProfileSubmitting = false;

async function submitIdentitySetup(event) {
  event.preventDefault();
  if (signupProfileSubmitting) return;
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const message = $("#identitySetupMessage");
  if (!$("#identityTermsConsent")?.checked) {
    if (message) message.textContent = "서비스 이용약관 동의가 필요합니다.";
    return;
  }
  if (!$("#identityPrivacyConsent")?.checked) {
    if (message) message.textContent = "개인정보 처리방침 동의가 필요합니다.";
    return;
  }
  signupProfileSubmitting = true;
  button.disabled = true;
  if (message) message.textContent = "가입 정보를 안전하게 저장하고 있습니다.";
  try {
    await persistConsentPreferences({
      marketingPush: $("#identityMarketingPush")?.checked === true,
      marketingSms: $("#identityMarketingSms")?.checked === true,
      marketingEmail: $("#identityMarketingEmail")?.checked === true,
    });
    const result = await persistIdentityProfile({
      realName: $("#identityRealName")?.value,
      nickname: $("#identityNickname")?.value,
      phone: $("#identityPhone")?.value,
      birthYear: $("#identityBirthYear")?.value,
      neighborhood: $("#identityNeighborhood")?.value,
      gender: $("#identityGender")?.value,
    });
    $("#identitySetupModal").hidden = true;
    document.body.classList.remove("identity-setup-required");
    renderAll();
    saveSnapshot();
    showToast(result.linkStatus === "linked"
      ? "가입 완료. 연결된 회원권과 수업 정보를 확인했습니다."
      : "가입 완료. 회원 정보 연결은 관리자 확인 후 처리됩니다.");
    await applyPendingOnboardingIntent();
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    if (String(error?.message || "").includes("signup_link_readback_unconfirmed")) {
      $("#identitySetupModal").hidden = false;
    }
    if (message) message.textContent = errorMessage;
    setNicknameStatus("identityNicknameStatus", errorMessage, "unavailable");
  } finally {
    signupProfileSubmitting = false;
    button.disabled = false;
  }
}
