// 게시가 아니라 완료 증거만 작성·검증한다. 자격증명·업무 API·자동 복구 없음.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const digest=b=>createHash('sha256').update(b).digest('hex');
const route=n=>'/'+(n.endsWith('index.html')?n.slice(0,-10):n.replace(/\.html$/,''));
export function validateCompletion(record,{manifest,manifestHash,source,runId,attempt}) {
  assert.match(source||'',/^[a-f0-9]{40}$/,'SOURCE_REQUIRED');
  assert.match(String(runId||''),/^[1-9][0-9]*$/,'RUN_REQUIRED');
  assert.equal(String(attempt),'1','ATTEMPT_DENIED');
  assert.equal(record?.schemaVersion,1,'RECEIPT_SCHEMA');
  assert.equal(record.status,'COACH_PRODUCTION_PASS','RECEIPT_NOT_COMPLETE');
  assert.equal(record.source,source,'RECEIPT_SOURCE');
  assert.equal(record.runId,String(runId),'RECEIPT_RUN');
  assert.equal(record.attempt,'1','RECEIPT_ATTEMPT');
  assert.equal(record.project,'tennisnote-app','RECEIPT_PROJECT');
  assert.equal(record.productSource,manifest.productSource,'RECEIPT_PRODUCT');
  assert.equal(record.manifestHash,manifestHash,'RECEIPT_MANIFEST');
  assert.match(record.deploymentId||'',/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,'RECEIPT_DEPLOYMENT');
  assert.notEqual(record.deploymentId,manifest.prior,'RECEIPT_IS_PRIOR');
  assert.deepEqual(record.finalChecks,{canonical:true,approval:true},'FINAL_CHECKS_REQUIRED');
  const p=record.readiness;
  assert.equal(p?.status,'READINESS_PASS','READINESS_REQUIRED');
  assert.equal(p.phase,'publication','PUBLICATION_REQUIRED');
  assert.equal(p.source,source,'READINESS_SOURCE');
  assert.equal(p.deploymentId,record.deploymentId,'READINESS_DEPLOYMENT');
  assert.equal(p.writeRequests,0,'READINESS_WRITE_DENIED');
  const assets={...manifest.baseline,...manifest.changed};
  const names=Object.keys(assets).filter(n=>!['_headers','_redirects','_worker.js'].includes(n));
  assert.equal(names.length,250,'ASSET_COUNT');
  const hosts=['https://'+record.deploymentId.slice(0,8)+'.tennisnote-app.pages.dev','https://tennisnote-app.pages.dev'];
  const expected=new Map();for(const name of names)for(const host of hosts)expected.set(host+route(name),{sha:assets[name],previous:manifest.baseline[name]});
  assert.equal(expected.size,500,'DUPLICATE_PATH');
  assert(Array.isArray(p.proof),'PROOF_REQUIRED');
  const last=new Map();
  for(const x of p.proof){const key=x.host+x.path,match=expected.get(key);assert(match,'PROOF_UNKNOWN_PATH');assert.equal(x.phase,'publication');assert.equal(x.expectedSha256,match.sha,'PROOF_EXPECTED');
    if(x.classification==='target'){assert.equal(x.status,200);assert.equal(x.sha256,match.sha,'PROOF_HASH')}
    else if(x.classification==='pending-404'){assert.equal(x.status,404)}
    else if(x.classification==='pending-known-previous'){assert.equal(x.status,200);assert.notEqual(match.previous,match.sha);assert.equal(x.sha256,match.previous);assert.equal(x.previousSha256,match.previous)}
    else assert.fail('PROOF_REJECTED');
    last.set(key,x);
  }
  assert.equal(last.size,500,'PROOF_INCOMPLETE');
  for(const x of last.values())assert.equal(x.classification,'target','PROOF_PENDING');
  assert.equal(record.verifiedResponses,500,'RESPONSE_COUNT');
  assert.equal(record.mismatches,0,'MISMATCHES');
  return record;
}
export function writeCompletion(file,record,expected){validateCompletion(record,expected);assert(!existsSync(file),'RECEIPT_EXISTS');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(record)+'\n',{flag:'wx'});validateCompletion(JSON.parse(readFileSync(file,'utf8')),expected)}
// Promise만 남아도 완료를 기다리며, 전체 한도 초과는 성공이 아닌 오류로 끝낸다.
export async function withCompletionDeadline(work,{timeoutMs=840000}={}){
  assert(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=840000);
  let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('COMPLETION_DEADLINE')),timeoutMs)})])}finally{clearTimeout(timer)}
}
export function expectedFromRuntime(manifest,manifestHash,env=process.env){assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_REPOSITORY,manifest.repo);assert.equal(env.GITHUB_REF,'refs/heads/'+manifest.branch);assert.equal(env.GITHUB_EVENT_NAME,'push');return {manifest,manifestHash,source:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT}}
export function completionPath(env=process.env){assert(env.RUNNER_TEMP,'RUNNER_TEMP_REQUIRED');return join(env.RUNNER_TEMP,'coach-absence-v8-completion','result.json')}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{assert.equal(process.argv[2],'verify','VERIFY_ONLY');const bytes=readFileSync(new URL('./manifest.json',import.meta.url)),manifest=JSON.parse(bytes),file=completionPath();const record=validateCompletion(JSON.parse(readFileSync(file,'utf8')),expectedFromRuntime(manifest,digest(bytes)));console.log(JSON.stringify({status:'COMPLETION_EVIDENCE_VERIFIED',source:record.source,runId:record.runId,deploymentId:record.deploymentId,verifiedResponses:record.verifiedResponses,mismatches:0}))}
  catch{console.error('COMPLETION_EVIDENCE_MISSING_OR_INVALID');process.exitCode=1}
}
