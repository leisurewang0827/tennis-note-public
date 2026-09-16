import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(join(root, relative), "utf8");

test("회원 앱은 이메일 인증 UI를 명시적 opt-in 전까지 노출하지 않는다", () => {
  const html = read("app/tennis-note-member-app/index.html");
  const runtime = read("app/shared/tennisnote-runtime-environment.js");
  const app = read("app/tennis-note-member-app/app.js");
  const members = read("app/tennis-note-member-app/forms/members.js");
  const common = read("app/tennis-note-member-app/forms/common.js");

  assert.match(html, /data-feature-gate="emailPasswordAuthUi" hidden inert aria-hidden="true"/);
  assert.match(runtime, /emailPasswordAuthUi:\s*config\.featureFlags\?\.emailPasswordAuthUi === true/);
  assert.doesNotMatch(app, /function emailPasswordAuthUiEnabled\(\)/);
  assert.match(common, /function emailPasswordAuthUiEnabled\(\)/);
  assert.match(members, /emailPanel\.inert = !emailUiAvailable/);
  assert.match(common, /if \(!emailPasswordAuthUiEnabled\(\)\)/);
  assert.ok(html.indexOf('id="memberEmailLoginStatus"') > html.indexOf("</details>"));
});

test("숨겨진 이메일 흐름은 서버 호출 전에 fail-closed하고 백엔드는 보존한다", () => {
  const auth = read("app/tennis-note-member-app/data/auth.js");
  const session = read("app/tennis-note-member-app/actions/session.js");
  const client = read("app/shared/tennisnote-data-client.js");

  for (const handler of ["loginWithEmail", "signUpWithEmail", "requestPasswordReset", "updateRecoveredPassword"]) {
    const start = auth.indexOf(`function ${handler}`);
    const guard = auth.indexOf("if (!emailPasswordAuthUiEnabled())", start);
    assert.ok(start >= 0 && guard > start && guard - start < 220, `${handler} 이메일 UI gate가 서버 호출보다 먼저 있어야 합니다`);
  }
  assert.match(session, /callbackType === "recovery"[\s\S]{0,180}if \(!emailPasswordAuthUiEnabled\(\)\)/);
  for (const backendMethod of ["signInWithPassword", "signUpWithPassword", "sendPasswordResetEmail", "updatePassword"]) {
    assert.match(client, new RegExp(backendMethod));
  }
});
