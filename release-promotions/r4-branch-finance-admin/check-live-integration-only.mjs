import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const tree=process.argv[2]==='--check-tree';
const entry=read('./finance-protected-live-entry.mjs'), flow=tree
 ? readFileSync('.github/workflows/r4-branch-finance-protected-publish.yml','utf8') : read('./r4-branch-finance-protected-publish.yml');
if(tree){
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${process.env.GITHUB_SHA} 264bf337ee12562d7f10f2f753db4eef295c4db8`);
 const root='release-promotions/r4-branch-finance-admin/';
 const expected=['.github/workflows/r4-branch-finance-protected-publish.yml',...[
  'check-live-integration-only.mjs','finance-mismatch-classifier.mjs','finance-postread.mjs','finance-protected-live-entry.mjs',
  'finance-protected-publish-sequence.mjs','finance-protected-rollback-proof.mjs','finance-publish-queue.mjs',
  'finance-publish-review-proof.mjs','observe-production-off-for-publish.mjs','protected-finance-admission.mjs',
 ].map(x=>root+x)].sort().map(p=>'A\t'+p);
 assert.deepEqual(git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').sort(),expected);
}
assert.ok(entry.indexOf('const approval=await review()')<entry.indexOf('const child=spawn('));
assert.ok(entry.includes('OFF_REVIEW_EXPIRED_BEFORE_POST'));
assert.equal((entry.match(/\x27pages\x27,\x27deploy\x27/g)||[]).length,1);
assert.equal((entry.match(/method:\x27POST\x27/g)||[]).length,1);
assert.match(entry,/rollbackOnce:async restore=>\{[\s\S]*verifyRollbackPreimage\([\s\S]*await review\(\);[^\n]*ROLLBACK_OFF_STALE[^\n]*rollbackSent=true;[\s\S]*method:'POST'/);
assert.ok(entry.includes('restore===expected.recovery'));
assert.ok(flow.includes('environment:')&&flow.includes('group: cloudflare-pages'));
assert.ok(!/SUPABASE|DATABASE_URL|POSTGRES/i.test(flow));
console.log(JSON.stringify({newStaticIntegrationChecks:8,executedProduction:false}));
