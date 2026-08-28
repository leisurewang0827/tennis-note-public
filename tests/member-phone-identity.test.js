import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const identitySource = readFileSync(join(root, "app/tennis-note-member-app/domain/identity.js"), "utf8");
const identity = new Function(`${identitySource}\nreturn { identityPhoneE164, verifiedPhoneFromAuthUser };`)();

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
  assert.match(auth, /await requireVerifiedIdentityPhone\(normalizedPhone\)/);
  assert.match(auth, /tn_update_my_identity_profile_v3/);
  assert.match(actions, /identityPhoneVerification = \{ phone, status: "pending", source: "sms" \}/);
  assert.match(html, /id="identityPhoneSendButton"/);
  assert.match(html, /id="identityPhoneVerifyButton"/);
  assert.match(dataClient, /options\.authType === "reprompt"/);
  assert.match(identityDomain, /function authUserHasProvider/);
  assert.match(actions, /client\.signInWithOAuth\("Naver", \{ authType: "reprompt" \}\)/);
  assert.match(memberForms, /id.*identityNaverPhoneButton|identityNaverPhoneButton/);
  assert.match(memberForms, /identityPhone.*value\s*=\s*formatIdentityPhone\(normalizedPhone\)/);
  assert.match(profileEvents, /identityNaverPhoneButton.*requestNaverPhoneConsent/);
  assert.match(html, /id="identityNaverPhoneButton"/);
});
