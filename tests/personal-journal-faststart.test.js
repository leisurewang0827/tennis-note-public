import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { File } from "node:buffer";
import vm from "node:vm";

const read = (name) => readFileSync(new URL(`../app/shared/${name}`, import.meta.url), "utf8");
function box(type, payload = Buffer.alloc(0)) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + payload.length);
  header.write(type, 4, 4, "ascii");
  return Buffer.concat([header, payload]);
}
function track(handler, codec, offset) {
  const hdlr = box("hdlr", Buffer.concat([Buffer.alloc(8), Buffer.from(handler), Buffer.alloc(12)]));
  const stsd = box("stsd", Buffer.concat([Buffer.alloc(4), Buffer.from([0, 0, 0, 1]), box(codec, Buffer.alloc(8))]));
  const chunk = Buffer.alloc(4); chunk.writeUInt32BE(offset);
  const stco = box("stco", Buffer.concat([Buffer.alloc(4), Buffer.from([0, 0, 0, 1]), chunk]));
  return box("trak", box("mdia", Buffer.concat([hdlr, box("minf", box("stbl", Buffer.concat([stsd, stco])))])));
}
function fixture() {
  const ftyp = box("ftyp", Buffer.from("isom0000", "ascii"));
  const mdat = box("mdat", Buffer.alloc(64, 0x5a));
  const moov = box("moov", Buffer.concat([track("vide", "hvc1", ftyp.length + 8), track("soun", "mp4a", ftyp.length + 24)]));
  return { ftyp, mdat, moov, file: new File([ftyp, mdat, moov], "synthetic.mp4", { type: "video/mp4", lastModified: 123 }) };
}
function runtime() {
  let sequence = 0;
  const window = { File, crypto: { randomUUID: () => `synthetic-operation-${++sequence}` } };
  const sandbox = { window };
  vm.runInNewContext(read("tennisnote-mp4-faststart.js"), sandbox);
  vm.runInNewContext(read("tennisnote-personal-journal.js"), sandbox);
  return window;
}

test("HEVC+AAC tail moov는 미디어 본문·메타데이터를 보존하며 업로드 전에 재배치", async () => {
  const window = runtime(), input = fixture();
  const output = await window.TennisNoteMp4Faststart.prepare(input.file);
  const bytes = Buffer.from(await output.arrayBuffer());
  assert.equal(output.size, input.file.size);
  assert.equal(output.name, input.file.name);
  assert.equal(output.type, input.file.type);
  assert.equal(output.lastModified, input.file.lastModified);
  assert.equal(bytes.subarray(input.ftyp.length, input.ftyp.length + input.moov.length).toString("ascii", 4, 8), "moov");
  assert.deepEqual(bytes.subarray(input.ftyp.length + input.moov.length), input.mdat);
  const table = bytes.indexOf(Buffer.from("stco"));
  assert.equal(bytes.readUInt32BE(table + 12), input.ftyp.length + 8 + input.moov.length);
  assert.equal(await window.TennisNoteMp4Faststart.prepare(output), output);
});

test("잘못된 MP4는 기록·미디어 RPC 전에 중단하고 draft를 유지", async () => {
  const window = runtime();
  let calls = 0;
  window.TennisNoteDataClient = { getSession: () => ({ access_token: "synthetic" }), rpc: async () => { calls += 1; } };
  const draft = { memo: "합성 운동 기록", journalDate: "2030-01-01", type: "개인연습" };
  const invalid = new File(["invalid"], "synthetic.mp4", { type: "video/mp4" });
  await assert.rejects(window.TennisNotePersonalJournal.save(draft, [invalid]), /personal_journal_mp4_prepare_failed/);
  assert.equal(calls, 0);
  assert.equal(draft.memo, "합성 운동 기록");
  assert.equal(draft.personalPendingSave, undefined);
});
