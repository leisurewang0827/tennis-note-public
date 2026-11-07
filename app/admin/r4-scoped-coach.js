/* R4/G2: additive staff and coach panels on the existing Seoul admin sign-in.
   This module never sets a role, session, or auth storage. */
(function (root, doc) {
  'use strict';
  const client = root.TennisNoteDataClient;
  const config = client?.loadConfig?.();
  const targets = {
    'https://tennisnote-admin.pages.dev': ['production', 'cnympiwrwgouuvhaivbc', '3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'],
    'https://tennisnote-admin-dev.pages.dev': ['development', 'udjmiezroipctytmztwz', '63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'],
  };
  const exact = targets[root.location.origin];
  if (!exact || config?.environment !== exact[0] ||
      config.supabaseUrl !== `https://${exact[1]}.supabase.co` || config.projectFingerprint !== exact[2]) return;
  const workspace = doc.getElementById('r4BranchHoursPanel');
  const branch = doc.getElementById('r4ManagedBranch');
  const onboarding = doc.getElementById('r4Onboarding');
  if (!workspace || !branch || !onboarding || !client?.rpc || !client.sessionSubject) return;
  const uuid = s => typeof s === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s);
  const auth = Object.freeze({requireCurrentSession:true,retryAuth:false});
  const query = new URLSearchParams(root.location.search).get('coachBranch');
  const pendingBranch = uuid(query) ? query : null;
  const el = (tag, text) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    return node;
  };
  const button = (label, handler, primary = false) => {
    const node = el('button', label);
    node.type = 'button'; node.className = primary ? 'primary-button' : 'ghost-button';
    node.addEventListener('click', handler);
    return node;
  };
  const statusNode = () => { const node = el('p'); node.setAttribute('role','status'); return node; };
  const field = (label, input) => { const node = el('label', label+' '); node.append(input); return node; };
  const own = el('section'), coach = el('section');
  own.hidden = true; coach.hidden = true;
  own.className = coach.className = 'operations-password-login-form';
  workspace.append(own); onboarding.after(coach);
  let subject = '', selectedBranch = '', revision = 0, coachRevision = 0, busy = false;
  let addKey = null, codeTimer = null;
  const valid = (who, stamp, mode) => who && who === client.sessionSubject() &&
    stamp === (mode === 'coach' ? coachRevision : revision);
  const managerCurrent = (who, stamp, id) => valid(who,stamp,'manager') && !workspace.hidden && branch.value === id;
  const rpc = (name, payload = {}) => client.rpc(name,payload,auth);
  const safeText = (node, message) => { node.textContent = message; };
  function clearCode() { if (codeTimer !== null) root.clearTimeout(codeTimer); codeTimer = null; }

  async function managerView(note = '') {
    const who = client.sessionSubject(), id = branch.value, stamp = ++revision;
    own.replaceChildren(); own.hidden = true;
    if (!who || workspace.hidden || !uuid(id)) return;
    let result;
    try { result = await rpc('tn_r4_list_scoped_coach_roster',{p_branch:id}); }
    catch { return; }
    if (!managerCurrent(who,stamp,id) || result?.branchId !== id || !Array.isArray(result.rows)) return;
    const title = el('h3','코치·직원');
    const status = statusNode();
    safeText(status,note);
    const controls = [];
    const perform = async (task, ok) => {
      if (busy || !managerCurrent(who,stamp,id)) return;
      busy = true; for (const item of controls) item.disabled = true;
      try {
        await task();
        if (managerCurrent(who,stamp,id)) await managerView(ok);
      } catch {
        if (managerCurrent(who,stamp,id)) await managerView('처리 결과를 확인해 주세요. 추가는 같은 이름으로 다시 시도하면 중복되지 않습니다.');
      } finally { busy = false; }
    };
    own.append(title);
    if (result.rows.length === 0) {
      own.append(el('p','첫 수업 준비에서 첫 코치를 먼저 등록해 주세요.'), button('명단 새로 확인',()=>managerView()), status);
      own.hidden = false; return;
    }
    const invite = el('a','코치에게 연결 링크 보내기');
    const url = new URL('/',root.location.origin); url.searchParams.set('coachBranch',id); invite.href = url.href;
    const input = el('input'); input.maxLength=60; input.minLength=2; input.autocomplete='off';
    const add = button('코치 추가', () => {
      const label=input.value.trim();
      if (label.length<2 || label.length>60) return safeText(status,'코치 이름을 입력해 주세요.');
      if (addKey?.who!==who || addKey?.id!==id || addKey?.label!==label)
        addKey={who,id,label,key:root.crypto.randomUUID()};
      const key=addKey.key;
      return perform(async () => {
        const x=await rpc('tn_r4_add_scoped_coach',{p_branch:id,p_name:label,p_operation:key});
        if (x?.branchId!==id || !uuid(x.rosterRoleId)) throw Error('unexpected receipt');
        addKey=null;
      },'명단에 추가했습니다.');
    },true);
    controls.push(add);
    own.append(invite,field('이름',input),add);
    for (const row of result.rows) {
      if (!uuid(row.id) || typeof row.name!=='string') continue;
      const section = el('section');
      section.append(el('h4',row.name),el('p',row.linked ? '계정 연결됨' : '미연결'));
      if (row.linked) {
        const revoke=button('연결 해제',()=>perform(async()=>{
          const x=await rpc('tn_r4_revoke_scoped_coach',{p_branch:id,p_roster_role:row.id});
          if(x?.branchId!==id || x.revoked!==true) throw Error('unexpected receipt');
        },'계정 연결을 해제했습니다.'));
        controls.push(revoke); section.append(revoke);
      } else if (row.eligible) {
        const code = el('input'); code.type='password'; code.maxLength=32; code.autocomplete='off';
        const link=button('계정 연결',()=>{
          const value=code.value.trim(); code.value='';
          if(!/^[a-f0-9]{32}$/.test(value)) return safeText(status,'코치가 보낸 연결 코드를 확인해 주세요.');
          return perform(async()=>{
            const x=await rpc('tn_r4_accept_scoped_coach_code',{p_branch:id,p_roster_role:row.id,p_code:value});
            if(x?.branchId!==id || x.rosterRoleId!==row.id || x.linked!==true) throw Error('unexpected receipt');
          },'본인 계정을 연결했습니다.');
        });
        controls.push(link); section.append(field('연결 코드',code),link);
      }
      own.append(section);
    }
    own.append(status); own.hidden = false;
  }
  async function coachView() {
    const who=client.sessionSubject(), stamp=++coachRevision;
    clearCode(); coach.replaceChildren(); coach.hidden=true;
    if (!who) return;
    let rows;
    try { rows=await rpc('tn_r4_my_scoped_coach_branches'); } catch { return; }
    if(!valid(who,stamp,'coach') || !Array.isArray(rows)) return;
    const branches=rows.filter(x=>uuid(x.id)&&typeof x.name==='string');
    if(!pendingBranch && !branches.length) return;
    const status=statusNode(), schedule=el('ul');
    let scheduleVersion=0;
    coach.append(el('h2','내 코치 일정'));
    if(pendingBranch && !branches.some(x=>x.id===pendingBranch)){
      const code=el('input'); code.readOnly=true; code.hidden=true; code.setAttribute('aria-label','일회용 연결 코드');
      const issue=button('연결 코드 만들기',async()=>{
        if(issue.disabled || !valid(who,stamp,'coach')) return;
        issue.disabled=true; clearCode(); code.value=''; code.hidden=true;
        try{
          const x=await rpc('tn_r4_request_scoped_coach_code',{p_branch:pendingBranch});
          if(!valid(who,stamp,'coach') || !/^[a-f0-9]{32}$/.test(x?.code)) return;
          code.value=x.code; code.hidden=false;
          safeText(status,'5분 안에 이 코드를 지점장에게 전달해 주세요.');
          codeTimer=root.setTimeout(()=>{code.value='';code.hidden=true;safeText(status,'코드가 만료됐습니다.');},300000);
        }catch{if(valid(who,stamp,'coach'))safeText(status,'이 지점의 연결 코드를 만들 수 없습니다.');}
        finally{issue.disabled=false;}
      },true);
      coach.append(issue,code,button('연결 상태 새로 확인',coachView));
    }
    for(const row of branches) coach.append(button(row.name,async()=>{
      if(!valid(who,stamp,'coach')) return;
      const request=++scheduleVersion;
      schedule.replaceChildren(); safeText(status,'일정 확인 중');
      const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      try {
        const x=await rpc('tn_r4_read_scoped_coach_schedule',{p_branch:row.id,p_from:date,p_to:date});
        if(!valid(who,stamp,'coach') || request!==scheduleVersion) return;
        if(x?.branchId!==row.id || !Array.isArray(x.lessons)) throw Error('unexpected receipt');
        for(const item of x.lessons) schedule.append(el('li',`${item.lessonDate} · ${item.startTime} · ${item.minutes}분`));
        safeText(status,x.lessons.length?row.name+' · 오늘 일정':'오늘 일정이 없습니다.');
      }catch{if(valid(who,stamp,'coach') && request===scheduleVersion)safeText(status,'일정을 열 수 없습니다. 연결 상태를 확인해 주세요.');}
    }));
    if(branches.length) coach.append(button('연결 상태 새로 확인',coachView));
    coach.append(schedule,status); coach.hidden=false;
  }
  function sync() {
    const who=client.sessionSubject() || '', id=workspace.hidden?'':branch.value;
    if(who!==subject){
      subject=who; selectedBranch=''; addKey=null; ++revision; ++coachRevision;
      own.replaceChildren(); coach.replaceChildren(); own.hidden=coach.hidden=true; clearCode();
      void coachView();
    }
    if(id!==selectedBranch){ selectedBranch=id; void managerView(); }
  }
  branch.addEventListener('change',sync);
  const observer=new MutationObserver(sync);
  observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});
  observer.observe(branch,{childList:true});
  root.addEventListener('focus',sync);
  root.setInterval(sync,1000);
  sync();
})(window,document);
