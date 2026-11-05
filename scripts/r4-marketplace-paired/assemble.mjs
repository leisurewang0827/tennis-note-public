// Assemble only the two reviewed development artifacts from their pinned official builders.
// This is a local candidate; it neither obtains credentials nor deploys anything.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const [adminArg,memberArg,outArg,platform]=process.argv.slice(2);
assert.ok(adminArg&&memberArg&&outArg&&['windows','posix'].includes(platform),'expected official baselines, empty output and explicit platform');
const source={admin:resolve(adminArg),member:resolve(memberArg)}, out=resolve(outArg);
assert.ok(!Object.values(source).some(s=>out===s||out.startsWith(s+sep)||s.startsWith(out+sep)),'output must not overlap a source');
const sha=x=>createHash('sha256').update(x).digest('hex');
const load=p=>readFile(p).then(x=>JSON.parse(x));
const delta=await load(join(root,'delta/LOCAL-RUNTIME-DELTA.json'));
assert.equal(delta.candidateSha256,'504459b03b9f61f5b4b6f3bea6f5809adaaa526a7a19cecf693bc8c627a7be0e');
const expectedCount={admin:7,member:11};
const rows={admin:await load(join(root,'admin-baseline.json')),member:await load(join(root,'member-baseline.json'))};
const posix=await load(join(root,'posix-baseline.json'));
assert.equal(posix.digestSha256,'73224eeb3c7be8d27d1601af53b537f69f912345789d98534ce5a62aedb2553f');
assert.equal(sha(JSON.stringify(posix.files)),posix.digestSha256,'posix manifest drift');
assert.equal(posix.files.length,35);
const posixMap=new Map(posix.files.map(x=>[x.surface+'/'+x.path,x]));assert.equal(posixMap.size,35);
assert.equal(rows.admin.artifactSha256,'165fd918140cfeda7a97e2cb5e5b43a3cfaaddbffb8defc753b7a539a21765d4');
assert.equal(rows.member.artifactSha256,'838b677fdeef020caf625644ef5b43f9a7a0505392dc3980a1d7de9a7c0505f4');
for(const side of ['admin','member']) assert.equal(sha(JSON.stringify(rows[side].files)),rows[side].artifactSha256,'baseline receipt drift');
assert.equal(sha(JSON.stringify({adminBase:rows.admin.artifactSha256,memberBase:rows.member.artifactSha256,delta:delta.delta})),delta.candidateSha256,'delta manifest drift');
assert.equal(rows.admin.source,'8d3dfca18ee0cd9511aea50b147df647ef1fea0b');
assert.equal(rows.admin.devBase,'0d2a1e5a489cead9957368ffe66c85c0b7c0a261');
assert.equal(rows.member.source,'15f046722252a75892886ca7afd67a4fea37ea9f');
function safe(p){assert.ok(typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>!x||x==='.'||x==='..'),'invalid path');return p;}
function checkFile(surface,path,actual,expected){if(actual!==expected){console.error(JSON.stringify({code:'BASELINE_HASH_MISMATCH',surface,path,expected,actual}));process.exit(1);}}
async function walk(dir,prefix=''){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=prefix+e.name;assert.ok(!e.isSymbolicLink(),'symlink forbidden');if(e.isDirectory())result.push(...await walk(join(dir,e.name),path+'/'));else{assert.ok(e.isFile(),'non-file forbidden');result.push(path);}}return result.sort();}
for(const side of ['admin','member']){
 const list=rows[side].files.map(x=>safe(x.path)).sort();assert.deepEqual(await walk(source[side]),list,'baseline file set drift');
 for(const file of rows[side].files)if(file.path!=='shared/config.local.js'){const alt=posixMap.get(side+'/'+file.path);if(alt)assert.equal(alt.windowsSha256,file.sha256,'posix mapping drift');checkFile(side,file.path,sha(await readFile(join(source[side],file.path))),platform==='posix'&&alt?alt.posixSha256:file.sha256);}
 const changed=delta.delta.filter(x=>x.surface===side);assert.equal(changed.length,expectedCount[side]);assert.equal(new Set(changed.map(x=>x.path)).size,changed.length);
 for(const file of changed){safe(file.path);assert.notEqual(file.path,'shared/config.local.js');assert.equal(sha(await readFile(join(root,'delta',side,file.path))),file.sha256,'delta drift');}
}
assert.equal(delta.delta.length,18);
await mkdir(out,{recursive:false});
for(const side of ['admin','member'])await cp(source[side],join(out,side),{recursive:true,errorOnExist:true,force:false});
for(const file of delta.delta){const target=join(out,file.surface,file.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(join(root,'delta',file.surface,file.path)));assert.equal(sha(await readFile(target)),file.sha256);}
for(const side of ['admin','member']){
 const changes=new Map(delta.delta.filter(x=>x.surface===side).map(x=>[x.path,x.sha256]));
 const paths=new Set(rows[side].files.map(x=>x.path));for(const p of changes.keys())paths.add(p);
 assert.deepEqual(await walk(join(out,side)),[...paths].sort(),'output file set drift');
 for(const file of rows[side].files)if(file.path!=='shared/config.local.js'){const alt=posixMap.get(side+'/'+file.path);checkFile(side,file.path,sha(await readFile(join(out,side,file.path))),changes.get(file.path)||(platform==='posix'&&alt?alt.posixSha256:file.sha256));}
}
console.log(JSON.stringify({status:'ASSEMBLED_LOCAL_NOT_DEPLOYABLE',candidate:delta.candidateSha256,adminChanges:7,memberChanges:11,environmentValidation:false}));
