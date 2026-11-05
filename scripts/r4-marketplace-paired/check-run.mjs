import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function checkRun(id,kind,env,request=fetch){
assert.ok(/^\d+$/.test(id||'')&&['verify','preview','failed-promote'].includes(kind));
assert.equal(env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
assert.equal(env.GITHUB_REF,'refs/heads/codex/tennisnote-r4-marketplace-paired-20261106');
assert.match(env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.ok(env.GH_TOKEN);
const get=async path=>{const res=await request('https://api.github.com'+path,{headers:{Authorization:`Bearer ${env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});assert.ok(res.ok,'CI lookup failed');return res.json();};
 const base=`/repos/${env.GITHUB_REPOSITORY}/actions/runs/${id}`,run=await get(base);
 assert.equal(run.head_sha,env.GITHUB_SHA);assert.equal(run.head_branch,'codex/tennisnote-r4-marketplace-paired-20261106');assert.equal(run.status,'completed');assert.ok(kind==='failed-promote'?['failure','cancelled','timed_out'].includes(run.conclusion):run.conclusion==='success');assert.equal(run.run_attempt,1);assert.equal((run.path||'').split('@')[0],'.github/workflows/deploy-cloudflare-pages.yml');
 const jobs=await get(base+'/jobs?per_page=100');const name=kind==='verify'?'marketplace-verify':kind==='preview'?'marketplace-preview':'marketplace-promote';const match=jobs.jobs.filter(x=>x.name===name);assert.equal(match.length,1);assert.ok(kind==='failed-promote'?['failure','cancelled','timed_out'].includes(match[0].conclusion):match[0].conclusion==='success');
 return {status:'EXACT_PRIOR_CI_PASS',kind};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await checkRun(...process.argv.slice(2),process.env)));}catch{console.error('EXACT_PRIOR_CI_FAILED');process.exitCode=1;}}
