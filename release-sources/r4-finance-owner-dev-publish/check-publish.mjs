// 새 게시 연결만 검사합니다. 제품·DB·기존 통과 검사는 호출하지 않습니다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validateManifest,validateOff,validateTarget,exactBody,publishedUrl,getJson,allDeployments,idleTarget,validateAlias,paths,deploymentListUrl,executionParent} from './publish.mjs';
const root='release-sources/r4-finance-owner-dev-publish/';
const m=JSON.parse(readFileSync(root+'manifest.json')),o=JSON.parse(readFileSync(root+'off.json'));
if(process.argv.includes('--query-delta')){
  assert.equal(deploymentListUrl('https://test.invalid/project',1),'https://test.invalid/project/deployments?page=1');
  assert.ok(!deploymentListUrl('https://test.invalid/project',2).includes('per_page'));
  assert.throws(()=>deploymentListUrl('https://test.invalid/project',0));
  assert.equal(executionParent(m),'a17a4ab2aaaf1907aa59315b95f952da52b7ecf9');
  assert.throws(()=>executionParent({...m,executionParent:'0'.repeat(40)}));
  const workflow=readFileSync('.github/workflows/r4-finance-owner-dev-publish.yml','utf8');assert.ok(workflow.includes('fetch-depth: 3'));
  await assert.rejects(()=>getJson('https://test.invalid/project/deployments?page=1','unused',async()=>({status:400,json:async()=>({errors:[{code:1001,message:'not logged'}]})})),/\?page=1 HTTP_400 CF_CODES_1001/);
  console.log(JSON.stringify({status:'NEW_QUERY_REVISION_CHECK_PASS',cases:7,oldPassingTestsRepeated:0,networkWrites:0}));
}else{
validateManifest(m);validateOff(o,Date.parse(o.at));let count=2;
const bad=(fn)=>{assert.throws(fn);count++;};
for(const delta of [{project:'tennisnote-admin'},{preview:'dev'},{source:'0'.repeat(40)},{paymentEnabled:true},{maximumPublications:2},{files:{}}])bad(()=>validateManifest({...m,...delta}));
bad(()=>validateOff({...o,effective_access:1},Date.parse(o.at)));bad(()=>validateOff(o,Date.parse(o.at)+1800001));bad(()=>validateOff(o,Date.parse(o.at)-1));
const target={name:m.project,production_branch:'dev',canonical_deployment:{id:m.canonicalId}};validateTarget(target,m);count++;
bad(()=>validateTarget({...target,name:'tennisnote-admin'},m));bad(()=>validateTarget({...target,canonical_deployment:{id:'drift'}},m));
const body=(branch,source)=>new Map([['branch',branch],['commit_hash',source]]);exactBody(body(m.preview,m.source));count++;
bad(()=>exactBody(body('dev',m.source)));bad(()=>exactBody(body(m.preview,'wrong')));
runInNewContext('('+exactBody.toString()+')(body)',{body:body(m.preview,m.source)});count++;
bad(()=>runInNewContext('('+exactBody.toString()+')(body)',{body:body('dev',m.source)}));
assert.equal(publishedUrl('https://12ab34cd.tennisnote-admin-dev.pages.dev'),'https://12ab34cd.tennisnote-admin-dev.pages.dev');count++;
bad(()=>publishedUrl('request failed'));bad(()=>publishedUrl('https://12ab34cd.tennisnote-admin-dev.pages.dev https://34ab56cd.tennisnote-admin-dev.pages.dev'));
await assert.rejects(()=>getJson('https://api.cloudflare.com/client/v4/accounts/test/pages/projects/tennisnote-admin-dev','not-a-real-token',async()=>({status:403})),/HTTP_403/);count++;
const page=(rows,pageNumber,totalPages,totalCount)=>({success:true,result:rows,result_info:{page:pageNumber,total_pages:totalPages,total_count:totalCount}});
const done=id=>({id,latest_stage:{status:'success'}});let calls=0;
const all=await allDeployments('https://test.invalid/project','unused',async()=>++calls===1?page([done('a')],1,2,2):page([done('b')],2,2,2));
assert.equal(all.length,2);assert.equal(calls,2);idleTarget(all);count++;
await assert.rejects(()=>allDeployments('https://test.invalid/project','unused',async()=>page([],1,2,1)),/PAGE_GAP/);count++;
await assert.rejects(()=>allDeployments('https://test.invalid/project','unused',async()=>({success:true,result:[]})),/PAGE_UNVERIFIED/);count++;
bad(()=>idleTarget([...all,{...done('old'),deployment_trigger:{metadata:{branch:m.preview,commit_hash:m.source}}}]));
bad(()=>idleTarget([...all,{id:'queue',latest_stage:{status:'idle'}}]));
const aliased={...done('prior'),aliases:['https://r4-finance-owner-qa.tennisnote-admin-dev.pages.dev'],deployment_trigger:{metadata:{branch:m.preview,commit_hash:''}}};
validateAlias([aliased],'prior',m.recoveryCommitHashes);count++;
bad(()=>validateAlias([aliased],'wrong',m.recoveryCommitHashes));bad(()=>validateAlias([aliased,aliased],'prior',m.recoveryCommitHashes));
bad(()=>validateAlias([aliased],'prior',[m.source]));bad(()=>validateAlias([],'prior',m.recoveryCommitHashes));
const wf=readFileSync('.github/workflows/r4-finance-owner-dev-publish.yml','utf8');
for(const s of ['environment: development','cancel-in-progress: false','44997731601','CLOUDFLARE_API_TOKEN','if: always()'])assert.ok(wf.includes(s));
for(const s of ['workflow_dispatch:','tennisnote-r4-admin-production','SUPABASE_SERVICE','pages deploy','git push'])assert.ok(!wf.includes(s));
assert.equal(paths.length,5);count++;
console.log(JSON.stringify({status:'NEW_PUBLICATION_CONNECTION_CHECK_PASS',cases:count,networkWrites:0,productTestsRepeated:0}));
}
