/* 지점 운영 설정의 비공개 수납 등록. 실제 결제 호출 없음. */
(function(root,doc){
 'use strict';
 const client=root.TennisNoteDataClient, c=client?.loadConfig?.();
 const targets={
  'https://tennisnote-admin-dev.pages.dev':['development','udjmiezroipctytmztwz','63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba'],
  'https://tennisnote-admin.pages.dev':['production','cnympiwrwgouuvhaivbc','3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a'],
 };
 const target=targets[root.location.origin], host=doc.getElementById('r4BranchHoursPanel'), branch=doc.getElementById('r4ManagedBranch');
 if(!target||!host||!branch||c?.environment!==target[0]||c.supabaseUrl!==`https://${target[1]}.supabase.co`||c.projectFingerprint!==target[2])return;
 const auth={requireCurrentSession:true,retryAuth:false};
 const rpc=(name,args)=>client.rpc(name,args,auth);
 const el=(tag,text)=>{const x=doc.createElement(tag);if(text)x.textContent=text;return x;};
 const label=(text,input)=>{const x=el('label',text+' ');input.setAttribute('aria-label',text);x.append(input);return x;};
 const opt=(id,text)=>{const x=el('option',text);x.value=id;return x;};
 const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(x);
 const pane=el('details'), body=el('div');pane.append(el('summary','수납 기록·회원권 등록'),body);host.append(pane);
 const methodLabel={cash:'현금',bank_transfer:'계좌이체',card:'현장 카드'};
 const ticketLabel={active:'사용 가능',paused:'일시 중지',expired:'만료',used:'소진',cancelled:'취소',refunded:'환불'};
 const count=x=>Number.isInteger(x)&&x>=0;
 async function history(target,b,current){
   target.replaceChildren(el('p','수납 기록 확인 중'));
   try{
     const data=await rpc('tn_r4_branch_list_manual_paid',{p_branch:b});
     if(!current())return;
     if(data?.branchId!==b||!Array.isArray(data.rows)||data.rows.length>20)throw Error('history');
   if(!data.rows.length){target.replaceChildren(el('p','최근 수납 기록이 없습니다.'),el('p','목록에 없다고 등록 실패가 확인된 것은 아닙니다.'));return;}
     const list=el('ul');
     for(const row of data.rows){
       if(!row||!count(row.amount)||row.amount===0||!/^\d{4}-\d{2}-\d{2}$/.test(row.paidOn)||
          ![row.usedSessions,row.totalSessions,row.remainingSessions].every(count))throw Error('history');
       const item=el('li');
       item.append(el('strong',`${row.memberName||'회원'} · ${row.productName||'개인권'}`),
         el('div',`${row.paidOn} · ${methodLabel[row.method]||'수동 수납'} · ${row.amount.toLocaleString('ko-KR')}원`),
         el('div',`${row.paymentStatus==='verified'?'수납 기록 확인':'수납 상태 확인 필요'} · ${ticketLabel[row.ticketStatus]||'회원권 상태 확인 필요'} · 사용 ${row.usedSessions}/${row.totalSessions}회, 잔여 ${row.remainingSessions}회`));
       list.append(item);
     }
     target.replaceChildren(list,el('p','이 화면에서 등록한 최근 20건까지 표시합니다.'),
       el('p','포트원 결제 건이 아닙니다. 환불 가능 여부와 금액은 수납 내역과 정책을 확인해 주세요.'));
   }catch{if(current())target.replaceChildren(el('p','이 지점의 수납 기록을 조회할 수 없습니다.'));}
 }
 let owner='', epoch=0, pending=null;
 const sync=()=>{const next=host.hidden?'':`${client.sessionSubject()||''}/${branch.value}`;if(next===owner)return;
   owner=next;++epoch;pending=null;pane.open=false;body.replaceChildren();pane.hidden=!uuid(branch.value)||!client.sessionSubject()||host.hidden;};
 pane.hidden=true;branch.addEventListener('change',sync);new MutationObserver(sync).observe(host,{attributes:true,attributeFilter:['hidden']});root.setInterval(sync,300);sync();
 pane.addEventListener('toggle',async()=>{
   const version=++epoch,b=branch.value,who=client.sessionSubject();body.replaceChildren();
   const current=()=>pane.open&&version===epoch&&branch.value===b&&who===client.sessionSubject()&&!host.hidden;
   if(!current()||!who||!uuid(b))return;
   const status=el('p','등록 대상 확인 중');status.setAttribute('role','status');body.append(status);
   const recent=el('details'), records=el('div');records.setAttribute('aria-live','polite');
   recent.append(el('summary','최근 수납 기록'),records);body.append(recent);
   let historyEpoch=0;
   const refreshHistory=()=>{
     const turn=++historyEpoch;
     if(recent.open&&current())void history(records,b,()=>current()&&recent.open&&turn===historyEpoch);
     else records.replaceChildren();
   };
   recent.addEventListener('toggle',refreshHistory);
   let busy=false,done=false;
   const readResult=async(p,m,op,expected)=>{
     const y=await rpc('tn_r4_branch_read_manual_paid',{p_branch:b,p_operation:op});
     if(!current())return false;
     if(y?.branchId!==b||y.memberId!==m.id||y.productId!==p.id||y.amount!==p.amount||y.status!=='verified'||
        y.charged!==false||!uuid(y.ticketId)||!uuid(y.paymentId)||
        (expected&&(expected.branchId!==b||expected.ticketId!==y.ticketId||expected.paymentId!==y.paymentId)))throw Error('receipt');
     done=true;pending=null;status.textContent=`수납·회원권 등록 확인 · ${y.amount.toLocaleString('ko-KR')}원`;
     if(recent.open)refreshHistory();
     return true;
   };
   if(pending){
     const f=pending.fields;
     const retry=el('button','등록 결과만 조회');retry.type='button';
     status.textContent='등록 성공 여부가 아직 확인되지 않았습니다. 재등록하지 말고 결과만 조회해 주세요.';
     body.prepend(retry);
     retry.addEventListener('click',async()=>{
       if(!current()||retry.disabled||!pending)return;
       retry.disabled=true;
       try{
         if(await readResult({id:f.p_product,amount:f.p_expected_amount},{id:f.p_member},pending.op))retry.remove();
       }catch{if(current()){retry.disabled=false;if(recent.open)refreshHistory();else recent.open=true;}}
     });
     recent.open=true;
     return;
   }
   let data;
   try{data=await rpc('tn_r4_branch_manual_paid_options',{p_branch:b});}catch{if(current())status.textContent='이 지점에는 수납 등록이 열려 있지 않습니다.';return;}
   if(!current())return;
   if(data?.branchId!==b||!Array.isArray(data.members)||!Array.isArray(data.products)){status.textContent='등록 대상을 확인할 수 없습니다.';return;}
   const products=data.products.filter(x=>uuid(x.id)&&Number.isInteger(x.amount)&&x.amount>0),members=data.members.filter(x=>uuid(x.id)&&uuid(x.coachId));
   if(!products.length||!members.length){status.textContent='비공개 유료 상품과 담당 코치가 지정된 대기 회원이 필요합니다.';return;}
   const product=el('select'),member=el('select'),method=el('select'),day=el('input'),ack=el('input'),save=el('button','수납 기록하고 회원권 등록');
   product.append(opt('','상품 선택'),...products.map(x=>opt(x.id,`${x.name} · ${x.amount.toLocaleString('ko-KR')}원`)));
   member.append(opt('','회원 선택'),...members.map(x=>opt(x.id,x.name)));
   method.append(opt('','수납 방법 선택'),opt('bank_transfer','계좌이체'),opt('cash','현금'),opt('card','현장 카드'));
   day.type='date';ack.type='checkbox';save.type='button';save.className='primary-button';
   body.prepend(label('비공개 상품',product),label('대기 회원',member),label('수납 방법',method),label('수납일',day),
     label('이미 받은 금액입니다. 새 결제는 하지 않습니다.',ack),save);status.textContent='';
   const controls=[product,member,method,day,ack,save];
   save.addEventListener('click',async()=>{
     if(!current()||busy||done)return;
     const p=products.find(x=>x.id===product.value),m=members.find(x=>x.id===member.value);
     if(!p||!m||!method.value||!day.value||!ack.checked){status.textContent='상품·회원·수납일과 수납 확인을 입력해 주세요.';return;}
     const fields={p_branch:b,p_member:m.id,p_product:p.id,p_coach:m.coachId,p_method:method.value,p_paid_on:day.value,p_expected_amount:p.amount};
     const key=JSON.stringify([who,fields]);if(pending&&pending.key!==key)return;
     if(!pending)pending={key,fields,op:root.crypto.randomUUID(),sent:false};
     const op=pending.op;busy=true;for(const f of controls)f.disabled=true;status.textContent='등록 결과 확인 중';
     try{
       let x;
       if(!pending.sent){
         pending.sent=true;
         x=await rpc('tn_r4_branch_register_manual_paid',{...fields,p_operation:op});
         if(!current())return;
       }
       await readResult(p,m,op,x);
     }catch{if(current()){
       status.textContent='등록 성공 여부가 아직 확인되지 않았습니다. 재등록하지 말고 결과만 조회해 주세요.';
       save.textContent='등록 결과만 조회';
       if(recent.open)refreshHistory();else recent.open=true;
     }}
     finally{busy=false;if(current()&&!done)save.disabled=false;}
   });
 });
})(window,document);
