import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const sha=x=>createHash('sha256').update(x).digest('hex');
const sealBytes=readFileSync(new URL('./admin-overlay-seal-v4.json',import.meta.url));
assert.equal(sha(sealBytes),'7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e');
const seal=JSON.parse(sealBytes);assert.equal(seal.candidateCount,180);
assert.equal(seal.recoveryDeployment,'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4');
assert.ok(process.argv[2],'ARTIFACT_DIRECTORY_REQUIRED');
function walk(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{assert.ok(e.isFile()||e.isDirectory());const name=prefix+e.name;return e.isDirectory()?Object.entries(walk(join(dir,e.name),name+'/')):[[name,sha(readFileSync(join(dir,e.name)))]];}));}
assert.deepEqual(walk(process.argv[2]),seal.assets);
console.log(JSON.stringify({adminAssetCount:180,seal:'PASS',recoveryBound:true,deployable:false}));
