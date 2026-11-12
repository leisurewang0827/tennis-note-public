import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkCommit, exactFiles, pins, reviewComment, validateEvidence} from "./evidence.mjs";

const sha = "a".repeat(40), qa = "b".repeat(64), runId = 123, reviewer = 321;
const expected = {sha,runId};
const ref = "refs/heads/" + pins.branch;
const scope = {name:pins.environment,id:pins.environmentId};
const evidence = {
  ref:{ref,object:{sha}},
  commit:{sha,parents:[{sha:pins.parent}]},
  diff:{status:"ahead",total_commits:1,files:exactFiles.map(filename=>({filename,status:"added",sha}))},
  run:{id:runId,event:"push",path:pins.workflow,head_branch:pins.branch,head_sha:sha,
    head_repository:{id:pins.repoId},run_attempt:1,status:"in_progress"},
  jobs:{total_count:2,jobs:[
    {name:"linked-source-only",run_id:runId,head_sha:sha,status:"completed",conclusion:"success",completed_at:"2026-11-12T01:00:00Z"},
    {name:"linked-evidence-only",run_id:runId,head_sha:sha,status:"in_progress",started_at:"2026-11-12T01:01:00Z"},
  ]},
  environment:{...scope,protection_rules:[{type:"required_reviewers",reviewers:[{type:"User",reviewer:{id:reviewer}}]}]},
  reviews:[{environments:[scope],state:"approved",user:{id:reviewer},comment:reviewComment(sha,runId,qa)}],
};
assert.deepEqual(validateEvidence(evidence,expected),{state:"R4_ACTUAL_READ_ONLY_APPROVAL",sha,runId,qa,
  candidate:pins.localCandidate,manifest:pins.localManifest,productionPermit:false});
const deny = [
  x=>{x.run.head_sha="c".repeat(40);}, x=>{x.run.run_attempt=2;},
  x=>{x.ref.object.sha=pins.parent;}, x=>{x.commit.parents.push({sha});},
  x=>{x.diff.files[1].filename="release-sources/other.mjs";},
  x=>{x.environment.id++;}, x=>{x.reviews[0].user.id++;},
  x=>{x.reviews[0].comment=reviewComment(sha,runId+1,qa);},
  x=>{x.reviews[0].comment=x.reviews[0].comment.replace(pins.localCandidate,"c".repeat(64));},
  x=>{x.reviews[0].comment=x.reviews[0].comment.replace(pins.localManifest,"d".repeat(64));},
  x=>{x.reviews.push({...x.reviews[0]});},
  x=>{x.reviews[0].environments.push({id:2});},
  x=>{x.jobs.jobs[0].conclusion="failure";},
  x=>{x.jobs.jobs[1].started_at="2026-11-12T00:59:00Z";},
];
for (const change of deny) {
  const altered = structuredClone(evidence);
  change(altered);
  assert.throws(()=>validateEvidence(altered,expected),/^Error: EVIDENCE_/);
}
const workflow = readFileSync(new URL("../../"+pins.workflow,import.meta.url),"utf8");
assert.doesNotMatch(workflow,/secrets\.|id-token:|deployments:|contents: write|actions: write|curl|supabase|wrangler|workflow_dispatch/);
assert.deepEqual(workflow.split(/\r?\n/).map(line=>line.trim().replace(/^- /,"")).filter(line=>line.startsWith("run:")),[
  "run: node release-sources/r4-first-issue-linked-evidence/check.mjs --commit",
  "run: node release-sources/r4-first-issue-linked-evidence/evidence.mjs",
]);
if (process.argv.includes("--commit")) checkCommit();
console.log("R4_LINKED_EVIDENCE_DELTA_PASS: "+deny.length+" denials; no production permit");
