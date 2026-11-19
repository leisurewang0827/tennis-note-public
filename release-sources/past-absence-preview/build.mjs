// Read-only DEV preview assembly. No Cloudflare credential or write action.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifestBytes=readFileSync('release-sources/past-absence-preview/manifest.json');
assert.equal(hash(manifestBytes),'1afa8bd2787ddd23d3b71620fdd7e5381afe1f852992b852d24aa4a8edbe17cd','MANIFEST_DRIFT');
const m=JSON.parse(manifestBytes);
assert.equal(m.kind,'PAST_ABSENCE_PREVIEW_V3');assert.equal(m.project,'tennisnote-app-dev');assert.equal(m.previewBranch,'r4-absence-group-qa');
assert.equal(process.env.GITHUB_REPOSITORY,m.repo);assert.equal(process.env.GITHUB_REF,'refs/heads/'+m.branch);assert.equal(process.env.GITHUB_EVENT_NAME,'push');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),process.env.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1','HEAD'),`${process.env.GITHUB_SHA} ${m.parent}`);
const owned=['.github/workflows/past-absence-preview.yml','release-sources/past-absence-preview/build.mjs','release-sources/past-absence-preview/publish.mjs','release-sources/past-absence-preview/check.cjs','release-sources/past-absence-preview/manifest.json','release-sources/past-absence-preview/dev/index.html','release-sources/past-absence-preview/dev/service-worker.js',...Object.keys(m.product)].sort();
assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',m.parent,'HEAD').split('\n').sort(),owned,'SCOPE_DRIFT');
for(const [p,h] of Object.entries(m.product))assert.equal(hash(readFileSync(p)),h,'PRODUCT_DRIFT');
for(const [p,h] of Object.entries(m.devLinks))assert.equal(hash(readFileSync('release-sources/past-absence-preview/dev/'+p.split('/').at(-1))),h,'DEV_CACHE_DRIFT');
assert.equal(Object.keys(m.baseline).length,254);
const host=`https://${m.previous.slice(0,8)}.${m.project}.pages.dev`;
const out=join(process.env.RUNNER_TEMP,'past-absence-preview');
const files={};
for(const [p,h] of Object.entries(m.baseline)){
 assert.ok(!p.startsWith('/')&&!p.includes('\\')&&!p.split('/').some(x=>x==='..'||x===''||x==='.'),'PATH_DENIED');
 let b;
 if(Object.hasOwn(m.controls,p))b=Buffer.from(m.controls[p],'base64');
 else {const path='/'+(p.endsWith('index.html')?p.slice(0,-10):p.replace(/\.html$/,''));const r=await fetch(host+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'BASE_READ_FAILED');b=Buffer.from(await r.arrayBuffer());}
 assert.equal(hash(b),h,'BASE_DRIFT');
 const source='app/'+p;
 if(Object.hasOwn(m.devLinks,p))b=readFileSync('release-sources/past-absence-preview/dev/'+p.split('/').at(-1));
 else if(Object.hasOwn(m.product,source))b=readFileSync(source);
 files[p]=hash(b);const dest=join(out,'site',p);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b,{flag:'wx'});
}
const expectedChanged=[...Object.keys(m.product).map(p=>p.slice(4)),...Object.keys(m.devLinks)].filter((p,i,a)=>a.indexOf(p)===i).sort();
assert.deepEqual(Object.keys(files).filter(p=>files[p]!==m.baseline[p]).sort(),expectedChanged,'OVERLAY_SCOPE_DRIFT');
writeFileSync(join(out,'seal.json'),JSON.stringify({source:process.env.GITHUB_SHA,manifest:hash(manifestBytes),files})+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'DEV_PREVIEW_ASSEMBLY_PASS',baseline:254,changed:expectedChanged.length}));
