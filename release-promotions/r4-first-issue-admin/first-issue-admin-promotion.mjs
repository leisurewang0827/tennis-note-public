// Local review candidate. No token is obtained and no POST is reachable until
// trusted independent QA, protected approval and OFF readback are connected.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const PIN=Object.freeze({repo:'leisurewang0827/tennis-note-public',source:'30bdd59100426cc6cee740c9b52b84c1e6c10c5d',
 run:43033784106,artifact:13861437991,digest:'26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e',
 seal:'7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e',
 recovery:'80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',recoverySource:'81046af5ff14184585533f1a72b22f29a0298050',install:'e63110be73bddee0bf1cb91f58b4cda753f1b8aa4891d755c637001eab5f7b23'});
export function checkGithub(run,artifact){
 if(run?.id!==PIN.run||run.head_sha!==PIN.source||run.run_attempt!==1||run.status!=='completed'||run.conclusion!=='success'||run.path!=='.github/workflows/r4-first-issue-binding-source.yml')fail('SOURCE_NOT_VERIFIED');
 if(artifact?.id!==PIN.artifact||artifact.workflow_run?.id!==PIN.run||artifact.digest!=='sha256:'+PIN.digest||artifact.expired!==false||!(Date.parse(artifact.expires_at)>Date.now()))fail('ARTIFACT_NOT_VERIFIED');
 return true;
}
export function checkRecovery(deployment,canonical){
 const d=deployment?.result,c=canonical?.result;
 if(deployment?.success!==true||d?.id!==PIN.recovery||d.environment!=='production'||d.latest_stage?.status!=='success'||d.deployment_trigger?.metadata?.branch!=='main'||d.deployment_trigger?.metadata?.commit_hash!==PIN.recoverySource)fail('RECOVERY_NOT_VERIFIED');
 if(canonical?.success!==true||c?.name!=='tennisnote-admin'||c.production_branch!=='main'||c.canonical_deployment?.id!==PIN.recovery)fail('CANONICAL_DRIFT');
 return true;
}
export function checkPost(canonical,publishedId){
 const c=canonical?.result,d=c?.canonical_deployment;
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(publishedId||'')||publishedId===PIN.recovery||canonical?.success!==true||c?.name!=='tennisnote-admin'||c.production_branch!=='main'||d?.id!==publishedId||d.environment!=='production'||d.latest_stage?.status!=='success'||d.deployment_trigger?.metadata?.branch!=='main'||d.deployment_trigger?.metadata?.commit_hash!==PIN.source)fail('PUBLISHED_CANONICAL_MISMATCH');
 return true;
}
export function classifyUnknownPost(){return 'UNKNOWN_READBACK_REQUIRED_NO_RETRY';}
function walk(dir,prefix=''){return Object.fromEntries(readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(!e.isFile()&&!e.isDirectory())fail('INVALID_ASSET');const n=prefix+e.name;
 return e.isDirectory()?Object.entries(walk(join(dir,e.name),n+'/')):[[n,sha(readFileSync(join(dir,e.name)))]];
}));}
export function checkArtifact(sealBytes,assetDir){
 if(sha(sealBytes)!==PIN.seal)fail('SEAL_DRIFT');const s=JSON.parse(sealBytes);
 if(s.recoveryDeployment!==PIN.recovery||s.candidateCount!==180||Object.keys(s.assets||{}).length!==180)fail('SEAL_SCOPE');
 assert.deepEqual(walk(assetDir),s.assets);return s;
}
// Cloudflare serves extensionless HTML routes and consumes its three root
// control files at deployment time. Those three are checked in the 180-file
// archive seal, never compared against a public SPA fallback response.
export function publicAssetRoute(name){
 if(typeof name!=='string'||name.startsWith('/')||name.includes('\\'))fail('ASSET_PATH_DENIED');
 if(['_headers','_redirects','_worker.js'].includes(name))return null;
 const parts=name.split('/');if(parts.some(x=>!x||x==='.'||x==='..'))fail('ASSET_PATH_DENIED');
 const last=parts.at(-1);
 if(last==='index.html')return '/'+(parts.length>1?parts.slice(0,-1).map(encodeURIComponent).join('/')+'/':'');
 if(last.endsWith('.html'))parts[parts.length-1]=last.slice(0,-5);
 return '/'+parts.map(encodeURIComponent).join('/');
}
export async function officialRead(url,credential){
 const u=new URL(url);
 const apiOrigin=new Map([['api.github.com','github'],['api.cloudflare.com','cloudflare']]);
 const publicHosts=new Set(['tennisnote-admin.pages.dev','80f7c05f.tennisnote-admin.pages.dev']);
 if(u.protocol!=='https:'||u.port||u.username||u.password||(!apiOrigin.has(u.hostname)&&!publicHosts.has(u.hostname)))fail('HOST_DENIED');
 const headers={};
 if(credential!==undefined){
  const provider=apiOrigin.get(u.hostname);
  if(!provider||credential?.provider!==provider||typeof credential.token!=='string'||!/^[\x21-\x7e]{1,4096}$/.test(credential.token))fail('CREDENTIAL_ORIGIN_DENIED');
  headers.Authorization='Bearer '+credential.token;
  headers.Accept='application/json';
 }
 const r=await fetch(u,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers});
 if(r.status!==200)fail('READ_FAILED');return r;
}
// This cannot be bypassed using an argument or a caller-supplied JSON file.
export function admitProduction(){fail('OFF_QA_APPROVAL_TRUSTED_BRIDGE_UNAVAILABLE');}
export async function prepareTransport(wranglerBytes){
 admitProduction();
 // Intended repository placement: release-promotions/r4-first-issue-admin/.
 // The existing helper is loaded only after the trusted bridge is implemented.
 const helper=new URL('../../scripts/r4_internal_registration_prod_promotion.mjs',import.meta.url);
 if(sha(readFileSync(helper))!=='e74e98d70cbfdc33d0d6031589365094d2f8a932d01ac40dfb642a40df7361b4')fail('TRANSPORT_HELPER_DRIFT');
 const {patchProductionWrangler}=await import(helper.href);
 return patchProductionWrangler(wranglerBytes);
}
export function publishOnce(){admitProduction();}
export function rollbackOnce(){admitProduction();}
export function postReadback(){admitProduction();}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{admitProduction();}catch(e){console.log(e.code||'BLOCKED');process.exitCode=1;}
}
