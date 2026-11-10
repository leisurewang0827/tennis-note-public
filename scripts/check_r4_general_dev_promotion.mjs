// Synthetic DEV promotion tests only: no real external calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {validateOff,rollbackDecision} from './r4_general_dev_promotion.mjs';
import {patchWrangler} from './r4_internal_registration_dev.mjs';
const policy=JSON.parse(readFileSync('release-sources/r4-general-dev/policy.json'));
const source='a'.repeat(40),digest='b'.repeat(64),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const receipt={targetFingerprint:policy.targetFingerprint,sqlSha256:policy.sqlSha256,sourceCommit:source,sourceRunId:1,artifactDigest:digest,rosterOff:true,lessonOff:true,activeLeases:0,existingRecordsPreserved:true,legacySwitchesUnchanged:true,rpcAclOk:true,privateRlsAclOk:true,productionWrites:0};
const qaReceipt={approved:true,sourceCommit:source,sourceRunId:1,artifactDigest:digest,sealSha256:'c'.repeat(64),moduleSha256:policy.moduleSha256,sqlSha256:policy.sqlSha256};
const promotion={sourceCommit:source,sourceRunId:1,artifactId:2,artifactDigest:digest,sealSha256:'c'.repeat(64),devOffReceipt:receipt,devOffReceiptSha256:hash(receipt),qaReceipt,qaReceiptSha256:hash(qaReceipt)};
if(process.env.R4_GENERAL_QA_BIND_ONLY==='1') {
  validateOff(promotion,policy);
  for(const change of [{approved:false},{sourceCommit:'d'.repeat(40)},{artifactDigest:'e'.repeat(64)},{moduleSha256:'f'.repeat(64)},{sqlSha256:'1'.repeat(64)}]) {
    const q={...qaReceipt,...change};assert.throws(()=>validateOff({...promotion,qaReceipt:q,qaReceiptSha256:hash(q)},policy));
  }
  console.log('PASS: independent QA receipt exact source/artifact/module/SQL binding');process.exit(0);
}
validateOff(promotion,policy);
for(const field of ['rosterOff','lessonOff','existingRecordsPreserved','legacySwitchesUnchanged','rpcAclOk','privateRlsAclOk']) {const changed={...receipt,[field]:false};assert.throws(()=>validateOff({...promotion,devOffReceipt:changed,devOffReceiptSha256:hash(changed)},policy));}
for(const field of ['activeLeases','productionWrites']) {const changed={...receipt,[field]:1};assert.throws(()=>validateOff({...promotion,devOffReceipt:changed,devOffReceiptSha256:hash(changed)},policy));}
assert.equal(rollbackDecision({uncertain:false,knownPublished:true,currentId:'ours',publishedId:'ours',immutableMismatch:true}),'ROLLBACK_ONCE');
for(const bad of [{uncertain:true},{knownPublished:false},{currentId:'other'},{immutableMismatch:false}])assert.equal(rollbackDecision({uncertain:false,knownPublished:true,currentId:'ours',publishedId:'ours',immutableMismatch:true,...bad}),'HOLD');
for(const mode of ['421','redirect','timeout','success']) {
  const {rollbackOnce}=await import(`./r4_general_dev_promotion.mjs?synthetic=${mode}`);let calls=0,timeout;
  const requester=(_url,_opts,callback)=>{calls++;const req=new EventEmitter();req.setTimeout=(_n,fn)=>{timeout=fn;};req.destroy=()=>req.emit('error',Error('synthetic'));req.end=()=>queueMicrotask(()=>{if(mode==='timeout'){timeout();return;}const res=new EventEmitter();res.statusCode=mode==='421'?421:mode==='redirect'?302:200;callback(res);res.emit('data',Buffer.from('{"success":true}'));res.emit('end');});return req;};
  const url=`https://api.cloudflare.com/client/v4/accounts/${'a'.repeat(32)}/pages/projects/tennisnote-admin-dev/deployments/${policy.canonicalId}/rollback`;
  if(mode==='success')assert.equal(await rollbackOnce(url,'synthetic',requester),true);else await assert.rejects(()=>rollbackOnce(url,'synthetic',requester));
  await assert.rejects(()=>rollbackOnce(url,'synthetic',requester));assert.equal(calls,1);
}
const root=process.env.R4_WRANGLER_ROOT||'C:/Users/user/AppData/Local/npm-cache/_npx/c39b96b4691e9531/node_modules/wrangler';
const bytes=readFileSync(join(root,'wrangler-dist/cli.js')),patched=patchWrangler(bytes);
assert.ok(patched.includes('R4_DEPLOYMENT_RETRY_DENIED')&&patched.includes('tennisnote-admin-dev/deployments')&&patched.includes('if (false && e4.code === 8e6'));
assert.throws(()=>patchWrangler(Buffer.from('drift')));
console.log('PASS: DEV OFF receipt, exact admin recovery, 421/redirect/timeout single POST and pinned publish guard');
