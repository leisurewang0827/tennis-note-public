// Local proposed protected-job bridge. Reviewer attests the OFF receipt and QA;
// the bridge does not itself query a database. Nothing runs until invoked in a
// real GitHub protected job with a valid signed OIDC identity and approval.
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const repo='leisurewang0827/tennis-note-public',repoId=1299952631;
const branch='codex/tennisnote-r4-ui-finish-dev-20261108',env='tennisnote-r4-admin-production',envId=26219323796;
const workflow='.github/workflows/r4-first-issue-admin-promotion.yml';
const source='30bdd59100426cc6cee740c9b52b84c1e6c10c5d',sourceRun=43033784106,artifact=13861437991;
const artifactDigest='26ff7deb94d407f83da4c40856bab75ac1756fd7d412f8c99f85de1357664f1e';
const corrected='e63110be73bddee0bf1cb91f58b4cda753f1b8aa4891d755c637001eab5f7b23';
const seal='7db1d490e7422665c7bfeeb20451ed134b31e13f6979bcf865899985a174346e';
const recovery='80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4';
const project='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const correctionPath='release-sources/r4-first-issue-correction/prod-install-corrected.sql';
export const EXACT_CORRECTION_PATHS=Object.freeze([
 '.github/workflows/r4-first-issue-admin-promotion.yml',
 '.github/workflows/r4-first-issue-correction.yml',
 ...['prod-install-corrected.sql','verify-first-issue-correction.mjs','first-issue-db-actions.mjs','check-first-issue-db-actions.mjs','check-scoped-emergency-off.mjs','check-scoped-off-pg.mjs','check-db-write-journal.mjs'].map(x=>'release-sources/r4-first-issue-correction/'+x),
 ...['trusted-review-bridge.mjs','admin-single-write-transport.mjs','first-issue-admin-promotion.mjs','check-trusted-review-bridge.mjs','check-admin-single-write-transport.mjs','check-correction-file-binding.mjs'].map(x=>'release-promotions/r4-first-issue-admin/'+x)
]);
const fields=['action','approvalJobId','approvalRunId','artifactDigest','artifactId','candidateCommit','candidateFilesDigest','candidateTree','correctedSqlSha256','correctionRunId','deploymentId','envId','expiresAt','issuedAt','mismatchAsset','offAcknowledged','offAction','offActiveScopeCount','offControlOff','offObservedAt','offOptionsSha','offReceiptDigest','offWriteAttempts','publishedId','qaMessageDigest','recoveryId','scopeDigest','sealSha256','sourceCommit','sourceRunId','targetFingerprint'];
const hex=(x,n)=>typeof x==='string'&&new RegExp('^[0-9a-f]{'+n+'}$').test(x);
const canonical=x=>JSON.stringify(Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])));
const minted=new WeakSet();
export function validateCandidateFiles(compare,digest){
 if(compare?.status!=='ahead'||compare.total_commits!==1||!Array.isArray(compare.files)||compare.files.length!==EXACT_CORRECTION_PATHS.length||compare.files.some(f=>f.status!=='added'||!EXACT_CORRECTION_PATHS.includes(f.filename)||!hex(f.sha,40)))fail('CANDIDATE_FILES_MISMATCH');
 const files=compare.files.map(f=>[f.filename,f.sha]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 if(new Set(files.map(f=>f[0])).size!==files.length||sha(JSON.stringify(files))!==digest)fail('CANDIDATE_FILES_MISMATCH');
 return true;
}
export function parseReviewerComment(comment,now,action='admin_publish'){
 const lines=typeof comment==='string'?comment.split('\n'):[];if(lines.length!==3||lines[0]!=='R4-ADMIN-PROMOTION-V1')fail('COMMENT_FORMAT');
 let r;try{r=JSON.parse(lines[1]);}catch{fail('COMMENT_FORMAT');}
 if(!r||Array.isArray(r)||Object.keys(r).sort().join('|')!==fields.join('|')||canonical(r)!==lines[1]||lines[2]!=='sha256:'+sha(lines[1]))fail('COMMENT_DIGEST');
 if(r.action!==action||!['admin_publish','admin_rollback'].includes(action)||r.sourceCommit!==source||r.sourceRunId!==sourceRun||r.artifactId!==artifact||r.artifactDigest!==artifactDigest||r.correctedSqlSha256!==corrected||r.sealSha256!==seal||r.recoveryId!==recovery||r.envId!==envId||r.targetFingerprint!==project)fail('COMMENT_SCOPE');
 if(!hex(r.candidateCommit,40)||!hex(r.candidateTree,40)||![r.candidateFilesDigest,r.offReceiptDigest,r.qaMessageDigest,r.scopeDigest].every(x=>hex(x,64))||!['approvalRunId','approvalJobId','correctionRunId','deploymentId'].every(k=>Number.isSafeInteger(r[k])&&r[k]>0))fail('COMMENT_SCOPE');
 const installing=action==='admin_publish';
 if(r.offAction!==(installing?'install':'readback')||r.offAcknowledged!==installing||r.offWriteAttempts!==(installing?1:0)||r.offControlOff!==true||r.offActiveScopeCount!==0||r.offOptionsSha!=='15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286')fail('OFF_RECEIPT_INVALID');
 if(action==='admin_publish'&&(r.publishedId!=='not-yet-published'||r.mismatchAsset!=='none'))fail('COMMENT_SCOPE');
 if(action==='admin_rollback'&&(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.publishedId||'')||r.publishedId===recovery||r.mismatchAsset!=='index.html'))fail('COMMENT_SCOPE');
 const off={candidate:r.candidateCommit,source,sqlSha:installing?corrected:'6a4afce725c7b1c1fe09692f046fe3ffe83133e54c730b780ee17bc2bebaf6a8',projectSha:project,action:r.offAction,acknowledged:r.offAcknowledged,writeAttempts:r.offWriteAttempts,observedAt:r.offObservedAt,controlOff:r.offControlOff,activeScopeCount:r.offActiveScopeCount,optionsSha:r.offOptionsSha};
 if(sha(canonical(off))!==r.offReceiptDigest)fail('OFF_RECEIPT_DIGEST');
 if(![r.offObservedAt,r.issuedAt,r.expiresAt,now].every(Number.isSafeInteger)||r.offObservedAt>now||now-r.offObservedAt>120000||r.issuedAt<r.offObservedAt||r.issuedAt>now+30000||r.expiresAt<=now||r.expiresAt-r.issuedAt>300000||r.expiresAt<=r.issuedAt)fail('EVIDENCE_STALE');
 return Object.freeze(r);
}
export function validateOidcClaims(c,{runId,commit,now}){
 const at=Math.floor(now/1000);
 if(c?.iss!=='https://token.actions.githubusercontent.com'||c.aud!=='tennisnote-r4-admin-promotion'||c.sub!=='repo:'+repo+':environment:'+env||String(c.repository_id)!==String(repoId)||c.repository!==repo||c.ref!=='refs/heads/'+branch||c.sha!==commit||String(c.run_id)!==String(runId)||String(c.run_attempt)!=='1'||c.event_name!=='push'||c.environment!==env||c.workflow_ref!==repo+'/'+workflow+'@refs/heads/'+branch||!Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)||c.iat>at+30||c.exp<=at||c.exp<=c.iat||c.exp-c.iat>600)fail('OIDC_MISMATCH');
 return true;
}
async function get(url,token){
 const u=new URL(url);if(u.protocol!=='https:'||!['api.github.com','api.cloudflare.com','token.actions.githubusercontent.com'].includes(u.hostname))fail('HOST_DENIED');
 const r=await fetch(u,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:token?{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}:{}});
 if(r.status!==200)fail('READ_FAILED');const s=await r.text();if(s.length>2e6)fail('READ_TOO_LARGE');try{return JSON.parse(s);}catch{fail('READ_INVALID');}
}
async function getPublicBytes(url){
 const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname==='tennisnote-admin.pages.dev'||/^[a-f0-9]{8}\.tennisnote-admin\.pages\.dev$/.test(u.hostname)))fail('PUBLIC_HOST_DENIED');
 const r=await fetch(u,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});if(r.status!==200)fail('PUBLIC_READ_FAILED');
 const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>2000000)fail('READ_TOO_LARGE');return bytes;
}
export function verifyOidcJwt(value,jwks,context){
 const parts=typeof value==='string'?value.split('.'):[];if(parts.length!==3)fail('OIDC_INVALID');
 let head,claims;try{head=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{fail('OIDC_INVALID');}
 if(head.alg!=='RS256'||typeof head.kid!=='string')fail('OIDC_INVALID');
 const key=jwks.keys?.find(k=>k.kid===head.kid&&k.kty==='RSA'&&k.use==='sig');if(!key)fail('OIDC_KEY');
 if(!verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url')))fail('OIDC_SIGNATURE');
 validateOidcClaims(claims,context);return true;
}
async function signedOidc(runId,commit,now){
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
 if(url.protocol!=='https:'||!url.hostname.endsWith('.actions.githubusercontent.com'))fail('OIDC_REQUEST_HOST');
 url.searchParams.set('audience','tennisnote-r4-admin-promotion');
 const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});
 if(response.status!==200)fail('OIDC_REQUEST_FAILED');const {value}=await response.json();
 const jwks=await get('https://token.actions.githubusercontent.com/.well-known/jwks');verifyOidcJwt(value,jwks,{runId,commit,now});
 return JSON.parse(Buffer.from(value.split('.')[1],'base64url')).exp;
}
export async function verifyOfficialReview(action='admin_publish'){
 const now=Date.now(),runId=Number(process.env.GITHUB_RUN_ID),commit=process.env.GITHUB_SHA,token=process.env.GITHUB_TOKEN;
 if(process.env.GITHUB_ACTIONS!=='true'||!Number.isSafeInteger(runId)||!hex(commit,40)||!token||!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN)fail('PROTECTED_JOB_REQUIRED');
 const oidcExp=await signedOidc(runId,commit,now);
 const base='https://api.github.com/repos/'+repo,g=p=>get(base+p,token);
 const [repository,environment,run,approvals,jobs,src,a,ref]=await Promise.all([
  g(''),g('/environments/'+env),g('/actions/runs/'+runId),g('/actions/runs/'+runId+'/approvals'),g('/actions/runs/'+runId+'/jobs?per_page=100'),
  g('/actions/runs/'+sourceRun),g('/actions/artifacts/'+artifact),g('/git/ref/heads/'+branch)]);
 if(repository.id!==repoId||environment.id!==envId||run.id!==runId||run.head_sha!==commit||run.head_branch!==branch||run.event!=='push'||run.run_attempt!==1||run.status!=='in_progress'||run.path!==workflow||ref.object?.sha!==commit)fail('RUN_MISMATCH');
 const reviewers=environment.protection_rules?.find(x=>x.type==='required_reviewers')?.reviewers?.filter(x=>x.type==='User').map(x=>x.reviewer?.id)||[];
 if(reviewers.length!==1)fail('REVIEWER_SCOPE_NOT_UNIQUE');
 const approvalsForEnv=matchingActionReviews(approvals,action);
 if(approvalsForEnv.length!==1||approvalsForEnv[0].state!=='approved'||!reviewers.includes(approvalsForEnv[0].user?.id))fail('REVIEWER_NOT_VERIFIED');
 const receipt=parseReviewerComment(approvalsForEnv[0].comment,Date.now(),action);
 if(receipt.approvalRunId!==runId||receipt.candidateCommit!==commit)fail('REVIEW_SCOPE_MISMATCH');
 if(src.id!==sourceRun||src.head_sha!==source||src.head_repository?.id!==repoId||src.status!=='completed'||src.conclusion!=='success'||src.run_attempt!==1||src.path!=='.github/workflows/r4-first-issue-binding-source.yml'||a.id!==artifact||a.workflow_run?.id!==sourceRun||a.digest!=='sha256:'+artifactDigest||a.expired!==false||!(Date.parse(a.expires_at)>Date.now()))fail('SOURCE_NOT_VERIFIED');
 const jobName=action==='admin_rollback'?'protected-rollback':'protected-promote';
 const active=(jobs.jobs||[]).filter(j=>j.id===receipt.approvalJobId&&j.name===jobName&&j.status==='in_progress'&&j.run_id===runId&&j.head_sha===commit);if(active.length!==1)fail('JOB_NOT_VERIFIED');
 const [gitCommit,content,correctionRun,correctionJobs,deployment,statuses,compare]=await Promise.all([
  g('/git/commits/'+commit),g('/contents/'+correctionPath+'?ref='+commit),g('/actions/runs/'+receipt.correctionRunId),
  g('/actions/runs/'+receipt.correctionRunId+'/jobs?per_page=100'),g('/deployments/'+receipt.deploymentId),g('/deployments/'+receipt.deploymentId+'/statuses?per_page=100'),g('/compare/'+source+'...'+commit+'?per_page=100')]);
 if(gitCommit.tree?.sha!==receipt.candidateTree||gitCommit.parents?.length!==1||gitCommit.parents[0].sha!==source||content.encoding!=='base64'||sha(Buffer.from(content.content.replace(/\s/g,''),'base64'))!==corrected)fail('CANDIDATE_MISMATCH');
 validateCandidateFiles(compare,receipt.candidateFilesDigest);
 if(correctionRun.id!==receipt.correctionRunId||correctionRun.head_sha!==commit||correctionRun.head_branch!==branch||correctionRun.head_repository?.id!==repoId||correctionRun.path!=='.github/workflows/r4-first-issue-correction.yml'||correctionRun.event!=='push'||correctionRun.run_attempt!==1||correctionRun.status!=='completed'||correctionRun.conclusion!=='success'||(correctionJobs.jobs||[]).filter(j=>j.name==='correction-only'&&j.status==='completed'&&j.conclusion==='success'&&j.head_sha===commit).length!==1)fail('CORRECTION_CI_NOT_VERIFIED');
 const latest=Array.isArray(statuses)&&[...statuses].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id)[0];
 if(deployment.id!==receipt.deploymentId||deployment.sha!==commit||deployment.environment!==env||latest?.state!=='in_progress'||latest.log_url!==`https://github.com/${repo}/actions/runs/${runId}/job/${receipt.approvalJobId}`||!Number.isFinite(Date.parse(latest.created_at))||Date.now()-Date.parse(latest.created_at)>300000||Date.parse(latest.created_at)>Date.now()+30000)fail('DEPLOYMENT_NOT_VERIFIED');
 // Required reviewer vouches for the OFF and QA digests in the official comment.
 // Actual DB observation and Codex message inspection remain separate human steps.
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,cfToken=process.env.CLOUDFLARE_API_TOKEN,cfFingerprint=process.env.EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT;
 if(!/^[a-f0-9]{32}$/.test(account||'')||!hex(cfFingerprint,64)||sha(account)!==cfFingerprint||!cfToken)fail('CLOUDFLARE_TARGET_MISMATCH');
 const cf='https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/tennisnote-admin';
 const [current,old]=await Promise.all([get(cf,cfToken),get(cf+'/deployments/'+recovery,cfToken)]);
 const currentId=action==='admin_publish'?recovery:receipt.publishedId;
 if(current.success!==true||current.result?.name!=='tennisnote-admin'||current.result?.production_branch!=='main'||current.result?.canonical_deployment?.id!==currentId||old.success!==true||old.result?.id!==recovery||old.result?.environment!=='production'||old.result?.latest_stage?.status!=='success'||old.result?.deployment_trigger?.metadata?.branch!=='main'||old.result?.deployment_trigger?.metadata?.commit_hash!=='81046af5ff14184585533f1a72b22f29a0298050')fail('CLOUDFLARE_PREIMAGE_DRIFT');
 if(action==='admin_rollback'&&current.result.canonical_deployment?.deployment_trigger?.metadata?.commit_hash!==source)fail('CLOUDFLARE_PREIMAGE_DRIFT');
 const recoveryIndex='66fb7b87c4a9984e85b462968b1682329a177bf41062656737885f659f7d1ef0';
 if(sha(await getPublicBytes('https://80f7c05f.tennisnote-admin.pages.dev/'))!==recoveryIndex)fail('RECOVERY_BYTES_MISMATCH');
 if(action==='admin_publish'&&sha(await getPublicBytes('https://tennisnote-admin.pages.dev/'))!==recoveryIndex)fail('CANONICAL_BYTES_MISMATCH');
 if(action==='admin_rollback'){
  const sealContent=await g('/contents/release-sources/r4-first-issue-candidate/admin-overlay-seal-v4.json?ref='+source);
  const raw=Buffer.from((sealContent.content||'').replace(/\s/g,''),'base64');if(sha(raw)!==seal)fail('SEAL_MISMATCH');
  const expected=JSON.parse(raw).assets?.['index.html'];if(!hex(expected,64)||sha(await getPublicBytes(`https://${receipt.publishedId.slice(0,8)}.tennisnote-admin.pages.dev/`))===expected)fail('MISMATCH_NOT_PROVEN');
 }
 // Recheck approval, branch and freshness immediately before minting.
 const [again,againRef,againStatuses,againCurrent,againEnv]=await Promise.all([g('/actions/runs/'+runId+'/approvals'),g('/git/ref/heads/'+branch),g('/deployments/'+receipt.deploymentId+'/statuses?per_page=100'),get(cf,cfToken),g('/environments/'+env)]);
 const last=Array.isArray(againStatuses)&&[...againStatuses].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id)[0];
 const finalReviewers=againEnv.protection_rules?.find(x=>x.type==='required_reviewers')?.reviewers?.filter(x=>x.type==='User').map(x=>x.reviewer?.id)||[];
 const finalApproval=matchingActionReviews(again,action);
 if(againEnv.id!==envId||finalReviewers.length!==1||finalReviewers[0]!==reviewers[0]||Date.now()>=oidcExp*1000||againRef.object?.sha!==commit||last?.id!==latest.id||last.state!=='in_progress'||againCurrent.success!==true||againCurrent.result?.canonical_deployment?.id!==currentId||finalApproval.length!==1||finalApproval[0].state!=='approved'||finalApproval[0].user?.id!==approvalsForEnv[0].user.id||finalApproval[0].comment!==approvalsForEnv[0].comment)fail('FINAL_STATE_DRIFT');
 parseReviewerComment(approvalsForEnv[0].comment,Date.now(),action);
 const capability=Object.freeze({accountFingerprint:cfFingerprint,scopeDigest:receipt.scopeDigest,expiresAt:receipt.expiresAt,offObservedAt:receipt.offObservedAt,action,publishedId:receipt.publishedId});minted.add(capability);return capability;
}
export function matchingActionReviews(rows,action){
 if(!Array.isArray(rows)||!['admin_publish','admin_rollback'].includes(action))return [];
 return rows.filter(x=>{
  if(!x?.environments?.some(y=>y.id===envId&&y.name===env)||typeof x.comment!=='string')return false;
  const lines=x.comment.split('\n');if(lines.length!==3||lines[0]!=='R4-ADMIN-PROMOTION-V1')return false;
  try{return JSON.parse(lines[1])?.action===action;}catch{return false;}
 });
}
export function assertOfficialCapability(c,action){if(!c||!minted.has(c)||Date.now()>=c.expiresAt||Date.now()<c.offObservedAt||Date.now()-c.offObservedAt>120000||c.action!==action)fail('OFFICIAL_CAPABILITY_REQUIRED');return true;}
