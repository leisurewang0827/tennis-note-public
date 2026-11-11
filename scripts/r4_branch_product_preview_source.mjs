// Source artifact only. No deployment, DB, auth or production network writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assemble} from './r4_independent_selfserve_dev.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const parent='81046af5ff14184585533f1a72b22f29a0298050';
const branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const candidateHashes={'app/admin/index.html':'a1e83cd81efa81fc044f42a182cf8ba009d4ebfddee918a415a42d98003ddf62','app/admin/r4-branch-operations.js':'adc452497c5a61c94f06b66f2afc079c1d12c53c0e6691ac00fe3833eaa03949','scripts/check_r4_branch_product_membership_web.mjs':'94fb06ce295f8014919fae8ae6a6a5c5a9463e6da24219c945c6a02866c94689'};
// Existing shared index change stays unstaged; this exact patch reconstructs and pins its bytes.
const files=['app/admin/r4-branch-operations.js','scripts/check_r4_branch_product_membership_web.mjs','.github/workflows/r4-branch-product-preview-source.yml','scripts/r4_branch_product_preview_source.mjs','scripts/check_r4_branch_product_preview_source.mjs'].sort();
const option='<option value="product">회원권 상품 등록</option>',addition='<option value="issue" hidden disabled>회원권 등록</option>';
const tag='<script src="./r4-branch-operations.js?v=r4-operations1"></script>',nextTag=tag.replace('r4-operations1','r4-operations2');
const normalized=x=>x.toString('utf8').replace(/\r\n/g,'\n');
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trimEnd();
function edit(html){assert.equal(html.split(option).length,2);assert.equal(html.split(tag).length,2);assert.ok(!html.includes(addition));return html.replace(option,option+'\n              '+addition).replace(tag,nextTag);}
export function reconstructIndex(oldIndex){return Buffer.from(edit(normalized(oldIndex)));}
export function overlay(admin,index,script,test,oldIndex,oldScript){
  for(const [path,bytes] of [['app/admin/index.html',index],['app/admin/r4-branch-operations.js',script],['scripts/check_r4_branch_product_membership_web.mjs',test]])assert.equal(sha(bytes),candidateHashes[path]);
  assert.equal(sha(admin['index.html']),'7eeeb2b998252c80c7eff466df9a879a8cfe0e9288aa62ad9617f5b43e9d26b1');
  assert.equal(sha(admin['r4-branch-operations.js']),'1ae64393eae9a960248b50478861508a5cf88f17e38d26e06e7e5fd890bb969b');
  assert.equal(sha(oldScript),sha(admin['r4-branch-operations.js']));assert.equal(normalized(index),edit(normalized(oldIndex)));
  const candidate={...admin,'index.html':Buffer.from(edit(admin['index.html'].toString('utf8'))),'r4-branch-operations.js':script};
  assert.equal(Object.keys(candidate).length,173);
  assert.deepEqual(Object.keys(candidate).filter(k=>sha(candidate[k])!==sha(admin[k])).sort(),['index.html','r4-branch-operations.js']);
  return candidate;
}
export function compose(base){
  assert.equal(sha(readFileSync('scripts/r4_independent_selfserve_dev.mjs')),'88c7c28e0f49dcec36bbf4071aca4a166e6e1d8b330526b915a769e06b65c4e1');
  const {bytes}=assemble(base),oldIndex=execFileSync('git',['show',parent+':app/admin/index.html']),oldScript=execFileSync('git',['show',parent+':app/admin/r4-branch-operations.js']);
  const patchedIndex=reconstructIndex(oldIndex);
  return overlay(bytes,patchedIndex,readFileSync('app/admin/r4-branch-operations.js'),readFileSync('scripts/check_r4_branch_product_membership_web.mjs'),oldIndex,oldScript);
}
function scope(){
  assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(process.env.GITHUB_REF,'refs/heads/'+branch);
  assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
  const head=git('rev-parse','HEAD');assert.equal(head,process.env.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1',head),head+' '+parent);
  assert.deepEqual(git('diff','--name-only',parent,head).split('\n').sort(),files);return head;
}
async function main(){
  const head=scope(),x=compose('base'),hashes=Object.fromEntries(Object.entries(x).map(([k,v])=>[k,sha(v)]));
  assert.equal(hashes['index.html'],'2cb175e3f44a796dac125861eb498943a1fc3a52b4313f79dba475a159907d7c');
  assert.equal(hashes['r4-branch-operations.js'],candidateHashes['app/admin/r4-branch-operations.js']);
  for(const [p,b] of Object.entries(x)){const dest=join('branch-preview-source','admin',p);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b,{flag:'wx'});}
  const seal={kind:'BRANCH_PRODUCT_PREVIEW_SOURCE_ONLY',source:head,baseArtifact:13757264546,baseDigest:'1272658b5a72962e789b11babcde9a5e5aa28f8104ee154f72ccff6622f34c98',sqlSha256:'29dc84e61acfa2678c0ee7ff1b22a905253171b3bfe5e92f915461e575da51d6',targetFingerprint:'63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba',admin:hashes};
  const bytes=Buffer.from(JSON.stringify(seal,null,2)+'\n');writeFileSync('branch-preview-source/seal.json',bytes,{flag:'wx'});console.log(JSON.stringify({status:'BRANCH_PREVIEW_SOURCE_ONLY',files:173,sealHash:sha(bytes)}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('BRANCH_PREVIEW_SOURCE_HOLD');process.exitCode=1;});
