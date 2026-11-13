import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root='release-promotions/r4-first-issue-off-only/';
const paths=JSON.parse(readFileSync(new URL('off-only-tree-paths.json',import.meta.url),'utf8'));
const workflow='.github/workflows/r4-first-issue-off-only-release.yml';
const expected=paths.map(p=>p===workflow?p:root+p).sort();
assert.equal(new Set(expected).size,27);
const git=(...args)=>execFileSync('git',args,{stdio:['ignore','pipe','ignore']});
assert.equal(git('rev-parse','HEAD^').toString().trim(),'9966c55f774ee8c5cced5d30632d73b1052a5a19');
const diff=git('diff-tree','--no-commit-id','--name-status','--no-renames','-r','-z','HEAD').toString().split('\0');
assert.equal(diff.pop(),'');
assert.equal(diff.length,54);
const actual=[];
const sha=x=>createHash('sha256').update(x).digest('hex');
for(let i=0;i<diff.length;i+=2){
  assert.equal(diff[i],'A'); const p=diff[i+1]; assert.ok(expected.includes(p));
  const bytes=git('show','HEAD:'+p);
  assert.deepEqual(readFileSync(p),bytes);
  actual.push([p,sha(bytes)]);
}
assert.deepEqual(actual.map(x=>x[0]).sort(),expected);
console.log('R4_OFF_ONLY_TREE_SHA256='+sha(JSON.stringify(actual.sort((a,b)=>a[0]<b[0]?-1:1))));
