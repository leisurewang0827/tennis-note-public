import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {compose,paths,after} from './compose.mjs';
export function fixture(data){
  const body=(p,name)=>{
    const src=data[p].toString();const head=new RegExp('^( *)function '+name+'\\(','m').exec(src);
    assert(head);const end=src.indexOf('\n'+head[1]+'}\n',head.index);assert(end>head.index);return src.slice(head.index,end+head[1].length+2);
  };
  const loader=data[paths[0]].toString().match(/<script src="[^"]*shared\/tennisnote-comment-draft\.js\?v=[0-9a-f]+"><\/script>/g);
  assert.equal(loader?.length,1);assert(loader[0].includes(after[1].slice(0,16)));
  return {loader:loader[0],legacy:body('actions/common.js','applyAdminCommentDraft'),schedule:body('schedule-v2-admin.js','generateOutcomeComment')};
}
export function verify(base,out){
  const built=compose(base,out),src=built.data[paths[1]].toString(),ui=fixture(built.data);
  const calls=[];const deny=()=>{calls.push('blocked');throw Error('Unexpected side effect')};
  const sandbox=vm.createContext({window:{},fetch:deny,XMLHttpRequest:deny,WebSocket:deny,localStorage:{setItem:deny},navigator:{sendBeacon:deny}});
  vm.runInContext(src,sandbox);const api=sandbox.window.TennisNoteCommentDraft;
  for(const v of ['포핸드(A: 타점이 몸에 가까움/B: 제자리 복귀가 늦음)','발리〔Ａ：타점 좋음／Ｂ：준비 늦음〕','발리/회원\u200b A: 준비 늦음']){
    const res=api.generateDetailed(v);assert.equal(res.code,'feedback_detail_required');assert.equal(res.comment,'');
  }
  const ctx={curriculum:{id:'common-frozen',label:'합성 공통 기준'}};const old=JSON.stringify(ctx);
  for(const [v,practice] of [['포핸드 타점이 몸에 가까움','몸과 팔 사이'],['치고 나서 제자리 복귀가 늦음','기준점']]){
    const general=api.generate(v,ctx),res=api.generateDetailed(v,ctx);assert(res.ok);
    assert.deepEqual(Array.from(res.sections,s=>s.label),['오늘 관찰','개인 연습']);assert.equal(res.sections[0].text,general.comment);
    assert(res.sections[1].text.includes(practice));assert(!res.comment.includes('합성 공통 기준'));assert.equal(JSON.stringify(ctx),old);
  }
  assert.deepEqual(calls,[]);assert(ui.legacy.includes('generator.generateDetailed'));assert(ui.schedule.includes('generator.generateDetailed'));
  return built;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  verify(process.argv[2],process.argv[3]);console.log('184 checked, exact 2 changes; 3 ambiguous inputs held, 2 single drafts; no transport, common curriculum preserved.');
}
