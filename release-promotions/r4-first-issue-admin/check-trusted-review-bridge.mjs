import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {parseReviewerComment,matchingActionReviews,validateOidcClaims,verifyOidcJwt,assertOfficialCapability} from './trusted-review-bridge.mjs';
const now=1700000000000,sha=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])));
const source='30bdd59100426cc6cee740c9b52b84c1e6c10c5d',sql='e63110be73bddee0bf1cb91f58b4cda753f1b8aa4891d755c637001eab5f7b23',project='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const commit='b'.repeat(40),off={candidate:commit,source,sqlSha:sql,projectSha:project,action:'install',acknowledged:true,writeAttempts:1,observedAt:now-1000,controlOff:true,activeScopeCount:0,optionsSha:'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286'};
const r={action:'admin_publish',approvalJobId:2,approvalRunId:3,artifactDigest:'26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e',artifactId:13861437991,candidateCommit:commit,candidateFilesDigest:'f'.repeat(64),candidateTree:'c'.repeat(40),correctedSqlSha256:sql,correctionRunId:4,deploymentId:5,envId:26219323796,expiresAt:now+60000,issuedAt:now-1000,mismatchAsset:'none',offAcknowledged:true,offAction:'install',offActiveScopeCount:0,offControlOff:true,offObservedAt:off.observedAt,offOptionsSha:off.optionsSha,offReceiptDigest:sha(canonical(off)),offWriteAttempts:1,publishedId:'not-yet-published',qaMessageDigest:'d'.repeat(64),recoveryId:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',scopeDigest:'e'.repeat(64),sealSha256:'7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e',sourceCommit:source,sourceRunId:43033784106,targetFingerprint:project};
const comment=x=>{const s=canonical(x);return 'R4-ADMIN-PROMOTION-V1\n'+s+'\nsha256:'+sha(s);};
if(process.argv.includes('--recovery-only')){
 const readback={...off,sqlSha:'6a4afce725c7b1c1fe09692f046fe3ffe83133e54c730b780ee17bc2bebaf6a8',action:'readback',acknowledged:false,writeAttempts:0};
 const rollback={...r,action:'admin_rollback',approvalJobId:20,publishedId:'11111111-2222-4333-8444-555555555555',mismatchAsset:'index.html',offAction:'readback',offAcknowledged:false,offWriteAttempts:0,offReceiptDigest:sha(canonical(readback))};
 const tagged=x=>({state:'approved',user:{id:3},environments:[{id:26219323796,name:'tennisnote-r4-admin-production'}],comment:comment(x)});
 const history=[tagged(r),tagged(rollback)];
 assert.deepEqual(matchingActionReviews(history,'admin_rollback'),[history[1]]);
 assert.equal(parseReviewerComment(history[1].comment,now,'admin_rollback').publishedId,rollback.publishedId);
 for(const d of [{offAction:'off'},{offWriteAttempts:1},{offAcknowledged:true},{mismatchAsset:'none'},{offObservedAt:now-120001}])assert.throws(()=>parseReviewerComment(comment({...rollback,...d}),now,'admin_rollback'));
 assert.throws(()=>parseReviewerComment(history[0].comment,now,'admin_rollback'));
 console.log(JSON.stringify({separateRecoveryReview:true,readOnlyOffEvidence:true,denied:6,network:0}));
}else{
assert.equal(parseReviewerComment(comment(r),now).candidateCommit,commit);
for(const d of [{offControlOff:false},{offActiveScopeCount:1},{offReceiptDigest:'0'.repeat(64)},{correctedSqlSha256:'0'.repeat(64)},{offObservedAt:now-120001},{expiresAt:now},{action:'admin_rollback'},{candidateCommit:'0'.repeat(40)}])assert.throws(()=>parseReviewerComment(comment({...r,...d}),now));
const c={iss:'https://token.actions.githubusercontent.com',aud:'tennisnote-r4-admin-promotion',sub:'repo:leisurewang0827/tennis-note-public:environment:tennisnote-r4-admin-production',repository_id:'1299952631',repository:'leisurewang0827/tennis-note-public',ref:'refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108',sha:commit,run_id:'3',run_attempt:'1',event_name:'push',environment:'tennisnote-r4-admin-production',workflow_ref:'leisurewang0827/tennis-note-public/.github/workflows/r4-first-issue-admin-promotion.yml@refs/heads/codex/tennisnote-r4-ui-finish-dev-20261108',iat:Math.floor(now/1000)-1,exp:Math.floor(now/1000)+100};
assert.equal(validateOidcClaims(c,{runId:3,commit,now}),true);
for(const d of [{repository_id:'1'},{sha:'0'.repeat(40)},{environment:'other'},{run_attempt:'2'},{exp:Math.floor(now/1000)}])assert.throws(()=>validateOidcClaims({...c,...d},{runId:3,commit,now}));
const keys=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...keys.publicKey.export({format:'jwk'}),kid:'synthetic',use:'sig'};
const encoded=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),payload=encoded({alg:'RS256',kid:'synthetic'})+'.'+encoded(c);
const token=payload+'.'+sign('RSA-SHA256',Buffer.from(payload),keys.privateKey).toString('base64url');
assert.equal(verifyOidcJwt(token,{keys:[jwk]},{runId:3,commit,now}),true);
assert.throws(()=>verifyOidcJwt(payload+'.'+Buffer.alloc(256).toString('base64url'),{keys:[jwk]},{runId:3,commit,now}));
assert.throws(()=>assertOfficialCapability({accountFingerprint:'f'.repeat(64)},'admin_publish'),e=>e.code==='OFFICIAL_CAPABILITY_REQUIRED');
console.log(JSON.stringify({syntheticComment:1,commentDenials:8,syntheticOidcClaims:1,claimDenials:5,forgedCapability:'DENIED',network:0,dbWrites:0}));
}
