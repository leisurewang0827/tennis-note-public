// Credential-free assembly for the source CI. No DB, deployment, or rollback actions.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
const digest=x=>createHash('sha256').update(x).digest('hex');
const freeze={
 baseline:'44c31617fc2c1d8ea5377d0e6d6a0f2d2b52ee1aa048a023e8c4ac08f497c85b',
 independent:'f454d23dbce8ca99895945950f4a80ee75a0f1f633a9419b2eb73fdf049daaaa',
 finance:'5cd616d932150114445c8ea12a5562b9d6df3df3927325a51a1d37b668b2c269',
};
const [baselinePath,independentPath,financePath,outputPath]=process.argv.slice(2);
assert.equal(process.argv.length,6,'EXPECTED_BASELINE_INDEPENDENT_FINANCE_NEW_OUTPUT');
assert.ok([baselinePath,independentPath,financePath,outputPath].every(Boolean));
const read=(root,file)=>{
 const f=join(root,file);assert.ok(lstatSync(f).isFile(),'EXPECTED_REGULAR_FILE');
 return readFileSync(f);
};
const json=(root,file,expected)=>{
 const x=read(root,file);assert.equal(digest(x),expected,'SEAL_BYTES_DRIFT');return JSON.parse(x);
};
const list=(root,prefix='')=>readdirSync(join(root,prefix),{withFileTypes:true}).flatMap(x=>{
 const path=prefix+x.name;
 if(x.isDirectory())return list(root,path+'/');
 assert.ok(x.isFile(),'UNSUPPORTED_ASSET_ENTRY');return [path];
});
const sums=assets=>Object.fromEntries([...assets.keys()].sort().map(k=>[k,digest(assets.get(k))]));
const patch=(input,anchor,next)=>{
 assert.equal(input.split(anchor).length,2,'SCRIPT_ANCHOR_DRIFT');return Buffer.from(input.replace(anchor,()=>next));
};
const originals=json(baselinePath,'seal.json',freeze.baseline).admin;
const independent=json(independentPath,'candidate-seal.json',freeze.independent).admin.sha256;
const candidate=json(financePath,'admin-seal.json',freeze.finance);
const dir=join(baselinePath,'admin');assert.ok(lstatSync(dir).isDirectory(),'EXPECTED_ADMIN_DIRECTORY');
const files=new Map(list(dir).map(path=>[path,read(dir,path)]));
assert.deepEqual(sums(files),originals);
assert.equal(files.size,178);
const ind=read(independentPath,'independent-v2.js');
const indName='r4-independent-prod-v2.js';
assert.ok(!files.has(indName));
files.set(indName,ind);
files.set('index.html',patch(files.get('index.html').toString('utf8'),
 '<script src="./r4-independent-owner.js?v=05b861eaffad3030"></script>',
 `<script src="./${indName}?v=${digest(ind).slice(0,16)}"></script>`));
assert.deepEqual(sums(files),independent);
const overlay=[
 ['r4-branch-finance-settlement.js','settlement-admin.js'],
 ['r4-branch-finance-paid.js','paid-admin.js'],
];
for(const [path,source] of overlay){
 assert.ok(!files.has(path));files.set(path,read(financePath,source));
}
const anchor='<script src="./r4-branch-operations.js?v=r4-ops-d75f6a0c54a0"></script>';
files.set('index.html',patch(files.get('index.html').toString('utf8'),anchor,
 [anchor,...overlay.map(([path])=>`<script src="./${path}?v=${digest(files.get(path)).slice(0,16)}"></script>`)].join('\n    ')));
assert.equal(candidate.kind,'LOCAL_ONLY_NOT_DEPLOYABLE');
assert.equal(candidate.recoveryCandidate,'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4');
assert.equal(files.size,181);assert.deepEqual(sums(files),candidate.assets);
assert.ok([...files.keys()].every(x=>!x.includes('\\')&&!x.split('/').includes('..')&&!x.startsWith('/')));
const output=resolve(outputPath);
mkdirSync(output);
mkdirSync(join(output,'admin'));
for(const [path,bytes] of files){
 const bits=path.split('/');bits.pop();
 if(bits.length)mkdirSync(join(output,'admin',...bits),{recursive:true});
 writeFileSync(join(output,'admin',path),bytes,{flag:'wx'});
}
writeFileSync(join(output,'source-evidence.json'),JSON.stringify({sourceCiOnly:true,assetCount:files.size,
 financeSeal:freeze.finance,recoveryCandidate:candidate.recoveryCandidate,deployAuthorized:false})+'\n',{flag:'wx'});
console.log('ADMIN_FINANCE_SOURCE_ARTIFACT_READY');
