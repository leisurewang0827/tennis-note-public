import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("개인운동 영상은 1GB까지 허용하고 사진은 100MB 제한을 유지", () => {
  const sandbox = {
    window: {
      crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
      URL,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(read("app/shared/tennisnote-personal-journal.js"), sandbox);
  const validate = sandbox.window.TennisNotePersonalJournal.validateFiles;
  assert.doesNotThrow(() => validate([{ name: "long.mp4", type: "video/mp4", size: 1024 * 1024 * 1024 }]));
  assert.throws(() => validate([{ name: "too-long.mp4", type: "video/mp4", size: 1024 * 1024 * 1024 + 1 }]));
  assert.throws(() => validate([{ name: "too-large.jpg", type: "image/jpeg", size: 100 * 1024 * 1024 + 1 }]));
});

test("큰 영상은 6MB 재개 업로드와 비공개 스트리밍 경로를 사용", () => {
  const client = read("app/shared/tennisnote-data-client.js");
  assert.match(client, /resumableUploadChunkBytes = 6 \* 1024 \* 1024/);
  assert.match(client, /method: "HEAD"/);
  assert.match(client, /method: "PATCH"/);
  assert.match(client, /"Upload-Offset"/);
  assert.match(client, /createSignedObjectUrl/);
  assert.match(read("app/shared/tennisnote-personal-journal.js"), /tn_reserve_personal_journal_media/);
  assert.match(read("app/tennis-note-member-app/events/delegated.js"), /개인운동-upload-progress|personal-journal-upload-progress/);
  assert.match(read("app/tennis-note-member-app/index.html"), /영상 MP4·MOV·WebM은 파일당 1GB 이하/);
  assert.match(read("app/tennis-note-coach-app/data/records.js"), /createSignedObjectUrl/);
  assert.match(read("app/admin/ui/common.js"), /createSignedObjectUrl/);
});
