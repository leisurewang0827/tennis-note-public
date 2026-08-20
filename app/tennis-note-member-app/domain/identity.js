// 이름·전화번호·닉네임과 로그인 오류 문구를 다루는 함수들.
//
// 전역 상태도 DOM 도 서버도 참조하지 않는다. 필요한 값은 인자로 받는다.
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

function identityErrorMessage(error) {
  const code = String(error?.message || error || "").toLowerCase();
  if (code.includes("failed to fetch") || code.includes("networkerror") || code.includes("load failed") || code.includes("temporarily_unavailable")) {
    return "인터넷 연결이 불안정합니다. 입력 내용은 유지되니 잠시 후 다시 저장해 주세요.";
  }
  if (code.includes("nickname_already_taken")) return "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.";
  if (code.includes("nickname_invalid") || code.includes("nickname_length_invalid")) return "닉네임은 공백을 제외하고 2~20자로 입력해 주세요.";
  if (code.includes("real_name_invalid")) return "실명을 확인해 주세요.";
  if (code.includes("phone_invalid")) return "휴대전화 번호를 010부터 정확히 입력해 주세요.";
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
