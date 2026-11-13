import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertArtifact,expected} from '../../release-promotions/r4-branch-finance-admin/protected-finance-admission.mjs';
export const sha=b=>createHash('sha256').update(b).digest('hex');
const here=dirname(fileURLToPath(import.meta.url));
export const sealBytes=readFileSync(join(here,'../r4-branch-finance-admin/admin-seal.json'));
export const baseline=JSON.parse(sealBytes).assets;
export const moduleBytes=Buffer.from(readFileSync(join(here,'disabled.js'),'utf8').replace(/\r\n/g,'\n'));
export const indexHash='f637d073004d254b51eea9d70973be286a50798c9031f7ac4a0318cb6d9b2280';
export const moduleHash='47d2c63bed5a9d97ccfa47f4a9d543fe12ed81592350ca02666daedbb89f6f5d';
assert.equal(sha(sealBytes),expected.seal);
assert.equal(sha(moduleBytes),moduleHash);
export function walk(dir,prefix='') {
  return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    assert(e.isFile()||e.isDirectory());const p=prefix+e.name;
    return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+'/')):[[p,readFileSync(join(dir,e.name))]];
  }));
}
export function compose(files) {
  const before=Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]));
  assert.deepEqual(before,baseline,'BASELINE_DRIFT');assert.equal(Object.keys(files).length,181);
  const old='./r4-scoped-member-catalog.js?v='+baseline['r4-scoped-member-catalog.js'].slice(0,16);
  const html=files['index.html'].toString();assert.equal(html.split(old).length,2,'CACHE_ANCHOR_DRIFT');
  const next={...files,'r4-scoped-member-catalog.js':moduleBytes,'index.html':Buffer.from(html.replace(old,'./r4-scoped-member-catalog.js?v='+moduleHash.slice(0,16)))};
  const hashes=Object.fromEntries(Object.entries(next).map(([p,b])=>[p,sha(b)]));
  assert.deepEqual(Object.keys(next).filter(p=>hashes[p]!==before[p]).sort(),['index.html','r4-scoped-member-catalog.js']);
  assert.equal(hashes['index.html'],indexHash);
  return {files:next,hashes};
}
export function build(base,out) {
  assertArtifact(base,sealBytes);
  const result=compose(walk(join(base,'admin')));
  for(const [p,b] of Object.entries(result.files)){const file=join(out,p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,b);}
  assert.deepEqual(Object.fromEntries(Object.entries(walk(out)).map(([p,b])=>[p,sha(b)])),result.hashes);
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {build(process.argv[2],process.argv[3]);console.log('EXACT_2_OF_181_BUILD_PASS');}
