// New V8 source binding only; do not replay the prior absence or deduction suites.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url)),m=JSON.parse(readFileSync(join(here,'manifest.json'))),hash=b=>createHash('sha256').update(b).digest('hex');
const local=process.argv.includes('--local'),repo=local?'C:/Codex/tennis-note-public-release-20260815':process.cwd(),git=(...args)=>execFileSync('git',args,{cwd:repo,maxBuffer:4000000}),root=local?resolve(here,'../..'):repo;
const paths=[...Object.keys(m.changed),'.github/workflows/absence-ui-native-source.yml','release-promotions/absence-ui-native-v8/check.mjs','release-promotions/absence-ui-native-v8/manifest.json'].sort();
assert.equal(m.repo,'leisurewang0827/tennis-note-public');assert.equal(m.branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(m.kind,'ABSENCE_UI_NATIVE_V8');assert.equal(m.baseParent,'d4a025560b434e069639d281df421178674a3ac8');assert.equal(m.parent,'30dabe299cfbbc70be94d32560aee78564720bfb');assert.equal(paths.length,8);assert.equal(m.dbWrites,0);assert.equal(m.conditionsChanged,0);assert.equal(m.actualDeduction,0);assert.equal(m.publicRelease,false);

// A Git text filter can mark these prior frozen CRLF artifacts dirty even on a pristine checkout.
// Accept that report only if their RAW bytes equal the immutable HEAD blob. Never normalize here.
const legacyFilterPaths=['release-promotions/admin-absence-v6/assets/index.html','release-promotions/admin-absence-v6/assets/styles.css','release-sources/absence-simple-preview/assets/admin/index.html'];
export function verifyCheckoutBytes(names,{read=p=>readFileSync(join(repo,p)),blob=p=>git('show','HEAD:'+p)}={}){
 for(const p of names){assert(legacyFilterPaths.includes(p),'Unexpected checkout modification');assert.deepEqual(read(p),blob(p),'Raw checkout differs from immutable commit');}
 return true;
}

if(!local){const e=process.env;assert.equal(e.GITHUB_ACTIONS,'true');assert.equal(e.GITHUB_REPOSITORY,m.repo);assert.equal(e.GITHUB_REF,'refs/heads/'+m.branch);assert.equal(e.GITHUB_EVENT_NAME,'push');assert.equal(e.GITHUB_RUN_ATTEMPT,'1');assert.equal(e.GITHUB_WORKFLOW_REF,m.repo+'/.github/workflows/absence-ui-native-source.yml@refs/heads/'+m.branch);assert.equal(git('rev-parse','HEAD').toString().trim(),e.GITHUB_SHA);assert.equal(git('rev-list','--parents','-n','1','HEAD').toString().trim(),e.GITHUB_SHA+' '+m.parent);assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',m.parent,'HEAD').toString().trim().split('\n').sort(),m.executionDelta.slice().sort());assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r',m.baseParent,'HEAD').toString().trim().split('\n').sort(),paths);assert.equal(git('diff','--cached','--name-only').toString().trim(),'');verifyCheckoutBytes(git('diff','--name-only').toString().trim().split('\n').filter(Boolean));}
const content=p=>local?git('show',m.parent+':'+p):readFileSync(join(root,p));
for(const[p,h]of Object.entries(m.changed))assert.equal(hash(content(p)),h,p+' seal');
const names=git('ls-tree','-r','--name-only',m.parent,'--','app/release.json','app/tennis-note-member-app','app/tennis-note-coach-app','app/shared','app/tennis-note-legal').toString().trim().split('\n').filter(p=>p!=='app/shared/config.local.js').sort();assert.equal(names.length,m.sourceCount);
const normalizedBytes=b=>Buffer.from(b.toString('binary').replace(/\r\n/g,'\n'),'binary');
assert.deepEqual(normalizedBytes(Buffer.from([255,0,13,10,233])),Buffer.from([255,0,10,233]),'Binary source bytes must not be UTF-8 decoded');
const fp=createHash('sha256');for(const p of names){const b=normalizedBytes(content(p));fp.update(p.slice(4)+'\0');fp.update(createHash('sha256').update(b).digest());fp.update('\n');}assert.equal(fp.digest('hex'),m.sourceContentSha256);assert.equal(hash(content('app/release.json')),m.releaseSha256);
const screens=content('app/tennis-note-coach-app/ui/screens.js').toString(),events=content('app/tennis-note-coach-app/events/delegated.js').toString();assert(screens.includes('수업 시작 전입니다.'));assert(screens.includes('다시 참석으로 변경'));assert(events.includes('.tn-empty-state button[data-view="fullScheduleView"]'));assert(events.includes('!emptyScheduleButton.disabled && !emptyScheduleButton.classList.contains("tab")'));
for(const n of ['index.html','service-worker.js']){const text=content('app/tennis-note-coach-app/'+n).toString();for(const asset of ['styles.css','ui/screens.js','events/delegated.js'])assert.equal(text.split(asset+'?v=v8-'+m.changed['app/tennis-note-coach-app/'+asset].slice(0,16)).length,2);}
const result={status:local?'LOCAL_V8_SOURCE_BINDING_PASS':'V8_SOURCE_CI_PASS',source:local?null:process.env.GITHUB_SHA,parent:m.parent,changedProducts:5,sourceCount:m.sourceCount,sourceContentSha256:m.sourceContentSha256,releaseSha256:m.releaseSha256,runId:local?null:process.env.GITHUB_RUN_ID,dbWrites:0,publication:false};if(!local)writeFileSync(join(process.env.RUNNER_TEMP,'absence-v8-source.json'),JSON.stringify(result)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
