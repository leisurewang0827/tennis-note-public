// Local review candidate. No deployment or database writes are implemented here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

export const expected=Object.freeze({
  source:'680f7d481121801a83972811bee41496e392aaf4',
  branch:'codex/tennisnote-r4-ui-finish-dev-20261108',
  workflow:'.github/workflows/r4-branch-finance-source-ci.yml',
  run:43391633723, artifact:14021410409,
  artifactName:'r4-branch-finance-admin-source-43391633723',
  artifactDigest:'sha256:e3cedb9135f1f5703a81f65ee96e43d59953596678e649b5b449c333c5d4b6a6',
  seal:'5cd616d932150114445c8ea12a5562b9d6df3df3927325a51a1d37b668b2c269',
  recovery:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',
});
const sha=x=>createHash('sha256').update(x).digest('hex');
export function assertSource(run,artifact,now=Date.now()){
  assert.equal(run.id,expected.run); assert.equal(run.head_sha,expected.source);
  assert.equal(run.head_branch,expected.branch); assert.equal(run.path,expected.workflow);
  assert.equal(run.status,'completed'); assert.equal(run.conclusion,'success');
  assert.equal(run.event,'push'); assert.equal(run.run_attempt,1);
  assert.equal(artifact.id,expected.artifact); assert.equal(artifact.name,expected.artifactName);
  assert.equal(artifact.digest,expected.artifactDigest); assert.equal(artifact.expired,false);
  assert.equal(artifact.workflow_run?.id,expected.run);
  assert.equal(artifact.workflow_run?.head_sha,expected.source);
  assert.ok(Date.parse(artifact.expires_at)>now,'ARTIFACT_EXPIRED');
}
function tree(dir,prefix=''){
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    assert.ok(e.isFile()||e.isDirectory(),'UNSAFE_ARTIFACT_ENTRY');
    const p=prefix+e.name;
    return e.isDirectory()?Object.entries(tree(join(dir,e.name),p+'/')):[[p,sha(readFileSync(join(dir,e.name)))]];
  }));
}
export function assertArtifact(dir,sealBytes){
  assert.equal(sha(sealBytes),expected.seal,'SEAL_MISMATCH');
  const seal=JSON.parse(sealBytes);
  assert.equal(seal.kind,'LOCAL_ONLY_NOT_DEPLOYABLE');
  assert.equal(seal.candidateCount,181);
  assert.equal(seal.recoveryCandidate,expected.recovery);
  const ev=JSON.parse(readFileSync(join(dir,'source-evidence.json')));
  assert.equal(ev.sourceCiOnly,true); assert.equal(ev.deployAuthorized,false);
  assert.equal(ev.assetCount,181); assert.equal(ev.financeSeal,expected.seal);
  assert.equal(ev.recoveryCandidate,expected.recovery);
  assert.deepEqual(tree(join(dir,'admin')),seal.assets,'ASSET_MISMATCH');
}
export function assertRecovery(project,deployment,expectedSource){
  assert.match(expectedSource||'',/^[0-9a-f]{40}$/,'RECOVERY_SOURCE_UNBOUND');
  assert.equal(project.success,true); assert.equal(project.result?.name,'tennisnote-admin');
  assert.equal(project.result?.production_branch,'main');
  assert.equal(project.result?.canonical_deployment?.id,expected.recovery);
  assert.equal(deployment.success,true); const d=deployment.result;
  assert.equal(d?.id,expected.recovery); assert.equal(d.environment,'production');
  assert.equal(d.latest_stage?.status,'success');
  assert.equal(d.deployment_trigger?.metadata?.branch,'main');
  assert.equal(d.deployment_trigger?.metadata?.commit_hash,expectedSource);
  assert.equal(d.url,'https://80f7c05f.tennisnote-admin.pages.dev');
}
// No caller-provided flag or JSON can stand in for the still-unbound protected
// database OFF proof and independent review. This gate cannot currently pass.
export function assertTrustedOffReceipt(){throw new Error('OFF_RECEIPT_TRUST_NOT_BOUND');}
