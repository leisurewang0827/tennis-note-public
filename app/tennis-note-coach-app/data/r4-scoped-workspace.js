/* R4/G2: 기존 로그인과 서버 소속을 사용하는 코치 업무 연결. */
(function(root,doc){
 'use strict';
 const client=root.TennisNoteDataClient;
 const sites={
  'https://tennisnote-app.pages.dev':['production','cnympiwrwgouuvhaivbc','3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'],
  'https://tennisnote-app-dev.pages.dev':['development','udjmiezroipctytmztwz','63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba']
 };
 const target=sites[root.location.origin],config=client?.loadConfig?.();
 if(!root.TennisNoteR4CoachEntry?.bound)return;
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
 const button=(label,fn,primary=false)=>{const n=el('button',label);n.type='button';n.className=primary?'approve-button':'small-button';n.addEventListener('click',fn);return n;};
 const rpc=async(name,args)=>{if(!await root.TennisNoteR4CoachEntry.ready)throw Error('runtime_denied');return client.rpc(name,args,{requireCurrentSession:true,retryAuth:false});};
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let epoch=0,owner='',screen=null,selection='',branches=[],pending=0;
 const valid=(who,stamp)=>who&&owner===who&&client.sessionSubject()===who&&stamp===epoch&&screen?.isConnected;
 const clear=()=>{
  ++pending;++epoch;root.TennisNoteR4CoachWorkflows?.reset();selection='';branches=[];owner='';screen?.remove();screen=null;
 };
 function hideLegacy(){for(const id of ['coachLoginScreen','coachAppScreen']){const n=doc.getElementById(id);if(n)n.hidden=true;}}
 const begin=()=>{clear();return pending;};
 const accepts=attempt=>Number.isSafeInteger(attempt)&&attempt===pending;
 const reset=attempt=>{if(attempt===undefined||accepts(attempt))clear();};
 async function activate({user,profile,coachRole,attempt:incoming}){
  if(incoming!==undefined){if(!accepts(incoming))return false;}else clear();
  if(coachRole?.status==='approved')return false;
  if(!uuid(user?.id)||!uuid(profile?.id)||client.sessionSubject()!==user.id)return false;
  const attempt=pending,activationEpoch=epoch,who=user.id;
  let response;
  try{response=await Promise.race([rpc('tn_r4_my_scoped_coach_branches',{}),new Promise((_,reject)=>root.setTimeout(()=>reject(Error('timeout')),5500))]);}
  catch{return false;}
  if(attempt!==pending||activationEpoch!==epoch||client.sessionSubject()!==who)return false;
  const choices=response;
  if(!Array.isArray(choices)||!choices.length||choices.some(x=>!uuid(x.id)||typeof x.name!=='string')||new Set(choices.map(x=>x.id)).size!==choices.length)return false;
  owner=who;branches=choices;const stamp=epoch;
  screen=el('section');screen.id='r4ScopedCoachApp';screen.className='app-screen';
  const header=el('header');header.className='topbar';
  const heading=el('h1','오늘');
  const back=el('a','회원 화면');back.href=root.TennisNoteR4CoachEntry.memberUrl();back.className='small-button';
  back.addEventListener('click',()=>root.TennisNoteR4CoachEntry.remember(false));
  header.append(heading,back);screen.append(header);
  const label=el('label','내 지점 '),branch=el('select');branch.setAttribute('aria-label','내 지점');
  for(const item of branches){const opt=el('option',item.name);opt.value=item.id;branch.append(opt);}label.append(branch);screen.append(label);
  const tabs=el('nav');tabs.className='tabbar';tabs.setAttribute('aria-label','코치 업무');
  const content=el('section'),status=el('p');status.setAttribute('role','status');
  const workflow=el('section');workflow.className='r4-coach-workflow';
  const invalidate=()=>{root.TennisNoteR4CoachWorkflows?.reset();content.replaceChildren();workflow.replaceChildren();};
  let view='오늘',load=0;
  const display=async()=>{
   const task=++load;invalidate();
   if(!valid(who,stamp)||!branches.some(x=>x.id===selection))return;
   heading.textContent=view;status.textContent='확인 중';
   if(view==='내 정보'){
    content.append(el('h2',profile.name||'코치'),el('p',branches.find(x=>x.id===selection).name));
    content.append(button('이번 달 정산',()=>root.TennisNoteR4CoachWorkflows.settlement({branchId:selection,host:workflow})));
    status.textContent='';return;
   }
   const day=el('input');day.type='date';day.value=today();day.setAttribute('aria-label','수업 날짜');
   const dateLabel=el('label','수업 날짜 ');dateLabel.append(day);content.append(dateLabel);
   const list=el('div');list.className='card-list';content.append(list);
   const read=async()=>{
    const request=++load,chosen=selection,date=day.value;
    workflow.replaceChildren();root.TennisNoteR4CoachWorkflows?.reset();list.replaceChildren();status.textContent='일정 확인 중';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    try{
     const data=await rpc('tn_r4_read_scoped_coach_schedule',{p_branch:chosen,p_from:date,p_to:date});
     if(!valid(who,stamp)||request!==load||selection!==chosen||day.value!==date)return;
     if(data?.branchId!==chosen||!Array.isArray(data.lessons)||data.lessons.some(x=>!uuid(x.id)||x.lessonDate!==date))throw Error('scope');
     for(const lesson of data.lessons){
      const card=el('article');card.className='lesson-card';card.append(el('h2',lesson.startTime+' · '+lesson.minutes+'분'));
      card.append(button('피드백·완료',()=>root.TennisNoteR4CoachWorkflows.lesson({branchId:chosen,lessonId:lesson.id,host:workflow})));
      list.append(card);
     }
     status.textContent=data.lessons.length?data.lessons.length+'건':'이 날짜에 수업이 없습니다.';
    }catch{if(valid(who,stamp)&&request===load)status.textContent='일정을 확인할 수 없습니다. 연결 상태를 확인해 주세요.';}
   };
   day.addEventListener('input',()=>{++load;workflow.replaceChildren();list.replaceChildren();root.TennisNoteR4CoachWorkflows?.reset();status.textContent='조회할 날짜를 선택해 주세요.';});
   day.addEventListener('change',read);await read();
  };
  for(const title of ['오늘','레슨표','내 정보']){
   const tab=button(title,()=>{view=title;void display();});tab.className='tab';tabs.append(tab);
  }
  screen.append(tabs,status,content,workflow);doc.querySelector('main.coach-shell').append(screen);
  branch.addEventListener('change',()=>{selection=branch.value;void display();});
  selection=branches[0].id;hideLegacy();void display();return true;
 }
 root.TennisNoteScopedCoachApp=Object.freeze({activate,begin,accepts,isActive:()=>Boolean(owner&&client.sessionSubject()===owner&&screen?.isConnected),reset});
 root.setInterval(()=>{if(owner&&client.sessionSubject()!==owner){clear();const login=doc.getElementById('coachLoginScreen');if(login)login.hidden=false;}},750);
})(window,document);
