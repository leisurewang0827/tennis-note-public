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

test("같은 파일의 목록 응답 유실 재시도는 중복 0, 크기가 같은 별도 파일은 각각 저장", async () => {
  let sequence = 0, reserved = 0, uploaded = 0, finished = 0;
  const window = { crypto: { randomUUID: () => `synthetic-key-${++sequence}` },
    TennisNoteDataClient: {
      getSession: () => ({ access_token: "synthetic" }),
      rpc: async (name, args) => {
        if (name === "tn_reserve_personal_journal_media") {
          reserved += 1;
          return { state: "reserved", mediaId: `synthetic-media-${reserved}`,
            storagePath: `synthetic/path-${reserved}` };
        }
        if (args.target_action === "save") return { journalId: "synthetic-journal", revision: sequence };
        if (args.target_action === "finish_media") { finished += 1; return {}; }
        if (args.target_action === "list") throw new Error("synthetic_list_unavailable");
        throw new Error("unexpected_action");
      },
      uploadObject: async () => { uploaded += 1; },
    } };
  vm.runInNewContext(source("app/shared/tennisnote-personal-journal.js"), { window, globalThis: window, URL });
  const api = window.TennisNotePersonalJournal;
  const file1 = { name: "synthetic.png", type: "image/png", size: 3, lastModified: 1 };
  const file2 = { ...file1 };
  const log = { memo: "합성 기록", journalDate: "2030-01-01", type: "개인연습",
    personalOwnerId: "synthetic-owner", mediaItems: [
      { name: file1.name, uploadSelectionKey: api.selectionKey(file1), url: "blob:synthetic-1" },
    ] };
  await api.save(log, [file1]);
  assert.equal(reserved, 1);
  assert.equal(uploaded, 1);
  assert.equal(finished, 1);
  assert.equal(log.mediaItems[0].serverMediaId, "synthetic-media-1");
  await assert.rejects(api.load(), /synthetic_list_unavailable/);
  await api.save(log, [file1]);
  assert.equal(reserved, 1);
  assert.equal(uploaded, 1);
  log.mediaItems.push({ name: file2.name, uploadSelectionKey: api.selectionKey(file2), url: "blob:synthetic-2" });
  await api.save(log, [file2]);
  assert.equal(reserved, 2);
  assert.equal(uploaded, 2);
  assert.equal(finished, 2);
  assert.equal(log.mediaItems[1].serverMediaId, "synthetic-media-2");
  assert.notEqual(api.selectionKey(file1), api.selectionKey(file2));
  assert.match(source("app/tennis-note-member-app/data/journal.js"), /completedSelections/);
});
