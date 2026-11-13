import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {expected,assertRecovery} from './protected-finance-admission.mjs';
import {pins} from './observe-production-off-for-publish.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const tree=process.argv[2]==='--check-tree';
if(tree){
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const parent='71d6b7d59bced58c40ad51b1661394067e0ef200';
 const first='dd04b2782f387b90653ef6f07caa51b91ecc2fb7';
 assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${process.env.GITHUB_SHA} ${parent}`);
 assert.equal(git('rev-list','--parents','-n','1',parent),`${parent} ${first}`);
 const root='release-promotions/r4-branch-finance-admin/';
 const changes=git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').sort();
 const scoped=['.github/workflows/r4-branch-finance-protected-publish.yml',...['check-live-integration-only.mjs','finance-protected-live-entry.mjs','finance-protected-publish-sequence.mjs','finance-protected-rollback-proof.mjs','observe-production-off-for-publish.mjs'].map(p=>root+p)].map(p=>'M\t'+p).sort();
 assert.deepEqual(changes,scoped);
}
// The workflow head of 42965332447 was not the hash sent to Cloudflare.
const baseline={id:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',environment:'production',
 latest_stage:{status:'success'},url:'https://80f7c05f.tennisnote-admin.pages.dev',
 deployment_trigger:{metadata:{branch:'main',commit_hash:'6ba041bbd89d3598f1bb8649c3a111697b713133'}}};
const project={success:true,result:{name:'tennisnote-admin',production_branch:'main',canonical_deployment:baseline}};
assert.equal(pins.recoveryId,expected.recovery);
assertRecovery(project,{success:true,result:baseline},pins.recoverySource);
assert.throws(()=>assertRecovery(project,{success:true,result:{...baseline,
 deployment_trigger:{metadata:{branch:'main',commit_hash:'81046af5ff14184585533f1a72b22f29a0298050'}}}},pins.recoverySource),{code:'ERR_ASSERTION'});
for(const file of ['./finance-protected-live-entry.mjs','./finance-protected-publish-sequence.mjs','./finance-protected-rollback-proof.mjs'])
 assert.match(read(file),/const recoverySource=pins\.recoverySource;/);
if(process.argv.includes('--recovery-source-only')){
 console.log(JSON.stringify({recoverySourceCorrection:'PASS',executedProduction:false}));
 process.exit(0);
}
const entry=read('./finance-protected-live-entry.mjs'), flow=tree
 ? readFileSync('.github/workflows/r4-branch-finance-protected-publish.yml','utf8') : read('./r4-branch-finance-protected-publish.yml');
assert.ok(entry.indexOf('const approval=await review()')<entry.indexOf('const child=spawn('));
assert.ok(entry.includes('OFF_REVIEW_EXPIRED_BEFORE_POST'));
assert.equal((entry.match(/\x27pages\x27,\x27deploy\x27/g)||[]).length,1);
assert.equal((entry.match(/method:\x27POST\x27/g)||[]).length,1);
assert.match(entry,/rollbackOnce:async restore=>\{[\s\S]*verifyRollbackPreimage\([\s\S]*await review\(\);[^\n]*ROLLBACK_OFF_STALE[^\n]*rollbackSent=true;[\s\S]*method:'POST'/);
assert.ok(entry.includes('restore===expected.recovery'));
assert.ok(flow.includes('environment:')&&flow.includes('group: cloudflare-pages'));
assert.ok(!/SUPABASE|DATABASE_URL|POSTGRES/i.test(flow));
console.log(JSON.stringify({newStaticIntegrationChecks:8,executedProduction:false}));
