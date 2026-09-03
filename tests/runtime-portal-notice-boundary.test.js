import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = "app/shared/tennisnote-runtime-environment.js";
const runtimeSource = readFileSync(join(root, runtimePath), "utf8");

function loadRuntime(environment, origin, releaseId = "test.release.1") {
  const values = new Map();
  const sessionStorage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const document = {
    readyState: "loading",
    documentElement: { dataset: {} },
    addEventListener: () => undefined,
    querySelector: () => null,
    createElement: () => ({ dataset: {}, style: {}, setAttribute() {} }),
    body: { prepend() {} },
  };
  const window = {
    TENNISNOTE_CONFIG: { environment },
    TENNIS_NOTE_RELEASE: { version: "1.0.test", releaseId },
    location: { origin },
    sessionStorage,
  };
  new Function("window", "document", "URL", runtimeSource)(window, document, URL);
  return { api: window.TennisNoteRuntimeEnvironment, window };
}

test("런타임별 member coach admin 포털을 권위 URL로 해석하고 origin 불일치는 차단한다", () => {
  const development = loadRuntime("development", "https://tennisnote-app-dev.pages.dev").api;
  assert.deepEqual(development.resolvePortal("member"), { ok: true, code: "", url: "https://tennisnote-app-dev.pages.dev/" });
  assert.deepEqual(development.resolvePortal("coach"), { ok: true, code: "", url: "https://tennisnote-app-dev.pages.dev/tennis-note-coach-app/" });
  assert.deepEqual(development.resolvePortal("admin"), { ok: true, code: "", url: "https://tennisnote-admin-dev.pages.dev/" });

  const production = loadRuntime("production", "https://tennisnote-app.pages.dev").api;
  assert.equal(production.resolvePortal("coach").url, "https://tennisnote-app.pages.dev/tennis-note-coach-app/");
  assert.equal(production.resolvePortal("admin").url, "https://tennisnote-admin.pages.dev/");

  const mismatch = loadRuntime("development", "https://tennisnote-app.pages.dev").api.resolvePortal("coach");
  assert.deepEqual(mismatch, { ok: false, code: "runtime_origin_mismatch", url: "" });
  assert.equal(runtimeSource.includes("tennisnote-coach-dev.pages.dev"), false);
});

test("공지 확인은 같은 session의 역할 전환에서 유지되고 release 또는 내용 변경 때만 풀린다", () => {
  const { api, window } = loadRuntime("development", "https://tennisnote-app-dev.pages.dev");
  const source = { id: "synthetic-notice", title: "Synthetic notice", body: "Testing announcement", updatedAt: "revision-1" };
  const notice = api.localizeSyntheticNotice(source);
  assert.equal(notice.title, "개발 검증 안내");
  assert.equal(notice.body, "서울 개발 환경의 화면 흐름을 확인하기 위한 합성 안내입니다.");
  assert.equal(api.hasNoticeAcknowledgement(notice, "member"), false);
  assert.equal(api.acknowledgeNotice(notice, "member"), true);
  assert.equal(api.hasNoticeAcknowledgement(notice, "coach"), true);

  const changed = api.localizeSyntheticNotice({ ...source, body: "Changed testing announcement" });
  assert.equal(api.hasNoticeAcknowledgement(changed, "member"), false);
  window.TENNIS_NOTE_RELEASE = { version: "1.0.test", releaseId: "test.release.2" };
  assert.equal(api.hasNoticeAcknowledgement(notice, "member"), false);
});

test("modular entry와 service worker가 runtime을 실제 실행 순서와 offline shell에 포함한다", () => {
  for (const app of ["tennis-note-member-app", "tennis-note-coach-app"]) {
    const html = readFileSync(join(root, `app/${app}/index.html`), "utf8");
    const worker = readFileSync(join(root, `app/${app}/service-worker.js`), "utf8");
    assert.ok(html.indexOf("tennisnote-runtime-environment.js") > html.indexOf("config.local.js"));
    assert.ok(html.indexOf("tennisnote-runtime-environment.js") < html.indexOf("tennisnote-app-common.js"));
    assert.match(worker, /shared\/tennisnote-runtime-environment\.js/);
  }
});

test("modular 권위 함수들이 runtime resolver와 공지 acknowledgment를 직접 호출한다", () => {
  const shared = readFileSync(join(root, "app/shared/tennisnote-app-common.js"), "utf8");
  const memberDomain = readFileSync(join(root, "app/tennis-note-member-app/domain/notices.js"), "utf8");
  const memberForm = readFileSync(join(root, "app/tennis-note-member-app/forms/common.js"), "utf8");
  const memberUi = readFileSync(join(root, "app/tennis-note-member-app/ui/screens.js"), "utf8");
  const coachDomain = readFileSync(join(root, "app/tennis-note-coach-app/domain/notices.js"), "utf8");
  const coachForm = readFileSync(join(root, "app/tennis-note-coach-app/forms/common.js"), "utf8");
  const coachUi = readFileSync(join(root, "app/tennis-note-coach-app/ui/screens.js"), "utf8");
  const coachApp = readFileSync(join(root, "app/tennis-note-coach-app/app.js"), "utf8");

  assert.match(shared, /noticeAcknowledgementKey/);
  assert.match(shared, /acknowledgeNotice/);
  assert.match(memberDomain, /localizeSyntheticNotice/);
  assert.match(coachDomain, /localizeSyntheticNotice/);
  assert.match(memberForm, /resolvePortal\?\.\("member"\)/);
  assert.match(coachForm, /resolvePortal\?\.\("coach"\)/);
  assert.match(memberUi, /hasNoticeAcknowledgement\?\.\(item, "member"\)/);
  assert.match(coachUi, /hasNoticeAcknowledgement\?\.\(item, "coach"\)/);
  assert.match(coachUi, /resolvePortal\?\.\(adminRequested \? "admin" : "coach"\)/);
  assert.doesNotMatch(coachApp + coachUi, /const (?:coach|admin)WebPortalUrl/);
});
