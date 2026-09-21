import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const identitySource = readFileSync(join(root, "app/tennis-note-member-app/domain/identity.js"), "utf8");
const identity = new Function(`${identitySource}\nreturn { identityPhoneE164, verifiedPhoneFromAuthUser, normalizedIdentityErrorCode, resolvedAuthCapabilities, identityErrorMessage, emailSignupResponseKind };`)();

test("국내 휴대전화 번호를 Supabase 전화 인증 형식으로 바꾼다", () => {
  assert.equal(identity.identityPhoneE164("010-1234-5678"), "+821012345678");
  assert.equal(identity.identityPhoneE164("821012345678"), "+821012345678");
  assert.equal(identity.identityPhoneE164("123"), "");
});

test("확인된 auth phone 또는 provider identity만 자동 연결 번호로 신뢰한다", () => {
  assert.equal(identity.verifiedPhoneFromAuthUser({
    phone: "+821012345678",
    phone_confirmed_at: "2026-08-28T00:00:00Z",
  }), "01012345678");
  assert.equal(identity.verifiedPhoneFromAuthUser({
    user_metadata: { phone: "01012345678", phone_verified: true },
  }), "");
  assert.equal(identity.verifiedPhoneFromAuthUser({
    identities: [{
      provider: "custom:naver",
      identity_data: { mobile: "+821012345678", mobile_verified: true },
    }],
  }), "01012345678");
});

test("가입 화면은 전화번호 인증 후 v3 서버 연결을 사용한다", () => {
  const dataClient = readFileSync(join(root, "app/shared/tennisnote-data-client.js"), "utf8");
  const identityDomain = readFileSync(join(root, "app/tennis-note-member-app/domain/identity.js"), "utf8");
  const auth = readFileSync(join(root, "app/tennis-note-member-app/data/auth.js"), "utf8");
  const actions = readFileSync(join(root, "app/tennis-note-member-app/actions/enrollment.js"), "utf8");
  const memberForms = readFileSync(join(root, "app/tennis-note-member-app/forms/members.js"), "utf8");
  const profileEvents = readFileSync(join(root, "app/tennis-note-member-app/events/profile.js"), "utf8");
  const html = readFileSync(join(root, "app/tennis-note-member-app/index.html"), "utf8");
  assert.match(dataClient, /type:\s*"phone_change"/);
  assert.match(dataClient, /requestPhoneChangeVerification/);
  assert.match(dataClient, /verifyPhoneChange/);
  assert.match(dataClient, /responseRequestError\(response, rawText, "Supabase auth settings failed"\)/);
  assert.match(auth, /await requireVerifiedIdentityPhone\(normalizedPhone\)/);
  assert.match(auth, /tn_update_my_identity_profile_v3/);
  assert.match(actions, /identityPhoneVerification = \{ phone, status: "pending", source: "sms" \}/);
  assert.match(actions, /refreshAuthProviderCapabilities\(\{ force: true \}\)/);
  assert.match(actions, /identityPhoneRequestInFlight/);
  assert.match(html, /id="identityPhoneSendButton"/);
  assert.match(html, /id="identityPhoneVerifyButton"/);
  assert.match(dataClient, /options\.authType === "reprompt"/);
  assert.match(identityDomain, /function authUserHasProvider/);
  assert.match(actions, /client\.signInWithOAuth\("Naver", \{ authType: "reprompt" \}\)/);
  assert.match(memberForms, /id.*identityNaverPhoneButton|identityNaverPhoneButton/);
  assert.match(memberForms, /identityPhone.*value\s*=\s*formatIdentityPhone\(normalizedPhone\)/);
  assert.match(memberForms, /identityPhoneVerification.*removeAttribute\("hidden"\)/s);
  assert.match(profileEvents, /identityNaverPhoneButton.*requestNaverPhoneConsent/);
  assert.match(html, /id="identityNaverPhoneButton"/);
});

test("이메일 가입의 난독화 응답은 성공으로 단정하지 않는다", () => {
  const auth = readFileSync(join(root, "app/tennis-note-member-app/data/auth.js"), "utf8");
  assert.equal(identity.emailSignupResponseKind({ access_token: "fixture" }), "authenticated");
  assert.equal(identity.emailSignupResponseKind({ user: { identities: [{ provider: "email" }] } }), "confirmation_sent");
  assert.equal(identity.emailSignupResponseKind({ user: { identities: [] } }), "indeterminate");
  assert.match(auth, /가입 요청 결과를 확정할 수 없습니다/);
  assert.match(auth, /responseKind === "confirmation_sent"/);
});

test("Auth provider capability와 전화 인증 오류를 안전하게 구분한다", () => {
  assert.deepEqual(identity.resolvedAuthCapabilities({ external: {
    phone: false,
    email: true,
    apple: true,
    "custom:kakao": true,
    "custom:naver": true,
    google: false,
  } }), {
    phone: false,
    email: true,
    apple: true,
    kakao: true,
    naver: true,
    google: false,
  });
  assert.match(identity.identityErrorMessage({ code: "phone_provider_disabled" }), /문자 인증을 준비 중/);
  assert.match(identity.identityErrorMessage({ message: "Phone provider is disabled" }), /네이버 번호 다시 받기/);
  assert.match(identity.identityErrorMessage({ payload: { error_code: "sms_send_failed" } }), /관리자 연결/);
  assert.match(identity.identityErrorMessage({ code: "over_sms_send_rate_limit" }), /잠시 후/);
  const phoneExistsMessage = "이미 다른 계정에 연결된 휴대전화입니다. 기존 계정으로 로그인하거나 다른 번호를 사용해 주세요.";
  assert.equal(identity.identityErrorMessage({ status: 422, code: "phone_exists", message: "Request failed" }), phoneExistsMessage);
  assert.equal(identity.identityErrorMessage({ status: 422, payload: { error_code: "phone_exists" } }), phoneExistsMessage);
  assert.equal(identity.normalizedIdentityErrorCode({ code: "Phone Provider-Disabled" }), "phone_provider_disabled");
});

test("이메일 인증 입력은 iOS 포커스 자동확대를 일으키지 않는다", () => {
  const styles = readFileSync(join(root, "app/tennis-note-member-app/styles.css"), "utf8");
  assert.match(styles, /\.email-login-panel \.email-login-form :is\(/);
  assert.match(styles, /input\[type="email"\]/);
  assert.match(styles, /input\[type="password"\]/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /font-size:\s*16px/);
});
