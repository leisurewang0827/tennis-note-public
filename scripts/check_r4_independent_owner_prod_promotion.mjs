// Offline synthetic promotion guard checks. No network, no remote write.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateReceipt,verifyAssets,versions,rollbackDecision,rollbackOnce} from './r4_independent_owner_prod_promotion.mjs';
const root='release-promotions/r4-independent-owner-prod/';
const p=JSON.parse(readFileSync(root+'promotion.json')),receipt=readFileSync(root+'off-receipt.json');
const base=process.argv[2],candidate=process.argv[3];assert.ok(base&&candidate);
if(process.env.R4_PROMOTION_VERSION_ONLY){
  const v=versions(readFileSync(join(candidate,'admin','index.html')),['r4-independent-owner.js','r4-onboarding.js']);assert.equal(v['r4-independent-owner.js'],'05b861eaffad3030');
  assert.throws(()=>versions('no script',['r4-independent-owner.js']));console.log('PASS promotion delta: exact versioned module URL and missing marker fail closed');
}else{
const at=Date.parse('2026-11-10T15:49:00Z');
validateReceipt(receipt,p,at);assert.throws(()=>validateReceipt(receipt,p,at+7200000));
assert.doesNotThrow(()=>validateReceipt(receipt,p,at+7200000,false));
const bad=Buffer.from(receipt);bad[10]^=1;assert.throws(()=>validateReceipt(bad,p,at));
assert.throws(()=>validateReceipt(receipt,{...p,recovery:'00000000-0000-0000-0000-000000000000'},at));
const result=verifyAssets(base,candidate);assert.equal(Object.keys(result.fresh.admin).length,178);
const v=versions(readFileSync(join(candidate,'admin','index.html')),['r4-independent-owner.js','r4-onboarding.js']);assert.equal(v['r4-independent-owner.js'],'05b861eaffad3030');
assert.throws(()=>versions('no script',['r4-independent-owner.js']));
const tmp=mkdtempSync(join(tmpdir(),'tn-independent-promote-negative-'));writeFileSync(join(tmp,'seal.json'),'{}');
assert.throws(()=>verifyAssets(base,tmp));
const published='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
assert.equal(rollbackDecision({definiteMismatch:true,publishedId:published,currentId:published}),'ROLLBACK_ONCE');
assert.equal(rollbackDecision({definiteMismatch:false,publishedId:published,currentId:published}),'HOLD');
assert.equal(rollbackDecision({definiteMismatch:true,publishedId:published,currentId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'}),'HOLD');
let sends=0;
const fake=(url,opts,cb)=>{sends++;const req=new EventEmitter();req.setTimeout=()=>{};req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=421;cb(res);queueMicrotask(()=>{res.emit('data',Buffer.from('{}'));res.emit('end');});};return req;};
const url='https://api.cloudflare.com/client/v4/accounts/'+'a'.repeat(32)+'/pages/projects/tennisnote-admin/deployments/2652a679-cc7b-4b85-a4d0-166c393faa0d/rollback';
await assert.rejects(()=>rollbackOnce(url,'synthetic',fake),/ROLLBACK_OUTCOME_UNKNOWN/);
await assert.rejects(()=>rollbackOnce(url,'synthetic',fake));assert.equal(sends,1);
console.log('PASS promotion delta: committed OFF pin/age, 178 exact hashes, wrong base rejection, guarded single rollback on 421');
}
