import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const tree=process.argv[2]==='--check-tree';
const entry=read('./finance-protected-live-entry.mjs'), flow=tree
 ? readFileSync('.github/workflows/r4-branch-finance-protected-publish.yml','utf8') : read('./r4-branch-finance-protected-publish.yml');
if(tree){
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const parent='dd04b2782f387b90653ef6f07caa51b91ecc2fb7';
 const first='07be1fc7423d291f4fe094e53c7d446ab303f5c5';
 assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${process.env.GITHUB_SHA} ${parent}`);
 assert.equal(git('rev-list','--parents','-n','1',parent),`${parent} ${first}`);
 const root='release-promotions/r4-branch-finance-admin/';
 const changes=git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').sort();
 const expected=['.github/workflows/r4-branch-finance-protected-publish.yml',root+'check-live-integration-only.mjs',root+'finance-protected-live-entry.mjs'].map(p=>'M\t'+p).sort();
 assert.deepEqual(changes,expected);
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
