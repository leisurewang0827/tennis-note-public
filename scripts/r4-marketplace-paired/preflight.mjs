import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const targets=[
 {name:'tennisnote-admin-dev',id:'0a62d203-55aa-41a9-93ac-4fb2e14bc18b',sha:'8d3dfca18ee0cd9511aea50b147df647ef1fea0b',version:'1.0.582',release:'2026.11.05.06'},
 {name:'tennisnote-app-dev',id:'a1d310e9-05d9-485c-acd7-badfba2b1264',sha:'15f046722252a75892886ca7afd67a4fea37ea9f',version:'1.0.578',release:'2026.11.03.03'},
];
export async function preflight(env,request=fetch){
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_API_TOKEN;
 assert.ok(/^[a-f0-9]{32}$/.test(account||'')&&typeof token==='string'&&token.length>0,'Cloudflare development credentials missing');
 assert.equal(createHash('sha256').update(account).digest('hex'),env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT,'account mismatch');
 for(const t of targets){
  const api=await request(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${t.name}`,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.ok(api.ok,'development project lookup failed');const value=await api.json();assert.equal(value.success,true);
  const project=value.result,current=project?.canonical_deployment;assert.equal(project?.name,t.name);assert.equal(project?.production_branch,'dev');assert.equal(current?.environment,'production');assert.equal(current?.latest_stage?.status,'success');assert.equal(current?.id,t.id);assert.equal(current?.deployment_trigger?.metadata?.commit_hash,t.sha);
  const immutable=`https://${t.id.slice(0,8)}.${t.name}.pages.dev`;assert.equal(current.url,immutable);
  const page=await request(`https://${t.name}.pages.dev/release.json`,{redirect:'error',signal:AbortSignal.timeout(20000)}), pinned=await request(`${immutable}/release.json`,{redirect:'error',signal:AbortSignal.timeout(20000)});assert.ok(page.ok&&pinned.ok,'development release lookup failed');const release=await page.json(), prior=await pinned.json();assert.deepEqual(release,prior,'live and immutable release differ');assert.equal(release.version,t.version);assert.equal(release.releaseId,t.release);
 }
 return {status:'EXACT_DEV_BASELINE_PASS',surfaces:2};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await preflight(process.env)));}catch{console.error('DEV_BASELINE_PREFLIGHT_FAILED');process.exitCode=1;}}
