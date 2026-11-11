// CI source evidence only; the output is not deployable without separate authorization.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {base,next,delta,sha} from './build-admin-overlay-portable.mjs';
const sealBytes=readFileSync(new URL('./admin-overlay-seal-v4.json',import.meta.url));
assert.equal(sha(sealBytes),'7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e');
const seal=JSON.parse(sealBytes);
assert.equal(seal.kind,'LOCAL_ONLY_NOT_DEPLOYABLE');
assert.equal(seal.recoveryDeployment,'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4');
assert.equal(seal.baseCount,179);assert.equal(seal.candidateCount,180);assert.deepEqual(seal.delta,delta);
assert.deepEqual(seal.assets,Object.fromEntries(Object.keys(next).sort().map(k=>[k,sha(next[k])])));
assert.equal(Object.keys(base).filter(k=>!delta.includes(k)&&base[k].equals(next[k])).length,176);
for(const [name,want] of Object.entries(seal.sql))assert.equal(sha(readFileSync(new URL('./'+name,import.meta.url))),want);
if(process.argv[2]){
 const target=resolve(process.argv[2]);assert.ok(!existsSync(target),'OUTPUT_ALREADY_EXISTS');mkdirSync(target,{recursive:false});
 for(const [name,bytes] of Object.entries(next)){assert.ok(!name.startsWith('/')&&!name.split('/').includes('..'));const path=join(target,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes,{flag:'wx'});}
}
console.log(JSON.stringify({adminAssets:180,unchangedExisting:176,seal:'PASS',recoveryBound:true,deployable:false}));
