(function install(root, doc) {
  'use strict';
  const select=doc.getElementById('r4ManagedBranch'), host=doc.getElementById('r4BranchHoursPanel');
  if(!select||!host)return;
  const labels=[['name','상품 이름'],['sessions','총 횟수'],['minutes','수업 시간(분)'],['days','이용 기간(일)'],['price','가격(원)']];
  const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
  let revision=0, section=null, port=null, listeners=null, demoted=null;
  function close(){
    revision++;const oldPort=port;port=null;listeners?.abort();listeners=null;
    section?.remove();section=null;
    if(demoted){demoted.classList.remove('ghost-button');demoted.classList.add('primary-button');demoted=null;}
    oldPort?.close();
  }
  select.addEventListener('change',close);
  const hoursForm=doc.getElementById('r4BranchHoursForm');
  if(hoursForm)new MutationObserver(()=>{if(hoursForm.hidden)close();}).observe(hoursForm,{attributes:true,attributeFilter:['hidden']});
  const el=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
  function currentSession(client,expectedActor){
    try{
      if(typeof client?.authStorageKey!=='string'||typeof client?.authPersistenceKey!=='string')return null;
      const persistence=root.localStorage.getItem(client.authPersistenceKey);
      if(persistence!==null&&persistence!=='local'&&persistence!=='session')return null;
      const store=persistence==='session'?root.sessionStorage:root.localStorage;
      const token=JSON.parse(store.getItem(client.authStorageKey)||'null')?.access_token;
      const jwt=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const c=JSON.parse(root.atob(jwt.padEnd(Math.ceil(jwt.length/4)*4,'=')));
      return c.sub===expectedActor&&uuid(c.sub)&&uuid(c.session_id)?{subject:c.sub,sessionId:c.session_id}:null;
    }catch{return null;}
  }
  async function open({client,branchId,expectedActor,currentContext}){
    close();const stamp=revision;
    const config=()=>root.TennisNoteDataClient?.loadConfig?.()||root.TENNISNOTE_CONFIG||{};
    const env=()=>root.location.origin==='https://r4-product-draft-qa.tennisnote-admin-dev.pages.dev'&&
      config().environment==='development'&&config().supabaseUrl==='https://udjmiezroipctytmztwz.supabase.co';
    const readContext=()=>stamp===revision&&env()&&select.value===branchId&&currentContext?.()===true?
      {origin:root.location.origin,projectFingerprint:config().projectFingerprint,branchId,...currentSession(client,expectedActor)}:null;
    const first=readContext();
    if(!first?.subject)return false;
    try{
      const {bindDevPrivateCatalog}=await import('./dev-private-catalog-admin-port.js?__PORT_HASH__');
      if(!readContext()||stamp!==revision)return false;
      const bound=bindDevPrivateCatalog({client,branchId,readContext,onInvalidate:()=>{if(stamp===revision)close();}});
      port=bound;
      const alive=()=>stamp===revision&&!!readContext()&&port===bound;
      const initial=await bound.list();
      if(!alive())return false;
      const storePrefix='tennis-note-r4-private-catalog-pending-v2:'+first.subject+':'+branchId+':';
      let busy=false, pending=null, blocked=false, rows=initial;
      const card=el('section');card.id='r4ProductDraftHost';card.setAttribute('aria-label','상품 설정 초안');
      const title=el('h2','상품 정보 초안'), note=el('p','지점 내부용입니다. 공개 판매·결제·회원권 발급은 하지 않습니다.');
      const form=el('form');form.className='operations-password-login-form';
      const fields=Object.fromEntries(labels.map(([key,label])=>{
        const wrap=el('label',label), field=el('input');field.required=true;field.name=key;
        field.type=key==='name'?'text':'number';
        if(key==='name')field.maxLength=100;else{field.min=key==='price'?'0':'1';field.step='1';}
        wrap.append(field);form.append(wrap);return [key,field];
      }));
      const save=el('button','상품 초안 저장');save.type='submit';save.className='primary-button';
      const recover=el('button','결과 다시 확인');recover.type='button';recover.className='ghost-button';
      const status=el('p');status.setAttribute('role','status');
      const list=el('ul');list.setAttribute('aria-label','비공개 상품 초안');
      form.append(save,recover,status);card.append(title,note,form,list);
      const remember=entry=>{
        const key=storePrefix+entry.operationId;
        const text=JSON.stringify({kind:entry.kind,draftId:entry.draftId,operationId:entry.operationId});
        root.localStorage.setItem(key,text);
        if(root.localStorage.getItem(key)!==text)throw Error('pointer_write_failed');
        pending=entry;
      };
      const same=(x,y)=>labels.every(([k])=>x?.[k]===y?.[k]);
      function render(){
        save.disabled=busy||!!pending||blocked;recover.hidden=!pending;recover.disabled=busy||blocked;
        list.replaceChildren();
        for(const row of rows){
          const li=el('li',row.terms.name+' · '+row.terms.sessions+'회 · '+row.terms.minutes+'분 · '+row.terms.days+'일 · '+
            row.terms.price.toLocaleString('ko-KR')+'원 · '+(row.registrationId?'내부 등록 완료':'비공개 초안'));
          if(!row.registrationId){
            const b=el('button','내부 등록');b.type='button';b.className='ghost-button';b.disabled=save.disabled;
            b.addEventListener('click',()=>act('register',row));li.append(b);
          }
          list.append(li);
        }
      }
      async function readBack(){
        const next=await bound.list();if(!alive())return;
        rows=next;
        const match=rows.find(r=>r.draftId===pending?.draftId&&(!pending.terms||same(r.terms,pending.terms))&&
          (pending.kind==='save'||r.registrationId));
        if(match){
          const other=pending.kind==='register'&&match.registrationId!==pending.operationId;
          root.localStorage.removeItem(storePrefix+pending.operationId);pending=null;
          form.reset();status.textContent=other?'다른 요청에서 먼저 내부 등록했습니다.':'저장된 결과를 확인했습니다.';
        }else status.textContent='결과가 확인되지 않았습니다. 다시 저장하지 말고 결과를 확인해 주세요.';
      }
      async function act(kind,row){
        if(!alive()||busy||pending||blocked)return;
        busy=true;
        try{
          if(loadPointer()){await readBack();return;}
          const t=kind==='register'?row.terms:Object.fromEntries(labels.map(([k])=>[k,k==='name'?fields[k].value.trim():Number(fields[k].value)]));
          if(kind==='save'&&(!form.reportValidity()||!t.name||[...t.name].length>100||
            labels.slice(1).some(([k])=>!/^\d+$/.test(fields[k].value)||!Number.isSafeInteger(t[k])||
              t[k]<(k==='price'?0:1)||(k!=='price'&&t[k]>2147483647)))){
            status.textContent='상품 이름·횟수·시간·기간·가격을 확인해 주세요.';return;
          }
          const draftId=kind==='save'?root.crypto.randomUUID():row.draftId, operationId=kind==='register'?root.crypto.randomUUID():draftId;
          remember({kind,draftId,operationId,terms:t});render();
          try{if(kind==='save')await bound.save(draftId,t);else await bound.register(draftId,operationId,t);}
          catch{ /* only exact read-back below; no second write */ }
          if(alive())await readBack();
        }catch{if(alive())status.textContent='작업 결과를 확인하지 못했습니다.';}
        finally{busy=false;if(alive())render();}
      }
      function loadPointer(){
        for(let i=0;i<root.localStorage.length;i++){
          const key=root.localStorage.key(i);
          if(!key?.startsWith(storePrefix))continue;
          const raw=root.localStorage.getItem(key);
          if(raw===null)continue;
          const r=JSON.parse(raw);
          if(!['save','register'].includes(r?.kind)||!uuid(r.draftId)||!uuid(r.operationId)||
            key!==storePrefix+r.operationId||(r.kind==='save')!==(r.draftId===r.operationId)){
            blocked=true;throw Error('pointer_invalid');
          }
          pending=r;return true;
        }
        return false;
      }
      form.addEventListener('submit',e=>{e.preventDefault();void act('save');});
      recover.addEventListener('click',async()=>{
        if(busy||!pending||!alive())return;busy=true;render();
        try{await readBack();}catch{if(alive())status.textContent='결과를 다시 확인하지 못했습니다.';}
        finally{busy=false;if(alive())render();}
      });
      section=card;host.append(card);render();
      const hoursSave=hoursForm?.querySelector('button[type="submit"].primary-button:not(.ghost-button)');
      if(hoursSave){hoursSave.classList.remove('primary-button');hoursSave.classList.add('ghost-button');demoted=hoursSave;}
      try{if(loadPointer()){render();recover.click();}}
      catch{blocked=true;status.textContent='이전 작업 정보를 확인할 수 없습니다.';render();}
      listeners=new AbortController();
      const hideIfChanged=()=>{const c=readContext();if(!c||c.subject!==first.subject||c.sessionId!==first.sessionId)close();};
      for(const e of ['storage','pageshow','focus'])root.addEventListener(e,hideIfChanged,{signal:listeners.signal});
      return true;
    }catch{if(stamp===revision)close();return false;}
  }
  root.TennisNoteR4ProductDraftHost=Object.freeze({open,close});
})(window,document);
