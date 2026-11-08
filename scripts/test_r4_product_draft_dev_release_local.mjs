import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkCandidate} from "./r4_product_draft_dev_release.mjs";
import {validate} from "../release-sources/r4-product-draft-dev/preflight-guard.mjs";
import {draftToken} from "../release-sources/r4-product-draft-dev/overlay-builder.mjs";
const p=JSON.parse(readFileSync("release-sources/r4-product-draft-dev/policy.json"));
Object.assign(process.env,{GITHUB_REPOSITORY:"leisurewang0827/tennis-note-public",GITHUB_REF:`refs/heads/${p.branch}`,
  GITHUB_EVENT_NAME:"push",GITHUB_RUN_ATTEMPT:"1",GITHUB_SHA:"a".repeat(40)});
assert.throws(()=>checkCandidate({...p,privateCommit:null}),/PRIVATE_SOURCE_UNBOUND/);
const expected={project:"tennisnote-admin-dev",productionBranch:"dev",previewBranch:"r4-product-draft-qa",
  accountFingerprint:"a".repeat(64),canonicalId:"canonical",canonicalSha:"b".repeat(40),recoveryId:"recovery"};
const state={accountFingerprint:expected.accountFingerprint,project:{name:expected.project,production_branch:"dev"},
  canonical:{id:"canonical",deployment_trigger:{metadata:{branch:"dev",commit_hash:expected.canonicalSha}},latest_stage:{status:"success"}},
  recovery:{id:"recovery",latest_stage:{status:"success"}},preview:[]};
assert.equal(validate(state,expected).previewBranchVacant,true);
for(const change of [s=>s.canonical.id="wrong",s=>s.preview.push({id:"occupied"}),s=>s.recovery.latest_stage.status="failure",s=>s.accountFingerprint="c".repeat(64)]) {
  const copy=structuredClone(state);change(copy);assert.throws(()=>validate(copy,expected));
}
assert.notEqual(draftToken(["one","two"]),draftToken(["on","etwo"]));
console.log("PASS: unbound private source denied, baseline drift denied, cache framing");
