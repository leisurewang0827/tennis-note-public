// GET-only admission for the exact production administrator and sealed recovery.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
const digest=b=>createHash("sha256").update(b).digest("hex");
const baseSource="cc38b03df566c6b3d297e77a00e61757935c4a45",baselineId="cfb8595d-dc30-4d50-88a5-fb611aa2dcd0";
export function validateSourceRuns(runs,source) {
  const exact=runs?.workflow_runs?.filter(x=>x.head_sha===source&&x.event==="push");
  assert.equal(exact?.length,1,"SOURCE_RUN_UNCERTAIN");const run=exact[0];
  assert.ok(Number.isSafeInteger(run.id));assert.equal(run.conclusion,"success");assert.equal(run.run_attempt,1);return run;
}
export function validateSourceArtifact(artifacts,run) {
  const matches=artifacts?.artifacts?.filter(x=>x.name===`r4-internal-registration-prod-source-${run.id}`);
  assert.equal(matches?.length,1,"SOURCE_ARTIFACT_UNCERTAIN");const artifact=matches[0];
  assert.ok(Number.isSafeInteger(artifact.id));assert.equal(artifact.expired,false);assert.match(artifact.digest||"",/^sha256:[a-f0-9]{64}$/);return artifact;
}
export function validate({project,recovery,run,artifact,sealBytes,admin,indexBytes,immutableBytes,now}) {
  assert.equal(project?.name,"tennisnote-admin");assert.equal(project?.production_branch,"main");
  for(const d of [project?.canonical_deployment,recovery]) {
    assert.equal(d?.id,baselineId,"PROD_CANONICAL_DRIFT");assert.equal(d?.latest_stage?.status,"success");
    assert.equal(d?.deployment_trigger?.metadata?.branch,"main");assert.equal(d?.deployment_trigger?.metadata?.commit_hash,baseSource);
  }
  assert.equal(run?.id,42449225848);assert.equal(run?.head_sha,baseSource);assert.equal(run?.conclusion,"success");assert.equal(run?.run_attempt,1);
  assert.equal(artifact?.id,13604763261);assert.equal(artifact?.workflow_run?.id,42449225848);assert.equal(artifact?.expired,false);
  assert.equal(artifact?.digest,"sha256:57a903df37a97e7ef5ab45eacbde7b3fa066a5172b8b78ee260afdf5d5ae4271");
  assert.ok(Date.parse(artifact.expires_at)>now+2*60*60*1000,"RECOVERY_EXPIRY_TOO_CLOSE");
  assert.equal(digest(sealBytes),"f16bf186f6d0d196f7d0a238f74863908dfb0904ee5fac201b947a834fb3ee20");
  const seal=JSON.parse(sealBytes);assert.equal(seal.sha,baseSource);assert.equal(Object.keys(seal.admin).length,168);
  assert.deepEqual(Object.fromEntries(Object.entries(admin).map(([k,v])=>[k,digest(v)])),seal.admin);
  assert.equal(digest(indexBytes),seal.admin["index.html"]);assert.equal(digest(immutableBytes),seal.admin["index.html"]);
  return {status:"PROD_ADMIN_GET_ONLY_PREFLIGHT_PASS",canonicalId:baselineId,recoveryId:baselineId,baseArtifactId:13604763261,baseSealSha256:digest(sealBytes)};
}
const walk=(dir,prefix="")=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,"en")).flatMap(e=>{
  assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),prefix+e.name+"/")):[[prefix+e.name,readFileSync(join(dir,e.name))]];
}));
async function get(url,token) {
  const headers=token?{Authorization:`Bearer ${token}`,Accept:"application/json"}:{};
  const r=await fetch(url,{method:"GET",headers,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(r.status!==200)throw Error("READ_FAILED");return r;
}
async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY,"leisurewang0827/tennis-note-public");
  assert.equal(process.env.GITHUB_REF,"refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108");
  assert.equal(process.env.GITHUB_EVENT_NAME,"push");assert.equal(process.env.GITHUB_RUN_ATTEMPT,"1");
  const sha=process.env.GITHUB_SHA;assert.match(sha||"",/^[a-f0-9]{40}$/);
  const git=(...a)=>execFileSync("git",a,{encoding:"utf8"}).trim();
  const [self,source]=git("rev-list","--parents","-n","1",sha).split(" ");assert.equal(self,sha);assert.match(source||"",/^[a-f0-9]{40}$/);
  const expected=[".github/workflows/r4-internal-registration-prod-preflight.yml","scripts/check_r4_internal_registration_prod_preflight.mjs","scripts/r4_internal_registration_prod_preflight.mjs"].sort();
  assert.deepEqual(git("diff","--name-only",source,sha).split("\n").filter(Boolean).sort(),expected,"PREFLIGHT_SCOPE_DRIFT");
  const sourceParents=git("rev-list","--parents","-n","1",source).split(" ");assert.equal(sourceParents.length,2);assert.equal(sourceParents[1],"7ecba95a6c6304563ee0b919a57b56de5366ccce");
  const sourcePaths=[".github/workflows/r4-internal-registration-prod-source.yml","release-sources/r4-internal-registration-prod/production-host.js","release-sources/r4-internal-registration-prod/production-overlay.mjs","scripts/build_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod.mjs","scripts/check_r4_internal_registration_prod_browser.mjs"].sort();
  assert.deepEqual(git("diff","--name-only",sourceParents[1],source).split("\n").filter(Boolean).sort(),sourcePaths,"SOURCE_SCOPE_DRIFT");
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.R4_ADMIN_CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;
  assert.match(account||"",/^[a-f0-9]{32}$/);assert.ok(token&&gh);assert.equal(digest(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const cf=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`,api="https://api.github.com/repos/leisurewang0827/tennis-note-public";
  const sourceRuns=await (await get(`${api}/actions/workflows/r4-internal-registration-prod-source.yml/runs?head_sha=${source}&event=push&per_page=100`,gh)).json();
  const sourceRun=validateSourceRuns(sourceRuns,source);
  const sourceArtifacts=await (await get(`${api}/actions/runs/${sourceRun.id}/artifacts?per_page=100`,gh)).json();
  const sourceArtifact=validateSourceArtifact(sourceArtifacts,sourceRun);
  const [p,r,run,artifact,index,immutable]=await Promise.all([(await get(cf,token)).json(),(await get(`${cf}/deployments/${baselineId}`,token)).json(),(await get(`${api}/actions/runs/42449225848`,gh)).json(),(await get(`${api}/actions/artifacts/13604763261`,gh)).json(),(await get("https://tennisnote-admin.pages.dev/",null)).arrayBuffer(),(await get("https://cfb8595d.tennisnote-admin.pages.dev/",null)).arrayBuffer()]);
  assert.equal(p.success,true);assert.equal(r.success,true);
  const result=validate({project:p.result,recovery:r.result,run,artifact,sealBytes:readFileSync("prod-base/seal.json"),admin:walk("prod-base/admin"),indexBytes:Buffer.from(index),immutableBytes:Buffer.from(immutable),now:Date.now()});
  console.log(JSON.stringify({...result,sourceCommit:source,sourceRunId:sourceRun.id,sourceArtifactId:sourceArtifact.id,sourceArtifactDigest:sourceArtifact.digest}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error("PROD_ADMIN_GET_ONLY_PREFLIGHT_BLOCKED");process.exitCode=1;});
