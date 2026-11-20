// Immutable prior-run evidence guard. This module performs no write or deployment.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const PIN=Object.freeze({repo:'leisurewang0827/tennis-note-public',repoId:1299952631,branch:'codex/tennisnote-r4-admin-prod-candidate',run:44728834968,commit:'8a038d4f7687190d28edc965a5a7f30001e890ef',workflow:'.github/workflows/absence-v15f-web.yml',artifact:14626005334,artifactName:'absence-v15f-web-44728834968',artifactDigest:'sha256:27507c3337842a00c3913147b4fd3dd5b5463bf07d57bb75107a1da27c0220de',artifactSize:110960840,product:'5d48655379d18fdaed28bb18e498c0a4dfbd28fb'});
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifyEvidence(run,jobs,artifact){
 assert.equal(run.id,PIN.run);assert.equal(run.head_sha,PIN.commit);assert.equal(run.head_branch,PIN.branch);assert.equal(run.path,PIN.workflow);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');assert.equal(run.event,'push');assert.equal(run.run_attempt,1);
 for(const r of [run.repository,run.head_repository]){assert.equal(r?.id,PIN.repoId);assert.equal(r?.full_name,PIN.repo)}
 assert.equal(jobs.total_count,jobs.jobs.length);
 for(const name of ['verify-source','publish-admin','publish-coach']) assert.equal(jobs.jobs.filter(j=>j.name===name&&j.run_id===PIN.run&&j.status==='completed'&&j.conclusion==='success').length,1);
 assert.equal(artifact.id,PIN.artifact);assert.equal(artifact.name,PIN.artifactName);assert.equal(artifact.digest,PIN.artifactDigest);assert.equal(artifact.size_in_bytes,PIN.artifactSize);assert.equal(artifact.expired,false);
 assert.equal(artifact.workflow_run?.id,PIN.run);assert.equal(artifact.workflow_run?.head_sha,PIN.commit);assert.equal(artifact.workflow_run?.repository_id,PIN.repoId);assert.equal(artifact.workflow_run?.head_repository_id,PIN.repoId);
 return true;
}
export function verifyExtracted({surface,seal,files,priorManifestBytes}){
 assert(['admin','coach'].includes(surface));assert(Buffer.isBuffer(priorManifestBytes));
 assert.equal(hash(priorManifestBytes),'975e98caa79f6b79c91c9b5ef677f57c569c2a545d01fc20a8dfc44300852c80');
 const prior=JSON.parse(priorManifestBytes.toString('utf8')),p=prior.projects[surface];
 const expected={...p.baseline,...p.changed};
 assert.equal(seal.source,PIN.commit);assert.equal(seal.productSource,PIN.product);assert.equal(seal.manifest,hash(priorManifestBytes));
 assert.deepEqual(seal.files,expected);assert.deepEqual(Object.keys(files).sort(),Object.keys(expected).sort());
 assert.equal(Object.keys(files).length,surface==='admin'?182:253);
 for(const [name,bytes] of Object.entries(files)){assert(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').some(x=>!x||x==='.'||x==='..'));assert(Buffer.isBuffer(bytes));assert.equal(hash(bytes),expected[name],name)}
 return true;
}
export async function verifyGithubEvidence(token){
 assert(token&&typeof token==='string');const root='https://api.github.com/repos/'+PIN.repo;
 const get=async url=>{const r=await fetch(root+url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);return r.json()};
 const run=await get('/actions/runs/'+PIN.run), jobs=await get('/actions/runs/'+PIN.run+'/attempts/1/jobs?per_page=100'), artifact=await get('/actions/artifacts/'+PIN.artifact);
 return verifyEvidence(run,jobs,artifact);
}
export {PIN};
