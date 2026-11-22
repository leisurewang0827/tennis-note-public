// 기존 CI 산출물만 지정 개발 미리보기에 게시합니다. 응답 유실은 재시도하지 않습니다.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {patchWrangler} from '../../scripts/r4_internal_registration_dev.mjs';
export const root='release-sources/r4-finance-owner-dev-publish/';
export const paths=['.github/workflows/r4-finance-owner-dev-publish.yml',...['publish.mjs','check-publish.mjs','manifest.json','off.json'].map(p=>root+p)].sort();
export const hash=x=>createHash('sha256').update(x).digest('hex');
const read=p=>readFileSync(p),json=p=>JSON.parse(read(p));
const repo='leisurewang0827/tennis-note-public';
const branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const source='166633ee86fcd0bdfbe9900ddc667e3d8e8ab14b';
const preview='r4-finance-owner-qa';
const project='tennisnote-admin-dev';
const origin='https://'+preview+'.'+project+'.pages.dev';
const critical=['index.html','views/settings.js','r4-finance-owner-dev-entry.js','r4-branch-finance-paid.js','r4-branch-finance-settlement.js','shared/config.local.js'];
export function validateManifest(m) {
  assert.equal(m.repository,repo);assert.equal(m.branch,branch);assert.equal(m.source,source);
  assert.equal(m.project,project);assert.equal(m.preview,preview);assert.equal(m.devProject,'udjmiezroipctytmztwz');
  assert.equal(m.run,44997731601);assert.equal(m.artifactId,14744806617);
  assert.equal(m.artifactName,'r4-finance-owner-dev-entry-44997731601');assert.equal(m.paymentEnabled,false);
  assert.equal(Object.keys(m.files).length,183);assert.equal(m.maximumPublications,1);
  for(const [p,h]of Object.entries(m.files)){assert.ok(!p.startsWith('/')&&!p.split('/').includes('..'));assert.match(h,/^[a-f0-9]{64}$/);}
  assert.equal(m.files['r4-finance-owner-dev-entry.js'],'ff3b80a67625e7b86fe5d7f27bcbe2c5b5b23447fc5b4ef8fd80ef0993d2be5e');
}
export function validateOff(o,now=Date.now()) {
  assert.equal(o.project,'udjmiezroipctytmztwz');assert.equal(o.source,source);
  const age=now-Date.parse(o.at);assert.ok(Number.isFinite(age)&&age>=0&&age<=30*60*1000,'OFF_RECEIPT_EXPIRED');
  for(const k of ['effective_access','old_paid_access','old_terms_access','old_history_access','existing_synthetic_owner_sessions'])assert.equal(o[k],0,k);
  assert.equal(o.preserved_paid_receipts,1);assert.equal(o.preserved_term_receipts,1);
}
export function validateTarget(p,m) {
  assert.equal(p.name,project);assert.equal(p.production_branch,'dev');
  assert.equal(p.canonical_deployment?.id,m.canonicalId,'CANONICAL_DRIFT');
}
export function exactBody(body) {
  if(body?.get('branch')!=='r4-finance-owner-qa'||body?.get('commit_hash')!=='166633ee86fcd0bdfbe9900ddc667e3d8e8ab14b')throw Error('R4_EXACT_PREVIEW_BODY_DENIED');
}
export function patchTransport(bytes) {
  const s=patchWrangler(bytes);
  const a='if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");';
  assert.equal(s.split(a).length,2);
  return s.replace(a,`(${exactBody.toString()})(init2.body);\n  ${a}`);
}
export function walk(dir,p='') {
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const path=join(dir,e.name);assert.ok(!lstatSync(path).isSymbolicLink());
    return e.isDirectory()?Object.entries(walk(path,p+e.name+'/')):[[p+e.name,hash(read(path))]];
  }));
}
export function executionParent(m) {
  const parent=m.executionParent||source;
  assert.ok([source,'a17a4ab2aaaf1907aa59315b95f952da52b7ecf9'].includes(parent),'EXECUTION_PARENT_DENIED');return parent;
}
function scope(m) {
  validateManifest(m);assert.equal(process.env.GITHUB_REPOSITORY,repo);
  assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  const sha=process.env.GITHUB_SHA;assert.match(sha||'',/^[a-f0-9]{40}$/);
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
  assert.equal(git('rev-list','--parents','-n','1',sha),sha+' '+executionParent(m));
  assert.deepEqual(git('diff','--name-only',source,sha).split('\n').sort(),paths);
  assert.equal(hash(read('scripts/r4_internal_registration_dev.mjs')),m.transportSourceSha256);
  return sha;
}
export async function getJson(url,token,fetcher=fetch) {
  const response=await fetcher(url,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
  if(response.status!==200){let codes=[];try{codes=(await response.json()).errors?.map(e=>e.code).filter(Number.isSafeInteger)||[];}catch{}
    throw Error('READ_FAILED '+new URL(url).pathname+new URL(url).search+' HTTP_'+response.status+' CF_CODES_'+codes.join(','));}
  return response.json();
}
export function deploymentListUrl(base,page) {
  assert.ok(Number.isSafeInteger(page)&&page>0);return base+'/deployments?page='+page;
}
export async function allDeployments(base,token,get=getJson) {
  const rows=[],seen=new Set();let totalPages,totalCount;
  for(let page=1;page<=1000;page++){
    const response=await get(deploymentListUrl(base,page),token);
    assert.equal(response.success,true);assert.ok(Array.isArray(response.result));
    const meta=response.result_info;assert.equal(meta?.page,page,'DEPLOYMENT_PAGE_UNVERIFIED');
    assert.ok(Number.isSafeInteger(meta.total_pages)&&meta.total_pages>=1&&meta.total_pages<=1000,'DEPLOYMENT_PAGINATION_UNVERIFIED');
    if(totalPages===undefined){totalPages=meta.total_pages;totalCount=meta.total_count;}else {assert.equal(meta.total_pages,totalPages,'DEPLOYMENT_LIST_CHANGED');assert.equal(meta.total_count,totalCount,'DEPLOYMENT_COUNT_CHANGED');}
    if(totalCount!==undefined)assert.ok(Number.isSafeInteger(totalCount)&&totalCount>=0,'DEPLOYMENT_COUNT_UNVERIFIED');
    for(const d of response.result){assert.ok(d.id&&!seen.has(d.id),'DEPLOYMENT_PAGE_OVERLAP');seen.add(d.id);rows.push(d);}
    if(page===totalPages){if(totalCount!==undefined)assert.equal(rows.length,totalCount,'DEPLOYMENT_COUNT_DRIFT');return rows;}
    assert.ok(response.result.length>0,'DEPLOYMENT_PAGE_GAP');
  }
  throw Error('DEPLOYMENT_PAGE_LIMIT');
}
export function idleTarget(deployments) {
  assert.ok(!deployments.some(d=>d.deployment_trigger?.metadata?.branch===preview&&d.deployment_trigger?.metadata?.commit_hash===source),'ALREADY_PUBLISHED_HOLD');
  assert.ok(deployments.every(d=>['success','failure','canceled','cancelled'].includes(d.latest_stage?.status)),'OTHER_PUBLICATION_HOLD');
}
export function validateAlias(deployments,id,allowedSources) {
  const matches=deployments.filter(d=>Array.isArray(d.aliases)&&d.aliases.includes(origin));
  assert.equal(matches.length,1,'PREVIEW_ALIAS_AMBIGUOUS');const d=matches[0];
  assert.equal(d.id,id,'PREVIEW_ALIAS_ID_DRIFT');assert.equal(d.latest_stage?.status,'success');
  assert.equal(d.deployment_trigger?.metadata?.branch,preview);
  assert.ok(allowedSources.includes(d.deployment_trigger?.metadata?.commit_hash||''),'PREVIEW_ALIAS_SOURCE_DRIFT');
  return d;
}
async function asset(base,p,expected) {
  const url=base+'/'+(p==='index.html'?'':p),r=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(r.status,200,'ASSET_HTTP '+p+' '+r.status);assert.equal(hash(Buffer.from(await r.arrayBuffer())),expected,'ASSET_HASH '+p);
}
export function publishedUrl(log) {
  const urls=[...new Set(log.match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin-dev\.pages\.dev/g)||[])];
  assert.equal(urls.length,1,'PUBLICATION_OUTCOME_UNKNOWN');return urls[0];
}
async function preserve(m) {
  for(const[p,h]of Object.entries(m.canonicalFiles))await asset('https://tennisnote-admin-dev.pages.dev',p,h);
  for(const[p,h]of Object.entries(m.recoveryFiles))await asset('https://29ab225c.tennisnote-admin-dev.pages.dev',p,h);
}
async function publish(m,sha) {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,gh=process.env.GH_TOKEN;
  assert.ok(token&&gh&&account,'EXISTING_DEV_CREDENTIALS_MISSING');
  assert.equal(hash(account),m.accountFingerprint);assert.equal(hash(account),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/'+project;
  const ghBase='https://api.github.com/repos/'+repo;
  const run=await getJson(ghBase+'/actions/runs/'+m.run,gh);
  assert.equal(run.head_sha,source);assert.equal(run.path,'.github/workflows/r4-finance-owner-dev-entry.yml');assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
  const a=await getJson(ghBase+'/actions/artifacts/'+m.artifactId,gh);
  assert.equal(a.workflow_run?.id,m.run);assert.equal(a.name,m.artifactName);assert.equal(a.expired,false);assert.equal(a.digest,m.artifactDigest);
  assert.equal(hash(read('candidate/composition.json')),m.compositionSha256);
  const receipt=json('candidate/composition.json');assert.equal(receipt.source,source);assert.equal(receipt.paymentEnabled,false);assert.deepEqual(receipt.files,m.files);
  assert.deepEqual(walk('candidate/admin'),m.files);
  const off=json(root+'off.json');validateOff(off);
  const target=await getJson(base,token);assert.equal(target.success,true);validateTarget(target.result,m);
  const before=await allDeployments(base,token);idleTarget(before);validateAlias(before,m.recoveryId,m.recoveryCommitHashes);
  const prior=await getJson(base+'/deployments/'+m.recoveryId,token);assert.equal(prior.success,true);assert.equal(prior.result.id,m.recoveryId);assert.equal(prior.result.latest_stage?.status,'success');
  assert.equal(prior.result.deployment_trigger?.metadata?.branch,preview);
  await preserve(m);for(const[p,h]of Object.entries(m.recoveryFiles))await asset(origin,p,h);validateOff(off);
  const last=await getJson(base,token);assert.equal(last.success,true);validateTarget(last.result,m);
  const lastList=await allDeployments(base,token);idleTarget(lastList);validateAlias(lastList,m.recoveryId,m.recoveryCommitHashes);
  assert.deepEqual(lastList.map(d=>d.id).sort(),before.map(d=>d.id).sort(),'PREPUBLICATION_LIST_DRIFT');
  const cli=join(process.env.RUNNER_TEMP,'r4-owner-transport/node_modules/wrangler/wrangler-dist/cli-r4-owner-single.cjs');
  // 이 실행은 한 번만 전송합니다. 불명확한 응답은 재시도 대신 HOLD로 남깁니다.
  const child=spawnSync(process.execPath,[cli,'pages','deploy','candidate/admin','--project-name='+project,'--branch='+preview,'--commit-hash='+source,'--commit-dirty=false'],
    {encoding:'utf8',timeout:150000,maxBuffer:2e6,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  const log=(child.stdout||'')+'\n'+(child.stderr||'');
  assert.equal(child.status,0,'PUBLICATION_RESULT_HOLD_NO_RETRY');const immutable=publishedUrl(log);
  const after=await allDeployments(base,token);
  const found=after.filter(d=>d.id?.startsWith(immutable.split('//')[1].slice(0,8)));
  assert.equal(found.length,1);const d=found[0];assert.equal(d.latest_stage?.status,'success');
  validateAlias(after,d.id,[source]);assert.equal(d.url,immutable,'DEPLOYMENT_URL_DRIFT');
  assert.equal(d.deployment_trigger?.metadata?.branch,preview);assert.equal(d.deployment_trigger?.metadata?.commit_hash,source);
  writeFileSync('publication-result.json',JSON.stringify({status:'PUBLISHED_CHECK_PENDING',source,executionSha:sha,deploymentId:d.id,immutable,alias:origin},null,2)+'\n');
  for(const b of [immutable,origin])for(const p of critical)await asset(b,p,m.files[p]);
  await preserve(m);const final=await getJson(base,token);assert.equal(final.success,true);validateTarget(final.result,m);
  validateAlias(await allDeployments(base,token),d.id,[source]);
  const result={status:'EXACT_DEV_PREVIEW_PUBLICATION_PASS',source,executionSha:sha,deploymentId:d.id,immutable,alias:origin,files:183,canonicalUnchanged:true,recoveryPreserved:true,paymentEnabled:false,publications:1};
  writeFileSync('publication-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
async function main(){
  const m=json(root+'manifest.json'),sha=scope(m);
  if(process.argv[2]==='prepare'){
    const dir=join(process.env.RUNNER_TEMP,'r4-owner-transport/node_modules/wrangler');assert.equal(json(join(dir,'package.json')).version,'3.90.0');
    writeFileSync(join(dir,'wrangler-dist/cli-r4-owner-single.cjs'),patchTransport(read(join(dir,'wrangler-dist/cli.js'))),{flag:'wx'});return;
  }
  assert.equal(process.argv[2],'publish');return publish(m,sha);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  if(!(()=>{try{read('publication-result.json');return true;}catch{return false;}})())writeFileSync('publication-result.json',JSON.stringify({status:'HOLD',reason:String(error.message).slice(0,260),retry:false},null,2)+'\n');
  console.error('R4_DEV_PREVIEW_HOLD '+String(error.message).slice(0,260));process.exitCode=1;
});
