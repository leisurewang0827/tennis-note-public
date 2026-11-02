// Exact production successor admission. Does not execute database operations.
import {createHash} from 'node:crypto';
import {readFileSync,appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

export const BASE='b7e6e84d980067d58427c37448c47c88704a6be1';
export const BASE_TREE='5ff01dcd7043e2abc45a36b07abc1ff3aacfc739';
export const BRANCH='codex/r3-dispute-production563-20261102';
export const REPO='leisurewang0827/tennis-note-public';
export const SUBJECT='release(tennisnote): promote r3 dispute 563';
export const FIXTURE='tests/fixtures/r3-production-563-selection.json';
export const TEST='tests/r3-production-563-admission.test.mjs';
export const SELF='scripts/check_r3_dispute_production563.mjs';
export const FIXTURE_SHA='267f25209b8836a554478fcef38adccb3c05bec92757cd4a3e9021a7c95f90a6';
export const TEST_SHA='0c5b7c2137d1a1e81f90f8bfff7d45ad50a641fd15224ceaf96863bade37c611';
export const SELF_SEAL='6c69f0b437c88c5ea9db9d4443cce477926f798b00eaeb3f36bc5e1c848e62c8';
const CONTROLS=['scripts/check_r3_purchase_identity_admission.mjs','scripts/verify.sh','.github/workflows/tennisnote-public-ci.yml'];
export const CONTROL_HASHES={
 'scripts/check_r3_purchase_identity_admission.mjs':'4f5571129cb547ac3f82242ddbf1f0681987cf8c03ce31c81979de7a78021f54',
 'scripts/verify.sh':'1e60a58e386fe0db1414ad08fde833909b518c5914c50490886685429d31498a',
 '.github/workflows/tennisnote-public-ci.yml':'6e5ce66c6c1a446f031167984981ec2f14f438f6b28b7ea1a0a3d8e4e62dc57d',
};
const PRODUCT=['app/admin/views/billing.js','app/shared/tennisnote-settlement-adjustment.js','app/tennis-note-coach-app/views/settlement.js'];
export const CANDIDATE_PATHS=['app/admin/index.html','app/admin/views/billing.js','app/release.json','app/shared/tennisnote-release.js','app/shared/tennisnote-settlement-adjustment.js','app/tennis-note-coach-app/app.js','app/tennis-note-coach-app/domain/coaches.js','app/tennis-note-coach-app/forms/common.js','app/tennis-note-coach-app/index.html','app/tennis-note-coach-app/service-worker.js','app/tennis-note-coach-app/views/settlement.js','app/tennis-note-member-app/app.js','app/tennis-note-member-app/forms/common.js','app/tennis-note-member-app/index.html','app/tennis-note-member-app/service-worker.js','app/tennis-note-member-app/ui/screens.js'];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const lf=s=>String(s).replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(lf(s)).digest('hex');
const need=(v,c)=>{if(!v)throw Error('R563_'+c);};
const sorted=a=>[...a].sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:8000000}).trim();
const raw=(ref,p)=>lf(execFileSync('git',['show',ref+':'+p],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:8000000}));

export function seal(s){
  const pattern=/^export const SELF_SEAL='[^']+';$/gm;
  need([...s.matchAll(pattern)].length===1,'SEAL_SHAPE');
  return hash(s.replace(pattern,"export const SELF_SEAL='PENDING';"));
}
export function trustedFixture(fixtureRaw,testRaw,selfRaw){
  need(hash(fixtureRaw)===FIXTURE_SHA&&hash(testRaw)===TEST_SHA&&seal(selfRaw)===SELF_SEAL,'INPUT_PIN');
  const f=JSON.parse(fixtureRaw);
  need(Array.isArray(f.candidatePaths)&&f.candidatePaths.length===16&&same(sorted(f.candidatePaths.map(x=>x?.path)),sorted(CANDIDATE_PATHS)),'FIXTURE_PATHS');
  return f;
}
export function inverseControl(path,contents){
  const markers=path===CONTROLS[0]?['    // R3_563_ENTRY_BEGIN\n','    // R3_563_ENTRY_END\n']:
    path===CONTROLS[1]?['# R3_PROD_563_COLLECTOR_BEGIN\n','# R3_PROD_563_COLLECTOR_END\n']:
    path===CONTROLS[2]?['      # R3_PROD_563_COLLECTOR_BEGIN\n','      # R3_PROD_563_COLLECTOR_END\n']:null;
  need(markers!==null,'CONTROL_PATH');
  const s=lf(contents),[begin,end]=markers;
  need(s.split(begin).length===2&&s.split(end).length===2&&s.indexOf(begin)<s.indexOf(end),'CONTROL_MARKER');
  let result=s.slice(0,s.indexOf(begin))+s.slice(s.indexOf(end)+end.length);
  if(path===CONTROLS[0]){
    for(const [b,e] of [['// R3_563_HISTORICAL_IMPORT_BEGIN\n','// R3_563_HISTORICAL_IMPORT_END\n'],['// R3_563_HISTORICAL_WRAPPER_BEGIN\n','// R3_563_HISTORICAL_WRAPPER_END\n']]){
      need(result.split(b).length===2&&result.split(e).length===2&&result.indexOf(b)<result.indexOf(e),'CONTROL_MARKER');
      result=result.slice(0,result.indexOf(b))+result.slice(result.indexOf(e)+e.length);
      if(b.includes('WRAPPER'))result=result.replace('// R3_562_ADMISSION_END\n\n\n','// R3_562_ADMISSION_END\n\n');
    }
  }
  if(path===CONTROLS[1])result=result.replace('# R3_PROD_563_COLLECTOR_END\n\n','');
  if(path===CONTROLS[1])result=result.replace('\n\n# PROD_LEGACY_COLLECTOR_BEGIN','\n# PROD_LEGACY_COLLECTOR_BEGIN');
  return result;
}
export function validate(s){
  const f=s.fixture;
  need(f?.contract==='r3-production-563-selection/1'&&f.base===BASE&&f.baseTree===BASE_TREE&&f.branch===BRANCH&&f.normalization==='utf8-lf','FIXTURE');
  need(f.release?.version==='1.0.563'&&f.release?.appSurfaceVersion==='1.0.563'&&f.release?.releaseId==='2026.11.02.02'&&f.release?.memberCache==='tennis-note-member-pwa-v596'&&f.release?.coachCache==='tennis-note-coach-mode-v569'&&typeof f.release?.deployedAt==='string','RELEASE');
  need(Array.isArray(f.candidatePaths)&&f.candidatePaths.length===16&&same(sorted(f.candidatePaths.map(x=>x?.path)),sorted(CANDIDATE_PATHS)),'FIXTURE_PATHS');
  const names=f.candidatePaths.map(x=>x.path), expected=sorted([...names,...CONTROLS,SELF,FIXTURE,TEST]);
  need(new Set(expected).size===22&&same(sorted(s.paths),expected),'PATHS');
  need(f.candidatePaths.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)&&/^[a-f0-9]{64}$/.test(x.baseSha256)&&s.hashes[x.path]===x.sha256&&s.baseHashes[x.path]===x.baseSha256),'BYTES');
  need(s.fixtureHash===FIXTURE_SHA&&s.testHash===TEST_SHA&&s.selfSeal===SELF_SEAL&&s.controlsMatch&&s.metadataMatch&&same(s.controlHashes,CONTROL_HASHES),'CONTROL');
  need(s.repo===REPO&&s.clean===true&&s.attempt==='1'&&s.baseTree===BASE_TREE&&s.checkoutTree===s.candidateTree&&/^[a-f0-9]{40}$/.test(s.head||''),'GRAPH');
  if(s.event==='pull_request'){
    need(/^[a-f0-9]{40}$/.test(s.candidateParent||'')&&s.candidateParent!==BASE&&s.featureParent===BASE&&same(sorted(s.featurePaths),sorted(PRODUCT))&&PRODUCT.every(p=>s.featureHashes[p]===s.hashes[p]),'FEATURE_GRAPH');
    need(s.mode==='--ci-route'&&s.headBranch===BRANCH&&s.headRepo===REPO&&s.baseRepo===REPO&&s.base===BASE&&s.target==='main'&&s.workflow==='Tennis Note Public PWA CI'&&Number.isSafeInteger(s.number)&&s.number>0&&s.ref==='refs/pull/'+s.number+'/merge'&&s.workflowRef===REPO+'/.github/workflows/tennisnote-public-ci.yml@'+s.ref&&same(s.checkoutParents,[BASE,s.head]),'PR');
  }else if(s.event==='push'){
    const deploy=s.mode==='--production-source';
    const wf=deploy?({'Deploy Tennis Note short URLs':'.github/workflows/deploy-cloudflare-pages.yml','Deploy Tennis Note web beta':'.github/workflows/deploy-pages.yml'})[s.workflow]:s.mode==='--ci-route'&&s.workflow==='Tennis Note Public PWA CI'?'.github/workflows/tennisnote-public-ci.yml':null;
    need(s.candidateParent===BASE&&s.ref==='refs/heads/main'&&s.before===BASE&&s.subject?.startsWith(SUBJECT)&&same(s.checkoutParents,[BASE])&&wf&&s.workflowRef===REPO+'/'+wf+'@refs/heads/main','PUSH');
  }else need(false,'EVENT');
  return true;
}

export function run(args,event,env,tools){
  need(args.length===2&&args[1]==='--production'&&['--ci-route','--production-source'].includes(args[0]),'ARGS');
  const pr=env.GITHUB_EVENT_NAME==='pull_request',head=pr?event.pull_request?.head?.sha:env.GITHUB_SHA;
  need(/^[a-f0-9]{40}$/.test(head||'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')&&git('rev-parse','HEAD')===env.GITHUB_SHA&&env.GITHUB_WORKFLOW_SHA===env.GITHUB_SHA,'SHA');
  const fixtureRaw=raw(head,FIXTURE),testRaw=raw(head,TEST),selfRaw=raw(head,SELF),f=trustedFixture(fixtureRaw,testRaw,selfRaw);
  const paths=git('diff','--no-renames','--name-only',BASE,head).split('\n').filter(Boolean);
  const hashes={},baseHashes={};
  for(const x of f.candidatePaths){hashes[x.path]=hash(raw(head,x.path));baseHashes[x.path]=hash(raw(BASE,x.path));}
  const controlsMatch=CONTROLS.every(p=>inverseControl(p,raw(head,p))===raw(BASE,p));
  const meta=f.candidatePaths.filter(x=>!PRODUCT.includes(x.path));
  const metadataMatch=meta.length===13&&meta.every(x=>raw(head,x.path)===tools.expectedMetadata(x.path,raw(BASE,x.path),f.release,'1.0.562'));
  for(const p of ['.github/workflows/deploy-cloudflare-pages.yml','.github/workflows/deploy-pages.yml'])need(raw(head,p)===raw(BASE,p),'DEPLOY_WORKFLOW');
  const controlHashes=Object.fromEntries(CONTROLS.map(p=>[p,hash(raw(head,p))]));
  const candidateParent=git('show','-s','--format=%P',head);
  const featureParent=pr?git('show','-s','--format=%P',candidateParent):null;
  const featurePaths=pr?git('diff','--no-renames','--name-only',BASE,candidateParent).split('\n').filter(Boolean):[];
  const featureHashes=pr?Object.fromEntries(PRODUCT.map(p=>[p,hash(raw(candidateParent,p))])):{};
  validate({fixture:f,paths,hashes,baseHashes,fixtureHash:hash(fixtureRaw),testHash:hash(testRaw),selfSeal:seal(selfRaw),controlsMatch,metadataMatch,controlHashes,
    repo:env.GITHUB_REPOSITORY,clean:git('status','--porcelain','--untracked-files=all')==='',attempt:env.GITHUB_RUN_ATTEMPT,
    baseTree:git('rev-parse',BASE+'^{tree}'),candidateParent,featureParent,featurePaths,featureHashes,checkoutTree:git('rev-parse',env.GITHUB_SHA+'^{tree}'),candidateTree:git('rev-parse',head+'^{tree}'),head,
    event:env.GITHUB_EVENT_NAME,mode:args[0],headBranch:event.pull_request?.head?.ref,headRepo:event.pull_request?.head?.repo?.full_name,baseRepo:event.pull_request?.base?.repo?.full_name,base:event.pull_request?.base?.sha,target:event.pull_request?.base?.ref,
    workflow:env.GITHUB_WORKFLOW,workflowRef:env.GITHUB_WORKFLOW_REF,number:event.number,ref:env.GITHUB_REF,before:event.before,subject:event.head_commit?.message,checkoutParents:git('show','-s','--format=%P',env.GITHUB_SHA).split(' ').filter(Boolean)});
  if(args[0]==='--ci-route')appendFileSync(env.GITHUB_OUTPUT,'scoped=true\nproduction_563_only=true\n');
  console.log(JSON.stringify({contract:'r3-production-563-selection/1',status:'SOURCE_PROVEN',files:paths.length,runtimeVerified:false,deployed:false}));
}
