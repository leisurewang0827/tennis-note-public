// Administrator-only promotion. A doubtful outcome is HOLD, never an automatic retry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {request as httpsRequest} from 'node:https';
import {compose} from '../release-sources/r4-independent-owner-prod/compose.mjs';
import {patchProductionWrangler} from './r4_internal_registration_prod_promotion.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const root='release-promotions/r4-independent-owner-prod/';
const source='7ba4e453e5e89540c0578db1dd76312c6f8d9442';
const recovery='2652a679-cc7b-4b85-a4d0-166c393faa0d';
const baseSource='bd848b8c8f893d3b7be0e2a763065e1ffaa8ec7c';
const fingerprint='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const candidateDigest='66eed766bd596422bbbd352641f1f1c7b67d2ab0bf8c4fee8e4a22a3ccadeeae';
const candidateSeal='44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b';
const previousSeal='5a7b6af33ac72f8ebd879b02555baa720cd309a01b10246af5af66cb9f4c54ad';
const previousDigest='ebf3da21e1672a93e66b9936747b976762e55f69bc19aad70133ec4ef6ee759a';
const receiptHash='514243df35f8a86754b1f11402ca4116d76a3660d178bb05ec8b7e37226fe2ec';
const origin='https://tennisnote-admin.pages.dev';
const oldUrl='https://2652a679.tennisnote-admin.pages.dev';
const files=['.github/workflows/r4-independent-owner-prod-promotion.yml',root+'promotion.json',root+'off-receipt.json','scripts/r4_independent_owner_prod_promotion.mjs','scripts/check_r4_independent_owner_prod_promotion.mjs'].sort();
const sourceFiles=['.github/workflows/r4-independent-owner-prod-source.yml',...['build-source.mjs','canary-close.sql','canary-open.sql','canary-postread.sql','check-db.mjs','check-web.mjs','compose.mjs','independent-ui.js','install-off.sql'].map(x=>'release-sources/r4-independent-owner-prod/'+x)].sort();
const sql={'install-off.sql':'1f7d415291d3b9be9067476acbb2bd6721c425dcfc609a6451005765a109f618','canary-open.sql':'f3dd0710c70064cb4dd8bfe9ea65c0b549457018669cb05681dfbaabc4fbe16f','canary-close.sql':'243d45009ad287bde0b57b8602fb9dce7f9434038f52867f1d8340136680dfe0','canary-postread.sql':'2365d9a81762ed3ae6576d5e4c1d72e82b2bfa3d5eb0114cea392f00d70225a2'};
const watched=['index.html','release.json','shared/config.local.js','r4-onboarding.js','r4-selfserve-client.js','pending-member-registration.js'];
const versioned=['r4-onboarding.js','r4-selfserve-client.js','pending-member-registration.js'];
export function versions(index,paths){const html=Buffer.isBuffer(index)?index.toString('utf8'):index;return Object.fromEntries(paths.map(file=>{
  const prefix=`src="./${file}?v=`,parts=html.split(prefix);assert.equal(parts.length,2);const v=parts[1].split('"')[0];assert.match(v,/^[a-zA-Z0-9._-]{1,100}$/);return [file,v];}));}
export function validateReceipt(bytes,p,now=Date.now(),enforceAge=true){
  assert.equal(sha(bytes),receiptHash);const r=JSON.parse(bytes);
  assert.equal(r.status,'COMMITTED_PROD_R4_INDEPENDENT_OFF_PASS');
  assert.equal(r.source,source);assert.equal(r.run,42846945596);assert.equal(r.artifact,13777303858);
  assert.equal(r.artifactHash,candidateDigest);assert.equal(r.sealHash,candidateSeal);assert.equal(r.projectHash,fingerprint);assert.equal(r.recovery,recovery);
  assert.deepEqual(r.sql,sql);assert.equal(r.readbackSha,'df1acda2190993602e31e5ffb7ae66a84369f2fa73284a48fffb33afb254caab');
  assert.deepEqual(r.actual,{feature_off:true,functions_exact_and_scoped:true,no_leases:true,no_lesson:true,no_tombstones:true,no_workspace:true,private_tables_protected:true});
  assert.deepEqual(p,{source,run:42846945596,artifact:13777303858,artifactHash:candidateDigest,sealHash:candidateSeal,offReceiptHash:receiptHash,recovery,baseSource,baseRun:42774611944,baseArtifact:13743341814,baseArtifactHash:previousDigest,baseSealHash:previousSeal,projectHash:fingerprint});
  const age=now-Date.parse(r.verifiedAt);assert.ok(Number.isFinite(age)&&(!enforceAge||(age>=-60000&&age<7200000)),'OFF_RECEIPT_STALE');return r;
}
function walk(dir,prefix=''){
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert.ok(e.isFile()||e.isDirectory());const p=prefix+e.name;
    return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,readFileSync(join(dir,e.name))]];}));
}
export function verifyAssets(base,candidate){
  const oldBytes=readFileSync(join(base,'seal.json')),newBytes=readFileSync(join(candidate,'seal.json'));
  assert.equal(sha(oldBytes),previousSeal);assert.equal(sha(newBytes),candidateSeal);
  const old=JSON.parse(oldBytes),fresh=JSON.parse(newBytes);assert.equal(old.source,baseSource);assert.equal(fresh.source,source);
  assert.equal(fresh.kind,'R4_INDEPENDENT_OWNER_SOURCE_ONLY');assert.equal(fresh.recovery,recovery);assert.deepEqual(fresh.sql,sql);
  const prior=walk(join(base,'admin')),current=walk(join(candidate,'admin'));
  const hashes=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,sha(v)]));
  assert.deepEqual(hashes(prior),old.admin);assert.equal(Object.keys(prior).length,177);
  assert.deepEqual(hashes(current),fresh.admin);assert.equal(Object.keys(current).length,178);
  const built=compose(base);assert.deepEqual(built.hashes,fresh.admin);
  assert.equal(fresh.admin['index.html'],'5001ed26ca546395c55db17f54b6b60d906153d86c6f7c4d2e235316b12d583c');
  assert.equal(fresh.admin['r4-independent-owner.js'],'05b861eaffad30308078a0c0e86c9b5ce1cbf8bb7c69c42d5bab7145a66e248a');
  assert.equal(fresh.admin['shared/config.local.js'],'0a89879945c847ecf2244823a1a32ff21dfb6936ecc80706b183c7231671bd64');
  return {old,fresh};
}
function scope(){
  assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
  assert.equal(process.env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108');
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim(),head=git('rev-parse','HEAD');
  assert.equal(head,process.env.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1',head),head+' '+source);
  assert.deepEqual(git('diff','--name-only',source,head).split('\n').sort(),files);
  assert.equal(git('rev-list','--parents','-n','1',source),source+' eeb53af5dfb03291d26da6e84b7454c1cc153c26');
  assert.deepEqual(git('diff','--name-only','eeb53af5dfb03291d26da6e84b7454c1cc153c26',source).split('\n').sort(),sourceFiles);
  assert.equal(sha(readFileSync('scripts/r4_internal_registration_prod_promotion.mjs')),'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4');
  for(const [k,v] of Object.entries(sql))assert.equal(sha(readFileSync('release-sources/r4-independent-owner-prod/'+k)),v);
}
function credentials(){const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.R4_ADMIN_CLOUDFLARE_API_TOKEN,g=process.env.GH_TOKEN;
  assert.match(a||'',/^[a-f0-9]{32}$/);assert.ok(t&&g);assert.equal(sha(a),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  return {token:t,gh:g,cf:`https://api.cloudflare.com/client/v4/accounts/${a}/pages/projects/tennisnote-admin`,api:'https://api.github.com/repos/leisurewang0827/tennis-note-public'};}
async function get(url,token){const r=await fetch(url,{method:'GET',headers:token?{Authorization:`Bearer ${token}`,Accept:'application/json'}:{},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'READ_FAILED');return r;}
async function obj(url,token){return (await get(url,token)).json();}
async function canonical(c){const p=await obj(c.cf,c.token);assert.equal(p.success,true);assert.equal(p.result?.name,'tennisnote-admin');assert.equal(p.result?.production_branch,'main');return p.result.canonical_deployment;}
function deployment(d,id,commit){assert.equal(d?.id,id);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,commit);}
async function artifact(c,id,run,hash){const a=await obj(c.api+'/actions/artifacts/'+id,c.gh);assert.equal(a.id,id);assert.equal(a.workflow_run?.id,run);assert.equal(a.digest,'sha256:'+hash);assert.equal(a.expired,false);assert.ok(Date.parse(a.expires_at)>Date.now());}
async function recoveryRead(c){const p=await obj(c.cf+'/deployments/'+recovery,c.token);assert.equal(p.success,true);deployment(p.result,recovery,baseSource);assert.equal(p.result.url,oldUrl);}
async function match(host,hashes,paths,params={}){const targets=paths.map(file=>[file,file==='index.html'?'/':'/'+file]);
  for(const [file,v] of Object.entries(params)){assert.match(v,/^[a-zA-Z0-9._-]{1,100}$/);targets.push([file,'/'+file+'?v='+v]);}
  const checks=await Promise.all(targets.map(async ([file,path])=>sha(Buffer.from(await (await get(host+path)).arrayBuffer()))===hashes[file]));return checks.every(Boolean);}
async function admit(p){
  const c=credentials(),{old}=verifyAssets('prod-base','prod-candidate');
  const run=await obj(c.api+'/actions/runs/'+p.run,c.gh);assert.equal(run.head_sha,source);assert.equal(run.path,'.github/workflows/r4-independent-owner-prod-source.yml');assert.equal(run.event,'push');assert.equal(run.conclusion,'success');assert.equal(run.run_attempt,1);
  await Promise.all([artifact(c,p.artifact,p.run,p.artifactHash),artifact(c,p.baseArtifact,p.baseRun,p.baseArtifactHash),recoveryRead(c)]);
  deployment(await canonical(c),recovery,baseSource);
  const priorVersions=versions(readFileSync('prod-base/admin/index.html'),versioned);
  assert.equal(await match(origin,old.admin,watched,priorVersions),true,'CURRENT_BASE_BYTES_MISMATCH');
  assert.equal(await match(oldUrl,old.admin,watched,priorVersions),true,'RECOVERY_BYTES_MISMATCH');
  deployment(await canonical(c),recovery,baseSource);console.log('INDEPENDENT_PROD_ADMISSION_PASS');
}
export function rollbackDecision({definiteMismatch,publishedId,currentId}){return definiteMismatch===true&&/^[a-f0-9-]{36}$/.test(publishedId||'')&&currentId===publishedId?'ROLLBACK_ONCE':'HOLD';}
let rollbackSent=false;
export async function rollbackOnce(url,token,requester=httpsRequest){
  const target=new URL(url);assert.equal(target.protocol,'https:');assert.equal(target.host,'api.cloudflare.com');
  assert.match(target.pathname,/^\/client\/v4\/accounts\/[a-f0-9]{32}\/pages\/projects\/tennisnote-admin\/deployments\/2652a679-cc7b-4b85-a4d0-166c393faa0d\/rollback$/);
  assert.equal(target.search,'');assert.equal(target.hash,'');assert.ok(token);assert.equal(rollbackSent,false);rollbackSent=true;
  return await new Promise((resolve,reject)=>{const req=requester(target,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json'}},res=>{
    let n=0,chunks=[];res.on('data',x=>{n+=x.length;if(n>1048576){req.destroy();return;}chunks.push(x);});res.on('error',reject);res.on('end',()=>{try{assert.equal(res.statusCode,200);assert.equal(JSON.parse(Buffer.concat(chunks)).success,true);resolve(true);}catch{reject(Error('ROLLBACK_OUTCOME_UNKNOWN'));}});});
    req.on('error',()=>reject(Error('ROLLBACK_OUTCOME_UNKNOWN')));req.setTimeout(20000,()=>req.destroy());req.end();});
}
async function post(p){
  const c=credentials(),{old,fresh}=verifyAssets('prod-base','prod-candidate');await recoveryRead(c);
  assert.equal(await match(oldUrl,old.admin,watched,versions(readFileSync('prod-base/admin/index.html'),versioned)),true,'RECOVERY_BYTES_MISMATCH');
  const d=await canonical(c);assert.match(d?.id||'',/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);assert.notEqual(d.id,recovery);deployment(d,d.id,source);
  const immutable='https://'+d.id.slice(0,8)+'.tennisnote-admin.pages.dev';assert.equal(immutable,process.env.PUBLISHED_URL,'PUBLISH_OUTCOME_UNKNOWN');
  const paths=[...watched,'r4-independent-owner.js'],params=versions(readFileSync('prod-candidate/admin/index.html'),[...versioned,'r4-independent-owner.js']);
  assert.equal(params['r4-independent-owner.js'],fresh.admin['r4-independent-owner.js'].slice(0,16));
  const fixed=await match(immutable,fresh.admin,paths,params),live=await match(origin,fresh.admin,paths,params);
  deployment(await canonical(c),d.id,source);
  if(!fixed){appendFileSync(process.env.GITHUB_OUTPUT,`definite_mismatch=true\ndeployment_id=${d.id}\n`);throw Error('IMMUTABLE_BYTES_MISMATCH');}
  assert.equal(live,true,'CANONICAL_BYTES_UNCERTAIN');console.log(JSON.stringify({status:'INDEPENDENT_PROD_ADMIN_POSTCHECK_PASS',deployment:d.id,recovery,immutable}));
}
async function rollback(){
  const c=credentials(),published=process.env.PUBLISHED_DEPLOYMENT_ID,d=await canonical(c);
  assert.equal(rollbackDecision({definiteMismatch:process.env.DEFINITE_MISMATCH==='true',publishedId:published,currentId:d?.id}),'ROLLBACK_ONCE');
  deployment(d,published,source);await recoveryRead(c);deployment(await canonical(c),published,source);
  await rollbackOnce(c.cf+'/deployments/'+recovery+'/rollback',c.token);deployment(await canonical(c),recovery,baseSource);
  const {old}=verifyAssets('prod-base','prod-candidate');assert.equal(await match(origin,old.admin,watched,versions(readFileSync('prod-base/admin/index.html'),versioned)),true,'ROLLBACK_READBACK_UNCERTAIN');console.log('INDEPENDENT_PROD_ADMIN_ROLLBACK_PASS');
}
async function main(){
  const mode=process.argv[2];const p=JSON.parse(readFileSync(root+'promotion.json'));
  validateReceipt(readFileSync(root+'off-receipt.json'),p,Date.now(),mode==='admit'||mode==='prepare');scope();
  if(mode==='admit')return admit(p);if(mode==='post')return post(p);if(mode==='rollback')return rollback();
  if(mode==='prepare'){const dir=join(process.env.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');assert.equal(JSON.parse(readFileSync(join(dir,'package.json'))).version,'3.90.0');writeFileSync(join(dir,'wrangler-dist/cli-r4-single.cjs'),patchProductionWrangler(readFileSync(join(dir,'wrangler-dist/cli.js'))),{flag:'wx'});return;}
  throw Error('INVALID_MODE');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('INDEPENDENT_PROD_PROMOTION_HOLD');process.exitCode=1;});
