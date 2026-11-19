// 검사 전용: 실제 완료 검증 CLI의 누락 거부를 확인한다. 게시 실행기는 호출하지 않는다.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {completionPath} from './completion.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),here=dirname(fileURLToPath(import.meta.url));
export function inspectWiring({production,inspection,runner,manifest,helperBytes,testBytes}){
  assert.match(production,/  verify-source:\r?\n    name: verify-source\r?\n    if: \$\{\{ false \}\}/,'SOURCE_JOB_NOT_DISABLED');
  assert.match(production,/  publish:\r?\n    if: \$\{\{ false \}\}/,'PUBLISH_JOB_NOT_DISABLED');
  assert.equal(manifest.inspectionOnly,true,'INSPECTION_FLAG_REQUIRED');
  const main=runner.slice(runner.indexOf('async function main()'),runner.indexOf('export function failureRecord'));
  assert(main.indexOf("assert.notEqual(m.inspectionOnly,true,'INSPECTION_ONLY_NO_RUNTIME_EXECUTION')")>=0);
  assert(main.indexOf('assert.notEqual')<main.indexOf("process.argv[2]==='build'"),'RUNTIME_NOT_BLOCKED_FIRST');
  assert.equal(sha(helperBytes),manifest.completionHash);
  assert.equal(sha(helperBytes),'0d6f51aaf12baeecec8b83007d312caeebfc929d6647b085d6bc86e30a649771','PRIOR_HELPER_DRIFT');
  assert.equal(sha(testBytes),'e6f310eb35105ca767a584bd75b2f14294e137232a6902fb58f11ffbd5182627','PRIOR_TEST_DRIFT');
  assert(!/(environment:|secrets\.|GH_TOKEN|CLOUDFLARE_|continue-on-error)/.test(inspection),'INSPECTION_PRIVILEGE_DENIED');
  assert.deepEqual(inspection.split(/\r?\n/).filter(l=>/^\s+run:/.test(l)).map(l=>l.trim()),['run: node release-sources/coach-absence-v7-prod/completion-ci.mjs']);
  assert(inspection.includes('permissions: {contents: read}'));
  assert(inspection.includes("paths: ['.github/workflows/coach-completion-guard-ci.yml']"));
  assert(inspection.includes('if-no-files-found: error'));
  assert(production.includes('if: always()\n        run: node release-sources/coach-absence-v7-prod/completion.mjs verify'));
  assert(production.includes('if-no-files-found: error'));
  return {status:'INSPECTION_WIRING_PASS',publicJobsDisabled:true,previous37TestsRerun:0};
}
function main(){
  const e=process.env;assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,'leisurewang0827/tennis-note-public');assert.equal(e.GITHUB_REF,'refs/heads/codex/tennisnote-r4-admin-prod-candidate');assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');assert.equal(e.GITHUB_WORKFLOW_REF,e.GITHUB_REPOSITORY+'/.github/workflows/coach-completion-guard-ci.yml@'+e.GITHUB_REF);
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),e.GITHUB_SHA);
  const repository=resolve(here,'../..'),manifest=JSON.parse(readFileSync(join(here,'manifest.json')));
  const wiring=inspectWiring({production:readFileSync(join(repository,'.github/workflows/coach-absence-v7-prod.yml'),'utf8'),inspection:readFileSync(join(repository,'.github/workflows/coach-completion-guard-ci.yml'),'utf8'),runner:readFileSync(join(here,'runner.mjs'),'utf8'),manifest,helperBytes:readFileSync(join(here,'completion.mjs')),testBytes:readFileSync(join(here,'completion.test.mjs'))});
  const isolated=mkdtempSync(join(e.RUNNER_TEMP,'coach-completion-missing-')),childEnv={PATH:e.PATH,RUNNER_TEMP:isolated,GITHUB_ACTIONS:e.GITHUB_ACTIONS,GITHUB_REPOSITORY:e.GITHUB_REPOSITORY,GITHUB_REF:e.GITHUB_REF,GITHUB_EVENT_NAME:e.GITHUB_EVENT_NAME,GITHUB_SHA:e.GITHUB_SHA,GITHUB_RUN_ID:e.GITHUB_RUN_ID,GITHUB_RUN_ATTEMPT:e.GITHUB_RUN_ATTEMPT};
  assert(!existsSync(completionPath(childEnv)));
  const child=spawnSync(process.execPath,[join(here,'completion.mjs'),'verify'],{env:childEnv,encoding:'utf8',timeout:10000});
  assert.equal(child.error,undefined,'CHECKER_START_FAILED');assert.equal(child.signal,null,'CHECKER_SIGNALLED');assert.equal(child.status,1,'MISSING_EVIDENCE_WAS_NOT_REJECTED');assert.equal(child.stderr.trim(),'COMPLETION_EVIDENCE_MISSING_OR_INVALID');assert.equal(child.stdout,'');assert(!existsSync(completionPath(childEnv)));
  const result={status:'MISSING_COMPLETION_REJECTED',source:e.GITHUB_SHA,runId:e.GITHUB_RUN_ID,attempt:e.GITHUB_RUN_ATTEMPT,workflow:e.GITHUB_WORKFLOW_REF,actualCheckerExit:child.status,checkerMessage:child.stderr.trim(),completionFileExists:false,wiring,syntheticNegativeControl:true,productionCompletionClaim:false,publishRequests:0,dbWrites:0,priorTestsRerun:0};
  const out=join(e.RUNNER_TEMP,'coach-completion-ci');mkdirSync(out,{recursive:true});writeFileSync(join(out,'inspection.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error('INSPECTION_FAILED',e.message);process.exitCode=1}}
