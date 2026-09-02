// 이름·전화번호·닉네임과 로그인 오류 문구를 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function memberEnrollmentErrorMessage(error) {
  const code = error?.payload?.code || error?.message || "";
  const labels = {
    applicant_name_required: "이름을 확인해 주세요.",
    valid_phone_required: "연락처를 정확히 입력해 주세요.",
    valid_birth_year_required: "출생연도를 확인해 주세요.",
    group_partner_required: "2대1 파트너 이름과 연락처를 입력해 주세요.",
    member_enrollment_consent_required: "필수 안내 두 가지를 확인하고 동의해 주세요.",
    active_product_required: "판매 중인 회원권 정보를 다시 확인해 주세요.",
  };
  return labels[code] || "가입서를 저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
}

function normalizeIdentityText(value = "") {
  return String(value || "").trim().replace(/\s+/gu, " ");
}

function normalizeIdentityPhone(value = "") {
  return String(value || "").replace(/\D/gu, "");
}

function formatIdentityPhone(value = "") {
  const digits = normalizeIdentityPhone(value).slice(0, 11);
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

function identityPhoneE164(value = "") {
  const digits = normalizeIdentityPhone(value);
  if (digits.startsWith("82") && digits.length >= 11) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+82${digits.slice(1)}`;
  return "";
}

function verifiedPhoneFromAuthUser(user = {}) {
  const directPhone = normalizeIdentityPhone(user?.phone || "");
  if (directPhone && user?.phone_confirmed_at) return directPhone.startsWith("82") ? `0${directPhone.slice(2)}` : directPhone;
  const verifiedIdentity = (user?.identities || []).find((identity) => {
    const provider = String(identity?.provider || "").toLowerCase();
    const metadata = identity?.identity_data || {};
    const verified = [
      metadata.phone_number_verified,
      metadata.phone_verified,
      metadata.mobile_verified,
      metadata.verified_phone,
    ].some((value) => value === true || value === "true");
    return ["custom:naver", "custom:kakao"].includes(provider) && verified;
  });
  const identityData = verifiedIdentity?.identity_data || {};
  const identityPhone = normalizeIdentityPhone(identityData.phone_number || identityData.phone || identityData.mobile || "");
  return identityPhone.startsWith("82") ? `0${identityPhone.slice(2)}` : identityPhone;
}

function authUserHasProvider(user = {}, provider = "") {
  const expected = String(provider || "").trim().toLowerCase();
  if (!expected) return false;
  const appMetadata = user?.app_metadata || {};
  const providers = [appMetadata.provider, ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : [])]
    .concat(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return providers.includes(expected);
}

function suggestedNicknameFromUser(user = {}) {
  const metadata = user?.user_metadata || {};
  return normalizeIdentityText(
    metadata.nickname
      || metadata.name
      || metadata.full_name
      || metadata.preferred_username
      || "",
  ).slice(0, 20);
}

function normalizedIdentityErrorCode(error) {
  const values = [
    error?.code,
    error?.error_code,
    error?.message,
    error?.payload?.code,
    error?.payload?.error_code,
    error?.payload?.message,
    error?.payload?.error_description,
    typeof error === "string" ? error : "",
  ];
  return values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ")
    .replace(/[\s-]+/gu, "_");
}

function transientAuthCapabilityError(error) {
  const code = normalizedIdentityErrorCode(error);
  return ["failed_to_fetch", "networkerror", "load_failed", "temporarily_unavailable", "request_timeout"]
    .some((marker) => code.includes(marker));
}

function customOAuthProviderCapability(provider = "") {
  const client = globalThis.window?.TennisNoteDataClient || globalThis.TennisNoteDataClient;
  const fallbackSlug = {
    kakao: "custom:kakao",
    naver: "custom:naver",
  }[String(provider || "").toLowerCase()] || "";
  const slug = String(client?.providerSlug?.(provider) || fallbackSlug).toLowerCase();
  return slug.startsWith("custom:") ? slug : "";
}

function authProviderCapability(settings = {}, provider = "") {
  const external = settings?.external;
  const customSlug = customOAuthProviderCapability(provider);
  if (!external || typeof external !== "object") return customSlug ? true : null;
  const aliases = {
    phone: ["phone"],
    email: ["email"],
    apple: ["apple"],
    kakao: ["custom:kakao", "kakao"],
    naver: ["custom:naver", "naver"],
    google: ["google"],
  }[provider] || [provider];
  const configured = aliases.filter((key) => Object.prototype.hasOwnProperty.call(external, key));
  if (configured.some((key) => external[key] === true)) return true;
  if (customSlug && !Object.prototype.hasOwnProperty.call(external, customSlug)) return true;
  if (configured.length) return false;
  return customSlug ? true : null;
}

function resolvedAuthCapabilities(settings = {}) {
  return {
    phone: authProviderCapability(settings, "phone"),
    email: authProviderCapability(settings, "email"),
    apple: authProviderCapability(settings, "apple"),
    kakao: authProviderCapability(settings, "kakao"),
    naver: authProviderCapability(settings, "naver"),
    google: authProviderCapability(settings, "google") === true,
  };
}

function phoneAuthUnavailableMessage() {
  return "문자 인증을 준비 중입니다. 네이버 번호 다시 받기 또는 관리자 연결을 이용해 주세요.";
}

function identityErrorMessage(error) {
  const code = normalizedIdentityErrorCode(error);
  if (code.includes("failed_to_fetch") || code.includes("networkerror") || code.includes("load_failed") || code.includes("temporarily_unavailable")) {
    return "인터넷 연결이 불안정합니다. 입력 내용은 유지되니 잠시 후 다시 저장해 주세요.";
  }
  if (code.includes("nickname_already_taken")) return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (code.includes("nickname_invalid") || code.includes("nickname_length_invalid")) return "닉네임은 공백을 제외하고 2~20자로 입력해 주세요.";
  if (code.includes("real_name_invalid")) return "실명을 확인해 주세요.";
  if (code.includes("phone_invalid")) return "휴대전화 번호를 010부터 정확히 입력해 주세요.";
  if (code.includes("phone_verification_required")) return "휴대전화 인증을 먼저 완료해 주세요.";
  if (code.includes("over_email_send_rate_limit") || code.includes("rate_limit") || code.includes("too many")) return "인증번호 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (code.includes("phone_provider") || code.includes("sms_provider") || code.includes("sms_send")) return phoneAuthUnavailableMessage();
  if (code.includes("otp_expired") || code.includes("token has expired")) return "인증번호가 만료되었거나 올바르지 않습니다. 새 번호를 받아 다시 입력해 주세요.";
  if (code.includes("phone_otp_invalid") || code.includes("phone_otp_verification_failed")) return "인증번호 6자리를 확인해 주세요.";
  if (code.includes("phone_change_conflict") || code.includes("phone already")) return "이미 다른 로그인 계정에서 확인된 번호입니다. 관리자에게 계정 연결을 요청해 주세요.";
  if (code.includes("birth_year_invalid")) return "출생연도를 확인해 주세요.";
  if (code.includes("gender_invalid")) return "성별을 선택해 주세요.";
  if (code.includes("terms_consent")) return "서비스 이용약관 동의가 필요합니다.";
  if (code.includes("privacy_consent")) return "개인정보 처리방침 동의가 필요합니다.";
  if (code.includes("login_required")) return "로그인 상태를 다시 확인해 주세요.";
  return "정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function emailLoginErrorMessage(error) {
  const code = `${error?.code || error?.message || ""}`.toLowerCase();
  if (code.includes("invalid_credentials") || code.includes("invalid login")) return "이메일 또는 비밀번호를 확인해주세요.";
  if (code.includes("email_not_confirmed")) return "이메일 인증을 먼저 완료해주세요.";
  if (code.includes("credentials_required")) return "이메일과 비밀번호를 입력해주세요.";
  return "로그인을 완료하지 못했습니다. 고객지원으로 문의해주세요.";
}

function oauthLoginErrorMessage(error, provider = "간편") {
  const code = String(error?.code || error?.message || "").toLowerCase();
  if (code.includes("flow_state_already_used")) {
    return `${provider} 로그인 요청이 겹쳤습니다. 버튼을 한 번만 눌러 다시 진행해 주세요.`;
  }
  if (code.includes("server_error") || code.includes("unexpected_failure") || code.includes("request_timeout")) {
    return `${provider} 로그인 서버 응답이 늦어졌습니다. 잠시 후 다시 시도해 주세요.`;
  }
  return `${provider} 로그인을 완료하지 못했습니다. 다시 시도해 주세요.`;
}

function emailSignupErrorMessage(error) {
  const code = `${error?.code || error?.message || ""}`.toLowerCase();
  if (code.includes("already") || code.includes("registered") || code.includes("exists")) return "이미 가입된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.";
  if (code.includes("weak_password") || code.includes("at least") || code.includes("too short")) return "비밀번호는 8자 이상 입력해주세요.";
  if (code.includes("invalid") && code.includes("email")) return "사용할 수 있는 이메일 주소를 입력해주세요.";
  if (code.includes("rate") || code.includes("too many")) return "요청이 많습니다. 잠시 후 다시 시도해주세요.";
  if (code.includes("signup_disabled")) return "현재 이메일 회원가입을 준비 중입니다. 고객지원으로 문의해주세요.";
  return "회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function passwordUpdateErrorMessage(error) {
  const code = `${error?.code || error?.message || ""}`.toLowerCase();
  if (code.includes("same_password")) return "기존 비밀번호와 다른 비밀번호를 입력해주세요.";
  if (code.includes("session") || code.includes("token") || code.includes("jwt")) return "인증 링크가 만료됐습니다. 비밀번호 찾기를 다시 진행해주세요.";
  if (code.includes("weak_password") || code.includes("at least") || code.includes("too short")) return "비밀번호는 8자 이상 입력해주세요.";
  return "비밀번호를 변경하지 못했습니다. 비밀번호 찾기를 다시 진행해주세요.";
}
