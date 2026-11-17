// Checks the authorized reviewer's attestation of a separate committed DB observation.
// Does not read, write or claim to independently observe the DB.
import { createHash } from "node:crypto";
import { pins } from "./sequence.mjs";
const environmentId=26219323796, reviewerId=294703475, repoId=1299952631;
const branch="codex/tennisnote-r4-ui-finish-dev-20261108";
export const workflowPath=".github/workflows/admin-legacy-absence-manual.yml";
const sha=/^[a-f0-9]{40}$/;
const id=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const sha256=x=>createHash("sha256").update(x).digest("hex");
const pinsDB={
  readback:"49a6175408d8b67ab930116f6648a0a461967ff081abeb19ba599267c0312b18",
  install:"5988f5482907d5b0cc57575c0ddb470206c611a9a627b56152b62574bdd12918",
  off:"20fe5d0c690b7486a683b3ed54d35e648d4ef7994699a8a60e00c504108f7bb9",
};

export function prepareReview(p,r) {
  if(!["release","recover"].includes(p?.intent) || !sha.test(p?.workflowCommit) || !sha.test(p?.releaseCommit) ||
    !Number.isSafeInteger(p.run)||p.run<=0||!Number.isSafeInteger(p.job)||p.job<=0||!id.test(p.operation) ||
    (p.intent==="release" && (p.releaseCommit!==p.workflowCommit || p.publishedId || p.publishedOperation)) ||
    (p.intent==="recover"&&(!id.test(p.publishedId)||p.publishedId===pins.recovery||!id.test(p.publishedOperation))))throw Error("MANUAL_SCOPE");
  if(r?.projectFingerprint!==pins.fingerprint || r.sourceSqlSha!==pinsDB.readback || r.gate!=="OFF" ||
    r.effective!==0 || r.rows!==0 || r.primary!==true || r.separateCommittedRead!==true ||
    typeof r.observedAt!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.observedAt) ||
    !/^[a-f0-9]{64}$/.test(r.readEvidenceSha))throw Error("OFF_EVIDENCE_REQUIRED");
  if(p.publishedOperation===p.operation)throw Error("RECOVERY_NEEDS_SEPARATE_OPERATION");
  const proof=Object.freeze({v:1,intent:p.intent,workflowCommit:p.workflowCommit,releaseCommit:p.releaseCommit,
    run:p.run,job:p.job,operation:p.operation,bundle:pins.digest,qaCommit:pins.verificationCommit,
    db:pins.fingerprint,readback:pinsDB.readback,previousStep:p.intent==="release"?pinsDB.install:pinsDB.off,
    recovery:pins.recovery,publishedId:p.publishedId??null,publishedOperation:p.publishedOperation??null,
    observedAt:r.observedAt,readEvidenceSha:r.readEvidenceSha,value:"OFF|0|0",adminPublishWindow:"EXCLUSIVE"});
  const bytes=Buffer.from(JSON.stringify(proof));
  const digest=sha256(bytes);
  return {comment:`TN-ABSENCE-MANUAL-V1 ${proof.observedAt} ${proof.readEvidenceSha} ${digest}`,proof,digest};
}

export function acceptOfficialReview(p,evidence,now=Date.now()) {
  const {run,jobs,approvals,environment,head,history}=evidence??{};
  if(run?.id!==p.run||run.path!==workflowPath||run.head_sha!==p.workflowCommit||run.event!=="push"||
    run.run_attempt!==1||run.status!=="in_progress"||run.head_branch!==branch||run.head_repository?.id!==repoId||
    head?.ref!=="refs/heads/"+branch||head.object?.sha!==p.workflowCommit||
    environment?.id!==environmentId||environment.name!==pins.environment||!Array.isArray(jobs)||
    !Array.isArray(approvals)||!Array.isArray(history))return null;
  const exact=history.filter(x=>x.path===workflowPath&&x.head_sha===p.workflowCommit);
  if(exact.length!==1||exact[0].id!==p.run||exact[0].run_attempt!==1)return null;
  const r=environment.protection_rules?.filter(r=>r.type==="required_reviewers");
  if(r?.length!==1||r[0].reviewers?.length!==1||r[0].reviewers[0].type!=="User"||
    r[0].reviewers[0].reviewer?.id!==reviewerId)return null;
  const j=jobs.filter(x=>x.run_id===p.run&&x.head_sha===p.workflowCommit);
  if(j.filter(x=>x.name==="legacy-absence-bundle-check"&&x.status==="completed"&&x.conclusion==="success").length!==1||
    j.filter(x=>x.name==="legacy-absence-manual-"+p.intent&&x.id===p.job&&x.status==="in_progress").length!==1)return null;
  const rows=approvals.filter(x=>x.environments?.some(e=>e.id===environmentId));
  if(rows.length!==1||rows[0].environments.length!==1||rows[0].state!=="approved"||rows[0].user?.id!==reviewerId)
    return null;
  const m=/^TN-ABSENCE-MANUAL-V1 (\S{24}) ([a-f0-9]{64}) ([a-f0-9]{64})$/.exec(rows[0].comment??"");
  if(!m)return null;
  try {
    const stamp=Date.parse(m[1]);
    if(!Number.isFinite(stamp)||stamp>now||now-stamp>120000)
      return null;
    const sealed=prepareReview(p,{projectFingerprint:pins.fingerprint,sourceSqlSha:pinsDB.readback,observedAt:m[1],
      readEvidenceSha:m[2],gate:"OFF",effective:0,rows:0,primary:true,separateCommittedRead:true});
    if(sealed.comment!==rows[0].comment)return null;
    return sealed.proof; // Reviewer attestation only, not a machine-generated independent read.
  } catch {return null;}
}
