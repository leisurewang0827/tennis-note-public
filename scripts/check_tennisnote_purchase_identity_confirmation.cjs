// Exact source-function focused fixtures; no real identities or HTTP requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = ['ui/member.js','domain/members.js','actions/member.js','actions/billing.js']
  .map(file => fs.readFileSync(path.join(__dirname, '../app/admin', file), 'utf8').replace(/\r\n/g,'\n')).join('\n');
function extract(name) {
  const regex = new RegExp(`(?:async )?function ${name}\\(`);
  const start = source.search(regex);
  assert.ok(start >= 0);
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start);
  return source.slice(start, end + 2);
}
async function main() {
  let checks = 0;
  const check = (name, ok) => { assert.ok(ok, name); checks++; };
  const key = 'synthetic-purchase-key';
  const record = {userId:'synthetic-email-member',branchId:'synthetic-branch',name:'synthetic same name'};
  let form, branch, calls, confirms, proof, hook, accepted;
  const ctx = {members:[],memberManagementModalState:{},JSON,FormData:class {
    constructor(f) { this.f = f; } entries() { return Object.entries(this.f.values); }
  }, window:{}, normalizedRpcResult:v=>v, activeOperationBranchId:()=>branch,
  $:()=>form};
  ctx.window.TennisNoteDataClient = {rpc:async (name, args) => {
    assert.equal(name,'tn_admin_preview_purchase_identity');calls++;
    assert.equal(args.target_record.identityProof,undefined);
    if (hook) await hook();
    return proof;
  }};
  ctx.window.confirm = message => {confirms++;assert.ok(message.includes('이름이 같아도'));return accepted;};
  vm.createContext(ctx);
  vm.runInContext(extract('onsitePurchaseIdentitySnapshot'),ctx);
  vm.runInContext(extract('confirmMemberPurchaseIdentity'),ctx);
  vm.runInContext(extract('memberManagementErrorText'),ctx);
  function reset() {
    form={isConnected:true,values:{name:'synthetic same name'}};
    branch=record.branchId;calls=0;confirms=0;hook=null;accepted=true;
    ctx.members=[{id:1,serverUserId:record.userId,name:record.name}];
    ctx.memberManagementModalState={action:'assign',memberId:1,purchaseTargetUserId:record.userId};
    proof={revision:'a'.repeat(64),userId:record.userId,branchId:branch,
      people:[{providers:['email'],phoneVerified:false,phoneMasked:null,identityTag:'1'.repeat(8)}]};
  }
  const run = (r=record,kind='assign') => ctx.confirmMemberPurchaseIdentity(form,r,[],key,kind);
  const reject = async (name, fn, code) => {await assert.rejects(fn,new RegExp(code));checks++;};
  reset(); const passed=await run();
  check('normal email accepted after explicit confirmation',passed.identityProof==='a'.repeat(64) && calls===1 && confirms===1);
  check('input not mutated with persisted proof',record.identityProof===undefined);
  reset();proof.people[0].providers=['custom:naver']; await run();check('naver accepted',confirms===1);
  reset();ctx.members.push({id:1,serverUserId:'synthetic-naver-member',name:record.name});
  await reject('duplicate display id no first-match',()=>run(),'selection_changed');check('ambiguous local id RPC0',calls===0);
  reset();ctx.memberManagementModalState.purchaseTargetUserId='synthetic-naver-member';
  await reject('exact target not same-name substitute',()=>run(),'selection_changed');
  reset();hook=()=>{ctx.members[0].serverUserId='synthetic-naver-member';};
  await reject('refresh substituted member',()=>run(),'selection_changed');check('no confirmation on stale read',confirms===0);
  reset();hook=()=>{form.isConnected=false;};await reject('closed form',()=>run(),'selection_changed');
  reset();hook=()=>{form={...form};};await reject('rerendered form',()=>run(),'selection_changed');
  reset();hook=()=>{form.values.name='different synthetic';};await reject('input edit while preview in-flight',()=>run(),'selection_changed');
  reset();hook=()=>{branch='other-branch';};await reject('branch switch',()=>run(),'selection_changed');
  reset();proof.userId='synthetic-naver-member';await reject('wrong preview response',()=>run(),'selection_changed');
  reset();proof.revision='';await reject('missing server proof',()=>run(),'selection_changed');
  reset();await reject('form changed during prior candidate resolution',()=>ctx.confirmMemberPurchaseIdentity(form,record,[],key,'assign','stale-form-values'),'selection_changed');
  check('changed form blocked before preview',calls===0);
  reset();accepted=false;await reject('cancel preserves draft',()=>run(),'confirmation_cancelled');check('draft preserved',form.values.name===record.name);
  reset();ctx.memberManagementModalState.action='create';proof.userId=null;
  await run({...record,userId:null},'create');check('new unlinked create explicit confirmation',confirms===1);
  reset();proof.people.push({providers:['custom:naver'],phoneVerified:true,identityTag:'2'.repeat(8)});
  await run(record,'group');check('group identities included',confirms===1);
  const submit=extract('submitMemberManagementForm');
  check('all three paid dispatch sites use proof', (submit.match(/target_record: await confirmMemberPurchaseIdentity/g)||[]).length===3);
  check('form locked before create identity lookup',submit.indexOf('const purchaseFormValues')<submit.indexOf('await resolveManualRegistrationMember'));
  check('duplicate submit guard before first async',submit.indexOf('purchaseSubmitting === "true"')<submit.indexOf('await '));
  check('busy release finally',submit.includes('finally {\n    delete form.dataset.purchaseSubmitting;'));
  check('open freezes exact server user',extract('openMemberManagementModal').includes('purchaseTargetUserId: targetUserId'));
  check('friendly cancelled error',ctx.memberManagementErrorText({message:'purchase_identity_confirmation_cancelled'}).includes('입력값은 유지'));
  check('friendly stale error',ctx.memberManagementErrorText({message:'purchase_identity_stale'}).includes('다시 선택'));
  vm.runInContext(submit,ctx);
  await ctx.submitMemberManagementForm({preventDefault(){},target:{dataset:{purchaseSubmitting:'true'}}});
  check('actual duplicate handler exits before dependency/RPC',calls===1);
  check('legacy refresh copy',ctx.memberManagementErrorText({message:'purchase_identity_proof_required'}).includes('새로고침'));
  check('legacy operation no repeat copy',ctx.memberManagementErrorText({message:'purchase_identity_legacy_operation_review_required'}).includes('다시 만들지'));
  const onsiteSubmit=extract('submitOnsitePayment');
  check('onsite no raw fallback',onsiteSubmit.includes('tn_admin_record_onsite_payment_with_identity') && !onsiteSubmit.includes('tn_admin_record_onsite_payment_v3'));
  check('onsite duplicate lock before preview',onsiteSubmit.indexOf('purchaseSubmitting === "true"')<onsiteSubmit.indexOf('await '));
  vm.runInContext(onsiteSubmit,ctx);
  let fields, writes, onsiteHook;
  function resetOnsite() {
    reset();writes=0;onsiteHook=null;form.dataset={};
    fields={
      '#onsitePaymentForm':form,'#onsitePaymentModal':{hidden:false},
      '#onsitePaymentMember':{value:record.userId},'#onsitePaymentSourceTicket':{value:''},
      '#onsitePaymentProduct':{value:'synthetic-product'},'#onsitePaymentCoach':{value:'synthetic-coach'},
      '#onsitePaymentMethod':{value:'card'},'#onsitePaymentDate':{value:'synthetic-date'},
      '#onsitePaymentAmount':{value:1000},'#onsitePaymentStartDate':{value:''},
      '#onsitePaymentKeepSchedule':{checked:false},'#onsitePaymentMessage':{textContent:''},
      "#onsitePaymentForm button[type='submit']":{disabled:false,isConnected:true},
    };
    ctx.$=selector=>fields[selector];
    form.querySelector=selector=>fields[selector];
    ctx.createAdminOperationKey=()=>key;ctx.reportAdminPaymentGuard=()=>{};
    ctx.syncAdminLiveData=ctx.loadServerPaymentsIntoBilling=async()=>true;
    ctx.closeOnsitePaymentModal=()=>{fields['#onsitePaymentModal'].hidden=true;};
    ctx.renderBilling=ctx.showToast=()=>{};
    ctx.tickets=[{serverTicketId:'synthetic-ticket'}];ctx.expiredTickets=[];
    ctx.billings=[{serverPaymentId:'synthetic-payment',ticketId:'synthetic-ticket',status:'paid'}];
    ctx.window.TennisNoteDataClient.rpc=async(name,args)=>{
      if(name==='tn_admin_preview_purchase_identity') {calls++;if(onsiteHook)await onsiteHook();return proof;}
      assert.equal(name,'tn_admin_record_onsite_payment_with_identity');
      assert.equal(args.target_record.identityProof,proof.revision);writes++;
      return {ok:true,operationKey:key,ticketId:'synthetic-ticket',paymentId:'synthetic-payment'};
    };
  }
  const onsiteRun=()=>ctx.submitOnsitePayment({preventDefault(){},currentTarget:form});
  resetOnsite();await Promise.all([onsiteRun(),onsiteRun()]);
  check('actual onsite double submit preview1 write1',calls===1 && writes===1);
  check('actual onsite success readback closes form',fields['#onsitePaymentModal'].hidden && !form.dataset.onsitePaymentOperationKey);
  check('actual onsite lock cleared',!form.dataset.purchaseSubmitting);
  resetOnsite();accepted=false;await onsiteRun();
  check('onsite cancel write0 draft kept',writes===0 && fields['#onsitePaymentMember'].value===record.userId && fields['#onsitePaymentMessage'].textContent.includes('입력값은 유지'));
  resetOnsite();onsiteHook=()=>{fields['#onsitePaymentMember'].value='different-synthetic';};await onsiteRun();
  check('onsite changed exact target write0',writes===0 && calls===1);
  resetOnsite();onsiteHook=()=>{fields['#onsitePaymentModal'].hidden=true;};await onsiteRun();
  check('onsite back/close write0',writes===0 && calls===1);
  resetOnsite();ctx.members.push({...ctx.members[0]});await onsiteRun();
  check('onsite duplicate identity preview0 write0',writes===0 && calls===0);
  resetOnsite();onsiteHook=()=>{throw new Error('purchase_identity_client_update_required');};await onsiteRun();
  check('onsite old client clear error no retry',writes===0 && calls===1 && fields['#onsitePaymentMessage'].textContent.includes('새로고침'));
  console.log(JSON.stringify({status:'PASS',checks,mode:'exact-source VM',externalRequests:0,hostedWrites:0}));
}
async function browserMain() {
  const {chromium,webkit}=require('playwright');
  for(const [engine,type] of Object.entries({chromium,webkit})) {
    const browser=await type.launch({headless:true});let checks=0;
    try {
      for(const [width,height] of [[390,844],[768,1024],[1366,900],[844,390]]) for(const colorScheme of ['light','dark']) {
        const page=await browser.newPage({viewport:{width,height},colorScheme});
        await page.route('**/*',r=>r.abort());
        // Browser engine/FormData/dialog fixture, NOT a screenshot of deployed UI.
        await page.setContent('<form id="memberManagementForm"><input name="memberName" value="synthetic same"><button type="submit">확정</button></form>');
        await page.addScriptTag({content:`
          var members=[{id:1,serverUserId:'synthetic-user'}];
          var memberManagementModalState={memberId:1,action:'assign',purchaseTargetUserId:'synthetic-user'};
          var selectedBranch='synthetic-branch';
          var normalizedRpcResult=v=>v,activeOperationBranchId=()=>selectedBranch,$=s=>document.querySelector(s);
          ${extract('onsitePurchaseIdentitySnapshot')}
          ${extract('confirmMemberPurchaseIdentity')}
        `});
        const result=await page.evaluate(async()=>{
          let previews=0,confirms=0,writes=0;const results=[];
          const form=$('#memberManagementForm');
          const r={userId:'synthetic-user',branchId:selectedBranch};
          const response={userId:r.userId,branchId:r.branchId,revision:'a'.repeat(64),people:[{providers:['email'],phoneVerified:false,identityTag:'1'.repeat(8)}]};
          window.TennisNoteDataClient={rpc:async()=>{previews++;return response;}};
          window.confirm=()=>{confirms++;return true;};
          const submit=async()=>{const proof=await confirmMemberPurchaseIdentity(form,r,[],'synthetic-key','assign');writes++;return proof;};
          results.push((await submit()).identityProof===response.revision && writes===1);
          window.confirm=()=>false;
          try{await submit();results.push(false);}catch(e){results.push(e.message==='purchase_identity_confirmation_cancelled' && writes===1);}
          window.confirm=()=>true;
          window.TennisNoteDataClient.rpc=async()=>{form.elements.memberName.value='changed';return response;};
          try{await submit();results.push(false);}catch(e){results.push(e.message==='purchase_identity_selection_changed' && writes===1);}
          window.TennisNoteDataClient.rpc=async()=>response;
          members.push({id:1,serverUserId:'other-user'});
          try{await submit();results.push(false);}catch(e){results.push(e.message==='purchase_identity_selection_changed' && writes===1);}
          return results;
        });
        assert.ok(result.every(Boolean));checks+=result.length;
        const actualHtml=fs.readFileSync(path.join(__dirname,'../app/admin/index.html'),'utf8');
        const actualForm=actualHtml.match(/<form id="onsitePaymentForm"[\s\S]*?<\/form>/)[0];
        await page.setContent(`<section id="onsitePaymentModal">${actualForm}</section>`);
        await page.addScriptTag({content:`
          var tickets=[{serverTicketId:'synthetic-ticket'}],expiredTickets=[],billings=[{serverPaymentId:'synthetic-payment',ticketId:'synthetic-ticket',status:'paid'}];
          var createAdminOperationKey=()=>'synthetic-operation',reportAdminPaymentGuard=()=>{};
          var syncAdminLiveData=async()=>true,loadServerPaymentsIntoBilling=async()=>true;
          var closeOnsitePaymentModal=()=>{$('#onsitePaymentModal').hidden=true;},renderBilling=()=>{},showToast=()=>{};
          ${extract('memberManagementErrorText')}
          ${extract('submitOnsitePayment')}
        `});
        const onsiteResults=await page.evaluate(async()=>{
          const form=$('#onsitePaymentForm'),modal=$('#onsitePaymentModal');let writes=0,previews=0,hook=null;
          members=[{id:1,serverUserId:'synthetic-user',name:'synthetic member'}];
          const setup=()=>{
            writes=previews=0;hook=null;modal.hidden=false;form.reset();window.confirm=()=>true;
            for(const [id,value] of Object.entries({onsitePaymentMember:'synthetic-user',onsitePaymentSourceTicket:'',onsitePaymentProduct:'synthetic-product',onsitePaymentCoach:'synthetic-coach',onsitePaymentMethod:'card'})) {
              $("#"+id).replaceChildren(new Option('합성',value));
            }
            $('#onsitePaymentSourceTicket').add(new Option('합성 변경','different-synthetic-ticket'));
            $('#onsitePaymentDate').value=new Date().toISOString().slice(0,10);
            $('#onsitePaymentAmount').value='1000';
            window.TennisNoteDataClient.rpc=async(name,args)=>{
              if(name==='tn_admin_preview_purchase_identity') {previews++;if(hook)hook();return {userId:'synthetic-user',branchId:selectedBranch,revision:'a'.repeat(64),people:[{providers:['email']}]};}
              if(name!=='tn_admin_record_onsite_payment_with_identity'||args.target_record.identityProof!=='a'.repeat(64))throw new Error('synthetic_wrong_dispatch');
              writes++;return {ok:true,operationKey:args.target_operation_key,ticketId:'synthetic-ticket',paymentId:'synthetic-payment'};
            };
          };
          const run=()=>submitOnsitePayment({preventDefault(){},currentTarget:form});const outcomes=[];
          setup();await Promise.all([run(),run()]);outcomes.push(previews===1&&writes===1&&!form.dataset.purchaseSubmitting);
          outcomes.push(modal.hidden&&!form.dataset.onsitePaymentOperationKey);
          setup();window.confirm=()=>false;await run();outcomes.push(previews===1&&writes===0&&$('#onsitePaymentMessage').textContent.includes('입력값은 유지'));
          setup();hook=()=>{$('#onsitePaymentSourceTicket').value='different-synthetic-ticket';};await run();outcomes.push(previews===1&&writes===0);
          setup();hook=()=>{modal.hidden=true;};await run();outcomes.push(previews===1&&writes===0);
          setup();hook=()=>{throw new Error('purchase_identity_client_update_required');};await run();outcomes.push(previews===1&&writes===0&&$('#onsitePaymentMessage').textContent.includes('새로고침'));
          outcomes.push(form.querySelectorAll('[name]').length===0 && [...new FormData(form)].length===0);
          const changes={
            onsitePaymentMember:()=>$('#onsitePaymentMember').add(new Option('다른 합성','other',false,true)),
            branch:()=>{selectedBranch='other-branch';},
            onsitePaymentSourceTicket:()=>{$('#onsitePaymentSourceTicket').value='different-synthetic-ticket';},
            onsitePaymentProduct:()=>$('#onsitePaymentProduct').add(new Option('다른 합성','other',false,true)),
            onsitePaymentCoach:()=>$('#onsitePaymentCoach').add(new Option('다른 합성','other',false,true)),
            onsitePaymentMethod:()=>$('#onsitePaymentMethod').add(new Option('다른 합성','bank_transfer',false,true)),
            onsitePaymentDate:()=>{$('#onsitePaymentDate').value='2000-01-01';},
            onsitePaymentAmount:()=>{$('#onsitePaymentAmount').value='2000';},
            onsitePaymentStartDate:()=>{$('#onsitePaymentStartDate').value='2000-01-01';},
            onsitePaymentKeepSchedule:()=>{$('#onsitePaymentKeepSchedule').checked=!$('#onsitePaymentKeepSchedule').checked;},
          };
          for(const mutate of Object.values(changes)) for(const stage of ['submit','preview','confirm']) {
            setup();selectedBranch='synthetic-branch';
            if(stage==='submit') {
              const expected=onsitePurchaseIdentitySnapshot(form);mutate();
              let blocked=false;try{await confirmMemberPurchaseIdentity(form,{userId:'synthetic-user',branchId:'synthetic-branch'},[],'synthetic-operation','onsite',expected);}catch{blocked=true;}
              outcomes.push(blocked&&previews===0&&writes===0);
            } else {
              if(stage==='preview')hook=mutate;else window.confirm=()=>{mutate();return true;};
              await run();outcomes.push(previews===1&&writes===0);
            }
          }
          selectedBranch='synthetic-branch';
          return outcomes;
        });
        assert.ok(onsiteResults.every(Boolean));checks+=onsiteResults.length;
        await page.close();
      }
      console.log(JSON.stringify({status:'PASS',engine,checks,cases:8,scope:'source-helper browser fixture',hostedWrites:0}));
    } finally {await browser.close();}
  }
}
(process.argv.includes('--browser')?browserMain():main()).catch(error=>{
  const sites=String(error.stack||'').match(/check_tennisnote_purchase_identity_confirmation\.cjs:\d+:\d+/g)||[];
  console.error('purchase_identity_contract_failed:'+error.name+':'+sites.slice(0,3).join(','));process.exitCode=1;
});
