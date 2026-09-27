const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = p => readFileSync(path.join(__dirname, "..", p), "utf8");

test("빈 개인운동은 정확한 안내로 RPC·업로드 전에 차단", async () => {
  let calls = 0;
  const window = { TennisNoteDataClient: { getSession: () => ({ access_token: "synthetic" }),
    rpc: () => { calls++; }, uploadObject: () => { calls++; } } };
  vm.runInNewContext(read("app/shared/tennisnote-personal-journal.js"), { window });
  const api = window.TennisNotePersonalJournal;
  for (const memo of ["", "  ", "\n\t"]) {
    await assert.rejects(api.save({ memo }), /personal_journal_invalid_content/);
  }
  for (const error of [{ code: "personal_journal_invalid_content" }, { message: "Personal Journal Invalid Content" }]) {
    assert.equal(api.errorMessage(error), "오늘 운동 기록을 입력해 주세요.");
  }
  assert.equal(calls, 0);
});

test("실제 modular 저장 함수는 빈 입력·파일을 보존하고 메모로 focus", async () => {
  const memo = { value: "  ", attributes: {}, setAttribute(k, v) { this.attributes[k] = v; },
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } };
  let message;
  const sandbox = { $: s => { assert.equal(s, "#practiceMemo"); return memo; },
    personalJournalStatus: value => { message = value; } };
  const fn = read("app/tennis-note-member-app/actions/journal.js").match(/^async function savePracticeLog\([^]*?^}/m)[0];
  vm.runInNewContext(fn + "; result = savePracticeLog();", sandbox);
  assert.equal(await sandbox.result, false);
  assert.equal(message, "오늘 운동 기록을 입력해 주세요.");
  assert.equal(memo.value, "  ");
  assert.equal(memo.focused && memo.scrolled, true);
  assert.deepEqual(memo.attributes, { "aria-invalid": "true", "aria-describedby": "personalJournalStatus" });
});

test("상세 media 정지는 video/audio 공통이며 hidden/pagehide만으로도 호출", () => {
  let pauses = 0;
  const media = [{ currentTime: 12, pause() { pauses++; } }, { currentTime: 24, pause() { pauses++; } }];
  const listeners = {};
  const window = { document: { hidden: false, querySelectorAll: selector => {
    assert.equal(selector, "#journalDetailContent video, #journalDetailContent audio"); return media;
  }, addEventListener: (name, fn) => { listeners[name] = fn; } },
  addEventListener: (name, fn) => { listeners[name] = fn; } };
  vm.runInNewContext(read("app/shared/tennisnote-personal-journal.js"), { window });
  listeners.visibilitychange(); assert.equal(pauses, 0);
  window.document.hidden = true; listeners.visibilitychange(); assert.equal(pauses, 2);
  listeners.pagehide(); assert.equal(pauses, 4);
  window.TennisNotePersonalJournal.pauseDetailMedia(); assert.equal(pauses, 6);
  assert.deepEqual(media.map(m => m.currentTime), [12, 24]);
  const ui = read("app/tennis-note-member-app/ui/screens.js");
  for (const name of ["openJournalDetail", "openJournalDay", "closeJournalDetail"]) {
    assert.match(ui.match(new RegExp("^function " + name + "\\([^]*?^}", "m"))[0], /pauseDetailMedia\(\)/);
  }
  assert.match(ui.match(/^function openCoachMode\([^]*?^}/m)[0], /closeJournalDetail\(\)/);
  assert.match(read("app/tennis-note-member-app/forms/common.js"), /activeMemberView !== viewId\) closeJournalDetail\(\)/);
});
