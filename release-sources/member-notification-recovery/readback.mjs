import assert from 'node:assert/strict';
import {seal,sha,readBytes} from './compose.mjs';
const source='849568b963fe0576be5ca4fac7490f173a78e90e';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert.equal(sha(account||''),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);assert(token);
const get=async()=>{const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-app`,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const p=await r.json();assert(p.success);assert.equal(p.result.name,'tennisnote-app');assert.equal(p.result.production_branch,'main');const d=p.result.canonical_deployment;assert.equal(d.deployment_trigger.metadata.commit_hash,source);assert.equal(d.deployment_trigger.metadata.branch,'main');assert.equal(d.environment,'production');assert.equal(d.latest_stage.status,'success');return d;};
const before=await get();const paths=Object.keys(seal.candidate).filter(p=>!['_headers','_redirects','_worker.js'].includes(p));let retries=0;
for(const host of ['https://tennisnote-app.pages.dev',`https://${before.id.slice(0,8)}.tennisnote-app.pages.dev`]){
 for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async p=>{let error;for(let n=0;n<3;n++){try{assert.equal(sha(await readBytes(host,p)),seal.candidate[p],'HASH_DRIFT '+p);return;}catch(e){error=e;if(n<2){retries++;await new Promise(r=>setTimeout(r,1000*(n+1)));}}}throw error;}));
}
assert.equal((await get()).id,before.id);
console.log(JSON.stringify({status:'NOTIFICATION_READBACK_PASS',deploymentId:before.id,source,assets:paths.length,hosts:2,retries,changed:seal.changed,publishCalls:0,dbWrites:0}));
