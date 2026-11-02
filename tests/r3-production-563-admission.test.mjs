import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as a from '../scripts/check_r3_dispute_production563.mjs';
import {expectedMetadata,r562Controls,R562_BASE} from '../scripts/check_r3_purchase_identity_admission.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/r3-production-563-selection.json',import.meta.url),'utf8'));
const lf=s=>String(s).replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(lf(s)).digest('hex');
const base=p=>lf(execFileSync('git',['show',a.BASE+':'+p],{encoding:'utf8'}));
const read=p=>lf(readFileSync(p,'utf8'));
const controls=['scripts/check_r3_purchase_identity_admission.mjs','scripts/verify.sh','.github/workflows/tennisnote-public-ci.yml'];
const products=['app/admin/views/billing.js','app/shared/tennisnote-settlement-adjustment.js','app/tennis-note-coach-app/views/settlement.js'];
const head='a'.repeat(40),tree='b'.repeat(40),ref='refs/pull/17/merge';
const good=()=>({fixture,paths:[...fixture.candidatePaths.map(x=>x.path),...controls,a.SELF,a.FIXTURE,a.TEST],
 hashes:Object.fromEntries(fixture.candidatePaths.map(x=>[x.path,x.sha256])),baseHashes:Object.fromEntries(fixture.candidatePaths.map(x=>[x.path,x.baseSha256])),
 fixtureHash:a.FIXTURE_SHA,testHash:a.TEST_SHA,selfSeal:a.SELF_SEAL,controlsMatch:true,metadataMatch:true,controlHashes:{...a.CONTROL_HASHES},
 repo:a.REPO,clean:true,attempt:'1',baseTree:a.BASE_TREE,candidateParent:'f'.repeat(40),featureParent:a.BASE,featurePaths:products,featureHashes:Object.fromEntries(fixture.candidatePaths.filter(x=>products.includes(x.path)).map(x=>[x.path,x.sha256])),checkoutTree:tree,candidateTree:tree,head,
 event:'pull_request',mode:'--ci-route',headBranch:a.BRANCH,headRepo:a.REPO,baseRepo:a.REPO,base:a.BASE,target:'main',
 workflow:'Tennis Note Public PWA CI',workflowRef:a.REPO+'/.github/workflows/tennisnote-public-ci.yml@'+ref,number:17,ref,checkoutParents:[a.BASE,head]});

test('R563 exact candidate accepts only reviewed path, content and graph',()=>{
 const s=good();assert.equal(a.validate(s),true);
 for(const change of [{paths:[...s.paths,'app/unknown.js']},{paths:s.paths.slice(1)},{fixtureHash:'0'.repeat(64)},
   {selfSeal:'0'.repeat(64)},{candidateParent:'bad'},{checkoutParents:[head,a.BASE]},
   {metadataMatch:false},{controlsMatch:false},{headRepo:'other/repo'},{base:'d'.repeat(40)}]){
   assert.throws(()=>a.validate({...s,...change}),/R563_/);
 }
 const changed={...s.hashes,[fixture.candidatePaths[0].path]:'0'.repeat(64)};
 assert.throws(()=>a.validate({...s,hashes:changed}),/R563_BYTES/);
});

test('R563 control pin rejects inserted block drift',()=>{
 const s=good();assert.equal(a.validate(s),true);
 for(const p of controls){
  assert.equal(hash(read(p)),a.CONTROL_HASHES[p]);
  const altered={...s.controlHashes,[p]:hash(read(p)+'\n// unexpected')};
  assert.throws(()=>a.validate({...s,controlsMatch:true,controlHashes:altered}),/R563_CONTROL/);
 }
});

test('R563 fixture is authenticated before candidate paths are read',()=>{
 const fixtureRaw=read(a.FIXTURE),testRaw=read(a.TEST),selfRaw=read(a.SELF);
 assert.equal(a.trustedFixture(fixtureRaw,testRaw,selfRaw).candidatePaths.length,16);
 const altered=JSON.parse(fixtureRaw);altered.candidatePaths[0].path='scripts/unknown-private.js';
 assert.throws(()=>a.trustedFixture(JSON.stringify(altered),testRaw,selfRaw),/R563_INPUT_PIN/);
 assert.throws(()=>a.trustedFixture(fixtureRaw,testRaw+'x',selfRaw),/R563_INPUT_PIN/);
 assert.throws(()=>a.trustedFixture(fixtureRaw,testRaw,selfRaw+'x'),/R563_INPUT_PIN/);
});

test('R563 historical consumer receives only exact inverse',()=>{
 const names=['scripts/check_r3_purchase_identity_admission.mjs','.github/workflows/tennisnote-public-ci.yml','scripts/verify.sh'];
 const current=names.map(read),old=names.map(p=>lf(execFileSync('git',['show',R562_BASE+':'+p],{encoding:'utf8'})));
 assert.equal(r562Controls(current[0],old[0],current[1],old[1],current[2],old[2]),true);
 assert.throws(()=>r562Controls(current[0]+'x',old[0],current[1],old[1],current[2],old[2]),/R563_HISTORICAL_CONTROL/);
});

test('R563 push admission accepts only main and exact production workflow',()=>{
 const s={...good(),candidateParent:a.BASE,event:'push',mode:'--production-source',ref:'refs/heads/main',before:a.BASE,subject:a.SUBJECT,
  workflow:'Deploy Tennis Note short URLs',workflowRef:a.REPO+'/.github/workflows/deploy-cloudflare-pages.yml@refs/heads/main',checkoutParents:[a.BASE]};
 assert.equal(a.validate(s),true);
 for(const change of [{ref:'refs/heads/dev'},{before:'c'.repeat(40)},{workflow:'other'},
   {subject:'unrelated'},{checkoutParents:[a.BASE,'c'.repeat(40)]}])assert.throws(()=>a.validate({...s,...change}),/R563_/);
});

test('R563 two commit graph requires exact product-only parent',()=>{
 const s=good(); assert.equal(a.validate(s),true);
 for(const change of [{featureParent:'0'.repeat(40)},{featurePaths:[...products,'app/release.json']},
  {featureHashes:{...s.featureHashes,[products[0]]:'0'.repeat(64)}},{candidateParent:a.BASE}])
  assert.throws(()=>a.validate({...s,...change}),/R563_FEATURE_GRAPH/);
});

test('R563 files, historical controls and generated metadata are exact',()=>{
 assert.equal(hash(read(a.FIXTURE)),a.FIXTURE_SHA);
 assert.equal(hash(read(a.TEST)),a.TEST_SHA);
 assert.equal(a.seal(read(a.SELF)),a.SELF_SEAL);
 for(const p of controls)assert.equal(a.inverseControl(p,read(p)),base(p),p);
 for(const x of fixture.candidatePaths){
  assert.equal(hash(read(x.path)),x.sha256,x.path);
  assert.equal(hash(base(x.path)),x.baseSha256,x.path);
  if(!products.includes(x.path))assert.equal(read(x.path),expectedMetadata(x.path,base(x.path),fixture.release,'1.0.562'),x.path);
 }
});
