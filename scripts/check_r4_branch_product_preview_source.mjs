// Synthetic, offline-only composition checks. No network or data writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {compose,overlay,reconstructIndex} from './r4_branch_product_preview_source.mjs';
import {assemble} from './r4_independent_selfserve_dev.mjs';
const base=process.argv[2]||'base',candidate=compose(base),{bytes:admin}=assemble(base);
assert.equal(Object.keys(candidate).length,173);
for(const p of Object.keys(admin))if(!['index.html','r4-branch-operations.js'].includes(p))assert.ok(candidate[p].equals(admin[p]));
const js=readFileSync('app/admin/r4-branch-operations.js'),test=readFileSync('scripts/check_r4_branch_product_membership_web.mjs');
const prev='81046af5ff14184585533f1a72b22f29a0298050',oldIndex=execFileSync('git',['show',prev+':app/admin/index.html']),oldJs=execFileSync('git',['show',prev+':app/admin/r4-branch-operations.js']);
const idx=reconstructIndex(oldIndex);
const args=[admin,idx,js,test,oldIndex,oldJs];
const badAdmin={...admin,'index.html':Buffer.from('wrong')};assert.throws(()=>overlay(badAdmin,...args.slice(1)));
assert.throws(()=>overlay(admin,idx,Buffer.from('wrong'),test,oldIndex,oldJs));
assert.throws(()=>overlay(admin,idx,js,test,oldIndex,Buffer.from('wrong')));
console.log('PASS preview source delta: exact 2/173, other 171 bytes preserved; source/base drift fail closed');
