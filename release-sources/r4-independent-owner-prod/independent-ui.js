/* Production-only, opt-in, own independent workspace; no role or payment changes. */
(function(root,doc){
  'use strict';
  const client=root.TennisNoteDataClient,cfg=client?.loadConfig?.();
  if(root.location.origin!=='https://tennisnote-admin.pages.dev' || cfg?.environment!=='production' ||
    cfg.supabaseUrl!=='https://cnympiwrwgouuvhaivbc.supabase.co' ||
    cfg.projectFingerprint!=='3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a' ||
    !client?.rpc || !client.authStorageKey || !client.authPersistenceKey)return;
  const anchor=doc.getElementById('r4Onboarding');if(!anchor)return;
  const id=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
  function identity(){try{
    const pref=root.localStorage.getItem(client.authPersistenceKey);
    if(pref!==null&&pref!=='local'&&pref!=='session')return '';
    const store=pref==='session'?root.sessionStorage:root.localStorage;
    const value=JSON.parse(store.getItem(client.authStorageKey)||'null');
    const part=value?.access_token?.split('.')[1]?.replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(root.atob(part.padEnd(Math.ceil(part.length/4)*4,'=')));
    return claims.role==='authenticated'&&claims.exp*1000>Date.now()&&id.test(claims.sub)&&id.test(claims.session_id)?claims.sub+':'+claims.session_id:'';
  }catch{return '';}}
  const node=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
  const btn=(text,type='button')=>{const n=node('button',text);n.type=type;n.className=type==='submit'?'primary-button':'ghost-button';return n;};
  const label=(text,input)=>{const n=node('label',text+' ');n.append(input);return n;};
  const panel=node('section');panel.hidden=true;panel.className='operations-password-login-form';anchor.before(panel);
  const opts=Object.freeze({requireCurrentSession:true,retryAuth:false});
  let generation=0,busy=false,last='';
  const valid=(who,stamp)=>who&&identity()===who&&generation===stamp;
  async function call(who,stamp,args){if(!valid(who,stamp))throw Error('scope');const r=await client.rpc('tn_r4_prod_my_independent',args,opts);if(!valid(who,stamp))throw Error('scope');return r;}
  async function key(who,lane){const bytes=new TextEncoder().encode(who.split(':')[0]+':'+lane);const h=new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes));return 'tn-independent-prod:'+Array.from(h,x=>x.toString(16).padStart(2,'0')).join('');}
  function pending(k){const value=root.localStorage.getItem(k);if(value!==null&&!id.test(value))throw Error('pending');return value;}
  async function claim(k,who,stamp){return root.navigator.locks.request(k,{ifAvailable:true},lock=>{if(!lock||!valid(who,stamp)||pending(k))throw Error('pending');const op=root.crypto.randomUUID();root.localStorage.setItem(k,op);return op;});}
  function rolledBack(e){return e?.status===400&&['22023','23514'].includes(e.code)&&e?.payload?.code===e.code;}
  async function markRollback(k,op,who,stamp){return root.navigator.locks.request(k,()=>{if(!valid(who,stamp)||pending(k)!==op)throw Error('scope');const marker=root.localStorage.getItem(k+':rollback');if(marker!==null&&marker!==op)throw Error('marker');root.localStorage.setItem(k+':rollback',op);});}
  async function clear(k,op,who,stamp){return root.navigator.locks.request(k,()=>{const marker=root.localStorage.getItem(k+':rollback');if(!valid(who,stamp)||pending(k)!==op||(marker!==null&&marker!==op))throw Error('scope');root.localStorage.removeItem(k);if(marker===op)root.localStorage.removeItem(k+':rollback');});}
  async function refresh(who,stamp){
    const wk=await key(who,'workspace'),lk=await key(who,'lesson');if(!valid(who,stamp))return;
    const wo=pending(wk),lo=pending(lk),data=await call(who,stamp,{p_action:'read',p_operation:lo});
    if(data?.available!==true)return;
    if(wo&&data.workspace?.operation===wo)await clear(wk,wo,who,stamp);
    if(lo&&data.lesson?.id&&data.lesson.visibility==='private')await clear(lk,lo,who,stamp);
    if(wo&&root.localStorage.getItem(wk+':rollback')===wo&&data.workspace===null)await clear(wk,wo,who,stamp);
    if(lo&&root.localStorage.getItem(lk+':rollback')===lo&&data.lesson===null){
      const all=await call(who,stamp,{p_action:'read'});
      if(all?.available===true&&id.test(data.workspace?.id||'')&&all.workspace?.id===data.workspace.id&&all.lesson===null)await clear(lk,lo,who,stamp);
    }
    render(data,who,stamp,wk,lk);
  }
  function render(data,who,stamp,wk,lk){
    if(!valid(who,stamp))return;
    const status=node('p');status.setAttribute('role','status');const again=btn('상태 다시 확인');
    again.onclick=()=>{void refresh(who,stamp).catch(()=>{status.textContent='상태를 확인하지 못했습니다.';});};
    panel.replaceChildren(node('h3','독립 코치'),node('p','비공개 작업공간입니다. 공개·예약·결제는 시작되지 않습니다.'));
    if(!data.workspace){
      const start=btn('독립 코치로 시작');start.disabled=!!pending(wk);
      if(start.disabled)status.textContent='저장 결과가 확인될 때까지 다시 등록할 수 없습니다.';
      start.onclick=async()=>{if(busy||start.disabled||!valid(who,stamp))return;busy=true;start.disabled=true;again.disabled=true;let attempted=null;
        try{const op=attempted=await claim(wk,who,stamp),result=await call(who,stamp,{p_action:'register',p_operation:op});
          const read=await call(who,stamp,{p_action:'read'});if(!id.test(result?.workspace?.id||'')||read?.workspace?.id!==result.workspace.id||read.workspace.operation!==op)throw Error('unconfirmed');
          await clear(wk,op,who,stamp);render(read,who,stamp,wk,lk);
        }catch(e){if(valid(who,stamp)){if(attempted&&rolledBack(e))try{await markRollback(wk,attempted,who,stamp);await refresh(who,stamp);return;}catch{}status.textContent='다시 저장하지 말고 상태를 확인해 주세요.';again.disabled=false;}}finally{busy=false;}};
      panel.append(start,again,status);
    }else if(data.lesson){
      const l=data.lesson,when=new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(l.startsAt));
      panel.append(node('p',l.title+' · '+when+' · '+l.minutes+'분 · 비공개'),again,status);
    }else{
      const form=node('form'),title=node('input'),date=node('input'),time=node('input'),minutes=node('select');form.className='tn-market-form';
      title.required=true;title.minLength=2;title.maxLength=80;date.type='date';date.required=true;time.type='time';time.required=true;
      for(const n of [20,30,40]){const option=node('option',n+'분');option.value=String(n);minutes.append(option);}
      const save=btn('비공개 레슨 저장','submit');save.disabled=!!pending(lk);
      if(save.disabled)status.textContent='저장 결과가 확인될 때까지 다시 저장할 수 없습니다.';
      form.append(label('레슨 이름',title),label('날짜',date),label('시작 시간',time),label('수업 시간',minutes),save);
      form.onsubmit=async event=>{event.preventDefault();if(busy||save.disabled||!valid(who,stamp)||!form.reportValidity())return;
        const trimmed=title.value.trim();if(Array.from(trimmed).length<2||Array.from(trimmed).length>80||/[\x00-\x1f\x7f-\x9f]/.test(trimmed)){status.textContent='레슨 이름을 두 글자 이상 입력해 주세요.';return;}
        const start=new Date(date.value+'T'+time.value+':00+09:00'),pieces=/^(\d{2}):(\d{2})$/.exec(time.value);
        if(!pieces||!Number.isFinite(start.valueOf())||start<=new Date()||start.valueOf()>Date.now()+30*86400000||Number(pieces[1])*60+Number(pieces[2])+Number(minutes.value)>=1440){status.textContent='30일 이내, 자정을 넘지 않는 시간을 선택해 주세요.';return;}
        const payload={p_action:'save',p_title:trimmed,p_start:start.toISOString(),p_minutes:Number(minutes.value)};
        busy=true;save.disabled=true;again.disabled=true;let attempted=null;
        try{const op=attempted=await claim(lk,who,stamp);payload.p_operation=op;const saved=await call(who,stamp,payload);
          const read=await call(who,stamp,{p_action:'read',p_operation:op}),actual=read?.lesson;
          if(!id.test(saved?.lesson?.id||'')||actual?.id!==saved.lesson.id||actual.workspaceId!==data.workspace.id||actual.title!==payload.p_title||new Date(actual.startsAt).toISOString()!==payload.p_start||actual.minutes!==payload.p_minutes||actual.visibility!=='private')throw Error('unconfirmed');
          await clear(lk,op,who,stamp);render(read,who,stamp,wk,lk);
        }catch(e){if(valid(who,stamp)){if(attempted&&rolledBack(e))try{await markRollback(lk,attempted,who,stamp);await refresh(who,stamp);return;}catch{}status.textContent='다시 저장하지 말고 상태를 확인해 주세요.';again.disabled=false;}}finally{busy=false;}};
      panel.append(form,again,status);
    }
    panel.hidden=false;
  }
  function update(){const who=identity();if(who===last)return;last=who;const stamp=++generation;panel.hidden=true;panel.replaceChildren();if(who&&!busy)void refresh(who,stamp).catch(()=>{});}
  root.addEventListener('focus',update);doc.addEventListener('visibilitychange',update);root.setInterval(update,1000);update();
})(window,document);
