/* BRANCH-02: 기존 지점 운영 설정 안에만 표시. 로그인·정산 계산·결제는 건드리지 않는다. */
(function (root, doc) {
  'use strict';
  const client = root.TennisNoteDataClient;
  const config = client?.loadConfig?.();
  const targets = {
    'https://tennisnote-admin-dev.pages.dev': ['development','udjmiezroipctytmztwz','63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'],
    'https://tennisnote-admin.pages.dev': ['production','cnympiwrwgouuvhaivbc','3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'],
  };
  const target=targets[root.location.origin];
  if (!target || config?.environment!==target[0] || config?.supabaseUrl!==`https://${target[1]}.supabase.co` || config?.projectFingerprint!==target[2]) return;
  const section=doc.getElementById('r4BranchHoursPanel'), branch=doc.getElementById('r4ManagedBranch');
  if (!section || !branch || !client?.rpc || !client.sessionSubject) return;
  const el=(tag,text)=>{const n=doc.createElement(tag);if(text)n.textContent=text;return n;};
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
  const auth={requireCurrentSession:true,retryAuth:false};
  const call=(name,args)=>client.rpc(name,args,auth);
  const wrap=el('details'), body=el('div');
  wrap.hidden=true;wrap.append(el('summary','코치 정산 기준'),body);section.append(wrap);
  let binding='', generation=0, pending=null;
  const scope=()=>section.hidden?'':`${client.sessionSubject()||''}/${branch.value}`;
  const sync=()=>{if(scope()===binding)return; binding=scope(); ++generation; pending=null; wrap.open=false;body.replaceChildren();wrap.hidden=!uuid(branch.value)||!client.sessionSubject()||section.hidden;};
  branch.addEventListener('change',sync);
  new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['hidden']});
  root.setInterval(sync,300);
  sync();
  wrap.addEventListener('toggle',async()=>{
    const stamp=++generation;
    body.replaceChildren();
    const branchId=branch.value, who=client.sessionSubject();
    const current=()=>wrap.open&&stamp===generation&&who===client.sessionSubject()&&branchId===branch.value&&!section.hidden;
    if(!who||!uuid(branchId)||!current())return;
    const status=el('p','코치 명단 확인 중');status.setAttribute('role','status');body.append(status);
    let roster;
    try{roster=await call('tn_r4_list_scoped_coach_roster',{p_branch:branchId});}
    catch{if(current())status.textContent='이 지점의 코치 명단을 확인할 수 없습니다.';return;}
    if(!current())return;
    const rows=roster?.branchId===branchId&&Array.isArray(roster.rows)?roster.rows.filter(x=>x.linked===true&&uuid(x.id)):[];
    if(!rows.length){status.textContent='먼저 코치 계정을 연결해 주세요.';return;}
    const coach=el('select'), type=el('select'), value=el('input'), date=el('input'), save=el('button','설정 저장');
    const label=(text,input)=>{const x=el('label',text+' ');input.setAttribute('aria-label',text);x.append(input);return x;};
    const option=(v,text)=>{const x=el('option',text);x.value=v;return x;};
    coach.append(option('','코치 선택'),...rows.map(x=>option(x.id,x.name)));
    type.append(option('hourly','시간당 금액'),option('ratio','수납액 비율 (%)'));
    value.type='number';value.min='0';value.step='0.01';date.type='date';save.type='button';save.className='primary-button';save.disabled=true;
    body.prepend(label('코치',coach),label('계산 방법',type),label('금액 또는 비율',value),label('적용일',date),
      el('p','한국시간 내일부터 적용됩니다. 기존 수업 정산과 지급 기록은 바뀌지 않습니다.'),save);
    status.textContent='코치를 선택해 주세요.';
    let readVersion=0, busy=false, allowed=false;
    coach.addEventListener('change',async()=>{
      const stampRead=++readVersion, coachId=coach.value;allowed=false;save.disabled=true;
      if(!uuid(coachId)||!current())return;
      try{
        const r=await call('tn_r4_branch_settlement_term',{p_branch:branchId,p_coach:coachId,p_action:'read'});
        if(!current()||readVersion!==stampRead||coach.value!==coachId)return;
        if(r?.branchId!==branchId||r.coachId!==coachId)throw Error('receipt');
        status.textContent=r.termId?`기존 기준 적용일: ${r.effectiveFrom}`:'등록된 기준이 없습니다.';
        allowed=true;save.disabled=busy;
      }catch{if(current()&&readVersion===stampRead)status.textContent='이 코치의 정산 기준을 설정할 수 없습니다.';}
    });
    save.addEventListener('click',async()=>{
      if(busy||!allowed||!current())return;
      const coachId=coach.value, method=type.value, start=date.value, amount=Number(value.value), readStamp=readVersion;
      if(!uuid(coachId)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d+(?:\.\d{1,2})?$/.test(value.value)||
        (method==='hourly'?!(Number.isInteger(amount)&&amount>0&&amount<=2147483647):!(amount>=0&&amount<=100))) {
        status.textContent='금액 또는 비율과 적용일을 확인해 주세요.';return;
      }
      const same=()=>current()&&coachId===coach.value&&readVersion===readStamp;
      const input={p_branch:branchId,p_coach:coachId,p_action:'save',p_type:method,p_start:start,
        p_hourly:method==='hourly'?amount:null,p_ratio:method==='ratio'?Number((amount/100).toFixed(4)):null};
      const key=JSON.stringify([who,input]);
      if(pending?.key!==key)pending={key,op:root.crypto.randomUUID()};
      busy=true; save.disabled=true; status.textContent='저장 확인 중';
      try {
        const r=await call('tn_r4_branch_settlement_term',{...input,p_operation:pending.op});
        if(!same())return;
        const after=await call('tn_r4_branch_settlement_term',{p_branch:branchId,p_coach:coachId,p_action:'read',p_start:start});
        if(!same())return;
        if(!uuid(r?.termId)||after?.termId!==r.termId||after?.branchId!==branchId||after?.coachId!==coachId||after?.effectiveFrom!==start||
           after?.type!==method||(method==='hourly'?Number(after.hourly)!==amount:Number(after.ratio)!==input.p_ratio)) throw Error('receipt');
        pending=null;status.textContent=`정산 기준 저장 확인 · ${start}부터`;
      }catch{if(same())status.textContent='저장 결과를 확인하지 못했습니다. 같은 값으로 다시 확인해도 중복 저장되지 않습니다.';}
      finally{busy=false;if(current())save.disabled=!allowed;}
    });
  });
})(window, document);
