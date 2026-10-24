import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const canonicalGitLf = source => Buffer.from(source.toString("utf8").replace(/\r\n?/g, "\n"), "utf8");
const sha256 = source => createHash("sha256").update(canonicalGitLf(Buffer.from(source, "utf8"))).digest("hex");
const spec = JSON.parse(read("tests/fixtures/r3-manual-payout-source-parity.json"));
const EXPECTED_PRIVATE_COMMIT = "a31a9e1be3d5acfa8dd859de79a0730ea2d4b5e6";
const EXPECTED_PRIVATE_SOURCE = new Map([
  ["90-Dashboard/tennis-note-prototype/app.js", {
    sha256: "00417fefe0c88367271543b40325fffe7d4615d61ad6f8a622702ee0d47d7c7f",
    gitBlobSha1: "b2e7ed287bf7e7b7822bfaa93868ccc4382095a6",
    observedWindowsCheckoutSha256: "2f9e63e0ee9d4bb013976801106fcfaf408dbe12f7d9e9e52af70ddc2fd9f5d0",
  }],
  ["90-Dashboard/tennis-note-coach-app/app.js", {
    sha256: "6a7c6f2e748536a2abb90a90d31d5b1188b1c2e1206d4d8c9e70cac4b8740245",
    gitBlobSha1: "4837d092bd83c957e5166b4c5e9f8eafe0a48981",
    observedWindowsCheckoutSha256: "d45683f2fcfad53b36bac531be295a3a39e07bb64fadce4dd8fb22e25e88cc06",
  }],
  ["supabase/supabase/migrations/20261023001000_tennisnote_r3_manual_payout_record.sql", {
    sha256: "a78c682f9f1b86ca239299053bf8618979cc3cb188809e1fb4f6aadaf3dea099",
    gitBlobSha1: "67847edeac2d8cb2d202c47e4f9e539f11707783",
    observedWindowsCheckoutSha256: "a78c682f9f1b86ca239299053bf8618979cc3cb188809e1fb4f6aadaf3dea099",
  }],
]);

function validatePrivateSourceBinding(binding, files) {
  assert.equal(binding?.kind, "git-commit-blob-and-canonical-git-lf-sha256");
  assert.equal(binding?.commit, EXPECTED_PRIVATE_COMMIT);
  assert.match(binding.commit, /^[0-9a-f]{40}$/);
  const actualPaths = files.map(source => source.path);
  assert.equal(new Set(actualPaths).size, actualPaths.length, "duplicate private source path");
  assert.deepEqual(actualPaths.slice().sort(), [...EXPECTED_PRIVATE_SOURCE.keys()].sort(), "private source path set mismatch");
  for (const source of files) {
    const expected = EXPECTED_PRIVATE_SOURCE.get(source.path);
    assert.ok(expected, `unreviewed private source path: ${source.path}`);
    assert.equal(source.sha256, expected.sha256, `canonical Git-LF pin drift: ${source.path}`);
    assert.equal(source.gitBlobSha1, expected.gitBlobSha1, `Git object pin drift: ${source.path}`);
    assert.equal(source.observedWindowsCheckoutSha256, expected.observedWindowsCheckoutSha256, `checkout-format evidence drift: ${source.path}`);
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.match(source.gitBlobSha1, /^[0-9a-f]{40}$/);
    assert.match(source.observedWindowsCheckoutSha256, /^[0-9a-f]{64}$/);
  }
}

test("R3 private authority to public modular adapter candidate hashes and function anchors are pinned", () => {
  assert.equal(spec.contract, "r3-manual-payout-private-public-semantic-parity/2");
  assert.equal(spec.parityType, "semantic-adapter-not-byte-identical");
  assert.equal(spec.publicHashContract, "sha256-utf8-canonical-git-lf-v1");
  validatePrivateSourceBinding(spec.privateSourceBinding, spec.privateAuthority.files);
  for (const source of spec.privateAuthority.files) {
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.match(source.gitBlobSha1, /^[0-9a-f]{40}$/);
    assert.ok(source.path && (source.functions || source.rpcNames));
  }
  for (const candidate of spec.publicCandidate.files) {
    const source = read(candidate.path);
    const actual = sha256(source);
    assert.equal(actual, candidate.sha256, `candidate source changed: ${candidate.path}`);
  }
  for (const binding of spec.bindings) {
    assert.ok(binding.adapterReason.length > 30);
    const joined = binding.public.map(read).join("\n");
    for (const anchor of binding.anchors) assert.ok(joined.includes(anchor), `missing adapter anchor: ${anchor}`);
  }
  const adminEntry = read("app/admin/index.html");
  const coachEntry = read("app/tennis-note-coach-app/index.html");
  for (const path of ["./events/billing.js", "./views/billing.js", "./data/billing.js", "./actions/billing.js"]) assert.ok(adminEntry.includes(path));
  for (const path of ["domain/settlement.js", "data/sync.js", "views/settlement.js"]) assert.ok(coachEntry.includes(path));
});

test("private binding rejects missing, changed and newline-confused source pins", () => {
  const files = structuredClone(spec.privateAuthority.files);
  assert.throws(() => validatePrivateSourceBinding(spec.privateSourceBinding, files.slice(1)));

  const duplicatePath = structuredClone(files);
  duplicatePath[1].path = duplicatePath[0].path;
  assert.throws(() => validatePrivateSourceBinding(spec.privateSourceBinding, duplicatePath), /duplicate private source path/);

  const missingBlob = structuredClone(files);
  delete missingBlob[0].gitBlobSha1;
  assert.throws(() => validatePrivateSourceBinding(spec.privateSourceBinding, missingBlob), /Git object pin drift/);

  const changedSource = structuredClone(files);
  changedSource[2].sha256 = "0".repeat(64);
  assert.throws(() => validatePrivateSourceBinding(spec.privateSourceBinding, changedSource), /canonical Git-LF pin drift/);

  const lf = Buffer.from("line one\nline two\n", "utf8");
  const crlf = Buffer.from(lf.toString("utf8").replace(/\n/g, "\r\n"), "utf8");
  assert.equal(sha256(lf.toString("utf8")), sha256(crlf.toString("utf8")));
  assert.notEqual(createHash("sha256").update(lf).digest("hex"), createHash("sha256").update(crlf).digest("hex"));
  assert.deepEqual(canonicalGitLf(crlf), lf);
});

const privateRepo = process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
test("private pins resolve to the exact reviewed Git commit blobs", { skip: !privateRepo }, () => {
  const commit = spec.privateSourceBinding.commit;
  for (const source of spec.privateAuthority.files) {
    const objectId = execFileSync("git", ["-C", privateRepo, "rev-parse", `${commit}:${source.path}`], { encoding: "utf8" }).trim();
    assert.equal(objectId, source.gitBlobSha1, `commit blob mismatch: ${source.path}`);

    const committedBytes = execFileSync("git", ["-C", privateRepo, "show", `${commit}:${source.path}`], { maxBuffer: 16 * 1024 * 1024 });
    const canonicalBytes = canonicalGitLf(committedBytes);
    assert.deepEqual(committedBytes, canonicalBytes, `Git commit blob is not canonical LF: ${source.path}`);
    assert.equal(createHash("sha256").update(canonicalBytes).digest("hex"), source.sha256, `commit content mismatch: ${source.path}`);

    const computedObjectId = execFileSync("git", ["-C", privateRepo, "hash-object", "--stdin"], { input: canonicalBytes, encoding: "utf8" }).trim();
    assert.equal(computedObjectId, objectId, `Git blob hash does not bind content: ${source.path}`);
  }
});
