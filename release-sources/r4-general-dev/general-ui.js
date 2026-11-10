/* Seoul DEV candidate. Mounts within existing own-branch and seller panels. */
(function (root, doc) {
  'use strict';
  const client = root.TennisNoteDataClient;
  const cfg = client?.loadConfig?.();
  const local = root.location.origin === 'http://127.0.0.1:53872';
  if ((!local && root.location.origin !== 'https://tennisnote-admin-dev.pages.dev') ||
      cfg?.environment !== 'development' || cfg.supabaseUrl !== 'https://udjmiezroipctytmztwz.supabase.co' ||
      cfg.projectFingerprint !== '63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba') return;
  const hours = doc.getElementById('r4BranchHoursPanel');
  const branch = doc.getElementById('r4ManagedBranch');
  const seller = doc.getElementById('r4MarketSeller');
  if (!hours || !branch || !seller || !client?.rpc || !client?.authStorageKey || !client?.authPersistenceKey) return;
  const isUuid = x => typeof x === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
  const identity = () => {
    try {
      const pref=root.localStorage.getItem(client.authPersistenceKey);
      if(pref!==null && pref!=='local' && pref!=='session') return '';
      const store=pref==='session'?root.sessionStorage:root.localStorage;
      const session=JSON.parse(store.getItem(client.authStorageKey)||'null');
      const raw=session?.access_token?.split('.')[1]?.replace(/-/g,'+').replace(/_/g,'/');
      const x = JSON.parse(root.atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')));
      return x.role === 'authenticated' && x.exp * 1000 > Date.now() && isUuid(x.sub) && isUuid(x.session_id)
        ? x.sub + ':' + x.session_id : '';
    } catch { return ''; }
  };
  const node = (tag, value) => {
    const n = doc.createElement(tag);
    if (value) n.textContent = value;
    return n;
  };
  const control = (label, field) => { const n = node('label',label+' '); n.append(field); return n; };
  const button = (label, isSubmit) => {
    const n = node('button',label); n.type = isSubmit ? 'submit' : 'button';
    n.className = isSubmit ? 'primary-button' : 'ghost-button'; return n;
  };
  const options = Object.freeze({requireCurrentSession:true,retryAuth:false});
  const roster = node('section'), lesson = node('section');
  roster.hidden = lesson.hidden = true;
  roster.className = lesson.className = 'operations-password-login-form';
  roster.dataset.r4DevGeneralRoster = ''; lesson.dataset.r4DevIndependentLesson = '';
  hours.append(roster); seller.append(lesson);
  let generation = 0, busy = false, refreshed = false, refreshAfterWrite = false;
  function matches(who, stamp, id) {
    return !!who && identity() === who && stamp === generation && (!id || branch.value === id && !hours.hidden);
  }
  async function call(which,args,who,stamp,id) {
    if (!matches(who,stamp,id)) throw Error('session changed');
    const r = await client.rpc(which,args,options);
    if (!matches(who,stamp,id)) throw Error('session changed');
    return r;
  }
  const showStatus = () => { const p = node('p'); p.setAttribute('role','status'); return p; };
  const readRoster = (who,stamp,id,op=null) => call('tn_r4_dev_my_general_roster',{p_branch:id,p_action:'list',p_operation:op},who,stamp,id);
  const readLesson = (who,stamp,op=null) => call('tn_r4_dev_my_first_private_lesson',{p_action:'read',p_operation:op},who,stamp);
  async function trackingKey(who,lane) {
    const data=new TextEncoder().encode(who.split(':')[0]+':'+lane);
    const hash=new Uint8Array(await root.crypto.subtle.digest('SHA-256',data));
    return 'r4-dev-split:'+Array.from(hash,v=>v.toString(16).padStart(2,'0')).join('');
  }
  function pending(key) {
    const op=root.localStorage.getItem(key);
    if(op!==null&&!isUuid(op))throw Error('invalid pending operation');
    return op;
  }
  async function claim(key,current) {
    return root.navigator.locks.request(key,{ifAvailable:true},lock=>{
      if(!lock||!current()||pending(key))throw Error('pending operation');
      const op=root.crypto.randomUUID();root.localStorage.setItem(key,op);return op;
    });
  }
  function confirmedRollback(key,op) { return root.localStorage.getItem(key+':rollback')===op; }
  async function markRollback(key,op,current) {
    return root.navigator.locks.request(key,()=>{if(!current() || pending(key)!==op)throw Error('scope changed');const prior=root.localStorage.getItem(key+':rollback');if(prior!==null&&prior!==op)throw Error('rollback marker conflict');root.localStorage.setItem(key+':rollback',op);if(!confirmedRollback(key,op))throw Error('rollback marker unconfirmed');});
  }
  async function clear(key,op,current) {
    return root.navigator.locks.request(key,()=>{const marker=root.localStorage.getItem(key+':rollback');if(!current() || pending(key)!==op || (marker!==null&&marker!==op))throw Error('scope changed');root.localStorage.removeItem(key);if(marker===op)root.localStorage.removeItem(key+':rollback');});
  }
  const rolledBack = e => e?.status===400 && ['22023','23514'].includes(e.code) && e?.payload?.code===e.code;
  async function refreshRoster(who,stamp,id,key) {
    const op=pending(key), data=await readRoster(who,stamp,id,op);
    if(op && ((isUuid(data?.addedId)&&data?.rows?.some(x=>x.id===data.addedId)) || (data?.branchId===id && data.addedId===null && Array.isArray(data.rows) && confirmedRollback(key,op))))await clear(key,op,()=>matches(who,stamp,id));
    showRoster(data,who,stamp,id,key);
  }
  async function refreshLesson(who,stamp,key) {
    const op=pending(key), data=await readLesson(who,stamp,op);
    if(op && ((isUuid(data?.lesson?.id)&&data.lesson.visibility==='private') || (data?.available===true && data.lesson===null && confirmedRollback(key,op))))await clear(key,op,()=>matches(who,stamp));
    showLesson(data,who,stamp,key);
  }
  function showRoster(data,who,stamp,id,key,message='') {
    if (!matches(who,stamp,id) || data?.branchId !== id || !Array.isArray(data.rows)) return;
    const heading=node('h3','코치·직원'), status=showStatus(), list=node('ul');
    const form=node('form'); form.className='tn-market-form';
    for (const item of data.rows) if (isUuid(item?.id)&&typeof item.name==='string') list.append(node('li',item.name));
    const select=node('input'); select.type='text'; select.required=true; select.minLength=2; select.maxLength=60;
    const add=button('코치 추가',true), again=button('명단 다시 조회',false);
    const unresolved=pending(key);
    status.textContent=message || (unresolved?'미확정 등록의 결과만 확인할 수 있습니다.':'코치 명단 '+data.rows.length+'명');
    again.addEventListener('click',async()=>{try{await refreshRoster(who,stamp,id,key);}catch{status.textContent='명단을 확인하지 못했습니다.';}});
    add.disabled = !!unresolved;
    form.append(control('코치 이름',select),add);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(busy||add.disabled||!matches(who,stamp,id))return;
      const name=select.value.trim(); if(name.length<2 || name.length>60 || /[\x00-\x1f\x7f]/.test(name)) return;
      busy=true; add.disabled=true; again.disabled=true; let attempted=null;
      try {
        const op=attempted=await claim(key,()=>matches(who,stamp,id));
        const result=await call('tn_r4_dev_my_general_roster',{p_branch:id,p_action:'add',p_name:name,p_operation:op},who,stamp,id);
        const current=await readRoster(who,stamp,id,op);
        if(!isUuid(result?.addedId)||result.addedId!==current?.addedId||
          !current?.rows?.some(x=>x.id===result.addedId&&x.name===name))throw Error('unconfirmed');
        await clear(key,op,()=>matches(who,stamp,id));
        showRoster(current,who,stamp,id,key,'코치 등록 확인 · 총 '+current.rows.length+'명');
      } catch(e) { if(matches(who,stamp,id)){
        if(attempted && rolledBack(e)) try {await markRollback(key,attempted,()=>matches(who,stamp,id));const r=await readRoster(who,stamp,id,attempted);
          if(r?.branchId===id && r.addedId===null && Array.isArray(r.rows) && pending(key)===attempted){await clear(key,attempted,()=>matches(who,stamp,id));showRoster(r,who,stamp,id,key,'서버가 저장을 거절했습니다. 내용을 확인한 뒤 다시 입력해 주세요.');return;}
        } catch {}
        status.textContent='다시 저장하지 말고 명단을 다시 조회해 주세요.';again.disabled=false;} }
      finally {busy=false;if(refreshAfterWrite){refreshAfterWrite=false;later();}}
    });
    roster.replaceChildren(heading,list,form,again,status);roster.hidden=false;
  }
  function showLesson(data,who,stamp,key,message='') {
    if(!matches(who,stamp)||data?.available!==true)return;
    const status=showStatus(), existing=data.lesson;
    const heading=node('h3','독립 코치 · 첫 비공개 레슨');
    const again=button('레슨 다시 조회',false);
    const unresolved=pending(key);
    status.textContent=message || (unresolved?'미확정 레슨의 결과만 확인할 수 있습니다.':'');
    again.addEventListener('click',async()=>{try{await refreshLesson(who,stamp,key);}catch{status.textContent='레슨을 확인하지 못했습니다.';}});
    lesson.replaceChildren(heading,node('p','나만 볼 수 있습니다. 공개·예약·결제는 열리지 않습니다.'));
    if(existing) {
      const when=new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(existing.startsAt));
      lesson.append(node('p',existing.title+' · '+when+' · '+existing.minutes+'분 · 비공개'),again,status);
    } else {
      const form=node('form');form.className='tn-market-form';
      const title=node('input');title.required=true;title.minLength=2;title.maxLength=80;
      const date=node('input');date.type='date';date.required=true;
      const time=node('input');time.type='time';time.required=true;
      const minutes=node('select');
      for(const n of [20,30,40]){const opt=node('option',n+'분');opt.value=String(n);minutes.append(opt);}
      const save=button('비공개 레슨 저장',true);
      save.disabled=!!unresolved;
      form.append(control('레슨 이름',title),control('날짜 (한국시간)',date),control('시작 시간',time),control('수업 시간',minutes),save);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy||save.disabled||!matches(who,stamp)||!form.reportValidity())return;
        const start=new Date(date.value+'T'+time.value+':00+09:00');
        const parts=/^(\d{2}):(\d{2})$/.exec(time.value), m=parts?Number(parts[1])*60+Number(parts[2]):NaN;
        if(!Number.isFinite(start.valueOf()) || start<=new Date() || start.valueOf()>Date.now()+30*86400000 || !Number.isFinite(m) || m+Number(minutes.value)>=1440){status.textContent='30일 이내이며 자정을 넘지 않는 수업 시간을 선택해 주세요.';return;}
        const payload={p_action:'save',p_title:title.value.trim(),
          p_start:start.toISOString(),p_minutes:Number(minutes.value)};
        busy=true;save.disabled=true;again.disabled=true;let attempted=null;
        try{
          const op=attempted=await claim(key,()=>matches(who,stamp));payload.p_operation=op;
          const saved=await call('tn_r4_dev_my_first_private_lesson',payload,who,stamp);
          const check=await readLesson(who,stamp,op), actual=check?.lesson;
          if(!isUuid(saved?.lesson?.id)||saved.lesson.id!==actual?.id||saved.lesson.workspaceId!==actual.workspaceId||
            actual.title!==payload.p_title||new Date(actual.startsAt).toISOString()!==payload.p_start||
            actual.minutes!==payload.p_minutes||actual.visibility!=='private')throw Error('unconfirmed');
          await clear(key,op,()=>matches(who,stamp));
          showLesson(check,who,stamp,key,'비공개 레슨 저장과 재조회를 확인했습니다.');
        }catch(e){if(matches(who,stamp)){
          if(attempted && rolledBack(e)) try {await markRollback(key,attempted,()=>matches(who,stamp));const r=await readLesson(who,stamp,attempted);
            if(r?.available===true && r.lesson===null && pending(key)===attempted){await clear(key,attempted,()=>matches(who,stamp));showLesson(r,who,stamp,key,'서버가 저장을 거절했습니다. 내용을 확인한 뒤 다시 입력해 주세요.');return;}
          } catch {}
          status.textContent='다시 저장하지 말고 레슨을 다시 조회해 주세요.';again.disabled=false;}}
        finally{busy=false;if(refreshAfterWrite){refreshAfterWrite=false;later();}}
      });
      lesson.append(form,again,status);
    }
    if (seller.hidden) { seller.before(lesson); } // DEV QA lease can exist without marketplace access.
    lesson.hidden=false;
  }
  async function sync() {
    const who=identity(), id=branch.value, stamp=++generation;
    roster.hidden=lesson.hidden=true; roster.replaceChildren();lesson.replaceChildren();
    if(busy){refreshAfterWrite=true;return;}
    if(!who)return;
    const scopes=[];
    if(!hours.hidden&&isUuid(id))scopes.push(trackingKey(who,id).then(key=>refreshRoster(who,stamp,id,key)));
    scopes.push(trackingKey(who,'lesson').then(key=>refreshLesson(who,stamp,key)));
    await Promise.allSettled(scopes);
  }
  function later(){if(!refreshed){refreshed=true;root.setTimeout(()=>{refreshed=false;void sync();},0);}}
  branch.addEventListener('change',later);
  const observer=new MutationObserver(later);
  observer.observe(hours,{attributes:true,attributeFilter:['hidden']});
  observer.observe(seller,{attributes:true,attributeFilter:['hidden']});
  doc.addEventListener('visibilitychange',later);root.addEventListener('focus',later);
  root.addEventListener('storage',event=>{if(event.key?.startsWith('r4-dev-split:') && !busy)later();});
  let last='';
  root.setInterval(()=>{const now=identity();if(now!==last){last=now;later();}},600);
  later();
})(window,document);
