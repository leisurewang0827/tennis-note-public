import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(read("docs/tennisnote-personal-journal-source-parity.json"));
test("개인운동 모듈은 검증된 private 함수 및 공용 파일과 정확히 동일", () => {
  const latestSource = "f408dae5c6918139c4d95067808b221439eb14da";
  assert.equal(manifest.privateSourceSha, latestSource);
  assert.equal(manifest.functions.length, 23);
  const latestFunctions = ["mediaItemsFromInput", "handleJournalMediaPreviewError", "savePracticeLog",
    "syncPersonalJournalFromServer", "renderMediaPreview", "openJournalDetail", "closeJournalDetail"];
  assert.deepEqual(manifest.functions.filter((entry) => entry.privateSourceSha === latestSource).map((entry) => entry.name), latestFunctions);
  for (const name of ["editPersonalJournal", "recoverLocalPersonalJournal", "openJournalComposer"]) {
    assert.equal(manifest.functions.find((entry) => entry.name === name)?.privateSourceSha,
      "c94b6dcb0a047d0fae9af1e55db3669bae98d831");
  }
  for (const name of ["personalJournalActionsMarkup", "sharePersonalJournal"]) {
    assert.equal(manifest.functions.find((entry) => entry.name === name)?.privateSourceSha, "LOCAL_WORKTREE");
  }
  assert.equal(manifest.functions.find((entry) => entry.name === "openJournalDay")?.privateSourceSha,
    "e2333baeae753393d005b16a4757f4d4af65064a");
  for (const entry of manifest.functions) {
    const matches = [...read(entry.path).matchAll(new RegExp("^(?:async )?function " + entry.name + "\\([^]*?^}", "gm"))];
    assert.equal(matches.length, 1, entry.name);
    assert.equal(digest(matches[0][0]), entry.sha256, entry.name);
  }
  assert.equal(digest(read(manifest.shared.path)), manifest.shared.sha256);
  assert.equal(manifest.shared.privateSourceSha, "LOCAL_WORKTREE");
  assert.equal(manifest.shared.sourceContentSha256, manifest.shared.sha256);
  assert.equal(digest(read(manifest.faststart.path)), manifest.faststart.sha256);
  assert.equal(manifest.faststart.privateSourceSha, "4f61594058a83f7a0be9afd5ef9163cfc486fa46");
  const transport = read(manifest.transport.path).match(/^  async function deleteObject\([^]*?^  }/m);
  assert.equal(manifest.transport.privateSourceSha, "bab72f668b394330227cf8f67250c971cde876c5");
  assert.equal(digest(transport[0]), manifest.transport.sha256);
});
test("개인운동 실제 entry·캐시·상세 이벤트 등록은 한 번", () => {
  for (const file of ["index.html", "service-worker.js"]) {
    assert.equal(read("app/tennis-note-member-app/" + file).split("tennisnote-personal-journal.js").length - 1, 1);
    assert.equal(read("app/tennis-note-member-app/" + file).split("tennisnote-mp4-faststart.js").length - 1, 1);
  }
  assert.match(read("app/tennis-note-member-app/events/delegated.js"), /personal-journal-prepare-progress/);
  const events = read("app/tennis-note-member-app/events/schedule.js");
  assert.match(events, /editPersonalJournal\(edit.dataset.editPersonalJournal\)/);
  assert.match(events, /sharePersonalJournal\(share.dataset.sharePersonalJournal, share\)/);
  assert.match(events, /recoverLocalPersonalJournal\(recover.dataset.recoverPersonalJournal\)/);
  assert.match(events, /deletePersonalJournal\(remove.dataset.deletePersonalJournal, remove\)/);
});
