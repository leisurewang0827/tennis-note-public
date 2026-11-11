// Local integration candidate. A real network write is reachable only with a
// private capability minted by verifyTrustedEvidence; no capability is exported.
import {spawn} from 'node:child_process';
import {request} from 'node:https';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {PIN,checkArtifact,checkPost,publicAssetRoute} from './first-issue-admin-promotion.mjs';
import {verifyOfficialReview,assertOfficialCapability} from './trusted-review-bridge.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const helperHash='e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4';
let publishUsed=false,rollbackUsed=false;
function cap(c,action){assertOfficialCapability(c,action);}

async function realPublish(c){
 cap(c,'admin_publish');if(publishUsed)fail('PUBLISH_NO_RETRY');publishUsed=true;
 const temp=process.env.RUNNER_TEMP,account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!temp||!/^[a-f0-9]{32}$/.test(account||'')||sha(account)!==c.accountFingerprint||!token)fail('TARGET_DENIED');
 const root=join(temp,'r4-wrangler','node_modules','wrangler'),patchedCli=join(root,'wrangler-dist','cli-r4-single.cjs');
 const original=readFileSync(join(root,'wrangler-dist','cli.js'));
 const helper=new URL('../../scripts/r4_internal_registration_prod_promotion.mjs',import.meta.url);
 if(sha(readFileSync(helper))!==helperHash)fail('TRANSPORT_HELPER_DRIFT');
 const {patchProductionWrangler}=await import(helper.href);
 if(!Buffer.from(patchProductionWrangler(original)).equals(readFileSync(patchedCli)))fail('PATCHED_CLI_DRIFT');
 const artifactDir=join(temp,'r4-source','admin');
 checkArtifact(readFileSync(resolve('release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json')),artifactDir);
 const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CLOUDFLARE_ACCOUNT_ID:account,CLOUDFLARE_API_TOKEN:token};
 const args=[patchedCli,'pages','deploy',artifactDir,'--project-name=tennisnote-admin','--branch=main','--commit-hash='+PIN.source,'--commit-dirty=false'];
 cap(await verifyOfficialReview('admin_publish'),'admin_publish');
 return await new Promise(resolve=>{
  const child=spawn(process.execPath,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env});let output='',done=false;
  const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve(result);};
  const timer=setTimeout(()=>{child.kill();finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});},120000);
  child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>1048576)child.kill();});
  child.stderr.resume();child.on('error',()=>finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'}));
  child.on('close',code=>{const urls=[...new Set(output.match(/https:\/\/[a-f0-9]{8}\.tennisnote-admin\.pages\.dev/g)||[])];
    if(code!==0||urls.length!==1)return finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});
    finish({status:'POST_RETURNED_READBACK_REQUIRED',immutableUrl:urls[0]});});
 });
}
async function realRollback(c){
 cap(c,'admin_rollback');const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!/^[a-f0-9]{32}$/.test(account||'')||sha(account)!==c.accountFingerprint||!token)fail('TARGET_DENIED');
 if(rollbackUsed)fail('ROLLBACK_NO_RETRY');rollbackUsed=true;
 cap(await verifyOfficialReview('admin_rollback'),'admin_rollback');
 const url=new URL(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin/deployments/${PIN.recovery}/rollback`);
 return await new Promise(resolve=>{let done=false;const finish=x=>{if(done)return;done=true;resolve(x);};
  const req=request(url,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json'}},res=>{
   let bytes=0,chunks=[];res.on('data',c=>{bytes+=c.length;if(bytes>1048576){req.destroy();return;}chunks.push(c);});
   res.on('error',()=>finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'}));
   res.on('end',()=>{try{const r=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(res.statusCode!==200||r.success!==true)throw Error();finish({status:'POST_RETURNED_READBACK_REQUIRED'});}catch{finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});}});
  });req.on('error',()=>finish({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'}));req.setTimeout(20000,()=>req.destroy());req.end();
 });
}
async function realPostReadback(c,{publishedId}){
 if(!c)fail('TRUSTED_CAPABILITY_REQUIRED');
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!/^[a-f0-9]{32}$/.test(account||'')||sha(account)!==c.accountFingerprint||!token)fail('TARGET_DENIED');
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(publishedId||'')||publishedId===PIN.recovery)fail('DEPLOYMENT_DENIED');
 const cf=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`;
 const get=async(url,auth=false)=>{const r=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:auth?{Authorization:'Bearer '+token,Accept:'application/json'}:{}});if(r.status!==200)fail('READBACK_FAILED');return r;};
 const canonical=await (await get(cf,true)).json();checkPost(canonical,publishedId);
 const recovery=await (await get(cf+'/deployments/'+PIN.recovery,true)).json();
 if(recovery?.success!==true||recovery.result?.id!==PIN.recovery||recovery.result?.environment!=='production'||recovery.result?.latest_stage?.status!=='success'||recovery.result?.deployment_trigger?.metadata?.commit_hash!==PIN.recoverySource)fail('RECOVERY_NOT_VERIFIED');
 const sealBytes=readFileSync(resolve('release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json'));if(sha(sealBytes)!==PIN.seal)fail('SEAL_DRIFT');
 const seal=JSON.parse(sealBytes);if(Object.keys(seal.assets||{}).length!==180)fail('SEAL_SCOPE');
 const fixed=`https://${publishedId.slice(0,8)}.tennisnote-admin.pages.dev`,origin='https://tennisnote-admin.pages.dev';
 const index=seal.assets['index.html'];
 if(!/^[a-f0-9]{64}$/.test(index||''))fail('SEAL_SCOPE');
 const actualIndex=sha(Buffer.from(await (await get(fixed+publicAssetRoute('index.html'))).arrayBuffer()));
 if(actualIndex!==index){
  checkPost(await (await get(cf,true)).json(),publishedId);
  return Object.freeze({status:'KNOWN_IMMUTABLE_INDEX_MISMATCH',publishedId});
 }
 let publicAssets=0;
 for(const [name,expected] of Object.entries(seal.assets)){
  if(name.startsWith('/')||name.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(expected))fail('ASSET_PATH_DENIED');
  const route=publicAssetRoute(name);if(route===null)continue;
  for(const host of [fixed,origin]){const bytes=Buffer.from(await (await get(host+route)).arrayBuffer());if(sha(bytes)!==expected)fail('PUBLISHED_ASSET_MISMATCH');}
  publicAssets++;
 }
 if(publicAssets!==177)fail('PUBLIC_ASSET_SCOPE');
 const oldBytes=readFileSync(resolve('release-sources/r4-independent-prod-v2/candidate-seal.json'));
 if(sha(oldBytes)!=='f454d23dbce8ca99895945950f4a80ee75a0f1f633a9419b2eb73fdf049daaaa')fail('RECOVERY_SEAL_DRIFT');
 const old=JSON.parse(oldBytes),oldIndex=old.admin?.sha256?.['index.html'];
 if(!/^[a-f0-9]{64}$/.test(oldIndex||'')||sha(Buffer.from(await (await get('https://80f7c05f.tennisnote-admin.pages.dev/')).arrayBuffer()))!==oldIndex)fail('RECOVERY_BYTES_MISMATCH');
 checkPost(await (await get(cf,true)).json(),publishedId);
 return Object.freeze({status:'POST_READBACK_VERIFIED',sealedBundleAssets:180,publicAssets,productionPreimage:'SEPARATE_GATE'});
}
async function resolvePublishedId(c,immutableUrl){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!c||sha(account||'')!==c.accountFingerprint||!token)fail('TARGET_DENIED');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
 if(r.status!==200)fail('READBACK_FAILED');const v=await r.json(),id=v.result?.canonical_deployment?.id;checkPost(v,id);
 if(immutableUrl!==`https://${id.slice(0,8)}.tennisnote-admin.pages.dev`)fail('PUBLISH_OUTCOME_UNCERTAIN');return id;
}
async function rollbackReadback(c){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!c||sha(account||'')!==c.accountFingerprint||!token)fail('TARGET_DENIED');
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
 if(r.status!==200)fail('READBACK_FAILED');const v=await r.json();
 if(v.success!==true||v.result?.name!=='tennisnote-admin'||v.result?.production_branch!=='main'||v.result?.canonical_deployment?.id!==PIN.recovery||v.result?.canonical_deployment?.deployment_trigger?.metadata?.commit_hash!==PIN.recoverySource)fail('ROLLBACK_NOT_VERIFIED');
 for(const host of ['https://tennisnote-admin.pages.dev','https://80f7c05f.tennisnote-admin.pages.dev']){
  const x=await fetch(host+'/',{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(x.status!==200||sha(Buffer.from(await x.arrayBuffer()))!=='66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0')fail('ROLLBACK_BYTES_MISMATCH');
 }
 return Object.freeze({status:'ROLLBACK_READBACK_VERIFIED'});
}
async function observeUnknownPublish(c){
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 if(!c||sha(account||'')!==c.accountFingerprint||!token)return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});
 try{
  const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(r.status!==200)fail('READBACK_FAILED');
  const v=await r.json(),d=v.result?.canonical_deployment;
  if(v.success!==true||v.result?.name!=='tennisnote-admin'||v.result?.production_branch!=='main')fail('READBACK_FAILED');
  const observed=d?.id===PIN.recovery?'prior-id':d?.deployment_trigger?.metadata?.commit_hash===PIN.source?'candidate-source':'unclassified';
  return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY',observed,recoveryAllowed:false});
 }catch{return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});}
}
export async function executeAuthorized(intent,parameters){
 if(!['publish','rollback'].includes(intent))fail('ACTION_DENIED');
 const action=intent==='publish'?'admin_publish':'admin_rollback';
 const c=await verifyOfficialReview(action);cap(c,action);
 if(intent==='publish'){
  const helper=new URL('../../scripts/r4_internal_registration_prod_promotion.mjs',import.meta.url);
  if(sha(readFileSync(helper))!==helperHash)fail('TRANSPORT_HELPER_DRIFT');
  // The prepared CLI is produced from the pinned Wrangler bytes using this helper
  // in the protected job, never from caller-supplied JS.
  const result=await realPublish(c);if(result.status!=='POST_RETURNED_READBACK_REQUIRED')return observeUnknownPublish(c);
  try{return await realPostReadback(c,{publishedId:await resolvePublishedId(c,result.immutableUrl)});}catch{return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});}
 }
 if(parameters?.publishedId!==c.publishedId)fail('RECOVERY_PREVIOUS_JOB_MISMATCH');
 const result=await realRollback(c);
 if(result.status!=='POST_RETURNED_READBACK_REQUIRED'){
  try{await rollbackReadback(c);return Object.freeze({status:'RECOVERY_STATE_VERIFIED_WRITE_ACK_UNKNOWN_NO_RETRY'});}
  catch{return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});}
 }
 try{return await rollbackReadback(c);}catch{return Object.freeze({status:'UNKNOWN_READBACK_REQUIRED_NO_RETRY'});}
}
// Deliberately no other exports: callers cannot mint capabilities or call POST.
