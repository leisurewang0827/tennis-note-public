// 신규가입·정산을 제외한 기존 본인 프로필 증분. 실제 계정·DB 접근 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import guard from "./helpers/self-profile-a-only.cjs";
const { contract, hash, normalize, undoRelease, restoreCandidate, restoreDevelopmentCandidate } = guard;
const production = "686cc97d9676da2d16ca3cdfbd862dc9cd19434e";
// 운영 A-only 원본 pin은 DEV의 후속 기능/릴리스와 분리해 그대로 검증한다.
const raw = file => normalize(execFileSync("git", ["show", `${production}:${file}`], { encoding: "utf8", maxBuffer: 12e6 }));
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

test("DEV 현재 계약: 운영 old pin 불변, 13제품·13릴리스 exact 역변환", () => {
  const dev = contract.development;
  assert.equal(dev.base, "e794c18059ff3391af9a5494f6389cfa0de70c2b");
  assert.equal(dev.product.length, 13);
  assert.equal(dev.releaseFiles.length, 13);
  assert.equal(dev.version.after, "1.0.548");
  const paths = new Set([...dev.product, ...dev.releaseFiles].map(row => row.path));
  assert.equal(paths.size, 24);
  for (const file of paths) {
    const current = normalize(fs.readFileSync(file, "utf8"));
    const baseline = normalize(execFileSync("git", ["show", `${dev.base}:${file}`], { encoding: "utf8", maxBuffer: 12e6 }));
    assert.equal(restoreDevelopmentCandidate(file, current), baseline, file);
    assert.throws(() => restoreDevelopmentCandidate(file, current + "\n"), /drift/, file);
  }
  for (const file of ["app/tennis-note-member-app/actions/profile.js",
    "app/tennis-note-member-app/events/profile.js", "app/tennis-note-member-app/views/profile.js"]) {
    assert.equal(hash(fs.readFileSync(file, "utf8")), hash(raw(file)), `operating A-only profile blob: ${file}`);
  }
});

test("DEV 현재 계약: 본인 scope·응답유실·가입 경계와 늦은 로그아웃 보호", () => {
  const source = file => normalize(fs.readFileSync(file, "utf8"));
  const required = [
    ["app/tennis-note-member-app/data/auth.js", ["tn_save_my_verified_profile_phone", "target_expected_phone", "target_operation_key", "tn_save_my_signup_profile", "requireSignupReadback"]],
    ["app/tennis-note-member-app/actions/profile.js", ["profile_revision_required", "profile_atomic_readback_unconfirmed", "selfProfileStyleOperation"]],
    ["app/tennis-note-member-app/forms/members.js", ["phoneVerificationOwnerCurrent", "syncPhoneVerificationControl"]],
    ["app/tennis-note-member-app/actions/enrollment.js", ["preserveCompletion", "profile.updated_at", "phoneVerificationRequestCurrent"]],
    ["app/shared/tennisnote-data-client.js", ["updated_at", "tennisnote:auth-session-cleared"]],
  ];
  for (const [file, markers] of required) {
    const text = source(file);
    for (const marker of markers) assert(text.includes(marker), `${file}: ${marker}`);
    assert.equal(restoreDevelopmentCandidate(file, text), normalize(execFileSync("git", ["show", `${contract.development.base}:${file}`], { encoding: "utf8", maxBuffer: 12e6 })));
    assert.throws(() => restoreDevelopmentCandidate(file, text.replace(markers[0], "")), /drift/);
  }
});

test("DEV 배포는 exact dev push Core 성공 뒤 기존 dev 프로젝트에만 연결", () => {
  const ci = fs.readFileSync(".github/workflows/tennisnote-public-ci.yml", "utf8");
  const deploy = fs.readFileSync(".github/workflows/deploy-cloudflare-pages-dev.yml", "utf8");
  assert.match(ci, /deploy-development-after-ci:\s*\n\s*if:.*github\.event_name == 'push'.*github\.ref == 'refs\/heads\/dev'/);
  assert.match(ci, /deploy-development-after-ci:[\s\S]*?needs: build-and-check\s*\n\s*uses: \.\/\.github\/workflows\/deploy-cloudflare-pages-dev\.yml/);
  assert.match(deploy, /^on:\s*\n\s*workflow_call:/m);
  assert.doesNotMatch(deploy, /workflow_dispatch:|project create|\bbranches:\s*\[dev\]/);
  for (const marker of [
    "ref: ${{ github.sha }}", "GITHUB_EVENT_NAME", "refs/heads/dev", "GITHUB_SHA",
    "EXPECTED_DEV_SUPABASE_FINGERPRINT", "DEV_CLOUDFLARE_ACCOUNT_FINGERPRINT",
    "development_pages_project_missing", "development_pages_branch_mismatch",
    "--project-name=tennisnote-app-dev --branch=dev", "--project-name=tennisnote-admin-dev --branch=dev",
  ]) assert(deploy.includes(marker), `development deploy guard: ${marker}`);
});
