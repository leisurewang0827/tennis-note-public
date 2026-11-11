/* Seoul DEV only. Inserted alongside the existing R4 onboarding panel. */
(function (root, doc) {
  'use strict';
  const client = root.TennisNoteDataClient;
  const cfg = client?.loadConfig?.();
  const anchor = doc.getElementById('r4Onboarding');
  if (root.location.origin !== 'https://tennisnote-admin-dev.pages.dev' || cfg?.environment !== 'development' ||
      cfg.supabaseUrl !== 'https://udjmiezroipctytmztwz.supabase.co' ||
      cfg.projectFingerprint !== '63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba' ||
      !anchor || !client?.rpc || !client.authStorageKey || !client.authPersistenceKey) return;
  const uuid = x => typeof x === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
  const identity = () => {
    try {
      const pref = root.localStorage.getItem(client.authPersistenceKey);
      if (pref !== null && pref !== 'local' && pref !== 'session') return '';
      const storage = pref === 'session' ? root.sessionStorage : root.localStorage;
      const token = JSON.parse(storage.getItem(client.authStorageKey) || 'null')?.access_token;
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const x = JSON.parse(root.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
      return x.role === 'authenticated' && x.is_anonymous !== true && uuid(x.sub) && uuid(x.session_id) && x.exp * 1000 > Date.now()
        ? x.sub + ':' + x.session_id : '';
    } catch { return ''; }
  };
  const el = (tag, label = '') => { const n = doc.createElement(tag); n.textContent = label; return n; };
  const btn = (label, primary = false, type = 'button') => {
    const n = el('button', label); n.type = type; n.className = primary ? 'primary-button' : 'ghost-button'; return n;
  };
  const field = (label, input) => { const n = el('label', label + ' '); n.append(input); return n; };
  const panel = el('section'); panel.hidden = true; panel.className = 'operations-password-login-form';
  panel.dataset.r4IndependentSelfserve = ''; anchor.before(panel);
  const options = Object.freeze({requireCurrentSession:true,retryAuth:false});
  const workspaceRpc = 'tn_r4_dev_my_independent_workspace', lessonRpc = 'tn_r4_dev_my_independent_lessons';
  const fmt = new Intl.DateTimeFormat('ko-KR', {dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'});
  const inputFmt = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const validText = (s,max) => Array.from(s).length >= 2 && Array.from(s).length <= max && !/[\x00-\x1f\x7f-\x9f]/.test(s);
  let last = '', generation = 0, current = null;
  const active = s => !!s && s.generation === generation && identity() === s.who;
  async function rpc(s, name, body) {
    if (!active(s)) throw Error('identity changed');
    const data = await client.rpc(name, body, options);
    if (!active(s)) throw Error('identity changed');
    return data;
  }
  async function load(s) {
    s.workspace = await rpc(s, workspaceRpc, {});
    s.list = s.workspace.workspace && s.workspace.canManageLessons ? await rpc(s, lessonRpc, {p_action:'list'}) : null;
  }
  function pending(s) {
    const id = root.localStorage.getItem(s.key);
    if (id === null) return null;
    if (!uuid(id)) throw Error('invalid receipt marker');
    let body = null;
    try {
      const saved = JSON.parse(root.sessionStorage.getItem(s.key) || 'null');
      if (saved?.p_operation === id) body = saved;
    } catch { /* Without the original payload only read-back is allowed. */ }
    return {id,body};
  }
  function clear(s,id) {
    if (root.localStorage.getItem(s.key) !== id) throw Error('receipt marker changed');
    root.localStorage.removeItem(s.key);
    root.sessionStorage.removeItem(s.key);
  }
  const validAck = ack => uuid(ack?.id) && Number.isSafeInteger(ack.revision) && ack.revision > 0;
  const rolledBack = err => ['22023','23505','23514','40001','42501'].includes(err?.code);
  async function mutate(s, payload, retry = false) {
    if (!active(s) || s.busy) return;
    s.busy = true;
    try {
      if (!root.navigator.locks?.request) throw Error('storage lock unavailable');
      await root.navigator.locks.request(s.key,{ifAvailable:true},async lock=>{
        if (!active(s)) return;
        if (!lock) { s.message='다른 탭에서 처리 중입니다. 결과를 확인해 주세요.'; return; }
        const existing = pending(s);
        if ((!retry && existing) || (retry && !existing)) return;
        let body;
        if (retry) {
          // A denial or missing receipt never proves an earlier uncertain write rolled back.
          const receipt = await rpc(s,lessonRpc,{p_action:'receipt',p_operation:existing.id});
          if (receipt?.found === true && validAck(receipt)) {
            clear(s,existing.id); s.message='저장 결과를 확인했습니다.'; return;
          }
          if (receipt?.found !== false || !existing.body) throw Error('receipt unresolved');
          body=existing.body;
        } else {
          body={...payload,p_operation:root.crypto.randomUUID()};
          root.sessionStorage.setItem(s.key,JSON.stringify(body));
          // Cross-tab/per-owner marker contains only the random operation id, not lesson data.
          root.localStorage.setItem(s.key,body.p_operation);
        }
        try {
          const ack=await rpc(s,lessonRpc,body);
          if (!validAck(ack)) throw Error('missing receipt');
          clear(s,body.p_operation);
          s.message=body.p_action==='cancel'?'레슨을 취소했습니다.':'레슨을 저장했습니다.';
        } catch (err) {
          if (!active(s)) return;
          if (retry || !rolledBack(err)) throw err;
          clear(s,body.p_operation);
          s.message='변경하지 못했습니다. 최신 목록을 확인해 주세요.';
        }
      });
      try { await load(s); } catch { if (active(s)) s.message += ' 목록을 새로 불러오지 못했습니다.'; }
    } catch {
      if (active(s)) s.message='저장 결과를 확인하지 못했습니다. 새로 저장하지 말고 결과를 확인해 주세요.';
    } finally { s.busy = false; if (active(s)) render(s); }
  }
  function render(s, editing = null, confirming = null) {
    if (!active(s)) return;
    const status = el('p',s.message); status.setAttribute('role','status');
    panel.replaceChildren(el('h3','독립 코치'),el('p','비공개 작업공간입니다. 공개·예약·결제와 연결되지 않습니다.'));
    const ws = s.workspace.workspace;
    if (!ws) {
      if (s.workspace.canCreate) {
        const form = el('form'), name = el('input'), go = btn('내 작업공간 만들기',true,'submit');
        form.className='tn-market-form'; name.required=true; name.minLength=2; name.maxLength=100;
        form.append(field('작업공간 이름',name),go);
        form.onsubmit=async e=>{
          e.preventDefault(); if (!active(s) || s.busy || !validText(name.value.trim(),100)) return;
          s.busy=true; go.disabled=true;
          try { await rpc(s,workspaceRpc,{p_name:name.value.trim()}); await load(s); s.message='내 작업공간을 불러왔습니다.'; }
          catch { if (active(s)) s.message='작업공간을 확인하지 못했습니다. 같은 화면에서 다시 확인해 주세요.'; }
          finally { s.busy=false; if(active(s)) render(s); }
        };
        panel.append(form);
      }
    } else {
      panel.append(el('h4',ws.displayName));
      if (!s.workspace.canManageLessons) panel.append(el('p','레슨 관리 기능은 아직 열리지 않았습니다.'));
      else if (pending(s)) {
        const retry = btn(pending(s).body?'같은 변경 요청 다시 확인':'저장 결과 확인',true);
        retry.onclick=()=>void mutate(s,null,true); panel.append(retry);
      } else if (editing) {
        const form=el('form'), title=el('input'), date=el('input'), time=el('input'), minutes=el('select');
        form.className='tn-market-form'; title.required=true; title.minLength=2; title.maxLength=80;
        date.type='date'; date.required=true; time.type='time'; time.required=true;
        for (const duration of [20,30,40]) { const n=el('option',duration+'분'); n.value=String(duration); minutes.append(n); }
        if (editing.id) {
          const p=Object.fromEntries(inputFmt.formatToParts(new Date(editing.startsAt)).map(x=>[x.type,x.value]));
          title.value=editing.title; date.value=`${p.year}-${p.month}-${p.day}`; time.value=`${p.hour}:${p.minute}`; minutes.value=String(editing.minutes);
        }
        const back=btn('목록으로'); back.onclick=()=>render(s);
        form.append(field('레슨 이름',title),field('날짜',date),field('시작 시간',time),field('수업 시간',minutes),btn('비공개 레슨 저장',true,'submit'),back);
        form.onsubmit=e=>{
          e.preventDefault(); const label=title.value.trim(), at=new Date(date.value+'T'+time.value+':00+09:00'), min=Number(minutes.value);
          if (!form.reportValidity() || !validText(label,80) || !Number.isFinite(at.valueOf()) || at<=new Date() ||
              at.valueOf()>Date.now()+30*86400000 || Number(time.value.slice(0,2))*60+Number(time.value.slice(3,5))+min>=1440) {
            status.textContent='레슨 이름과 30일 이내의 시간을 확인해 주세요. 자정을 넘길 수 없습니다.';return;
          }
          void mutate(s,{p_action:editing.id?'edit':'create',p_lesson:editing.id??null,p_revision:editing.revision??null,p_title:label,p_start:at.toISOString(),p_minutes:min});
        };
        panel.append(form);
      } else if (confirming) {
        panel.append(el('p',confirming.title+'을(를) 취소할까요? 레슨 기록은 남습니다.'));
        const yes=btn('레슨 취소 확인',true), no=btn('돌아가기');
        yes.onclick=()=>void mutate(s,{p_action:'cancel',p_lesson:confirming.id,p_revision:confirming.revision});
        no.onclick=()=>render(s); panel.append(yes,no);
      } else if (s.list) {
        const add=btn('비공개 레슨 추가',true); add.onclick=()=>render(s,{}); panel.append(add);
        if (!s.list.lessons.length) panel.append(el('p','아직 비공개 레슨이 없습니다.'));
        const list=el('ul');
        for (const lesson of s.list.lessons) {
          const li=el('li'); li.append(el('strong',lesson.title),el('p',fmt.format(new Date(lesson.startsAt))+' · '+lesson.minutes+'분 · '+(lesson.cancelled?'취소됨':'비공개')));
          if (!lesson.cancelled && new Date(lesson.startsAt)>new Date()) {
            const edit=btn('수정'), cancel=btn('취소'); edit.onclick=()=>render(s,lesson); cancel.onclick=()=>render(s,null,lesson);li.append(edit,cancel);
          }
          list.append(li);
        }
        panel.append(list);
        if (s.list.next) {
          const more=btn('더 보기'); more.onclick=async()=>{
            if (!active(s) || s.busy) return; s.busy=true; more.disabled=true;
            try { const p=await rpc(s,lessonRpc,{p_action:'list',p_after_start:s.list.next.startsAt,p_after_id:s.list.next.id});
              s.list={lessons:[...new Map([...s.list.lessons,...p.lessons].map(l=>[l.id,l])).values()],next:p.next}; }
            catch { s.message='다음 목록을 불러오지 못했습니다.'; }
            finally { s.busy=false; if(active(s))render(s); }
          };
          panel.append(more);
        }
      }
    }
    const again=btn('다시 불러오기'); again.onclick=async()=>{
      if (!active(s)||s.busy) return;s.busy=true;again.disabled=true;
      try { await load(s);s.message='최신 상태를 불러왔습니다.'; }
      catch { if(active(s)) { panel.hidden=true;last=''; } return; }
      finally { s.busy=false; }
      if(active(s)) render(s);
    };
    panel.append(again,status);panel.hidden=false;
  }
  async function update() {
    const who=identity(); if(who===last)return;
    last=who; const stamp=++generation;current=null;panel.hidden=true;panel.replaceChildren();if(!who)return;
    const s={who,generation:stamp,message:'',busy:false};
    try {
      const bytes=new TextEncoder().encode(who.split(':')[0]+':r4-dev-independent-selfserve');
      s.key='tennis-note-r4-independent-pending-'+Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
      await load(s);if(active(s)){current=s;render(s);}
    } catch { if(active(s)) panel.hidden=true; }
  }
  root.addEventListener('storage',event=>{
    if (active(current) && current.key===event.key && !current.busy) render(current);
    else void update();
  });
  root.addEventListener('focus',update); root.setInterval(update,1000); void update();
})(window, document);
