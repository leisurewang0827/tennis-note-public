import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function memberRuntime(tickets = []) {
  const context = {window:{}, state:{liveTickets:tickets,expiredTickets:[]},localDateKey:()=>"2099-01-01"};
  context.window = context;
  vm.createContext(context);
  for(const file of ["shared/tennisnote-ticket-state.js","tennis-note-member-app/domain/tickets.js","tennis-note-member-app/forms/tickets.js","tennis-note-member-app/data/sync.js"]) {
    vm.runInContext(read(`app/${file}`),context,{filename:file});
  }
  return context;
}

test("회원권은 exact ID만 중복 제거하고 같은 상품·코치의 별도 권리를 보존한다",()=>{
  const ctx=memberRuntime();
  const tickets=[{id:"synthetic-a",productId:"same",coachRoleId:"same",remaining:3},{id:"synthetic-b",productId:"same",coachRoleId:"same",remaining:4},{id:"synthetic-a",remaining:3}];
  assert.deepEqual(Array.from(ctx.distinctTicketsByExactId(tickets),t=>t.id),["synthetic-a","synthetic-b"]);
  assert.equal(ctx.currentLiveTicketOverlapCount(),0);
  ctx.state.liveTickets=[{id:"old",status:"expired"},{id:"refund",status:"refunded"}];
  ctx.state.expiredTickets=[{id:"old",status:"expired"},{id:"void",status:"voided"}];
  assert.equal(ctx.historicalLiveTickets().length,3);
});

test("페이지 경계 0/199/200/201/401 및 link key를 누락 없이 읽는다",async()=>{
  const ctx=memberRuntime();
  for(const size of [0,199,200,201,401]) for(const key of ["id","ticket_id"]){
    const all=Array.from({length:size},(_,i)=>({[key]:`synthetic-${i}`}));const calls=[];
    const result=await ctx.selectAllMemberTicketRows({selectRows:async(table,o)=>{calls.push(o);return all.slice(o.offset,o.offset+o.limit);}},"synthetic_table",{paginationKey:key,filters:{user_id:"synthetic"}});
    assert.equal(result.length,size);assert.equal(calls.length,Math.floor(size/200)+1);
    assert(calls.every(o=>o.order===`${key}.asc`&&o.limit===200&&!('paginationKey' in o)));
  }
});

test("페이지 반복·잘못된 응답·부분 실패·상한은 조용히 부분 결과를 반환하지 않는다",async()=>{
  const ctx=memberRuntime();
  for(const value of [null,{},[{}],Array.from({length:201},(_,i)=>({id:`s-${i}`}))]){
    await assert.rejects(()=>ctx.selectAllMemberTicketRows({selectRows:async()=>value},"synthetic",{}),/invalid_page/);
  }
  const page=Array.from({length:200},(_,i)=>({id:`s-${i}`}));
  await assert.rejects(()=>ctx.selectAllMemberTicketRows({selectRows:async()=>page},"synthetic",{}),/repeated_page/);
  await assert.rejects(()=>ctx.selectAllMemberTicketRows({selectRows:async(_,o)=>{if(o.offset)throw Error("synthetic_failure");return page;}},"synthetic",{}),/synthetic_failure/);
  await assert.rejects(()=>ctx.selectAllMemberTicketRows({selectRows:async(_,o)=>page.map((r,i)=>({id:`s-${o.offset+i}`}))},"synthetic",{}),/limit_exceeded/);
});

test("세 구획은 입력 사실·20자·가혹표현 우선순위를 보존하며 빈 사실을 만들어내지 않는다",()=>{
  const context={window:{}};vm.runInNewContext(read("app/shared/tennisnote-comment-draft.js"),context);
  const draft=context.window.TennisNoteCommentDraft;
  const input="잘된 점: 포핸드 방향이 좋아졌습니다; 더 연습할 점: 백핸드 준비가 늦었습니다; 개인 연습 중점: 스플릿스텝 타이밍 확인";
  const result=draft.generateSectioned(input);
  assert.equal(result.ok,true);assert.equal(result.complete,true);assert.equal(result.sections.length,3);
  assert(result.sections.every(s=>draft.feedbackVisibleLength(s.text)>=20));
  for(const fact of ["포핸드 방향이 좋아졌습니다","백핸드 준비가 늦었습니다","스플릿스텝 타이밍 확인"])assert(result.comment.includes(fact));
  assert.equal(result.quality.adjacentRepetition,false);
  for(const input of ["최.악","못!함","엉;망"]){assert.equal(draft.generateSectioned(input).code,"neutral_wording_required");}
  const partial=draft.generateSectioned("포핸드 방향 좋아짐");assert.equal(partial.complete,false);assert(partial.comment.includes("[입력 필요]"));
});

test("실제 entry·공개 고유 동선·제외 경계를 보존한다",()=>{
  const html=read("app/tennis-note-coach-app/index.html"),entry=read("app/tennis-note-coach-app/app.js");
  for(const f of ["views/schedule.js","actions/schedule.js","data/records.js","domain/records.js","events/delegated.js"])assert(html.includes(f));
  assert(entry.includes("bindDelegatedEvents()"));
  assert(!html.includes('id="coachWebPortalButton"'));
  assert(read("app/tennis-note-member-app/views/tickets.js").includes("renderMemberOneDayReservationPanel();"));
  const schedule=read("app/tennis-note-coach-app/views/schedule.js");
  assert(!schedule.includes("data-save-lesson-draft="));
  assert(schedule.includes('data-lesson-detail-tab='));
  assert(!schedule.includes('data-delete-lesson='));
  const admin=read("app/admin/schedule-v2-admin.js");
  assert(admin.includes("attendance_choice_correction_makeup_conflict"));
  assert(admin.includes("attendance_choice_correction_makeup_policy_required"));
});
