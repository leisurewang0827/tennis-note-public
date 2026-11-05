import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preflight} from './preflight.mjs';
const account='0'.repeat(32),token='synthetic-test-token',env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token,EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT:createHash('sha256').update(account).digest('hex')};
const t={
 'tennisnote-admin-dev':{id:'0a62d203-55aa-41a9-93ac-4fb2e14bc18b',sha:'8d3dfca18ee0cd9511aea50b147df647ef1fea0b',version:'1.0.582',release:'2026.11.05.06'},
 'tennisnote-app-dev':{id:'a1d310e9-05d9-485c-acd7-badfba2b1264',sha:'15f046722252a75892886ca7afd67a4fea37ea9f',version:'1.0.578',release:'2026.11.03.03'},
};
let fault='';const fake=async url=>{const name=Object.keys(t).find(n=>url.includes(n));assert.ok(name);const x=t[name];if(url.includes('/client/v4/'))return {ok:true,json:async()=>({success:true,result:{name,production_branch:fault==='branch'?'main':'dev',canonical_deployment:{id:fault==='id'?'wrong':x.id,url:`https://${x.id.slice(0,8)}.${name}.pages.dev`,environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:fault==='sha'?'wrong':x.sha}}}}})};return {ok:true,json:async()=>({version:x.version,releaseId:fault==='release'?'wrong':x.release})};};
assert.equal((await preflight(env,fake)).status,'EXACT_DEV_BASELINE_PASS');
for(const f of ['branch','id','sha','release']){fault=f;await assert.rejects(()=>preflight(env,fake));}
fault='';await assert.rejects(()=>preflight({...env,EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT:'wrong'},fake));
console.log(JSON.stringify({status:'SYNTHETIC_PREFLIGHT_PASS',cases:6,network:0}));
