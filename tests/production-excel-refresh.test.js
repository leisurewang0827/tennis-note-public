// 운영 exact 원본 + 검증된 개발 source에서 승인된 두 경로만 조립했는지 검사.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const norm = s => s.replace(/\r\n/g, "\n");
const read = p => norm(fs.readFileSync(p, "utf8"));
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const manifest = JSON.parse(read("tests/fixtures/production-excel-refresh-source.json"));
const show = (revision, p) => norm(execFileSync("git", ["show", `${revision}:${p}`], { encoding: "utf8", maxBuffer: 8e6 }));
const paths = ["app/admin/actions/common.js", "app/shared/tennisnote-single-sheet-preview-ui.js"];
test("Excel 최소 조립: 운영 exact base·개발 authority·두 경로·10 hunks·역이식", () => {
  assert.equal(manifest.base, "11e8928e369c9d9a4eedaa572102f75d1681602b");
  assert.equal(manifest.source, "f8473839a097d9443dd6f2df61cb802be9ab698b");
  assert.equal(manifest.privateAuthority, "dc89f2ebd17af38c96e84087f2df99221d69075f");
  assert.deepEqual(manifest.products.map(p => p.path), paths);
  assert.deepEqual(manifest.products.map(p => p.hunks.length), [3,7]);
  const changed = execFileSync("git", ["diff", "--name-only", manifest.base, "--", "app"], { encoding: "utf8" }).trim().split("\n").sort();
  assert.deepEqual(changed, paths.slice().sort());
  for (const p of manifest.products) {
    let source = show(manifest.base, p.path);
    assert.equal(hash(source), p.baseSha256);
    assert.equal(execFileSync("git", ["rev-parse", `${manifest.source}:${p.path}`], { encoding: "utf8" }).trim(), p.sourceBlob);
    const authority = show(manifest.source, p.path);
    for (const h of p.hunks) {
      assert.equal(source.split(h.before).length, 2);
      // 회원등록 라벨은 이번 기능에서 바꾸지 않고 기존 운영 의미를 보존한다.
      const normalizedAuthority = authority.replace("기존 회원에 새 회원권 추가 · 기존권 보존", "다른 코치 회원권 추가 · 기존권 보존");
      assert.equal(normalizedAuthority.split(h.after).length, 2, `authority hunk: ${p.path}`);
      source = source.replace(h.before, () => h.after);
    }
    assert.equal(hash(source), p.candidateSha256);
    assert.equal(read(p.path), source);
    for (const h of [...p.hunks].reverse()) {
      assert.equal(source.split(h.after).length, 2);
      source = source.replace(h.after, () => h.before);
    }
    assert.equal(source, show(manifest.base, p.path));
  }
});
test("Excel 최소 조립: 신규 RPC·template/onboarding/payment HOLD 없음·운영 서버·캐시 불변", () => {
  for (const p of paths) {
    const before = show(manifest.base, p), after = read(p);
    const calls = text => [...text.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)].map(m => m[1]);
    assert.deepEqual(calls(after), calls(before));
    for (const marker of ["loadAdminPaymentHoldReasons", "TEMPLATE_COACHES_REQUIRED", "SHEET_PRODUCT_SESSION_MISMATCH", "tn_save_my_signup_profile", "tn_admin_review_signup_link"]) assert(!after.includes(marker), marker);
  }
  for (const path of ["app/release.json", "app/shared/tennisnote-release.js", "app/shared/tennisnote-data-client.js", "app/shared/tennisnote-single-sheet-batch.js", "app/shared/tennisnote-single-sheet-snapshot.js", "app/shared/tennisnote-single-sheet-transport.js", "app/shared/tennisnote-single-sheet-import.js", "app/shared/tennisnote-single-sheet-worker.js", "app/tennis-note-member-app/service-worker.js", "app/tennis-note-coach-app/service-worker.js", ".github/workflows/deploy-cloudflare-pages.yml", ".github/workflows/deploy-cloudflare-pages-dev.yml", "scripts/bump_release.py"]) assert.equal(read(path), show(manifest.base, path), path);
  assert.equal(JSON.parse(read("app/release.json")).version, "1.0.533");
  assert.equal(manifest.releaseUnchanged, true);
});
