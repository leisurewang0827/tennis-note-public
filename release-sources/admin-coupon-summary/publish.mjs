import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {sha,build,baseline} from './compose.mjs';
import {expected,assertSource} from '../../release-promotions/r4-branch-finance-admin/protected-finance-admission.mjs';
import {readRoutes} from '../../release-promotions/r4-branch-finance-admin/finance-postread.mjs';
const repo='leisurewang0827/tennis-note-public',branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const workflow='.github/workflows/admin-coupon-summary.yml';
const parent='f97ebce51ba4ad1c6d7dcb7cdc1c8db883d05a72';
const priorSource='c1800ed4713f866ac422c5d923f88bf05cdf2c95';
const prior='a5d9cb02-dbf0-401a-8074-218015e9a099';
const origin='https://tennisnote-admin.pages.dev';
const files=[workflow,...['seal.json','compose.mjs','check.mjs','publish.mjs'].map(p=>'release-sources/admin-coupon-summary/'+p)].sort();
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
export function preimage(project) {
  assert.equal(project.success,true);const p=project.result,d=p?.canonical_deployment;
  assert.equal(p?.name,'tennisnote-admin');assert.equal(p?.production_branch,'main');
  assert.equal(d?.id,prior);assert.equal(d.environment,'production');assert.equal(d.latest_stage?.status,'success');
  assert.equal(d.deployment_trigger?.metadata?.branch,'main');assert.equal(d.deployment_trigger?.metadata?.commit_hash,priorSource);
}
export function review(approvals,commit) {
  assert.equal(approvals.length,1);const a=approvals[0];
  assert.equal(a.state,'approved');assert.equal(a.user?.id,294703475);
  assert.deepEqual(a.environments.map(e=>e.id),[26219323796]);
  assert.equal(a.comment,'ADMIN-COUPON-SUMMARY '+commit+' exact-two-assets no-member-data');
}
let stage='runtime';
async function main() {
  const e=process.env;
  assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,repo);assert.equal(e.GITHUB_REF,'refs/heads/'+branch);
  assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');
  assert.equal(e.GITHUB_WORKFLOW_REF,`${repo}/${workflow}@refs/heads/${branch}`);
  assert.equal(git('rev-parse','HEAD'),e.GITHUB_SHA);
  assert.equal(git('rev-list','--parents','-n','1','HEAD'),e.GITHUB_SHA+' '+parent);
  assert.deepEqual(git('diff-tree','--no-commit-id','--name-status','-r',parent,'HEAD').split('\n').sort(),files.map(p=>'A\t'+p).sort());
  assert.match(e.CLOUDFLARE_ACCOUNT_ID||'',/^[a-f0-9]{32}$/);
  assert.equal(sha(e.CLOUDFLARE_ACCOUNT_ID),e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
  assert(e.CLOUDFLARE_API_TOKEN&&e.GH_TOKEN);
  const get=async(url,token)=>{
    const r=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
    assert.equal(r.status,200,'READ_FAILED');return r.json();
  };
  const api=`https://api.github.com/repos/${repo}`;
  const cf=`https://api.cloudflare.com/client/v4/accounts/${e.CLOUDFLARE_ACCOUNT_ID}/pages/projects/tennisnote-admin`;
  const read=async url=>fetch(url,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const [run,artifact]=await Promise.all([get(`${api}/actions/runs/${expected.run}`,e.GH_TOKEN),get(`${api}/actions/artifacts/${expected.artifact}`,e.GH_TOKEN)]);
  stage='source-artifact';
  assertSource(run,artifact);
  const out=join(e.RUNNER_TEMP,'admin-coupon-summary-candidate');
  stage='compose';
  const candidate=build(join(e.RUNNER_TEMP,'admin-coupon-summary-base'),out);
  stage='canonical';
  preimage(await get(cf,e.CLOUDFLARE_API_TOKEN));
  stage='baseline-http';
  await readRoutes(baseline,[origin],read);
  stage='approval';
  review(await get(`${api}/actions/runs/${e.GITHUB_RUN_ID}/approvals`,e.GH_TOKEN),e.GITHUB_SHA);
  const ref=await get(`${api}/git/ref/heads/${branch}`,e.GH_TOKEN);assert.equal(ref.object?.sha,e.GITHUB_SHA,'BRANCH_MOVED');
  stage='transport-source';
  const helper=resolve('scripts/r4_internal_registration_prod_promotion.mjs');
  assert.equal(sha(readFileSync(helper)),'e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4');
  const {patchProductionWrangler}=await import(pathToFileURL(helper));
  const wrangler=join(e.RUNNER_TEMP,'r4-wrangler/node_modules/wrangler');
  assert.equal(JSON.parse(readFileSync(join(wrangler,'package.json'))).version,'3.90.0');
  const transport=Buffer.from(patchProductionWrangler(readFileSync(join(wrangler,'wrangler-dist/cli.js'))));
  assert.equal(sha(transport),'e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4');
  const cli=join(wrangler,'wrangler-dist/cli-hide-single.cjs');writeFileSync(cli,transport,{flag:'wx'});
  stage='canonical';
  preimage(await get(cf,e.CLOUDFLARE_API_TOKEN));
  if(e.EXCEL_DIAGNOSTIC_ONLY==='true'){console.log('READ_ONLY_ADMISSION_PASS_NO_POST');return;}
  const result=await new Promise(done=>{
    let output='',settled=false;
    const child=spawn(process.execPath,[cli,'pages','deploy',out,'--project-name=tennisnote-admin','--branch=main','--commit-hash='+e.GITHUB_SHA,'--commit-dirty=false'],{shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:e.CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:e.CLOUDFLARE_API_TOKEN}});
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);done(value);};
    const timer=setTimeout(()=>{child.kill();finish(null);},120000);
    child.stdout.on('data',b=>{output+=b;if(output.length>1048576)child.kill();});child.stderr.resume();
    child.on('error',()=>finish(null));child.on('close',code=>{const urls=[...new Set(output.match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin\.pages\.dev/g)||[])];finish(code===0&&urls.length===1?urls[0]:null);});
  });
  // 불확실한 응답에 재게시하지 않는다. 현재 배포 ID를 보존한 채 HOLD한다.
  assert(result,'PUBLISH_UNKNOWN_NO_RETRY');
  const after=await get(cf,e.CLOUDFLARE_API_TOKEN),d=after.result?.canonical_deployment;
  assert.equal(after.success,true);assert.match(d?.id||'',/^[a-f0-9-]{36}$/);assert.notEqual(d.id,prior);
  assert.equal(result,`https://${d.id.slice(0,8)}.tennisnote-admin.pages.dev`);
  assert.equal(d.latest_stage?.status,'success');assert.equal(d.environment,'production');
  assert.equal(d.deployment_trigger?.metadata?.commit_hash,e.GITHUB_SHA);assert.equal(d.deployment_trigger?.metadata?.branch,'main');
  const counts=await readRoutes(candidate.hashes,[origin,result],read);
  assert.equal((await get(cf,e.CLOUDFLARE_API_TOKEN)).result?.canonical_deployment?.id,d.id,'CANONICAL_MOVED');
  console.log(JSON.stringify({status:'ADMIN_COUPON_SUMMARY_PUBLISHED',deploymentId:d.id,source:e.GITHUB_SHA,prior,changed:['forms/member.js','index.html'],...counts,dbChanges:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) main().catch(error=>{console.error('ADMIN_COUPON_SUMMARY_HOLD: '+stage+' '+error.message);process.exitCode=1;});
