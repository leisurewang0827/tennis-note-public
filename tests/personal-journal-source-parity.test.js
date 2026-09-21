import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(read("docs/tennisnote-personal-journal-source-parity.json"));
test("개인운동 모듈은 검증된 private 함수 및 공용 파일과 정확히 동일", () => {
  assert.equal(manifest.privateSourceSha, "d3cf3a8f64d18feb00492dd06c9aad5df1ec4368");
  assert.equal(manifest.functions.length, 17);
  for (const entry of manifest.functions) {
    const matches = [...read(entry.path).matchAll(new RegExp("^(?:async )?function " + entry.name + "\\([^]*?^}", "gm"))];
    assert.equal(matches.length, 1, entry.name);
    assert.equal(digest(matches[0][0]), entry.sha256, entry.name);
  }
  assert.equal(digest(read(manifest.shared.path)), manifest.shared.sha256);
  const transport = read(manifest.transport.path).match(/^  async function deleteObject\([^]*?^  }/m);
  assert.equal(manifest.transport.privateSourceSha, "bab72f668b394330227cf8f67250c971cde876c5");
  assert.equal(digest(transport[0]), manifest.transport.sha256);
});
test("개인운동 실제 entry·캐시·상세 이벤트 등록은 한 번", () => {
  for (const file of ["index.html", "service-worker.js"]) {
    assert.equal(read("app/tennis-note-member-app/" + file).split("tennisnote-personal-journal.js").length - 1, 1);
  }
  const events = read("app/tennis-note-member-app/events/schedule.js");
  assert.match(events, /editPersonalJournal\(edit.dataset.editPersonalJournal\)/);
  assert.match(events, /deletePersonalJournal\(remove.dataset.deletePersonalJournal, remove\)/);
});
