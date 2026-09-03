import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("로그인 첫 화면은 안내·세션 전용 최근 로그인 badge만 두고 상세 사업자 정보는 앱 화면에 보존한다", () => {
  const html = source("app/tennis-note-member-app/index.html");
  const styles = source("app/tennis-note-member-app/styles.css");
  const session = source("app/tennis-note-member-app/actions/session.js");
  const login = source("app/tennis-note-member-app/ui/login-entry.js");

  assert.match(html, /login-brand-guidance/);
  assert.match(html, /id="memberRecentLoginBadge"/);
  assert.equal((html.match(/business-operator-info/g) || []).length, 1);
  assert.match(styles, /\.recent-login-badge/);
  assert.match(session, /rememberRecentLoginProvider\(state\.member\.provider\)/);
  assert.match(login, /sessionStorage\.getItem/);
  assert.match(login, /"custom:kakao": "카카오"/);
});

test("모드 전환 mark는 splash의 span 숨김 규칙보다 명시적으로 grid 항목으로 복구한다", () => {
  const foundation = source("app/shared/tennisnote-ui-foundation.css");

  assert.match(foundation, /\.brand-splash\.is-mode-transition \.tn-mode-transition-mark/);
  assert.match(foundation, /position: static/);
  assert.match(foundation, /min-inline-size: min\(280px, calc\(100% - 32px\)\)/);
});
