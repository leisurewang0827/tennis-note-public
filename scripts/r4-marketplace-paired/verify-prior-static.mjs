import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const prior='3fc84adb98acabb138bbaa002eaa92a81c02b5b8',id='42055495096',jobId=127342652574;
export function checkReceipt(run,jobs){
 assert.equal(run.head_sha,prior);assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');assert.equal(run.run_attempt,1);assert.equal((run.path||'').split('@')[0],'.github/workflows/deploy-cloudflare-pages.yml');
 const job=jobs.jobs.filter(x=>x.id===jobId&&x.name==='marketplace-verify');assert.equal(job.length,1);const step=job[0].steps.filter(x=>x.name==='Check development preflight negative cases');assert.equal(step.length,1);assert.equal(step[0].conclusion,'success');return true;
}
export async function verify(env,request=fetch){
 assert.equal(env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.ok(env.GH_TOKEN);
 const paths=['preflight.mjs','rollback.mjs','check-run.mjs','test-preflight.mjs','test-rollback.mjs','test-check-run.mjs'].map(x=>'scripts/r4-marketplace-paired/'+x);
 execFileSync('git',['diff','--exit-code',prior,'HEAD','--',...paths],{stdio:'pipe'});
 const base=`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/runs/${id}`,get=async url=>{const r=await request(url,{headers:{Authorization:`Bearer ${env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});assert.ok(r.ok);return r.json();};
 checkReceipt(await get(base),await get(base+'/jobs?per_page=100'));return {status:'EXACT_PRIOR_STATIC_STEP_REUSED',run:id};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await verify(process.env)));}catch{console.error('PRIOR_STATIC_RECEIPT_OR_SOURCE_MISMATCH');process.exitCode=1;}}
