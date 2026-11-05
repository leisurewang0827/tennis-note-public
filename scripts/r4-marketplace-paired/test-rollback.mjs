import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {rollback} from './rollback.mjs';
const account='0'.repeat(32),source='1'.repeat(40),env={CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:'synthetic-token',EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT:createHash('sha256').update(account).digest('hex'),GITHUB_SHA:source};
const ts={
 'tennisnote-admin-dev':{id:'0a62d203-55aa-41a9-93ac-4fb2e14bc18b',sha:'8d3dfca18ee0cd9511aea50b147df647ef1fea0b',version:'1.0.582',release:'2026.11.05.06'},
 'tennisnote-app-dev':{id:'a1d310e9-05d9-485c-acd7-badfba2b1264',sha:'15f046722252a75892886ca7afd67a4fea37ea9f',version:'1.0.578',release:'2026.11.03.03'},
};
let posts=0,fault='',state={};function reset(){posts=0;fault='';state={'tennisnote-admin-dev':'candidate','tennisnote-app-dev':'old'};}
const fake=async(url,opts={})=>{const n=Object.keys(ts).find(x=>url.includes(x));assert.ok(n);const t=ts[n];if(opts.method==='POST'){posts++;assert.ok(url.endsWith('/'+t.id+'/rollback'));state[n]='old';return {ok:true,json:async()=>({success:true})};}if(url.includes('/client/v4/')){const candidate=state[n]==='candidate',badAfter=posts>0&&n==='tennisnote-admin-dev';return {ok:true,json:async()=>({success:true,result:{name:n,production_branch:'dev',canonical_deployment:{id:candidate?'candidate':badAfter&&fault==='post-id'?'wrong-id':t.id,environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:fault==='unexpected'&&n==='tennisnote-app-dev'||badAfter&&fault==='post-sha'?'2'.repeat(40):candidate?source:t.sha}}}}})};}const pinned=url.includes(t.id.slice(0,8));return {ok:true,json:async()=>pinned||state[n]==='old'?{version:t.version,releaseId:t.release}:{version:'1.0.583',releaseId:'2026.11.05.07'}};};
if(process.argv[2]!=='--new-postproof-cases'){
reset();assert.equal((await rollback(env,fake)).status,'DEVELOPMENT_ROLLBACK_READBACK_PASS');assert.equal(posts,1);
reset();fault='unexpected';await assert.rejects(()=>rollback(env,fake));assert.equal(posts,0);
reset();await assert.rejects(()=>rollback({...env,EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT:'wrong'},fake));assert.equal(posts,0);
}
for(const f of ['post-id','post-sha']){reset();fault=f;await assert.rejects(()=>rollback(env,fake));assert.equal(posts,1);}
console.log(JSON.stringify({status:'SYNTHETIC_ROLLBACK_PASS',newCases:2,realNetwork:0}));
