// Administrator DEV source-only artifact and GET-only canonical/recovery admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>readFileSync(p);
const sourcePaths=['.github/workflows/r4-general-dev-source.yml','release-sources/r4-general-dev/general-ui.js','release-sources/r4-general-dev/policy.json','scripts/r4_general_dev_source.mjs','scripts/check_r4_general_dev_source.mjs'].sort();
export function walk(dir,p='') {return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>{assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,read(join(dir,e.name))]];}));}
export function compose({files,sealBytes,module,policy}) {
  assert.equal(hash(sealBytes),policy.baseSealSha256,'BASE_SEAL_DRIFT');const seal=JSON.parse(sealBytes);
  assert.equal(seal.sha,policy.baseSource);assert.equal(Object.keys(seal.admin).length,171);
  assert.deepEqual(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)])),seal.admin,'BASE_CONTENT_DRIFT');
  assert.equal(hash(module),policy.moduleSha256,'MODULE_DRIFT');
  assert.equal(hash(files['index.html']),policy.baseIndexSha256);
  assert.equal(hash(files['shared/config.local.js']),policy.baseConfigSha256);assert.equal(hash(files['release.json']),policy.baseReleaseSha256);
  const source=module.toString();assert.doesNotMatch(source,/tn_r4_dev_yongin_roster|tn_r4_dev_pyeongtaek_lesson|용인|평택/);
  assert.ok(source.includes('tn_r4_dev_my_general_roster')&&source.includes('tn_r4_dev_my_first_private_lesson'));
  const index=files['index.html'].toString();assert.equal(index.split('</body>').length,2);assert.ok(!index.includes('r4-general-dev.js'));
  const next=Buffer.from(index.replace('</body>',`<script defer src="./r4-general-dev.js?v=${hash(module).slice(0,16)}"></script>\n</body>`));
  const all={...files,'index.html':next,'r4-general-dev.js':module};assert.equal(Object.keys(all).length,172);
  const changes=Object.keys(all).filter(k=>!files[k]||hash(all[k])!==hash(files[k])).sort();
  assert.deepEqual(changes,['index.html','r4-general-dev.js']);
  return {all,hashes:Object.fromEntries(Object.entries(all).map(([k,v])=>[k,hash(v)])),changes};
}
export function validateTarget({project,recovery,indexBytes,immutableBytes,configBytes,immutableConfigBytes,releaseBytes,immutableReleaseBytes},p) {
  assert.equal(project?.name,p.project);assert.equal(project?.production_branch,p.branchName);
  for(const d of [project.canonical_deployment,recovery]) {
    assert.equal(d?.id,p.canonicalId,'DEV_CANONICAL_DRIFT');assert.equal(d?.latest_stage?.status,'success');
    assert.equal(d?.deployment_trigger?.metadata?.branch,p.branchName);assert.equal(d?.deployment_trigger?.metadata?.commit_hash,p.baseSource);
  }
  assert.equal(hash(indexBytes),p.baseIndexSha256);assert.equal(hash(immutableBytes),p.baseIndexSha256);
  for(const bytes of [configBytes,immutableConfigBytes]) {
    assert.equal(hash(bytes),p.baseConfigSha256,'DEV_CONFIG_DRIFT');const config=bytes.toString();
    assert.match(config,/['"]environment['"]\s*:\s*['"]development['"]/);assert.ok(config.includes(p.targetFingerprint),'DEV_FINGERPRINT_DRIFT');
  }
  for(const bytes of [releaseBytes,immutableReleaseBytes])assert.equal(hash(bytes),p.baseReleaseSha256,'DEV_RELEASE_DRIFT');
  return {canonicalId:p.canonicalId,recoveryId:p.canonicalId};
}
export function validateBaseArtifact(artifact,p,now=Date.now()) {
  assert.equal(artifact?.id,p.baseArtifactId);assert.equal(artifact?.workflow_run?.id,p.baseRun);assert.equal(artifact?.name,p.baseArtifactName);
  assert.equal(artifact?.digest,`sha256:${p.baseArtifactDigest}`);assert.equal(artifact?.expired,false);
  assert.ok(Date.parse(artifact.expires_at)>now+2*60*60*1000,'RECOVERY_ARTIFACT_EXPIRY');
}
export async function readTarget(p) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;
  assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token&&gh);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const base=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${p.project}`;
  const get=async(url,auth)=>{const r=await fetch(url,{method:'GET',headers:auth?{Authorization:`Bearer ${token}`,Accept:'application/json'}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'DEV_READ_FAILED');return r;};
  const live='https://tennisnote-admin-dev.pages.dev',fixed=`https://${p.canonicalId.slice(0,8)}.tennisnote-admin-dev.pages.dev`;
  const [a,b,index,immutable,config,immutableConfig,release,immutableRelease]=await Promise.all([(await get(base,true)).json(),(await get(`${base}/deployments/${p.canonicalId}`,true)).json(),(await get(live+'/',false)).arrayBuffer(),(await get(fixed+'/',false)).arrayBuffer(),(await get(live+'/shared/config.local.js',false)).arrayBuffer(),(await get(fixed+'/shared/config.local.js',false)).arrayBuffer(),(await get(live+'/release.json',false)).arrayBuffer(),(await get(fixed+'/release.json',false)).arrayBuffer()]);
  const ar=await fetch(`https://api.github.com/repos/leisurewang0827/tennis-note-public/actions/artifacts/${p.baseArtifactId}`,{method:'GET',headers:{Authorization:`Bearer ${gh}`,Accept:'application/json'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});assert.equal(ar.status,200,'ARTIFACT_READ_FAILED');validateBaseArtifact(await ar.json(),p);
  assert.equal(a.success,true);assert.equal(b.success,true);const result=validateTarget({project:a.result,recovery:b.result,indexBytes:Buffer.from(index),immutableBytes:Buffer.from(immutable),configBytes:Buffer.from(config),immutableConfigBytes:Buffer.from(immutableConfig),releaseBytes:Buffer.from(release),immutableReleaseBytes:Buffer.from(immutableRelease)},p);
  const fresh=await (await get(base,true)).json();assert.equal(fresh.success,true);assert.equal(fresh.result?.canonical_deployment?.id,p.canonicalId,'CANONICAL_FINAL_DRIFT');
  assert.equal(fresh.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,p.baseSource);return result;
}
function sourceScope(p) {
  assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(process.env.GITHUB_REF,`refs/heads/${p.branch}`);
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');const sha=process.env.GITHUB_SHA;
  assert.match(sha||'',/^[a-f0-9]{40}$/);const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
  assert.equal(git('rev-list','--parents','-n','1',sha),`${sha} ${p.parent}`,'SOURCE_PARENT_DRIFT');
  assert.deepEqual(git('diff','--name-only',p.parent,sha).split('\n').filter(Boolean).sort(),sourcePaths,'SOURCE_SCOPE_DRIFT');return sha;
}
async function main() {
  const p=JSON.parse(read('release-sources/r4-general-dev/policy.json')),sha=sourceScope(p);
  if(process.argv[2]==='build') {
    const {all,hashes,changes}=compose({files:walk('base/admin'),sealBytes:read('base/seal.json'),module:read('release-sources/r4-general-dev/general-ui.js'),policy:p});
    mkdirSync('general-artifact/admin',{recursive:true});for(const [k,v] of Object.entries(all)){const path=join('general-artifact/admin',k);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,v,{flag:'wx'});}
    writeFileSync('general-artifact/seal.json',JSON.stringify({schema:1,source:sha,baseSource:p.baseSource,baseSealSha256:p.baseSealSha256,sqlSha256:p.sqlSha256,admin:hashes})+'\n',{flag:'wx'});
    console.log(JSON.stringify({status:'GENERAL_DEV_SOURCE_PASS',changes,assetCount:Object.keys(all).length}));return;
  }
  if(process.argv[2]==='preflight') {console.log(JSON.stringify({status:'GENERAL_DEV_GET_ONLY_PASS',...(await readTarget(p)),source:sha}));return;}
  throw Error('INVALID_MODE');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(()=>{console.error('GENERAL_DEV_SOURCE_BLOCKED');process.exitCode=1;});
