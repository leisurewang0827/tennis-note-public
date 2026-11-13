// Never publish, roll back, or connect to a database. Report only stage/status.
import {createHash} from 'node:crypto';
const e=process.env;
const repo='leisurewang0827/tennis-note-public';
const branch='codex/tennisnote-r4-ui-finish-dev-20261108';
const name='.github/workflows/r4-branch-finance-protected-read-diagnostic.yml';
const api='https://api.github.com/repos/'+repo;
const stop=code=>{console.error(code);process.exit(1);};
if(e.GITHUB_ACTIONS!=='true'||e.GITHUB_REPOSITORY!==repo||e.GITHUB_RUN_ATTEMPT!=='1'||
 e.GITHUB_WORKFLOW_REF!==repo+'/'+name+'@refs/heads/'+branch||!/^[1-9][0-9]*$/.test(e.GITHUB_RUN_ID||''))stop('DIAGNOSTIC_CONTEXT_DENIED');
if(!e.GH_TOKEN||!e.CLOUDFLARE_API_TOKEN||!/^[a-f0-9]{32}$/.test(e.CLOUDFLARE_ACCOUNT_ID||'')||
 createHash('sha256').update(e.CLOUDFLARE_ACCOUNT_ID).digest('hex')!==e.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT)stop('DIAGNOSTIC_TARGET_DENIED');
let oidc;
try{oidc=new URL(e.ACTIONS_ID_TOKEN_REQUEST_URL);}catch{stop('DIAGNOSTIC_OIDC_DENIED');}
if(oidc.protocol!=='https:'||oidc.username||oidc.password||oidc.port||
 !oidc.hostname.endsWith('.actions.githubusercontent.com')||!e.ACTIONS_ID_TOKEN_REQUEST_TOKEN)stop('DIAGNOSTIC_OIDC_DENIED');
oidc.searchParams.set('audience','tennisnote-r4-finance-admin-publish');
const cf='https://api.cloudflare.com/client/v4/accounts/'+e.CLOUDFLARE_ACCOUNT_ID+'/pages/projects/tennisnote-admin';
const reads=[
 ['OIDC_TOKEN',oidc,e.ACTIONS_ID_TOKEN_REQUEST_TOKEN],
 ['OIDC_JWKS','https://token.actions.githubusercontent.com/.well-known/jwks'],
 ['GITHUB_JOB',api+'/actions/runs/'+e.GITHUB_RUN_ID+'/attempts/1/jobs?per_page=100',e.GH_TOKEN],
 ['GITHUB_SOURCE',api+'/actions/runs/43391633723',e.GH_TOKEN],
 ['GITHUB_ARTIFACT',api+'/actions/artifacts/14021410409',e.GH_TOKEN],
 ['CLOUDFLARE_PROJECT',cf,e.CLOUDFLARE_API_TOKEN],
 ['CLOUDFLARE_RECOVERY',cf+'/deployments/80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',e.CLOUDFLARE_API_TOKEN],
];
const results=await Promise.all(reads.map(async ([stage,url,token])=>{
 let response;
 try{response=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
  headers:token?{Authorization:'Bearer '+token,Accept:'application/json'}:{}});}
 catch{return {stage,status:'UNREACHABLE'};}
 try{await response.body?.cancel();}catch{}
 return {stage,status:response.status};
}));
for(const result of results)console.log(JSON.stringify(result));
