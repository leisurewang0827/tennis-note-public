import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {route} from '../../release-promotions/r4-branch-finance-admin/finance-postread.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyAssets(assets,hosts,read,pause=ms=>new Promise(r=>setTimeout(r,ms))){
 const diagnostics=[];let normal=0,redirected=0,controls=0;
 for(const [name,digest]of Object.entries(assets)){
  const path=route(name);if(path===null){controls++;continue;}
  for(const host of hosts){
   let response;
   for(let attempt=1;attempt<=3;attempt++){
    response=await read(host+path);
    if(response.status===200||response.status===302)break;
    diagnostics.push({host:new URL(host).hostname,path,status:response.status,attempt});
    if(attempt===3||![404,429,500,502,503,504].includes(response.status))break;
    await pause(attempt*1000);
   }
   const expectedRedirect=name.startsWith('tennis-note-member-app/');
   if(expectedRedirect){assert.equal(response.status,302,JSON.stringify(diagnostics));assert.equal(response.headers.get('location'),'https://tennisnote-app.pages.dev/');}
   else {assert.equal(response.status,200,JSON.stringify(diagnostics));assert.equal(sha(Buffer.from(await response.arrayBuffer())),digest,'ASSET_HASH_MISMATCH '+name);}
  }
  name.startsWith('tennis-note-member-app/')?redirected++:normal++;
 }
 return {normal,redirected,controls,diagnostics};
}
async function main(){
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
 assert.equal(sha(account||''),process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT);assert(token);
 const api=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/tennisnote-admin`;
 const getProject=async()=>{const r=await fetch(api,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200,'PROJECT_GET_HTTP_'+r.status);const p=await r.json();assert.equal(p.success,true);assert.equal(p.result.name,'tennisnote-admin');assert.equal(p.result.production_branch,'main');return p.result.canonical_deployment;};
 const before=await getProject();assert.match(before.id,/^[a-f0-9-]{36}$/);assert.equal(before.environment,'production');assert.equal(before.latest_stage.status,'success');assert.equal(before.deployment_trigger.metadata.commit_hash,'f42cfca6cf22bcdbc82bd3ff8b08711ea806a34e');
 const canonical='https://tennisnote-admin.pages.dev',immutable=`https://${before.id.slice(0,8)}.tennisnote-admin.pages.dev`;
 assert.equal(before.url,immutable);
 console.log(JSON.stringify({stage:'CANONICAL_CONFIRMED',deployment:before.id,source:before.deployment_trigger.metadata.commit_hash}));
 const seal=JSON.parse(fs.readFileSync(new URL('../admin-excel-complete/seal.json',import.meta.url)));
 const result=await verifyAssets(seal.candidate,[canonical,immutable],url=>fetch(url,{method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)}));
 assert.equal((await getProject()).id,before.id,'CANONICAL_CHANGED');
 console.log(JSON.stringify({status:'EXCEL_READBACK_RECOVERED',deployment:before.id,...result,publishCalls:0,dbWrites:0}));
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error('READ_ONLY_CHECK_FAILED '+e.message);process.exitCode=1;});

