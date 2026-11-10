(function(root,document){
  "use strict";
  const origin="https://tennisnote-admin.pages.dev";
  const api="https://cnympiwrwgouuvhaivbc.supabase.co";
  const fingerprint="3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a";
  const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  const opKey="tennis-note-r4-pending-registration-last-op";
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const identity=()=>{
    try{
      const client=root.TennisNoteDataClient,cfg=client?.loadConfig?.();
      if(root.location.origin!==origin||cfg?.environment!=="production"||cfg.supabaseUrl!==api||
        cfg.projectFingerprint!==fingerprint||!cfg.supabasePublishableKey||
        typeof operationsRole!=="function"||operationsRole()!=="admin"||
        typeof activeOperationBranchId!=="function") return null;
      const branch=activeOperationBranchId(),token=client.getSession()?.access_token;
      const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
      const c=JSON.parse(root.atob(p.padEnd(Math.ceil(p.length/4)*4,"=")));
      if(!uuid.test(branch)||!uuid.test(c.sub)||!uuid.test(c.session_id)||
        c.role!=="authenticated"||!Number.isFinite(c.exp)||c.exp*1000<=Date.now())return null;
      return {branch,token,key:cfg.supabasePublishableKey,subject:c.sub,session:c.session_id};
    }catch{return null;}
  };
  function mount(){
    const anchor=document.querySelector("#addMemberButton"),view=document.querySelector("#membersView");
    if(!anchor||!view||document.querySelector("[data-r4-pending-registration]"))return;
    const box=el("details");box.dataset.r4PendingRegistration="";box.hidden=true;
    const summary=el("summary","대기 회원 등록");summary.className="ghost-button";
    const form=el("form"),name=el("input"),coach=el("select"),save=el("button","대기 회원 저장");
    const read=el("button","저장 결과 다시 조회"),status=el("p"),tip=el("p","회원권·결제·수업 일정은 만들지 않습니다.");
    name.maxLength=50;name.minLength=2;name.required=true;name.autocomplete="off";
    coach.required=true;save.type="submit";read.type="button";status.setAttribute("role","status");
    const nl=el("label","회원 이름 "),cl=el("label","담당 코치 ");
    nl.append(name);cl.append(coach);form.append(tip,nl,cl,save,read,status);box.append(summary,form);anchor.after(box);
    let seen=null,busy=false,allowed=false,serial=0,lastOp=null,confirmedOp=null,hold=false;
    function current(initial){
      const n=identity();return n&&initial&&n.branch===initial.branch&&n.subject===initial.subject&&n.session===initial.session?n:null;
    }
    function render(){
      save.disabled=!allowed||busy||hold||!uuid.test(coach.value);
      read.disabled=!allowed||busy||!lastOp;
    }
    async function rpc(initial,action,operation=null,n=null,c=null){
      const a=current(initial);if(!a)throw Error("context_changed");
      const reply=await root.fetch(api+"/rest/v1/rpc/tn_r4_prod_pending_member_registration",{
        method:"POST",credentials:"omit",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),
        headers:{apikey:a.key,Authorization:"Bearer "+a.token,"Content-Type":"application/json"},
        body:JSON.stringify({p_action:action,p_branch:a.branch,p_name:n,p_coach:c,p_operation:operation})
      });
      if(!reply.ok||!current(initial))throw Error("request_failed");
      const body=await reply.json();if(!current(initial))throw Error("context_changed");return body;
    }
    const scopedKey=a=>opKey+":"+a.branch+":"+a.subject;
    const stored=a=>{try{const n=root.localStorage.getItem(scopedKey(a));return uuid.test(n)?n:null;}catch{return null;}};
    async function claim(ctx){
      if(!root.navigator.locks?.request)throw Error("tracking_unavailable");
      return root.navigator.locks.request(scopedKey(ctx),{ifAvailable:true},lock=>{
        if(!lock||!current(ctx))return null;
        const previous=stored(ctx);
        if(previous&&previous!==confirmedOp){
          lastOp=previous;hold=true;
          status.textContent="다른 탭의 등록 결과를 먼저 조회하세요.";
          return null;
        }
        const next=root.crypto.randomUUID();
        root.localStorage.setItem(scopedKey(ctx),next);
        return next;
      });
    }
    function show(ctx,operation,result){
      if(!current(ctx)||lastOp!==operation||stored(ctx)!==operation){
        const latest=stored(ctx);
        if(current(ctx)&&latest){lastOp=latest;hold=true;status.textContent="최신 등록 결과를 먼저 조회하세요.";}
        return;
      }
      if(!result||!uuid.test(result.memberId)||typeof result.name!=="string")throw Error("not_confirmed");
      if(result.status!=="pending"||result.hasTicket!==false)throw Error("unexpected_state");
      status.textContent=result.name+" · 대기 등록 확인 · 회원권 없음";
      confirmedOp=operation;hold=false;name.value="";
    }
    async function refresh(){
      const initial=identity(),seq=++serial;
      if(!initial||view.hidden||!view.getClientRects().length){box.hidden=true;allowed=false;render();return;}
      if(seen&&!current(seen)){box.open=false;box.hidden=true;allowed=false;name.value="";status.textContent="";lastOp=null;confirmedOp=null;hold=false;}
      seen=initial;
      if(allowed&&!box.hidden)return;
      try{
        const list=await rpc(initial,"coaches");
        if(seq!==serial||!current(initial)||!Array.isArray(list)||!list.length||
          !list.every(x=>uuid.test(x.id)&&typeof x.label==="string"))return;
        coach.replaceChildren();
        const blank=el("option","선택");blank.value="";coach.append(blank);
        for(const c of list){const o=el("option",c.label);o.value=c.id;coach.append(o);}
        if(!lastOp&&(lastOp=stored(initial))){hold=true;status.textContent="이전 등록 결과를 먼저 조회하세요.";}
        allowed=true;box.hidden=false;render();
      }catch{if(seq===serial){allowed=false;box.hidden=true;render();}}
    }
    coach.addEventListener("change",render);
    form.addEventListener("submit",async e=>{
      e.preventDefault();if(save.disabled||!form.reportValidity()||!current(seen))return;
      const ctx=seen,n=name.value.trim(),c=coach.value;
      if(n.length<2||n.length>50||!uuid.test(c))return;
      busy=true;render();
      let operation=null;
      try{
        operation=await claim(ctx);
        if(!operation){
          const prev=stored(ctx);
          if(prev&&prev!==lastOp){lastOp=prev;hold=true;status.textContent="다른 탭의 등록 결과를 먼저 조회하세요.";}
          return;
        }
        lastOp=operation;hold=true;
        await rpc(ctx,"save",operation,n,c);show(ctx,operation,await rpc(ctx,"read",operation));
      }catch{if(current(ctx))status.textContent=operation
        ?"결과가 확실하지 않습니다. 다시 저장하지 말고 결과를 조회하세요."
        :"결과 추적을 준비할 수 없어 저장을 시작하지 않았습니다.";}
      finally{busy=false;render();}
    });
    read.addEventListener("click",async ()=>{
      if(read.disabled||!current(seen))return;
      const ctx=seen,operation=lastOp;busy=true;render();
      try{show(ctx,operation,await rpc(ctx,"read",operation));}
      catch{if(current(ctx))status.textContent="저장 결과를 확인하지 못했습니다. 중복 방지를 위해 새 저장을 보류하세요.";}
      finally{busy=false;render();}
    });
    const refreshLater=()=>root.setTimeout(()=>void refresh(),0);
    new MutationObserver(refreshLater).observe(view,{attributes:true,attributeFilter:["hidden","class","aria-hidden"]});
    const shell=document.querySelector("#adminAppShell");
    if(shell)new MutationObserver(refreshLater).observe(shell,{attributes:true,attributeFilter:["hidden","class","aria-hidden"]});
    document.addEventListener("visibilitychange",refreshLater);
    root.addEventListener("focus",refreshLater);
    root.addEventListener("storage",e=>{
      if(seen&&e.key===scopedKey(seen)&&uuid.test(e.newValue)&&e.newValue!==lastOp&&!busy){
        lastOp=e.newValue;hold=true;status.textContent="다른 탭의 등록 결과를 먼저 조회하세요.";render();
      }
    });
    document.addEventListener("click",e=>{if(e.target.closest("[data-view='members'],[data-member-payment-view]"))refreshLater();});
    refreshLater();render();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})(window,document);
