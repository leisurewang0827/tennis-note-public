/* R4/G2 scoped workflows: existing verified login, no identity override. */
(function(root,doc){
 'use strict';
 const client=root.TennisNoteDataClient, config=client?.loadConfig?.();
 const sites={
  'https://tennisnote-app.pages.dev':['production','cnympiwrwgouuvhaivbc','3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'],
  'https://tennisnote-app-dev.pages.dev':['development','udjmiezroipctytmztwz','63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba']
 };
 const target=sites[root.location.origin];
 if(!root.TennisNoteR4CoachEntry?.bound)return;
 const auth=Object.freeze({requireCurrentSession:true,retryAuth:false});
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
 const btn=(text,fn,primary=false)=>{const n=el('button',text);n.type='button';n.className=primary?'approve-button':'small-button';n.addEventListener('click',fn);return n;};
 const field=(text,node)=>{const n=el('label',text+' ');node.setAttribute('aria-label',text);n.append(node);return n;};
 const rpc=async(name,args)=>{if(!await root.TennisNoteR4CoachEntry.ready)throw Error('runtime_denied');return client.rpc(name,args,auth);};
 const money=n=>Number.isSafeInteger(n)&&n>=0?new Intl.NumberFormat('ko-KR').format(n)+'원':null;
 let serial=0;
 const current=(who,n,host)=>who&&client.sessionSubject()===who&&n===serial&&host.isConnected;
 const reset=()=>{serial++;};
 function explain(e){
  const text=String(e?.payload?.message||e?.message||'');
  if(/future|not_ended|before_end/.test(text))return '수업 종료 후 완료할 수 있습니다.';
  if(/stale|conflict|operation_key/.test(text))return '내용이 변경됐습니다. 새로 확인해 주세요.';
  if(/settlement_hold|purchase_context|snapshot|settlement_term/.test(text))return '정산 기준 확인이 필요합니다. 지점장에게 문의해 주세요.';
  if(/workflow_off|denied|forbidden|42501/.test(text))return '이 지점의 이용 권한을 확인해 주세요.';
  return '처리 결과를 다시 확인해 주세요. 확인 전에는 저장을 반복하지 마세요.';
 }
 async function lesson({branchId,lessonId,host,note=''}){
  const who=client.sessionSubject(),n=++serial;
  host.replaceChildren();
  if(!who||!uuid(branchId)||!uuid(lessonId))return;
  const message=el('p','수업 확인 중');message.setAttribute('role','status');host.append(message);
  let data;
  try{data=await rpc('tn_r4_scoped_coach_lesson',{p_branch:branchId,p_lesson:lessonId});}
  catch(e){if(current(who,n,host))message.textContent=explain(e);return;}
  if(!current(who,n,host))return;
  if(data?.branchId!==branchId||data.lessonId!==lessonId||!Array.isArray(data.participants)||!Array.isArray(data.curriculum)){message.textContent='수업 정보를 확인할 수 없습니다.';return;}
  host.replaceChildren(el('h3','수업 피드백'),el('p',data.lessonDate+' · '+data.startTime+' · '+data.minutes+'분'));
  const status=el('p',note);status.setAttribute('role','status');
  host.append(status);
  const complete=data.status==='completed';
  const drafts=[];
  let saving=false;
  const inputs=[];
  for(const member of data.participants){
   if(!uuid(member.userId)||!uuid(member.ticketId)||typeof member.name!=='string')continue;
   const card=el('section');card.append(el('h4',member.name));
   const counts=[member.total,member.used,member.remaining];
   if(counts.every(Number.isSafeInteger))card.append(el('p','총 '+counts[0]+'회 · 사용 '+counts[1]+'회 · 잔여 '+counts[2]+'회'));
   const comment=el('textarea');comment.minLength=5;comment.maxLength=3000;comment.value=member.comment||'';
   const curriculum=el('select');const blank=el('option','선택');blank.value='';curriculum.append(blank);
   for(const item of data.curriculum){if(!uuid(item.id)||typeof item.title!=='string')continue;const option=el('option',item.title);option.value=item.id;curriculum.append(option);}
   curriculum.value=member.curriculumId||'';
   card.append(field('수업 코멘트',comment),field('다음 커리큘럼',curriculum));
   inputs.push(comment,curriculum);
   drafts.push({userId:member.userId,ticketId:member.ticketId,comment,curriculum});
   if(complete && member.recordStatus==='final'&&member.outcome==='completed'){
    const save=btn('피드백 저장',async()=>{
     if(saving||!current(who,n,host))return;
     if(comment.value.trim().length<5||!uuid(curriculum.value)){status.textContent='코멘트와 다음 커리큘럼을 확인해 주세요.';return;}
     saving=true;for(const input of inputs)input.disabled=true;save.disabled=true;
     const key='r4-coach-feedback:'+root.crypto.randomUUID();
     try{
      await rpc('tn_r4_scoped_coach_feedback',{p_branch:branchId,p_lesson:lessonId,p_user:member.userId,p_comment:comment.value.trim(),p_curriculum:curriculum.value,p_expected:member.updatedAt,p_operation:key});
      if(current(who,n,host))await lesson({branchId,lessonId,host,note:'피드백을 저장했습니다. 횟수는 추가 차감되지 않습니다.'});
     }catch(e){if(current(who,n,host)){status.textContent=explain(e);host.append(btn('저장 결과 새로 확인',()=>lesson({branchId,lessonId,host})));}}
    },true);
    card.append(save);inputs.push(save);
   }
   host.append(card);
  }
  if(!complete){
   const finalize=btn('수업 완료',async()=>{
    if(saving||!current(who,n,host))return;
    const results=drafts.map(d=>({userId:d.userId,ticketId:d.ticketId,coachComment:d.comment.value.trim(),nextCurriculumRefId:d.curriculum.value}));
    if(!results.length||results.length!==data.participants.length||results.some(x=>x.coachComment.length<5||!uuid(x.nextCurriculumRefId))){
     status.textContent='모든 회원의 코멘트와 다음 커리큘럼을 확인해 주세요.';return;
    }
    saving=true;finalize.disabled=true;for(const input of inputs)input.disabled=true;
    const key='r4-coach-complete:'+root.crypto.randomUUID();
    try{
     await rpc('tn_r4_scoped_coach_complete',{p_branch:branchId,p_lesson:lessonId,p_results:results,p_operation:key});
     if(current(who,n,host))await lesson({branchId,lessonId,host,note:'수업 완료와 회원권 차감을 저장했습니다.'});
    }catch(e){if(current(who,n,host)){status.textContent=explain(e);host.append(btn('저장 결과 새로 확인',()=>lesson({branchId,lessonId,host})));}}
   },true);
   finalize.disabled=data.ended!==true||!data.participants.length;host.append(finalize);
   if(data.ended!==true)host.append(el('p','수업 종료 후 완료할 수 있습니다.'));
  }
 }
 async function settlement({branchId,host}){
  const who=client.sessionSubject(),n=++serial;
  host.replaceChildren();
  if(!who||!uuid(branchId))return;
  host.append(el('h3','내 정산'));
  const month=el('input');month.type='month';
  month.value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date());
  const status=el('p');status.setAttribute('role','status');
  let request=0;
  const invalidate=()=>{request++;status.textContent='조회 월을 변경했습니다. 정산 조회를 눌러 주세요.';};
  month.addEventListener('input',invalidate);
  month.addEventListener('change',invalidate);
  const load=async()=>{
   if(!current(who,n,host)||!/^\d{4}-\d{2}$/.test(month.value))return;
   const date=month.value+'-01',r=++request;
   status.textContent='정산 확인 중';
   try{
    const data=await rpc('tn_r4_scoped_coach_settlement',{p_branch:branchId,p_month:date});
    if(!current(who,n,host)||r!==request||month.value+'-01'!==date)return;
    if(data?.scope?.branchId!==branchId||data.scope.settlementMonth!==date)throw Error('settlement scope mismatch');
    const amount=money(data.totals?.totalSettlementAmount);
    status.textContent=amount?date.slice(0,7)+' 예상 정산액 '+amount:'정산 기준 확인이 필요합니다.';
   }catch(e){if(current(who,n,host)&&r===request&&month.value+'-01'===date)status.textContent=explain(e);}
  };
  const go=btn('정산 조회',load);
  host.append(field('조회 월',month),go,status);
  await load();
 }
 root.TennisNoteR4CoachWorkflows=Object.freeze({lesson,settlement,reset});
})(window,document);
