// Read-only source packet. Never load credentials or submit an operational request.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dir = "release-sources/r4-first-issue-candidate/";
const sources = Object.freeze(Object.fromEntries([
  ["dbInstall", "repo", "release-sources/r4-first-issue-correction/prod-install-corrected.sql", "e63110be73bddee0bf1cb91f58b4cda753f1b8aa4891d755c637001eab5f7b23"],
  ["lessonGuard", "local", "canary-single-lesson-guard.sql", "c29b0ac8658dac4a865063ab7a779843ee55bb69deee0dacb4371942fdf45801"],
  ["lessonStorageFence", "local", "canary-lesson-storage-fence.sql", "08dd2b8f3ddd4d3afe95f870d7bb35321a101fc692a7f1a9084eefebe073f3ea"],
  ["issueCommitFence", "local", "canary-issue-commit-fence.sql", "2f6e71294cdc18298d8d2d001cfef90557766b7772866099621a07792613b6ca"],
  ["scopedCleanup", "local", "canary-bound-cleanup.mjs", "7c38b5fa9e0db86c97f740b77237db8347214143e37a70a0c36e7e6b7f3caf07"],
  ["offReadback", "repo", dir + "prod-readback-template-v2.sql", "6a4afce725c7b1c1fe09692f046fe3ffe83133e54c730b780ee17bc2bebaf6a8"],
  ["issueFenceRestore", "local", "canary-issue-commit-fence-restore.sql", "af19451fa2588aadf4f07267a355ac61b20e53d1969947f3787a9656eea4bab2"],
  ["lessonGuardRestore", "local", "canary-lesson-guard-restore.sql", "ce052826f5deca0951dcb2b0da7e8decf31f3d80b2e3121347a6c9e20e51d6ce"],
  ["dbRestore", "repo", dir + "prod-restore-template-v2.sql", "29ad67c914d1a2efff2c8d3bfcc8f78b64eb63ab21787b426f6a02472c9715d6"],
  ["adminSeal", "repo", dir + "admin-overlay-seal-v4.json", "7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e"],
].map(([name, root, path, sha256]) => [name, Object.freeze({ root, path, sha256 })])));
const target = Object.freeze({
  repo: "leisurewang0827/tennis-note-public",
  ref: "refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108",
  evidenceParent: "cc349e385dce7582b0a8a43f442fe899415b050d",
  environment: "tennisnote-r4-admin-production",
  environmentId: 26219323796,
  dbProjectFingerprint: "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a",
  adminProject: "tennisnote-admin",
  adminArtifact: Object.freeze({
    id: 13861437991, run: 43033784106, source: "30bdd59100426cc6cee740c9b52b84c1e6c10c5d",
    sha256: "26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e",
  }),
  adminRecoveryId: "80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4",
  payment: "OFF",
  android: "HOLD",
});

const steps = Object.freeze([
  { name: "install-off", sources: ["dbInstall", "lessonGuard", "lessonStorageFence", "issueCommitFence", "offReadback"],
    requires: ["stage-review", "fresh-prod-db-preimage-and-acl", "fresh-admin-recovery"],
    verifies: ["single-install-transaction", "separate-committed-off-and-zero-scope"] },
  { name: "admin-publish", sources: ["adminSeal", "offReadback"],
    requires: ["stage-review", "same-candidate-committed-install-off", "fresh-admin-recovery", "pinned-admin-artifact"],
    verifies: ["admin-only", "new-deployment-id", "immutable-and-canonical-readback"] },
  { name: "emergency-off", sources: ["lessonGuard", "scopedCleanup", "offReadback"],
    requires: ["prearmed-by-same-candidate-opening", "exact-operation-and-session"],
    verifies: ["separate-committed-off-and-zero-scope", "exact-session-revoked", "no-ambiguous-write-retry"] },
  { name: "admin-restore", sources: ["adminSeal", "offReadback"],
    requires: ["stage-review", "same-candidate-committed-off", "same-bad-deployment-still-canonical", "pinned-admin-recovery"],
    verifies: ["admin-only", "recovery-canonical-readback"] },
  { name: "db-restore", sources: ["issueFenceRestore", "lessonGuardRestore", "dbRestore", "offReadback"],
    requires: ["stage-review", "same-candidate-committed-off", "exact-session-revoked", "token-expired", "exact-installed-preimage"],
    verifies: ["single-restore-transaction", "original-functions-and-acl", "records-and-audit-preserved"] },
].map(s => Object.freeze({ ...s, sources: Object.freeze(s.sources), requires: Object.freeze(s.requires), verifies: Object.freeze(s.verifies) })));

const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  (value && typeof value === "object" ?
    Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value);
const localFile = name => new URL("./" + name, import.meta.url);
const stopFiles = Object.freeze({
  lessonGuard: "r4_local_canary_candidate_not_authorized",
  lessonStorageFence: "r4_local_storage_fence_not_authorized",
  issueCommitFence: "r4_issue_commit_fence_review_only",
  issueFenceRestore: "r4_local_issue_fence_restore_not_authorized",
  lessonGuardRestore: "r4_local_lesson_restore_not_authorized",
});

export function buildReviewPacket(repoRoot, read = readFileSync, { offOnly = false } = {}) {
  const root = resolve(repoRoot);
  for (const [name, source] of Object.entries(sources)) {
    // Prior session-cleanup metadata is retained in the historical packet ID only.
    // This OFF-only bundle never opens a session or ships the old cleanup operator.
    if (name === "scopedCleanup" && offOnly) continue;
    const bytes = read(source.root === "repo" ? resolve(root, source.path) : localFile(source.path));
    if (!Buffer.isBuffer(bytes) || hash(bytes) !== source.sha256) throw Error("R4_PACKET_SOURCE_DRIFT:" + name);
    if (stopFiles[name] && !bytes.toString("utf8").split(/\r?\n/).slice(0, 5)
      .some(line => line.includes("raise exception '" + stopFiles[name] + "'"))) {
      throw Error("R4_PACKET_REVIEW_GUARD_MISSING:" + name);
    }
  }
  const packet = Object.freeze({
    format: "r4-first-issue-local-source-packet/v2", operational: false, executionGitSha: null,
    target, sources, steps,
    missing: Object.freeze(["registered-protected-dispatch", "approved-transport-identity",
      "exact-transactional-install-and-restore", "same-sha-independent-review-and-ci"]),
  });
  return Object.freeze({ packet, sha256: hash(JSON.stringify(canonical(packet))) });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw Error("Usage: node first-issue-release-packet.mjs <candidate-checkout>");
  const { packet, sha256 } = buildReviewPacket(process.argv[2]);
  console.log(JSON.stringify({ sha256, operational: packet.operational, sources: Object.keys(packet.sources).length,
    stages: packet.steps.map(s => s.name), missing: packet.missing }));
}
