import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { r562Validate, r562Controls, R562_BASE, R562_BRANCH } from "../scripts/check_r3_purchase_identity_admission.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/r3-production-562-selection.json", import.meta.url), "utf8"));
const mk = () => ({
  fixture, base: R562_BASE, branch: R562_BRANCH, mode: "--ci-route", event: "pull_request",
  repo: "leisurewang0827/tennis-note-public", headRepo: "leisurewang0827/tennis-note-public",
  target: "main", workflow: "Tennis Note Public PWA CI", clean: true,
  targetSha: "1".repeat(40), checkoutTree: "2".repeat(40), candidateTree: "2".repeat(40),
  candidateParent: R562_BASE, mergeParents: [R562_BASE, "1".repeat(40)],
  number: 1, prNumber: 1, ref: "refs/pull/1/merge", attempt: "1",
  workflowRef: "leisurewang0827/tennis-note-public/.github/workflows/tennisnote-public-ci.yml@refs/pull/1/merge",
  paths: [...fixture.candidatePaths.map(x => x.path), ...[".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_purchase_identity_admission.mjs", "scripts/verify.sh", "tests/fixtures/r3-production-562-selection.json", "tests/r3-production-562-admission.test.mjs"]].sort(),
  hashes: Object.fromEntries(fixture.candidatePaths.map(x => [x.path, x.sha256])),
  controlsMatch: true, metadataMatch: true,
});

test("R3-562: exact candidate and review context admitted", () => assert.equal(r562Validate(mk()), true));
test("R3-562: unknown, missing or duplicate path rejected", () => {
  for (const paths of [p => p.push("app/unreviewed.js"), p => p.pop(), p => p.push(p[0])]) {
    const s = mk(); paths(s.paths); assert.throws(() => r562Validate(s));
  }
});
test("R3-562: product or release byte changes fail closed", () => {
  for (const key of [fixture.candidatePaths[0].path, "app/release.json"]) {
    const s = mk(); s.hashes[key] = "0".repeat(64); assert.throws(() => r562Validate(s));
  }
  const s = mk(); s.metadataMatch = false; assert.throws(() => r562Validate(s));
});
test("R3-562: wrong base, branch, merge, target or checkout rejected", () => {
  for (const [key, value] of [["base", "0".repeat(40)], ["branch", "wrong"], ["target", "dev"], ["candidateParent", "0".repeat(40)], ["checkoutTree", "0".repeat(40)], ["clean", false]]) {
    const s = mk(); s[key] = value; assert.throws(() => r562Validate(s));
  }
});
test("R3-562: guard and execution context fail closed", () => {
  for (const [key, value] of [["controlsMatch", false], ["attempt", "2"], ["repo", "other/repo"], ["workflow", "unknown"]]) {
    const s = mk(); s[key] = value; assert.throws(() => r562Validate(s));
  }
});
test("R3-562: actual three control files invert to exact existing baseline", () => {
  const paths = ["scripts/check_r3_purchase_identity_admission.mjs", ".github/workflows/tennisnote-public-ci.yml", "scripts/verify.sh"];
  const current = paths.map(p => readFileSync(p, "utf8").replace(/\r\n/g, "\n"));
  const old = paths.map(p => execFileSync("git", ["show", R562_BASE + ":" + p], {encoding:"utf8"}).replace(/\r\n/g, "\n"));
  assert.equal(r562Controls(current[0],old[0],current[1],old[1],current[2],old[2]), true);
  assert.throws(() => r562Controls(current[0],old[0],current[1].replace("Reviewed R3 562", "Altered R3 562"),old[1],current[2],old[2]));
});
test("R3-562: production CI and both pre-deploy workflows require exact main context", () => {
  const s = mk();
  Object.assign(s, {event:"push", ref:"refs/heads/main", before:R562_BASE, mergeParents:[R562_BASE],
    workflowRef:"leisurewang0827/tennis-note-public/.github/workflows/tennisnote-public-ci.yml@refs/heads/main"});
  assert.equal(r562Validate(s), true);
  for (const [name,path] of [["Deploy Tennis Note short URLs","deploy-cloudflare-pages.yml"],["Deploy Tennis Note web beta","deploy-pages.yml"]]) {
    const p = {...s, mode:"--production-source", workflow:name,
      workflowRef:"leisurewang0827/tennis-note-public/.github/workflows/"+path+"@refs/heads/main"};
    assert.equal(r562Validate(p),true);
    assert.throws(() => r562Validate({...p,before:"0".repeat(40)}));
    assert.throws(() => r562Validate({...p,workflowRef:s.workflowRef}));
  }
});
