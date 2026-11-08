// Pure read-only decision function; no network, no credentials, no deployment.
import assert from "node:assert/strict";
export function validate({accountFingerprint,project,canonical,recovery,preview},expected) {
  assert.equal(expected.project,"tennisnote-admin-dev");
  assert.equal(expected.productionBranch,"dev");
  assert.equal(expected.previewBranch,"r4-product-draft-qa");
  assert.match(expected.accountFingerprint,/^[a-f0-9]{64}$/);
  assert.equal(accountFingerprint,expected.accountFingerprint,"ACCOUNT_DRIFT");
  assert.equal(project?.name,expected.project,"PROJECT_DRIFT");
  assert.equal(project?.production_branch,expected.productionBranch,"PRODUCTION_BRANCH_DRIFT");
  assert.equal(canonical?.id,expected.canonicalId,"CANONICAL_DRIFT");
  assert.equal(canonical?.deployment_trigger?.metadata?.branch,"dev","CANONICAL_BRANCH_DRIFT");
  assert.equal(canonical?.deployment_trigger?.metadata?.commit_hash,expected.canonicalSha,"CANONICAL_SHA_DRIFT");
  assert.equal(canonical?.latest_stage?.status,"success","CANONICAL_UNAVAILABLE");
  assert.equal(recovery?.id,expected.recoveryId,"RECOVERY_DRIFT");
  assert.equal(recovery?.latest_stage?.status,"success","RECOVERY_UNAVAILABLE");
  assert.ok(Array.isArray(preview),"PREVIEW_STATE_UNKNOWN");
  assert.equal(preview.length,0,"PREVIEW_BRANCH_OCCUPIED");
  return Object.freeze({canonicalMatched:true,recoveryAvailable:true,previewBranchVacant:true});
}
