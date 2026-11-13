// Candidate protected entry. Must be independently reviewed before any Git push.
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {request} from 'node:https';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expected,assertSource,assertArtifact,assertRecovery} from './protected-finance-admission.mjs';
import {readOfficialReview} from './finance-publish-review-proof.mjs';
import {readQueue} from './finance-publish-queue.mjs';
import {sequenceProtectedAdmin} from './finance-protected-publish-sequence.mjs';
import {classifyPostread} from './finance-mismatch-classifier.mjs';
import {verifyRollbackPreimage} from './finance-protected-rollback-proof.mjs';
import {readRoutes} from './finance-postread.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,c)=>{if(!x)throw Error(c);};
const repo='leisurewang0827/tennis-note-public',branch=expected.branch;
const workflow='.github/workflows/r4-branch-finance-protected-publish.yml';
const parent='dd04b2782f387b90653ef6f07caa51b91ecc2fb7';
const first='07be1fc7423d291f4fe094e53c7d446ab303f5c5';
const recoverySource='81046af5ff14184585533f1a72b22f29a0298050';
const helperHash='e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4';
const prefix='release-promotions/r4-branch-finance-admin/';
const files=[workflow,prefix+'check-live-integration-only.mjs',prefix+'finance-protected-live-entry.mjs'].sort();
const git=(...x)=>execFileSync('git',x,{encoding:'utf8'}).trim();
function assertContext(e){
 need(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY===repo&&e.GITHUB_REF==='refs/heads/'+branch&&e.GITHUB_EVENT_NAME==='push'&&e.GITHUB_RUN_ATTEMPT==='1','CI_CONTEXT_DENIED');
 need(e.GITHUB_WORKFLOW_REF===`${repo}/${workflow}@refs/heads/${branch}`&&/^[a-f0-9]{40}$/.test(e.GITHUB_SHA||'')&&git('rev-parse','HEAD')===e.GITHUB_SHA,'CI_HEAD_DENIED');
 need(git('rev-list','--parents','-n','1','HEAD')===`${e.GITHUB_SHA} ${parent}`,'CI_PARENT_DENIED');
 need(git('rev-list','--parents','-n','1',parent)===`${parent} ${first}`,'CI_DIAGNOSTIC_PARENT_DENIED');
 const changes=git('diff-tree','--no-commit-id','--name-status','-r','HEAD').split('\n').sort();
 need(JSON.stringify(changes)===JSON.stringify(files.map(p=>'M\t'+p).sort()),'CI_SCOPE_DENIED');
 need(/^[1-9][0-9]*$/.test(e.GITHUB_RUN_ID||'')&&Number.isSafeInteger(Number(e.GITHUB_RUN_ID)),'CI_RUN_DENIED');
}
async function assertSignedJob(e,{run,head}){
 const endpoint=new URL(e.ACTIONS_ID_TOKEN_REQUEST_URL||'');
 need(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.port&&endpoint.hostname.endsWith('.actions.githubusercontent.com')&&e.ACTIONS_ID_TOKEN_REQUEST_TOKEN,'OIDC_REQUEST_DENIED');
 endpoint.searchParams.set('audience','tennisnote-r4-finance-admin-publish');
 const [credential,keys]=await Promise.all([get(endpoint,e.ACTIONS_ID_TOKEN_REQUEST_TOKEN),get('https://token.actions.githubusercontent.com/.well-known/jwks')]);
 const [h,p,s,...extra]=typeof credential.value==='string'?credential.value.split('.'):[];
 need(h&&p&&s&&!extra.length&&credential.value.length<=24000,'OIDC_SHAPE_DENIED');
 const header=JSON.parse(Buffer.from(h,'base64url')),claims=JSON.parse(Buffer.from(p,'base64url'));
 const match=Array.isArray(keys.keys)?keys.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig'):[];
 need(header.alg==='RS256'&&match.length===1&&verifySignature('RSA-SHA256',Buffer.from(h+'.'+p),createPublicKey({key:match[0],format:'jwk'}),Buffer.from(s,'base64url')),'OIDC_SIGNATURE_DENIED');
 const name='tennisnote-r4-admin-production',now=Math.floor(Date.now()/1000);
 need(claims.iss==='https://token.actions.githubusercontent.com'&&claims.aud==='tennisnote-r4-finance-admin-publish'&&
   claims.sub===`repo:${repo}:environment:${name}`&&claims.environment===name&&String(claims.repository_id)==='1299952631'&&
   claims.repository===repo&&claims.ref===`refs/heads/${branch}`&&claims.event_name==='push'&&String(claims.run_id)===String(run)&&String(claims.run_attempt)==='1'&&
   claims.sha===head&&claims.workflow_sha===head&&claims.workflow_ref===`${repo}/${workflow}@refs/heads/${branch}`&&claims.runner_environment==='github-hosted'&&
   Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.exp>now&&claims.iat<=now+30&&claims.exp>claims.iat&&claims.exp-claims.iat<=600,'OIDC_CONTEXT_DENIED');
 return claims.exp*1000;
}
async function get(url,token){
 const r=await fetch(url,{method:'GET',headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
 need(r.status===200,'READ_FAILED');
 const data=await readBounded(r,2e6);
 return JSON.parse(data);
}
async function readBounded(r,max){
 need(r.body,'READ_BODY_MISSING');const parts=[];let size=0;
 for await(const part of r.body){size+=part.length;need(size<=max,'READ_BODY_TOO_LARGE');parts.push(part);}
 return Buffer.concat(parts);
}
async function live(){
 const e=process.env;assertContext(e);
 const gh=e.GH_TOKEN,account=e.CLOUDFLARE_ACCOUNT_ID,cfToken=e.CLOUDFLARE_API_TOKEN,fp=e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT;
 need(gh&&cfToken&&/^[a-f0-9]{32}$/.test(account||'')&&/^[a-f0-9]{64}$/.test(fp||'')&&sha(account)===fp,'TARGET_DENIED');
 const api=`https://api.github.com/repos/${repo}`,cf=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`;
 const run=Number(e.GITHUB_RUN_ID),head=e.GITHUB_SHA;
 const oidcExpiry=await assertSignedJob(e,{run,head});
 const jobList=await get(`${api}/actions/runs/${run}/attempts/1/jobs?per_page=100`,gh);
 need(Array.isArray(jobList.jobs)&&jobList.total_count===jobList.jobs.length,'JOB_LIST_INCOMPLETE');
 const jobs=jobList.jobs.filter(j=>j.name==='r4-finance-admin-publish');
 need(jobs.length===1&&Number.isSafeInteger(jobs[0].id),'JOB_ID_UNCONFIRMED');
 const target={commit:head,run,job:jobs[0].id};
 const artifact=join(e.RUNNER_TEMP,'r4-finance-admin-out');
 const sealBytes=readFileSync('release-sources/r4-branch-finance-admin/admin-seal.json');
 const assets=JSON.parse(sealBytes).assets;
 const priorSeal=readFileSync('release-sources/r4-independent-prod-v2/candidate-seal.json');
 need(sha(priorSeal)==='f454d23dbce8ca99895945950f4a80ee75a0f1f633a9419b2eb73fdf049daaaa','RECOVERY_SEAL_DRIFT');
 const recoveryAssets=JSON.parse(priorSeal).admin.sha256;
 const artifactCheck=async()=>{
  const [r,a]=await Promise.all([get(`${api}/actions/runs/${expected.run}`,gh),get(`${api}/actions/artifacts/${expected.artifact}`,gh)]);
  assertSource(r,a);assertArtifact(artifact,sealBytes);return {sha:expected.source,seal:expected.seal,assets};
 };
 const preimage=async()=>{
  const project=await get(cf,cfToken),recovery=await get(`${cf}/deployments/${expected.recovery}`,cfToken);
  assertRecovery(project,recovery,recoverySource);
  const oldIndex='66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0';
  for(const host of ['https://tennisnote-admin.pages.dev','https://80f7c05f.tennisnote-admin.pages.dev']){
   const r=await readPublic(host+'/');need(r.status===200&&sha(Buffer.from(await r.arrayBuffer()))===oldIndex,'PREIMAGE_BYTES_MISMATCH');
  }
  const current=await get(cf,cfToken);assertRecovery(current,recovery,recoverySource);
  return {project:current,recovery};
 };
 const review=async()=>{
  const result=await readOfficialReview({target,token:gh});
  need(Date.now()<oidcExpiry,'OIDC_EXPIRED');return result;
 };
 const queue=()=>readQueue({token:gh,ownRun:run});
 const readPublic=async url=>{
  const u=new URL(url);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   (u.hostname==='tennisnote-admin.pages.dev'||/^[a-f0-9]{8}\.tennisnote-admin\.pages\.dev$/.test(u.hostname)),'PUBLIC_HOST_DENIED');
  const r=await fetch(u,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const bytes=r.status===200?await readBounded(r,10e6):Buffer.alloc(0);
  if(r.status!==200)await r.body?.cancel();
  const copy=()=>({status:r.status,headers:r.headers,arrayBuffer:async()=>bytes,clone:copy});
  return copy();
 };
 let claimed=false,sent=false,rollbackClaimed=false,rollbackSent=false,rollbackTarget=null;
 const io={verifySealedArtifact:artifactCheck,queue,readPreimage:preimage,officialReview:review,now:()=>Date.now(),
  claimPublish:async()=>{need(!claimed,'PUBLISH_ALREADY_CLAIMED');need((await queue()).ready,'PUBLISH_QUEUE_BUSY');
   const p=await preimage();assertRecovery(p.project,p.recovery,recoverySource);await review();claimed=true;},
  publishOnce:async()=>{
   need(claimed&&!sent,'PUBLISH_NO_RETRY');const p=await preimage();assertRecovery(p.project,p.recovery,recoverySource);
   const helper=resolve('scripts/r4_internal_registration_prod_promotion.mjs');need(sha(readFileSync(helper))===helperHash,'TRANSPORT_HELPER_DRIFT');
   const {patchProductionWrangler}=await import(pathToFileURL(helper).href);
   const root=join(e.RUNNER_TEMP,'r4-wrangler','node_modules','wrangler'),patched=join(root,'wrangler-dist','cli-r4-single.cjs');
   const pinned=readFileSync(patched);
   need(sha(pinned)==='e35355b3a5cb45fcb47ad016f043649b8ad891dc5781b7c7e3e278c7deccf5c4'&&
     Buffer.from(patchProductionWrangler(readFileSync(join(root,'wrangler-dist','cli.js')))).equals(pinned),'PATCHED_CLI_DRIFT');
   assertArtifact(artifact,sealBytes);
   const approval=await review();
   const cutoff=Math.min(Date.parse(approval.observedAt)+120000,oidcExpiry);
   const transport=readFileSync(patched,'utf8'),anchor='  if (__r4DeploymentPosts !== 0) throw Error("R4_DEPLOYMENT_RETRY_DENIED");';
   need(transport.split(anchor).length===2,'DEPLOYMENT_GUARD_DRIFT');
   const guarded=join(root,'wrangler-dist','cli-r4-finance-deadline.cjs');
   writeFileSync(guarded,transport.replace(anchor,`  if (Date.now() > ${cutoff}) throw Error("OFF_REVIEW_EXPIRED_BEFORE_POST");\n${anchor}`),{flag:'wx'});
   sent=true;
   const args=[guarded,'pages','deploy',join(artifact,'admin'),'--project-name=tennisnote-admin','--branch=main','--commit-hash='+expected.source,'--commit-dirty=false'];
   return new Promise(done=>{let out='',finished=false;const finish=x=>{if(finished)return;finished=true;clearTimeout(timer);done(x);};
    const child=spawn(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{PATH:e.PATH,HOME:e.HOME,TMPDIR:e.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:cfToken}});
    const timer=setTimeout(()=>{child.kill();finish({status:'UNKNOWN_HOLD_NO_RETRY'});},120000);
    child.stdout.on('data',x=>{out+=x.toString();if(out.length>1048576)child.kill();});child.stderr.resume();
    child.on('error',()=>finish({status:'UNKNOWN_HOLD_NO_RETRY'}));child.on('close',code=>{const urls=[...new Set(out.match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin\.pages\.dev/g)||[])];finish(code===0&&urls.length===1?{status:'POST_RETURNED_READBACK_REQUIRED',url:urls[0]}:{status:'UNKNOWN_HOLD_NO_RETRY'});});
   });
  },
  readCanonical:()=>get(cf,cfToken),
  verifyPublished:async(_id,write,project)=>classifyPostread({write,project,projectAfter:()=>get(cf,cfToken),sealBytes,read:readPublic}),
  // The same protected approval covers restoring only this fixed preimage on a
  // confirmed mismatch from this job. Uncertain responses cannot arm recovery.
  rollbackAuthorized:async({id,recovery,asset})=>{
   if(!sent||rollbackTarget||recovery!==expected.recovery||!Object.hasOwn(assets,asset))return false;
   await review();
   const p=await get(cf,cfToken),old=await get(`${cf}/deployments/${expected.recovery}`,cfToken);
   const check=await verifyRollbackPreimage({publishedId:id,asset,sealBytes,project:p,recovery:old,readPublic,readProject:()=>get(cf,cfToken)});
   if(!check.preimageVerified||check.restoreId!==expected.recovery)return false;
   rollbackTarget={id,asset};return true;
  },
  readRecoveryForRollback:async()=>({project:await get(cf,cfToken),recovery:await get(`${cf}/deployments/${expected.recovery}`,cfToken)}),
  fetchBytes:readPublic,
  claimRollback:async()=>{need(rollbackTarget&&!rollbackClaimed,'ROLLBACK_NO_RETRY');rollbackClaimed=true;},
  rollbackOnce:async restore=>{
   need(rollbackClaimed&&!rollbackSent&&restore===expected.recovery,'ROLLBACK_SCOPE_DENIED');
   need((await queue()).ready,'ROLLBACK_QUEUE_BUSY');
   const p=await get(cf,cfToken),old=await get(`${cf}/deployments/${restore}`,cfToken);
   await verifyRollbackPreimage({publishedId:rollbackTarget.id,asset:rollbackTarget.asset,sealBytes,project:p,recovery:old,readPublic,readProject:()=>get(cf,cfToken)});
   const last=await review();need(Date.now()-Date.parse(last.observedAt)<=120000,'ROLLBACK_OFF_STALE');rollbackSent=true;
   return new Promise(done=>{
    const req=request(`${cf}/deployments/${restore}/rollback`,{method:'POST',headers:{Authorization:'Bearer '+cfToken,Accept:'application/json'}},r=>{
     const body=[];let size=0;r.on('data',b=>{size+=b.length;if(size>1048576)req.destroy();else body.push(b);});
     r.on('end',()=>{try{done(r.statusCode===200&&JSON.parse(Buffer.concat(body)).success===true);}catch{done(false);}});r.on('error',()=>done(false));
    });
    req.on('error',()=>done(false));req.setTimeout(15000,()=>req.destroy());req.end();
   });
  },
  verifyRecoveryAssets:async()=>{
   await preimage();
   const counted=await readRoutes(recoveryAssets,['https://tennisnote-admin.pages.dev','https://80f7c05f.tennisnote-admin.pages.dev'],readPublic);
   await preimage();return counted.normal+counted.redirected+counted.controls===179;
  },
 };
 const result=await sequenceProtectedAdmin(io);
 console.log(JSON.stringify(result));
 if(result.status!=='PUBLISHED_ASSETS_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 live().catch(e=>{console.error(/^[A-Z_]{4,70}$/.test(e?.message||'')?e.message:'PUBLISH_HOLD');process.exitCode=1;});
}
