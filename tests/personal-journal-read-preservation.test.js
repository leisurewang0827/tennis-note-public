const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function source(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function journalApi() {
  const window = {
    crypto: { randomUUID: () => "test-key", subtle: {} },
    TennisNoteDataClient: {},
  };
  vm.runInNewContext(source("app/shared/tennisnote-personal-journal.js"), { window, globalThis: window, URL });
  return window.TennisNotePersonalJournal;
}

test("개인 운동일지 조회 오류는 권한과 연결 오류를 구분하고 기존 입력 보존을 안내한다", () => {
  const api = journalApi();
  assert.match(api.errorMessage({ status: 403 }, "list"), /접근 권한/);
  assert.match(api.errorMessage(new Error("network unavailable"), "list"), /기존 기록과 입력은 유지/);
  assert.match(api.errorMessage(new Error("personal_journal_login_required"), "list"), /로그인이 필요/);
});

test("조회 실패는 빈 목록으로 덮어쓰지 않고 소유자별 오류 상태를 렌더링한다", () => {
  const data = source("app/tennis-note-member-app/data/journal.js");
  const view = source("app/tennis-note-member-app/views/journal.js");
  const settings = source("app/tennis-note-member-app/settings.js");
  assert.doesNotMatch(data, /syncPersonalJournalFromServer\(\)\.catch\(\(\) => false\)/);
  assert.match(data, /personalJournalReadError = \{ owner, message: api\.errorMessage\(error, "list"\) \}/);
  assert.match(data, /state\.practiceLogs = \[\.\.\.loaded\.logs/);
  assert.match(view, /data-personal-journal-read-error/);
  assert.match(view, /readError \? "" : memberEmptyState/);
  assert.match(settings, /let personalJournalReadError = null/);
});

test("공용 API는 잘못된 목록 응답을 정상 빈 목록으로 취급하지 않는다", () => {
  const shared = source("app/shared/tennisnote-personal-journal.js");
  assert.match(shared, /!Array\.isArray\(data\?\.entries\) \|\| !Array\.isArray\(data\?\.media\)/);
  assert.match(shared, /personal_journal_invalid_list/);
});
