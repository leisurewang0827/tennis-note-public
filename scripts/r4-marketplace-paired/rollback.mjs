import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const targets=[
 {name:'tennisnote-admin-dev',id:'0a62d203-55aa-41a9-93ac-4fb2e14bc18b',sha:'8d3dfca18ee0cd9511aea50b147df647ef1fea0b',version:'1.0.582',release:'2026.11.05.06'},
 {name:'tennisnote-app-dev',id:'a1d310e9-05d9-485c-acd7-badfba2b1264',sha:'15f046722252a75892886ca7afd67a4fea37ea9f',version:'1.0.578',release:'2026.11.03.03'},
];
export async function rollback(env,request=fetch){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN,source=env.GITHUB_SHA;
 assert.ok(/^[a-f0-9]{32}$/.test(account||'')&&typeof token==='string'&&token.length>0&&/^[a-f0-9]{40}$/.test(source||''));
 assert.equal(createHash('sha256').update(account).digest('hex'),env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);
 const get=async(url,auth=false,method='GET')=>{const r=await request(url,{method,headers:auth?{Authorization:`Bearer ${token}`}:{},redirect:'error',signal:AbortSignal.timeout(20000)});assert.ok(r.ok,'development rollback request failed');return r.json();};
 const plans=[];
 for(const t of targets){
  const api=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${t.name}`,data=await get(api,true),p=data.result,c=p?.canonical_deployment;
  assert.equal(data.success,true);assert.equal(p?.name,t.name);assert.equal(p?.production_branch,'dev');assert.equal(c?.environment,'production');assert.equal(c?.latest_stage?.status,'success');
  const sha=c?.deployment_trigger?.metadata?.commit_hash;
  const old=c?.id===t.id&&sha===t.sha, candidate=sha===source;
  assert.ok(old||candidate,'unexpected current deployment; no rollback');
  const live=await get(`https://${t.name}.pages.dev/release.json`),prior=await get(`https://${t.id.slice(0,8)}.${t.name}.pages.dev/release.json`);
  assert.equal(prior.version,t.version);assert.equal(prior.releaseId,t.release);
  if(old)assert.deepEqual(live,prior);else{assert.equal(live.version,'1.0.583');assert.equal(live.releaseId,'2026.11.05.07');}
  plans.push({t,api,old,prior});
 }
 const results=[];
 for(const plan of plans){
  if(!plan.old){const response=await get(`${plan.api}/deployments/${plan.t.id}/rollback`,true,'POST');assert.equal(response.success,true,'rollback rejected');}
  const now=await get(`https://${plan.t.name}.pages.dev/release.json`);assert.deepEqual(now,plan.prior,'rollback readback mismatch');results.push({surface:plan.t.name,state:plan.old?'ALREADY_BASELINE':'ROLLBACK_READBACK_PASS'});
 }
 return {status:'DEVELOPMENT_ROLLBACK_READBACK_PASS',results};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await rollback(process.env)));}catch{console.error('DEVELOPMENT_ROLLBACK_FAILED_OR_PARTIAL');process.exitCode=1;}}
