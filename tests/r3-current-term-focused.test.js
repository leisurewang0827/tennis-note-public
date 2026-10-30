const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const consumerOnly=process.argv.includes('--consumer-only');
const addedOnly=process.argv.includes('--added-only');
const paths=[path.resolve(__dirname,'..','app/admin/actions/coach.js')];
if (process.argv.includes('--admission-selftest')) {
 (async()=>{
  const {pathToFileURL}=require('node:url'), {execFileSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
  const m=await import(pathToFileURL(path.join(root,'scripts/check_r3_purchase_identity_admission.mjs')).href),git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',env:{...process.env,GIT_NO_LAZY_FETCH:'1'}});
  const self='scripts/check_r3_purchase_identity_admission.mjs', workflow='.github/workflows/tennisnote-public-ci.yml';
  const rows=[['M',self],...Object.keys(m.CURRENT_TERM_PUBLIC_PINS).map(p=>[p===m.CURRENT_TERM_PUBLIC_TEST?'A':'M',p])];
  const head='1'.repeat(40),checkout='2'.repeat(40),tree='3'.repeat(40),source='4'.repeat(40),ref='refs/pull/19/merge';
  const s={event:'pull_request',repo:m.REPOSITORY,eventRepo:m.REPOSITORY,baseRepo:m.REPOSITORY,headRepo:m.REPOSITORY,base:m.CURRENT_TERM_PUBLIC_BASE,baseTree:m.CURRENT_TERM_PUBLIC_TREE,target:m.CURRENT_TERM_PUBLIC_PARENT,branch:m.CURRENT_TERM_PUBLIC_HEAD,attempt:'1',clean:true,indexClean:true,symlinks:false,checkoutBranch:'',head,source,checkout,tree,checkoutTree:tree,parents:[source],sourceParents:[m.CURRENT_TERM_PUBLIC_BASE],mergeParents:[m.CURRENT_TERM_PUBLIC_BASE,head],number:19,ref,workflow:'Tennis Note Public PWA CI',workflowSha:checkout,workflowRef:m.REPOSITORY+'/'+workflow+'@'+ref,githubSha:checkout,rows,sourceRows:rows.filter(([,p])=>!m.METADATA.includes(p)),metadataRows:rows.filter(([,p])=>m.METADATA.includes(p)),modes:Object.fromEntries(rows.map(([,p])=>[p,'100644'])),bodies:Object.fromEntries(rows.map(([,p])=>[p,fs.readFileSync(path.join(root,p),'utf8')])),oldSelf:git('show',m.CURRENT_TERM_PUBLIC_BASE+':'+self),oldWorkflow:git('show',m.CURRENT_TERM_PUBLIC_BASE+':'+workflow)};
  assert.equal(m.currentTermPublicValidate(s).status,'SOURCE_ONLY_NOT_ADMITTED');
  const bad=[{...s,target:'dev'},{...s,branch:'other'},{...s,attempt:'2'},{...s,clean:false},{...s,parents:[head]},{...s,sourceParents:[head]},{...s,metadataRows:s.metadataRows.slice(1)},{...s,mergeParents:[head,m.CURRENT_TERM_PUBLIC_BASE]},{...s,checkoutTree:'5'.repeat(40)},{...s,workflow:'other'},{...s,rows:rows.slice(1)},{...s,modes:{...s.modes,[self]:'120000'}},{...s,bodies:{...s.bodies,[self]:s.bodies[self]+'x'}},{...s,bodies:{...s.bodies,[workflow]:s.bodies[workflow]+'x'}},{...s,bodies:{...s.bodies,'app/release.json':s.bodies['app/release.json']+'x'}}];
  for(const item of bad) assert.throws(()=>m.currentTermPublicValidate(item));
  assert.equal(m.currentTermPublicClaimed(['--current-term'],{}),true);
  assert.equal(m.currentTermPublicClaimed([],{GITHUB_EVENT_NAME:'pull_request',GITHUB_BASE_REF:m.CURRENT_TERM_PUBLIC_PARENT}),true);
  assert.equal(m.currentTermPublicClaimed([],{GITHUB_EVENT_NAME:'push'}),false);
  const dev={...s,event:'workflow_dispatch',checkout:head,checkoutTree:tree,ref:'refs/heads/'+m.CURRENT_TERM_PUBLIC_HEAD,workflow:'Deploy Tennis Note development sites',workflowSha:head,workflowRef:m.REPOSITORY+'/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/'+m.CURRENT_TERM_PUBLIC_HEAD,githubSha:head};
  assert.equal(m.currentTermPublicValidate(dev).status,'SOURCE_ONLY_NOT_ADMITTED');
  assert.throws(()=>m.currentTermPublicValidate({...dev,workflow:'Tennis Note Public PWA CI'}));
  m.currentTermPublicReceipt('focused current-term 13/13 PASS\n',13);
  assert.throws(()=>m.currentTermPublicReceipt('focused current-term 12/13 PASS\n',13));
  assert.throws(()=>m.currentTermPublicReceipt('focused current-term 20/20 PASS\nerror',20));
  let calls=0;m.currentTermPublicFocused(flags=>{calls++;return 'focused current-term '+(flags.length?20:13)+'/'+(flags.length?20:13)+' PASS';});
  assert.equal(calls,2); calls=0;assert.throws(()=>m.currentTermPublicFocused(()=>{calls++;throw Error('child failed');}));assert.equal(calls,1);
  console.log('public synthetic admission checks 27/27 PASS (not CI admission)');
 })().catch(e=>{const code=/^CURRENT_TERM_[A-Z_]+$/.test(e?.message||'')?e.message:'TEST_ASSERTION';console.error('public admission selftest FAIL '+code);process.exitCode=1;});
 return;
}
if (process.argv.includes('--portable-smoke')) {
 const src=fs.readFileSync(paths[0],'utf8').replace(/\r\n/g,'\n');
 const a=src.indexOf('  const settlementTermByCoachRoleId = new Map();');
 const b=src.indexOf('  const coachIdByRole = new Map();',a);
 assert(a>=0&&b>a,'selection implementation missing');
 const select=new Function('serverSettlementTerms','adminLocalDateKey',src.slice(a,b)+'\nreturn settlementTermByCoachRoleId;');
 const rows=[{coach_role_id:'synthetic',effective_from:'2031-03-01',effective_to:'2031-03-31',status:'active'}, {coach_role_id:'synthetic',effective_from:'2031-04-01',effective_to:null,status:'scheduled'}];
 assert.equal(select(rows,()=> '2031-03-15').get('synthetic')?.effective_from,'2031-03-01');
 assert.equal(select(rows,()=> '2031-04-01').get('synthetic')?.effective_from,'2031-04-01');
 console.log('public portable actual-source smoke 2/2 PASS');
 process.exit(0);
}
if (process.argv.includes('--binding-selftest')) {
 const action='function applyServerCoachSnapshot(', terms='function coachSettlementEffectiveState(', verify='function coachStaffServerMatches(';
 const check=(a,d)=>a.includes(action)&&d.includes(terms)&&d.includes(verify);
 assert(check(action,terms+verify));
 assert(!check('',terms+verify));
 assert(!check(action,''));
 assert(!check(action,terms));
 assert(!check(action,verify));
 console.log('public source binding negatives 5/5 PASS');
 process.exit(0);
}
if (process.argv.includes('--binding-only')) {
 const src=fs.readFileSync(paths[0],'utf8');
 const domain=fs.readFileSync(path.resolve(__dirname,'..','app/admin/domain/coaches.js'),'utf8');
 assert(src.includes('function applyServerCoachSnapshot('), 'actual source missing');
 for (const token of ['function coachSettlementEffectiveState(', 'function coachStaffServerMatches(']) assert(domain.includes(token), 'required source missing');
 console.log('public portable source binding PASS');
 process.exit(0);
}
let n=0, failed=0;
for (const file of paths) {
 const path=file.replace(/\\/g,'/');
 const src=fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 if (!consumerOnly) {
 const start=src.indexOf('  const settlementTermByCoachRoleId = new Map();');
 const end=src.indexOf('  const coachIdByRole = new Map();',start);
 assert(start>=0&&end>start,'actual source selection not found');
 const selector=new Function('serverSettlementTerms','adminLocalDateKey',src.slice(start,end)+'\nreturn settlementTermByCoachRoleId;');
 const now=()=> '2026-10-30';
 const row=(role,from,to,status)=>({coach_role_id:role,effective_from:from,effective_to:to,status});
 const current=row('a','2026-10-25','2026-10-30','active'), future=row('a','2026-10-31',null,'scheduled');
 const cases=[
  ['future first',[future,current],'2026-10-25'],
  ['current first',[current,future],'2026-10-25'],
  ['ended current date',[row('a','2026-10-01','2026-10-10','ended'),current], '2026-10-25'],
  ['other role',[row('b','2026-10-01',null,'active'),current],'2026-10-25'],
  ['inactive ignored',[row('a','2026-10-20',null,'cancelled'),current],'2026-10-25'],
  ['overlap hold',[current,row('a','2026-10-26',null,'active')],null],
  ['future only hold',[future],null],
 ];
 for(const [name,terms,expected] of cases){n++;const got=selector(terms,now).get('a')?.effective_from??null;if(got!==expected){failed++;console.log('FAIL',path.includes('prototype')?'private':'public',name,'expected',expected,'actual',got);}}
 const checkSource=path.endsWith('/actions/coach.js') ? fs.readFileSync(path.replace('/actions/coach.js','/domain/coaches.js'),'utf8').replace(/\r\n/g,'\n') : src;
 const functionSource = name => { const m=checkSource.match(new RegExp('^function '+name+'\\([\\s\\S]*?^}', 'm')); assert(m, name); return m[0]; };
 const ctx=vm.createContext({adminLocalDateKey:now,normalizedMemberPhone:x=>x||'',normalizeCoachWorkBlocks:x=>x.workBlocks,normalizeCoachBreakBlocks:x=>x.breakBlocks,coachBlockSignature:x=>JSON.stringify(x),coachSettlementRule:x=>x.rule});
 for(const name of ['coachSettlementTermDraft','coachStaffFreshSettlementTermMatches','coachStaffServerMatches']) vm.runInContext(functionSource(name),ctx);
 const makeTerm=(from,to,status)=>({...row('a',from,to,status),settlement_type:'ratio',coach_rate:0.5,hourly_rate:null,settlement_basis:'cash_ex_vat',settlement_calculation_mode:'session_progress',substitute_policy:'actualCoach'});
 const cur=makeTerm('2026-10-25','2026-10-30','active'), next=makeTerm('2026-10-31',null,'scheduled');
 const saved={name:'qa',approvalStatus:'approved',phone:'',role:'레슨',bio:'',employmentStatus:'active',serverRoleId:'a',workBlocks:[],breakBlocks:[],rule:{method:'ratio',ratio:0.5,cardBase:'cash',calculationMode:'session_progress',substitute:'actualCoach',effectiveFrom:'2026-10-25'}};
 const draft={name:'qa',approvalStatus:'approved',phone:'',jobTitle:'레슨',bio:'',employmentStatus:'active',coachRoleId:'a',workBlocks:[],breakBlocks:[],settlement:ctx.coachSettlementTermDraft(next)};
 const tests=[['future verified',saved,draft,[next,cur],true],['wrong role',saved,{...draft,coachRoleId:'b'},[next,cur],false],['wrong value',saved,{...draft,settlement:{...draft.settlement,ratio:99}},[next,cur],false],['overlap rejected',saved,draft,[next,cur,makeTerm('2026-10-26',null,'active')],false],['missing current rejected',saved,draft,[next],false],['cancelled target rejected',saved,draft,[{...next,status:'cancelled'},cur],false]];
 for(const [name,s,d,terms,expected] of tests){n++;const got=ctx.coachStaffServerMatches(s,d,terms);if(got!==expected){failed++;console.log('FAIL',path.includes('prototype')?'private':'public',name,'expected',expected,'actual',got);}}
 }
 if (consumerOnly) {
  const checkSource=path.endsWith('/actions/coach.js') ? fs.readFileSync(path.replace('/actions/coach.js','/domain/coaches.js'),'utf8').replace(/\r\n/g,'\n') : src;
  const get=name=>{const m=checkSource.match(new RegExp('^function '+name+'\\([\\s\\S]*?^}','m'));assert(m,name);return m[0];};
  const ctx=vm.createContext({adminLiveDataState:{coachSettlementTerms:[]},adminLocalDateKey:()=> '2026-10-30',escapeHtml:String,money:{format:String},coachSettlementRules:[],defaultCoachSettlementRule:()=>({method:'ratio',ratio:0.5,effectiveFrom:'2026-10-01'}),normalizeCoachWorkBlocks:()=>[],normalizeCoachBreakBlocks:()=>[],coachAccountDetail:()=>'',activeOperationBranchId:()=>'',defaultOperationBranch:()=>null});
  for(const name of ['coachSettlementRule','coachSettlementSummary','coachStaffDraftFrom','coachSettlementPercentLabel','coachSettlementValueLabel','coachSettlementTermDraft','coachSettlementEffectiveTerms','coachSettlementEffectiveState','coachSettlementEffectiveMarkup'])vm.runInContext(get(name),ctx);
  const row=(from,to,status,role='a')=>({coach_role_id:role,effective_from:from,effective_to:to,status,settlement_type:'ratio',coach_rate:0.5,settlement_basis:'cash_ex_vat',settlement_calculation_mode:'session_progress',substitute_policy:'actualCoach'});
  const scenarios=[['empty',[],null,null],['future only',[row('2026-10-31',null,'scheduled')],null,'2026-10-31'],['overlap',[row('2026-10-01',null,'active'),row('2026-10-20',null,'scheduled')],null,null],['triple overlap',[row('2026-10-01',null,'active'),row('2026-10-20',null,'scheduled'),row('2026-10-25',null,'ended')],null,null],['unknown',[row('2026-10-01',null,'unknown')],null,null],['missing status',[row('2026-10-01',null,undefined)],null,null],['end inclusive',[row('2026-10-01','2026-10-30','ended')],'2026-10-01',null],['start inclusive',[row('2026-10-30',null,'scheduled')],'2026-10-30',null],['open end',[row('2026-10-01',null,'active')],'2026-10-01',null],['unrelated role',[row('2026-10-01',null,'active','b')],null,null]];
  const draft={coachRoleId:'a',settlement:{method:'ratio',ratio:50,effectiveFrom:'2026-10-01'}};
  if(!addedOnly){for(const [name,terms,current,future] of scenarios){ctx.adminLiveDataState.coachSettlementTerms=terms;const before=JSON.stringify(terms);const result=ctx.coachSettlementEffectiveState(draft);const html=ctx.coachSettlementEffectiveMarkup(draft);n++;if((result.current?.effective_from??null)!==current||(result.future?.effective_from??null)!==future||JSON.stringify(terms)!==before||(!current&&!html.includes('현재 적용값 없음'))){failed++;console.log('FAIL',path.includes('prototype')?'private':'public',name);}}
  ctx.coachSettlementRules=[{serverRoleId:'a',currentTermUnavailable:true,method:'ratio',ratio:0.5}];n++;if(ctx.coachSettlementSummary({serverRoleId:'a'})!=='현재 적용값 없음'){failed++;console.log('FAIL',path.includes('prototype')?'private':'public','summary unresolved');}}
  ctx.adminLiveDataState.coachSettlementTerms=[];
  const editor=ctx.coachStaffDraftFrom({id:'a',serverRoleId:'a',workBlocks:[],breakBlocks:[]});
  n++;if(!editor.settlement || !ctx.coachSettlementEffectiveMarkup(editor).includes('현재 적용값 없음')){failed++;console.log('FAIL',path.includes('prototype')?'private':'public','draft not applied');}
  const selectorStart=src.indexOf('  const settlementTermByCoachRoleId = new Map();');
  const selectorEnd=src.indexOf('  const coachIdByRole = new Map();',selectorStart);
  const select=new Function('serverSettlementTerms','adminLocalDateKey',src.slice(selectorStart,selectorEnd)+'\nreturn settlementTermByCoachRoleId;');
  for(const [name,term,expected] of [['ended today',row('2026-10-30','2026-10-30','ended'),true],['scheduled today',row('2026-10-30',null,'scheduled'),true],['next day',row('2026-10-31',null,'scheduled'),false],['missing status',row('2026-10-01',null,undefined),false],['unknown status',row('2026-10-01',null,'unknown'),false]]){n++;let input=[term],before=JSON.stringify(input);let found=select(input,()=> '2026-10-30').has('a');if(found!==expected||JSON.stringify(input)!==before){failed++;console.log('FAIL',path.includes('prototype')?'private':'public',name);}}
  for(const name of ['coachStaffFreshSettlementTermMatches','coachStaffServerMatches'])vm.runInContext(get(name),ctx);
  Object.assign(ctx,{normalizedMemberPhone:x=>x||'',coachBlockSignature:x=>JSON.stringify(x)});
  const cur={...row('2026-10-30','2026-10-30','active'),coach_rate:0.4,substitute_policy:'manual'}, next={...row('2026-10-31',null,'scheduled'),coach_rate:0.5};
  const saved={name:'qa',approvalStatus:'approved',phone:'',role:'레슨',bio:'',employmentStatus:'active',serverRoleId:'a',workBlocks:[],breakBlocks:[]};
  const rule={serverRoleId:'a',method:'ratio',ratio:0.4,cardBase:'cash',calculationMode:'session_progress',substitute:'manual',effectiveFrom:'2026-10-30'};
  const d={name:'qa',approvalStatus:'approved',phone:'',jobTitle:'레슨',bio:'',employmentStatus:'active',coachRoleId:'a',workBlocks:[],breakBlocks:[],settlement:ctx.coachSettlementTermDraft(next)};
  for(const [name,r,ds,expected] of [['different future valid',rule,d,true],['future wrong',{...rule},{...d,settlement:{...d.settlement,ratio:99}},false],['current wrong',{...rule,ratio:0.6},d,false]]){ctx.coachSettlementRules=[r];n++;if(ctx.coachStaffServerMatches(saved,ds,[next,cur])!==expected){failed++;console.log('FAIL',path.includes('prototype')?'private':'public',name);}}
 }
}
console.log(`focused current-term ${n-failed}/${n} PASS`);
if(failed)process.exitCode=1;
