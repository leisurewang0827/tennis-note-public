import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const repo = "leisurewang0827/tennis-note-public";
const branch = "codex/tennisnote-r4-ui-finish-dev-20261108";
const parent = "55da99d2d9281a69d62ac28b1467be88c9a54ab1";
const dir = "release-evidence/r4-first-issue-manual/";
const paths = [".github/workflows/r4-first-issue-manual-checkpoint.yml", dir + "check.mjs", dir + "checkpoint.json"];
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const hash = value => createHash("sha256").update(value).digest("hex");
const checkpoint = JSON.parse(readFileSync(dir + "checkpoint.json", "utf8"));

assert.deepEqual(checkpoint, {
  schema: "tennisnote-r4-manual-checkpoint/v1", mode: "review-only", repository: repo, branch, parent,
  environment: "tennisnote-r4-admin-production", reviewer: "leisurewang0827",
  reviewSql: {
    install: "3e06d71b538e9f072e64433aaa8549e6e2a9e860699e5c090f73294569731493",
    restore: "e9a8c08e5a7c0b066a326c23433e68e4c156ef85b06e3b49e5bdce06878f366d",
  },
  admin: {
    source: "30bdd59100426cc6cee740c9b52b84c1e6c10c5d", artifactId: 13861437991,
    artifactSha256: "26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e",
    sealSha256: "7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e",
    recoveryDeployment: "80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4",
  },
});
const sealPath = "release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json";
const seal = execFileSync("git", ["show", parent + ":" + sealPath]);
assert.equal(hash(seal), checkpoint.admin.sealSha256);
assert.equal(JSON.parse(seal).recoveryDeployment, checkpoint.admin.recoveryDeployment);
const workflow = readFileSync(paths[0], "utf8").replaceAll("\r\n", "\n");
assert.doesNotMatch(workflow, /\bsecrets\b|id-token|workflow_dispatch|uses:.*(?:cloudflare|artifact)|write\b/i);
assert.match(workflow, /needs: candidate-delta-only\n    environment:\n      name: tennisnote-r4-admin-production\n      deployment: false\n    permissions: \{\}/);

if (process.env.GITHUB_ACTIONS === "true") {
  const sha = git("rev-parse", "HEAD");
  assert.equal(process.env.GITHUB_SHA, sha);
  assert.equal(process.env.GITHUB_REPOSITORY, repo);
  assert.equal(process.env.GITHUB_REF, "refs/heads/" + branch);
  assert.equal(process.env.GITHUB_EVENT_NAME, "push");
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, "1");
  assert.equal(git("rev-list", "--parents", "-n", "1", sha), sha + " " + parent);
  assert.deepEqual(git("diff-tree", "--no-commit-id", "--name-status", "-r", sha).split("\n").sort(),
    paths.map(path => "A\t" + path).sort());
  console.log("Verified candidate delta for " + sha);
} else {
  assert.equal(git("rev-parse", "HEAD"), parent);
  assert.equal(git("branch", "--show-current"), branch);
  console.log("Verified local checkpoint only");
}
