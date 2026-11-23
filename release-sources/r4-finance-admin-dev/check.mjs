// 이전 금융·권한 검사를 반복하지 않고 새 게시 연결과 배포 범위만 검사한다.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {json,hash,prefix,walk} from './compose.mjs';
const m=json(prefix+'manifest.json');
assert.equal(m.repository,'leisurewang0827/tennis-note-public');assert.equal(m.project,'tennisnote-admin-dev');
assert.equal(m.preview,'r4-finance-owner-qa');assert.equal(m.devProject,'udjmiezroipctytmztwz');assert.equal(m.paymentEnabled,false);
for(const[p,h]of Object.entries(m.files))assert.equal(hash(readFileSync(p)),h,p);
const workflow=readFileSync('.github/workflows/r4-finance-admin-dev.yml','utf8');
assert(!workflow.includes('production'));assert(workflow.includes('environment: development'));assert(!workflow.includes('workflow_dispatch'));
assert(workflow.includes('cloudflare-pages-development'));assert(!workflow.includes('supabase'));
const text=readFileSync(prefix+'r4-finance-admin-control.js','utf8');assert(text.includes('environment !== "development"'));
assert(text.includes('tn_r4_finance_admin_state'));assert(text.includes('tn_r4_finance_admin_set'));
assert(!text.includes('service_role'));assert(!/[\u3040-\u30ff\u3400-\u9fff]/u.test(text));
for(const p of ['compose.mjs','publish.mjs','r4-finance-admin-control.js'])execFileSync(process.execPath,['--check',prefix+p]);
if(process.env.GITHUB_SHA){
 const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
 assert.equal(process.env.GITHUB_REPOSITORY,m.repository);assert.equal(process.env.GITHUB_REF,'refs/heads/'+m.branch);
 assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');assert.equal(process.env.GITHUB_EVENT_NAME,'push');
 assert.equal(git('rev-list','--parents','-n','1',process.env.GITHUB_SHA),process.env.GITHUB_SHA+' '+m.parent);
 assert.deepEqual(git('diff','--name-only',m.parent,process.env.GITHUB_SHA).split('\n').sort(),m.commitPaths);
}
if(process.argv.includes('--composed')){
 const c=json('candidate/composition.json');assert.equal(c.project,m.devProject);assert.equal(c.privateSource,m.privateSource);assert.equal(c.paymentEnabled,false);
 assert.equal(Object.keys(c.files).length,185);assert.deepEqual(walk('candidate/admin'),c.files);
}
console.log(JSON.stringify({newConnection:'PASS',oldTestsRepeated:false,productionOrDbExecution:false}));
