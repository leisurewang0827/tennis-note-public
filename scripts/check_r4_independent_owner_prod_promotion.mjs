// Offline synthetic promotion guard checks. No network, no remote write.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateReceipt,verifyAncestry,verifyAssets,versions,rollbackDecision,rollbackOnce} from './r4_independent_owner_prod_promotion.mjs';
const root='release-promotions/r4-independent-owner-prod/';
const p=JSON.parse(readFileSync(root+'promotion.json')),receipt=readFileSync(root+'off-receipt.json');
const base=process.argv[2],candidate=process.argv[3];assert.ok(base&&candidate);
if(process.env.R4_PROMOTION_SUCCESSOR_ONLY){
  const at=Date.parse('2026-11-11T00:10:26Z');validateReceipt(receipt,p,at);validateReceipt(receipt,p,at+7199999);
  assert.throws(()=>validateReceipt(receipt,p,at+7200000),/OFF_RECEIPT_STALE/);assert.throws(()=>validateReceipt(receipt,p,at-60001),/OFF_RECEIPT_STALE/);
  const head='1111111111111111111111111111111111111111',previous='8fc186361e0d0541d46b6eed4310146f57fae0eb',source='7ba4e453e5e89540c0578db1dd76312c6f8d9442',base='eeb53af5dfb03291d26da6e84b7454c1cc153c26';
  const promotion=['.github/workflows/r4-independent-owner-prod-promotion.yml','release-promotions/r4-independent-owner-prod/off-receipt.json','release-promotions/r4-independent-owner-prod/promotion.json','scripts/check_r4_independent_owner_prod_promotion.mjs','scripts/r4_independent_owner_prod_promotion.mjs'].sort().join('\n');
  const sourcePaths=['.github/workflows/r4-independent-owner-prod-source.yml',...['build-source.mjs','canary-close.sql','canary-open.sql','canary-postread.sql','check-db.mjs','check-web.mjs','compose.mjs','independent-ui.js','install-off.sql'].map(x=>'release-sources/r4-independent-owner-prod/'+x)].sort().join('\n');
  const answers=new Map([[`rev-list --parents -n 1 ${head}`,head+' '+previous],[`diff --name-only ${previous} ${head}`,promotion],[`rev-list --parents -n 1 ${previous}`,previous+' '+source],[`diff --name-only ${source} ${previous}`,promotion],[`rev-list --parents -n 1 ${source}`,source+' '+base],[`diff --name-only ${base} ${source}`,sourcePaths]]);
  const git=(...args)=>{const key=args.join(' ');assert.ok(answers.has(key));return answers.get(key);};verifyAncestry(head,git);
  const prior=answers.get(`rev-list --parents -n 1 ${previous}`);answers.set(`rev-list --parents -n 1 ${previous}`,previous+' '+base);assert.throws(()=>verifyAncestry(head,git));answers.set(`rev-list --parents -n 1 ${previous}`,prior);
  answers.set(`diff --name-only ${previous} ${head}`,promotion+'\nunexpected');assert.throws(()=>verifyAncestry(head,git));
  console.log('PASS promotion successor delta: fresh receipt, unchanged 2h expiry, exact source and two promotion generations; drift rejected');
}else if(process.env.R4_PROMOTION_VERSION_ONLY){
  const v=versions(readFileSync(join(candidate,'admin','index.html')),['r4-independent-owner.js','r4-onboarding.js']);assert.equal(v['r4-independent-owner.js'],'05b861eaffad3030');
  assert.throws(()=>versions('no script',['r4-independent-owner.js']));console.log('PASS promotion delta: exact versioned module URL and missing marker fail closed');
}else{
const at=Date.parse('2026-11-11T00:10:30Z');
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
