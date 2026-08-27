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

function applySavedIdentity(profile = {}) {
  state.profile.name = normalizeIdentityText(profile.name || state.profile.name);
  state.profile.nickname = normalizeIdentityText(profile.nickname || state.profile.nickname);
  state.profile.phone = normalizeIdentityPhone(profile.phone || state.profile.phone);
  state.profile.birthYear = profile.birth_year || state.profile.birthYear || "";
  state.profile.neighborhood = normalizeIdentityText(profile.neighborhood || state.profile.neighborhood || "");
  state.profile.gender = profile.gender || state.profile.gender || "";
  state.profile.profileCompletedAt = profile.profile_completed_at || state.profile.profileCompletedAt || new Date().toISOString();
  state.profile.privacyConsentVersion = profile.privacy_consent_version || state.profile.privacyConsentVersion || identityPrivacyVersion;
  state.profile.privacyConsentedAt = profile.privacy_consented_at || state.profile.privacyConsentedAt || new Date().toISOString();
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

async function submitIdentitySetup(event) {
  event.preventDefault();
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
    if (result?.linkStatus === "linked") {
      const restored = await applySupabaseMemberSession(false);
      if (!restored) throw new Error("auto_link_session_refresh_failed");
      showToast("가입 완료 · 기존 회원권과 앱 계정이 바로 연결되었습니다.");
      return;
    }
    renderAll();
    saveSnapshot();
    if (result?.linkStatus === "admin_review_required") {
      showToast("가입 완료. 기존 회원 정보는 관리자 확인 후 연결됩니다.");
      await applyPendingOnboardingIntent();
      return;
    }
    showToast("가입 정보가 저장되었습니다.");
    await applyPendingOnboardingIntent();
  } catch (error) {
    const errorMessage = identityErrorMessage(error);
    if (message) message.textContent = errorMessage;
    setNicknameStatus("identityNicknameStatus", errorMessage, "unavailable");
  } finally {
    button.disabled = false;
  }
}
