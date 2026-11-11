import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {EXACT_CORRECTION_PATHS,validateCandidateFiles} from './trusted-review-bridge.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const files=EXACT_CORRECTION_PATHS.map((filename,i)=>({filename,sha:(i+1).toString(16).padStart(40,'0'),status:'added'}));
const pairs=files.map(f=>[f.filename,f.sha]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
const digest=sha(JSON.stringify(pairs)),compare={status:'ahead',total_commits:1,files};
const colocated=new URL('./first-issue-db-actions.mjs',import.meta.url);
const db=await import((existsSync(colocated)?colocated:new URL('../../release-sources/r4-first-issue-correction/first-issue-db-actions.mjs',import.meta.url)).href);
assert.deepEqual(db.scopeOf(compare),pairs);
assert.equal(EXACT_CORRECTION_PATHS.length,15);assert.equal(validateCandidateFiles(compare,digest),true);
for(const wrong of [
 {...compare,files:files.slice(1)},
 {...compare,files:[...files,{filename:'extra',sha:'1'.repeat(40),status:'added'}]},
 {...compare,files:files.map((f,i)=>i?f:{...f,status:'modified'})},
 {...compare,files:files.map((f,i)=>i?f:{...f,sha:'0'.repeat(40)})}
])assert.throws(()=>validateCandidateFiles(wrong,digest));
assert.throws(()=>db.scopeOf({...compare,files:files.slice(1)}));
assert.throws(()=>validateCandidateFiles(compare,'0'.repeat(64)));
console.log(JSON.stringify({exactPaths:15,dbPaths:8,format:'JSON.stringify([[path,blob],...]) ASCII',denied:5,network:0,dbWrites:0}));
