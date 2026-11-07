import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {admit,validateMetadata,parent,scope,livePaths} from '../scripts/r4_store_notice_release.mjs';
const before=p=>execFileSync('git',['show',parent+':app/'+p],{encoding:'utf8'}),after=p=>readFileSync('app/'+p,'utf8');
test('새 안내는 실제 공개 Android134의 두 값만 변경하고 iOS와 강제 업데이트 기준을 보존한다',()=>{
 validateMetadata(before('release.json'),after('release.json'),before('shared/tennisnote-release.js'),after('shared/tennisnote-release.js'));
 for(const mutate of [d=>d.nativePlatforms.ios.latestBuild=136,d=>d.nativePlatforms.android.minimumBuild=134,d=>d.nativePlatforms.android.latestBuild=131,d=>d.releaseId='2026.11.08.99']){
  const data=JSON.parse(after('release.json'));mutate(data);assert.throws(()=>validateMetadata(before('release.json'),JSON.stringify(data),before('shared/tennisnote-release.js'),after('shared/tennisnote-release.js')));
 }
 assert.throws(()=>validateMetadata(before('release.json'),after('release.json'),before('shared/tennisnote-release.js'),after('shared/tennisnote-release.js').replace('iosVersion: "1.0.428"','iosVersion: "1.0.566"')));
});
test('새 안내 후보의 환경·소스·정확한 파일 범위 외에는 배포를 거부한다',()=>{
 const sha='a'.repeat(40),env={GITHUB_REPOSITORY:'leisurewang0827/tennis-note-public',GITHUB_REF:'refs/heads/codex/tennisnote-r4-admin-prod-candidate',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha,REVIEWED_SHA:sha};
 admit(env,sha+' '+parent,scope);
 for(const key of Object.keys(env))assert.throws(()=>admit({...env,[key]:'wrong'},sha+' '+parent,scope));
 assert.throws(()=>admit(env,sha+' '+'b'.repeat(40),scope));assert.throws(()=>admit(env,sha+' '+parent,[...scope,'app/shared/config.local.js']));assert.throws(()=>admit(env,sha+' '+parent,scope.slice(1)));
});
test('새 공개 정보에서103은 선택 업데이트,134는 최신으로 판정하며 최소 기준과iOS는 유지된다',()=>{
 const window={TENNIS_NOTE_RELEASE:{},Capacitor:{getPlatform:()=> 'android'}},context={window,document:{readyState:'loading',addEventListener(){}},console,URL,URLSearchParams,setTimeout,clearTimeout};
 vm.runInNewContext(after('shared/tennisnote-release-updater.js'),context);const evaluate=window.TennisNoteReleaseUpdater.evaluateNativeUpdate,manifest=JSON.parse(after('release.json'));
 assert.equal(evaluate(manifest,{platform:'android',version:'1.0.474',build:103}).status,'optional');assert.equal(evaluate(manifest,{platform:'android',version:'1.0.566',build:134}).status,'current');
 assert.deepEqual(JSON.parse(before('release.json')).nativePlatforms.ios,manifest.nativePlatforms.ios);
});
test('새 원격 검사는 안내 전용이며 기존 배포 경로와 보호 파일 전체 검사를 반복하지 않는다',()=>{
 const yaml=readFileSync('.github/workflows/deploy-cloudflare-pages.yml','utf8'),notice=yaml.slice(yaml.indexOf('\n  notice-verify:'));
 assert.match(notice,/node --test tests\/r4-store-notice-release\.test\.mjs/);assert.match(notice,/notice-prod/);assert.match(notice,/TENNISNOTE_R4_STORE_NOTICE_APPROVED_SHA/);assert.match(notice,/--project-name=tennisnote-app --branch=main/);
 assert.doesNotMatch(notice,/verify\.sh|production_projection|manual_ledger_http|project-name=tennisnote-admin|cap:|gradle|xcode/);
 assert.deepEqual(livePaths,['index.html','tennis-note-coach-app/index.html','shared/config.local.js','release.json','shared/tennisnote-release.js','service-worker.js','tennis-note-coach-app/service-worker.js']);
});
