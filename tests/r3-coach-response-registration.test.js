// 실제 현재 체크아웃만 사용한다. 로컬 조립기나 옛 Git object가 필요 없다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/r3-coach-response-source.json'),'utf8'));
const page=path.join(root,'app/tennis-note-coach-app');
const read=p=>fs.readFileSync(path.join(page,p),'utf8').replace(/\r\n/g,'\n');
const sha=s=>createHash('sha256').update(s).digest('hex');
function extract(source,name){
 let start=source.indexOf(`function ${name}(`);
 assert.ok(start>=0,`${name} 누락`);
 assert.equal(source.indexOf(`function ${name}(`,start+1),-1,`${name} 중복`);
 if(source.slice(start-6,start)==='async ')start-=6;
 const end=source.indexOf('\n}\n',start);assert.ok(end>start);
 return source.slice(start,end+3);
}
function entryGraph(){
 const html=read('index.html'), scripts=[];
 for(const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)){
  const url=match[1].split('?')[0];
  if(/^(?:https?:)?\/\//.test(url))continue;
  const resolved=path.resolve(page,url);
  assert.ok(resolved.startsWith(root+path.sep));
  if(!fs.existsSync(resolved)){
   assert.ok(/(?:config\.local\.js)$/.test(resolved),'필수 script 누락');continue;
  }
  scripts.push({path:path.relative(page,resolved).replaceAll('\\','/'),body:fs.readFileSync(resolved,'utf8')});
 }
 // 실제 HTML의 조건부 앱 로더가 두 갈래여도 app.js는 전역 공간에 한 번만 로드.
 assert.ok(/appScript\.src\s*=\s*["']\.\/app\.js/.test(html));
 if(!scripts.some(x=>x.path==='app.js'))scripts.push({path:'app.js',body:read('app.js')});
 return scripts;
}
test('응답 함수가 실제 entry graph의 같은 전역 공간에 정확히 한 번 연결됨',()=>{
 const scripts=entryGraph(),paths=scripts.map(x=>x.path);
 for(const required of ['domain/settlement.js','data/sync.js','views/settlement.js','events/account.js'])assert.equal(paths.filter(p=>p===required).length,1);
 assert.ok(paths.indexOf('domain/settlement.js')<paths.indexOf('data/sync.js'));
 const joined=scripts.map(x=>x.body).join('\n;\n');
 new vm.Script(joined); // 기존 entry와 모든 모듈의 lexical 충돌을 엄격히 검사.
 for(const [name,pin] of Object.entries(fixture.functions)){
  const actual=extract(read(pin.file),name);assert.equal(sha(actual),pin.sha256);
  assert.equal(scripts.filter(x=>x.body.includes(`function ${name}(`)).length,1);
 }
});
test('현재 actual 모듈에서 추출한 전역 함수가 VM에서 호출됨, 저장/통신 0',async()=>{
 const calls={rpc:0,submit:0,prevent:0};const listeners={};
 const form={addEventListener:(kind,fn)=>{assert.equal(kind,'submit');assert.equal(listeners.submit,undefined);listeners.submit=fn;}};
 const context=vm.createContext({coachSettlementHistory:{coachSettlementReconciliationSubmitting:true},
  renderCoachSettlementHistory(){},$:()=>form,window:{requestAnimationFrame(){}},
  fetch(){calls.rpc++;throw Error('통신 금지');}});
 const names=Object.keys(fixture.functions);
 const code=names.map(name=>extract(read(fixture.functions[name].file),name)).join('\n');
 new vm.Script(code).runInContext(context);
 assert.equal(await vm.runInContext('submitCoachSettlementReconciliation()',context),false);
 // 실제 event 모듈의 정확한 submit 연결문을 실행한다. 새 테스트용 연결을 발명하지 않는다.
 assert.ok(read('events/account.js').includes(fixture.submitBinding));
 context.submitCoachSettlementReconciliation=()=>{calls.submit++;return false;};
 new vm.Script(fixture.submitBinding).runInContext(context);
 listeners.submit({preventDefault(){calls.prevent++;}});
 assert.deepEqual(calls,{rpc:0,submit:1,prevent:1});
});
test('기존 form/CSS/공용 script 경로 재사용, 별도 화면·등록 누락 없음',()=>{
 const html=read('index.html'),css=read('styles.css');
 assert.equal(html.split('id="coachSettlementReconciliationForm"').length-1,1);
 assert.ok(html.includes(fixture.form));assert.ok(css.includes(fixture.cssFragment));
 assert.ok(fixture.cssFragment.includes('font-size: 16px'));
 assert.ok(fixture.cssFragment.includes('min-height: 44px'));
 assert.equal(fixture.publicParent,'705b7312ab14bbfcd8c68b1ef78c041be643d5d2');
});
