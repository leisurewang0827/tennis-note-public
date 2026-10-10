// 신규가입·정산을 제외한 기존 본인 프로필 증분. 실제 계정·DB 접근 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import guard from "./helpers/self-profile-a-only.cjs";
const { contract, hash, normalize, undoRelease, restoreCandidate } = guard;
const raw = file => normalize(fs.readFileSync(file, "utf8"));
const show = file => normalize(execFileSync("git", ["show", `${contract.base}:${file}`], { encoding: "utf8", maxBuffer: 12e6 }));
test("본인 프로필 A-only: 정확한 13경로·43hunk·원PROD 전체 역변환·구문", () => {
  assert.equal(contract.base, "e048a85ec59b39dfbaea0cff89d32564bad94157");
  assert.equal(contract.inventoryHash, "8617514f26f89507b409584724c9eda7c336ab92d74e980f854e50d4e7d77307");
  assert.equal(contract.files.length, 13);
  assert.equal(contract.files.reduce((n, r) => n + r.patches.length, 0), 43);
  for (const row of contract.files) {
    const candidate = undoRelease(row.path, raw(row.path));
    assert.equal(hash(candidate), row.afterHash);
    assert.equal(restoreCandidate(row.path, raw(row.path)), show(row.path));
    if (row.path.endsWith(".js")) new vm.Script(candidate, { filename: row.path });
    assert.throws(() => restoreCandidate(row.path, raw(row.path) + "\n"), /drift/);
    const p = row.patches.at(-1);
    assert.throws(() => restoreCandidate(row.path, candidate.replace(p.after, "")), /drift/);
    assert.throws(() => restoreCandidate(row.path, candidate + p.after), /drift/);
  }
});
test("본인 프로필 A-only: 신규가입·session link·보강·개인불참·R3 호출 증가 0", () => {
  for (const marker of ["tn_save_my_signup_profile", "signupProfileOperation", "requireSignupReadback", "expectedProfileId", "expectedAuthUserId", "tn_book_makeup_entitlement", "tn_request_future_participant_absence", "tn_admin_record_monthly_settlement_manual_payment"]) {
    for (const row of contract.files) assert.equal(undoRelease(row.path, raw(row.path)).split(marker).length, show(row.path).split(marker).length, `${marker}: ${row.path}`);
  }
});
