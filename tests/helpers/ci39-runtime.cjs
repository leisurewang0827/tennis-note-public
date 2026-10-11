"use strict";
// 실제 소스 함수와 등록된 클릭을 합성 transport에서만 실행한다.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n");
const extract=(s,n)=>{const m=s.match(new RegExp("^(?:async )?function "+n+"\\([^]*?^}","m"));assert(m,n);return m[0];};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function coachSources(root,side) {
  const priv=side==="private",app=priv?read(path.join(root,"90-Dashboard/tennis-note-coach-app/app.js")):read(path.join(root,"app/tennis-note-coach-app/data/auth.js"));
  const push=priv?app:read(path.join(root,"app/tennis-note-coach-app/data/push.js"));
  const sync=priv?app:read(path.join(root,"app/tennis-note-coach-app/data/sync.js"));
  const domain=priv?app:read(path.join(root,"app/tennis-note-coach-app/domain/settlement.js"));
  const event=priv?app:read(path.join(root,"app/tennis-note-coach-app/events/account.js"));
  const binding=event.match(/\$\('#coachLogoutButton'\)\.addEventListener\('click', logoutCoach\);/);assert(binding,"actual registered click");
  return {logout:extract(app,"logoutCoach"),push:extract(push,"disableNativeCoachPushForLogout"),apply:extract(app,"applySupabaseCoachSession"),
    reset:extract(sync,priv?"resetCoachSettlementReconciliation":"resetCoachSettlementHistory"),continuation:extract(domain,"coachSettlementReconciliationContinuation"),binding:binding[0]};
}
function coach(root,side) {
  const priv=side==="private",source=coachSources(root,side),push=deferred(),profile=deferred(),schedule=deferred(),signout=deferred();
  const stats={reset:0,render:0,returns:0,signout:0,push:0,access:0,renderAll:0},buttons=new Map();
  const history={coachSettlementReconciliationRequestId:0,coachSettlementReconciliation:{old:true},continuationIsCurrent:()=>true};
  const state={coach:{role:"coach",authUserId:"synthetic-auth",coachRoleId:"synthetic-role",branchId:"synthetic-branch"},liveProfileId:"synthetic-profile",dataMode:"live",...history};
  let session={access_token:"synthetic-memory-session"},holdSignout=false;
  const client={getSession:()=>session,readiness:()=>({ready:true}),consumeOAuthRedirect:async()=>{},ensureSession:async()=>session,
    selectCurrentProfile:()=>profile.promise,rpc:(name,args,options)=>{assert.equal(name,"tn_disable_push_device");assert.equal(args.target_device_id,"synthetic-device");assert.deepEqual({...options},{requireCurrentSession:true,retryAuth:false});stats.push++;return push.promise;},
    signOut:async()=>{stats.signout++;if(holdSignout)await signout.promise;else session=null;}};
  const c=vm.createContext({state,coachSettlementHistory:history,coachSettlementHistoryPending:null,coachSettlementRequestSequence:0,
    coachSettlementSelection:{old:true},coachPushProfileId:"synthetic-profile",window:{TennisNoteDataClient:client},
    currentCoachPushDeviceId:()=>"synthetic-device",setCoachPushNotificationState:()=>{},setCoachAccessMessage:()=>stats.access++,
    returnToMemberEntry:()=>stats.returns++,renderCoachSettlementHistory:()=>stats.render++,renderCoachSettlementReconciliation:()=>stats.render++,
    coachSettlementReconciliationScope:()=>({branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"}),
    coachSettlementReconciliationScopeSignature:()=>"synthetic-scope",canUseCoachAppProfile:()=>true,
    activateLiveCoachProfile:id=>{state.liveProfileId=id;},renderAll:()=>stats.renderAll++,openCoachApp:()=>{},saveSnapshot:()=>{},
    approvedCoachesFromAdmin:()=>[],syncCoachSchedulePreview:()=>schedule.promise,syncLiveSchedulePolicy:async()=>{},
    syncCoachLessonsFromServer:async()=>{},syncCoachJournalEntriesFromServer:async()=>{},syncCoachSettlementFromServer:async()=>{},
    syncCoachSettlementReconciliationFromServer:async()=>{},syncNativeCoachPushRegistration:async()=>{},
    $:selector=>{if(!buttons.has(selector))buttons.set(selector,{hidden:false,addEventListener:(kind,fn)=>{buttons.get(selector)[kind]=fn;}});return buttons.get(selector);}});
  vm.runInContext([source.reset,source.continuation,source.logout,source.push,source.apply,source.binding].join("\n"),c);
  const name=priv?"resetCoachSettlementReconciliation":"resetCoachSettlementHistory",actual=c[name];
  c[name]=()=>{stats.reset++;actual();};
  return {c,stats,history:priv?state:history,push,profile,schedule,signout,click:()=>buttons.get("#coachLogoutButton").click(),
    holdSignout:()=>{holdSignout=true;},newIdentity:()=>{session={access_token:"synthetic-new-session"};state.coach={authUserId:"synthetic-new-auth",role:"coach"};state.liveProfileId="synthetic-new-profile";},
    profileValue:()=>({user:{id:"synthetic-auth"},profile:{id:"synthetic-profile",role:"coach",name:"합성",status:"active"},coachRole:{id:"synthetic-role",branch_id:"synthetic-branch"}})};
}
const scope={branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"};
const preview=month=>({ok:true,scope:{...scope,settlementMonth:month},calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),totals:{totalSettlementAmount:37,paymentCount:1},lines:[]});
const confirmed=month=>({ok:true,state:"CONFIRMED",scope:{...scope,settlementMonth:month},snapshot:{snapshotId:"synthetic-snapshot",revision:1,status:"calculated",calculationVersion:"r3_effective_settlement_v2",sourceFingerprint:"a".repeat(64),totals:{settledSessions:1,settledMinutes:40,totalSettlementAmount:37}},confirmation:{confirmationId:"synthetic-confirm",status:"confirmed",confirmationVersion:"r3_monthly_settlement_confirmation_v1",confirmedAt:"2099-01-01T00:00:00Z"},reconciliation:null});
function admin(root,side) {
  const priv=side==="private",pending=[],history={coachRoleId:"synthetic-role",requestId:0,request:0,value:{old:true},preview:{old:true},scopeState:{old:true},loadedSignature:"old",snapshotOperationKey:"old",confirmationOperationKey:"old",submitting:false,loading:false};
  const c=vm.createContext({window:{},Date,Intl,state:{billingMonth:"2099-01"},monthlySettlementConfirmationState:history,adminDemoMode:false,
    adminImportAuthState:{user:{id:"synthetic-auth"},profile:{id:"synthetic-admin",role:"admin"}},operationsRole:()=>c.adminImportAuthState.profile?.role,
    operationsAccessReady:()=>true,adminApprovalReady:()=>true,isAdminViewLocked:()=>false,isAdminUnlocked:()=>true,adminPinNeedsSetup:()=>false,
    activeOperationBranchId:()=>scope.branchId,operationBranchCoaches:()=>[{serverRoleId:scope.coachRoleId,branchId:scope.branchId,status:"active"}],
    createAdminOperationKey:prefix=>prefix+":synthetic",renderAdminSettlementHistory:()=>{},renderMonthlySettlementConfirmation:()=>{}});
  if(priv){const s=read(path.join(root,"90-Dashboard/tennis-note-prototype/app.js"));const names=["monthlySettlementMonthStart","monthlySettlementScope","monthlySettlementScopeSignature","monthlySettlementPayloadScope","monthlySettlementScopeMatches","monthlySettlementPreviewHasSources","monthlySettlementSnapshotFrom","monthlySettlementSnapshotMatchesPreview","resetMonthlySettlementConfirmation","monthlySettlementEnsureOperationKeys","monthlySettlementErrorContract","refreshMonthlySettlementConfirmation"];vm.runInContext(names.map(n=>extract(s,n)).join("\n"),c);}
  else {vm.runInContext(read(path.join(root,"app/admin/domain/billing.js"))+"\n"+read(path.join(root,"app/admin/data/billing.js")),c);vm.runInContext('adminSettlementHistory.coachRoleId="synthetic-role"',c);}
  c.window.TennisNoteDataClient={getSession:()=>({access_token:"synthetic-memory-session"}),rpc:(name,args)=>{const p=deferred();pending.push({...p,name,args});return p.promise;}};
  return {c,pending,history:()=>priv?history:vm.runInContext("adminSettlementHistory",c),refresh:()=>priv?c.refreshMonthlySettlementConfirmation({force:true}):c.refreshAdminSettlementHistory({force:true}),scope:()=>priv?c.monthlySettlementScope():c.adminSettlementHistoryScope()};
}
function register(test,root,side) {
  const prefix="CI39 delta "+side+": ";
  for(const mode of ["direct","registered-click"])test(prefix+"logout "+mode+" clears once before await and rejects late ledger",async()=>{
    const s=coach(root,side),old=s.c.coachSettlementReconciliationContinuation();assert.equal(old(),true);
    const work=mode==="direct"?s.c.logoutCoach():s.click();assert.equal(s.c.state.coach,null);assert.equal(s.c.state.liveProfileId,"");
    assert.equal(s.stats.reset,1);assert.equal(s.stats.render,1);assert.equal(s.history.coachSettlementReconciliation,null);assert.equal(old(),false);
    assert.equal(s.c.coachSettlementRequestSequence,1);assert.equal(s.c.coachSettlementSelection,null);assert.equal(s.stats.push,1);assert.equal(s.stats.signout,0);
    s.push.resolve();assert.equal(await work,true);assert.equal(s.stats.signout,1);assert.equal(s.stats.returns,1);
  });
  test(prefix+"failed push does not restore authority",async()=>{const s=coach(root,side),work=s.c.logoutCoach();s.push.reject(Error("synthetic-push-failure"));assert.equal(await work,true);assert.equal(s.c.state.coach,null);assert.equal(s.stats.reset,1);assert.equal(s.stats.signout,1);});
  test(prefix+"signOut failure remains cleared and offers retry",async()=>{const s=coach(root,side);s.c.window.TennisNoteDataClient.signOut=async()=>{s.stats.signout++;throw Error("synthetic-signout-failure");};const work=s.c.logoutCoach();s.push.resolve();assert.equal(await work,false);assert.equal(s.c.state.coach,null);assert.equal(s.stats.returns,0);assert.equal(s.stats.access,1);});
  test(prefix+"new login during old push is not signed out",async()=>{const s=coach(root,side),work=s.c.logoutCoach();s.newIdentity();s.push.resolve();assert.equal(await work,false);assert.equal(s.stats.signout,0);assert.equal(s.stats.returns,0);assert.equal(s.c.coachPushProfileId,"synthetic-profile");assert.equal(s.c.state.liveProfileId,"synthetic-new-profile");});
  test(prefix+"new login while signOut pending is not navigated away",async()=>{const s=coach(root,side);s.holdSignout();const work=s.c.logoutCoach();s.push.resolve();await tick();assert.equal(s.stats.signout,1);s.newIdentity();s.signout.resolve();assert.equal(await work,false);assert.equal(s.stats.returns,0);assert.equal(s.c.state.liveProfileId,"synthetic-new-profile");});
  test(prefix+"late profile response after logout cannot revive coach",async()=>{const s=coach(root,side),apply=s.c.applySupabaseCoachSession();await tick();const work=s.c.logoutCoach();s.profile.resolve(s.profileValue());assert.equal(await apply,false);assert.equal(s.c.state.coach,null);s.push.resolve();await work;});
  test(prefix+"late profile rejection cannot clear a newer identity",async()=>{const s=coach(root,side),apply=s.c.applySupabaseCoachSession();await tick();const work=s.c.logoutCoach();s.newIdentity();s.profile.reject(Error("synthetic-profile-failure"));assert.equal(await apply,false);assert.equal(s.c.state.liveProfileId,"synthetic-new-profile");s.push.resolve();await work;});
  test(prefix+"late background refresh after logout has no render or followup",async()=>{const s=coach(root,side),apply=s.c.applySupabaseCoachSession();await tick();s.profile.resolve(s.profileValue());assert.equal(await apply,true);const renders=s.stats.renderAll,work=s.c.logoutCoach();s.schedule.resolve(true);await tick();assert.equal(s.stats.renderAll,renders);assert.equal(s.c.state.coach,null);s.push.resolve();await work;});
  test(prefix+"invalid month matrix clears cache and has zero RPC",async()=>{
    for(const month of ["2099-00","2099-13","2099-1","2099-01-01","2099-01T00:00"," 2099-01","2099-01 ","２０９９-０１","0000-01",""]){const s=admin(root,side);s.c.state.billingMonth=month;await s.refresh();assert.equal(s.pending.length,0,month);assert.equal(s.scope().settlementMonth,"");assert.equal(s.history().preview,null);assert.equal(s.history().scopeState,null);assert.equal(s.history().snapshotOperationKey,"");assert.equal(s.history().errorCode,"settlement_month_invalid");}
  });
  for(const month of ["2099-01","2099-12"])test(prefix+"valid month boundary "+month+" retains exact producer readback",async()=>{const s=admin(root,side);s.c.state.billingMonth=month;const work=s.refresh();assert.equal(s.pending.length,1);assert.equal(s.pending[0].args.target_month,month+"-01");s.pending[0].resolve(preview(month+"-01"));await tick();assert.equal(s.pending.length,2);assert.equal(s.pending[1].args.target_month,month+"-01");s.pending[1].resolve(confirmed(month+"-01"));await work;assert.equal(s.history().status,"CONFIRMED");});
  test(prefix+"valid pending read then invalid month rejects late response",async()=>{const s=admin(root,side),old=s.refresh();s.c.state.billingMonth="2099-13";await s.refresh();s.pending[0].resolve(preview("2099-01-01"));await old;assert.equal(s.pending.length,1);assert.equal(s.history().errorCode,"settlement_month_invalid");assert.equal(s.history().preview,null);});
  test(prefix+"invalid then explicit valid retry succeeds once",async()=>{const s=admin(root,side);s.c.state.billingMonth="2099-00";await s.refresh();assert.equal(s.pending.length,0);s.c.state.billingMonth="2099-12";const work=s.refresh();s.pending[0].resolve(preview("2099-12-01"));await tick();s.pending[1].resolve(confirmed("2099-12-01"));await work;assert.equal(s.pending.length,2);assert.equal(s.history().status,"CONFIRMED");});
  test(prefix+"month change and new identity fence prior read",async()=>{const s=admin(root,side),old=s.refresh();s.c.adminImportAuthState.profile.id="synthetic-new-admin";s.pending[0].resolve(preview("2099-01-01"));await old;assert.equal(s.pending.length,1);assert.equal(s.history().preview,null);});
  if(side==="public")test(prefix+"explicit invalid direct scope read and continuation have zero RPC",async()=>{const s=admin(root,side),bad={...scope,settlementMonth:"2099-13-01"};assert.equal(s.c.adminSettlementHistoryContinuation(bad),null);assert.equal(await s.c.readMonthlySettlementConfirmation(bad),null);assert.equal(s.pending.length,0);});
  if(side==="private")registerActual(test,root,side);
}
// 실제 IIFE/API를 사용한다. 저장소·DB·통신만 격리하며 인증 함수는 대체하지 않는다.
function actualEnvironment(options={}) {
  const pending=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
  const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>{values.delete(key);},values};};
  const localStorage=memory(),sessionStorage=memory(),events=new Map(),push=pending(),logout=pending();
  const stats={push:0,logout:0,events:0,oldHeaders:0,newHeaders:0,deleted:0,aborted:0,completed:0,network:0};
  const authKey="tennis-note-supabase-session",providerKey=authKey+"-provider",persistenceKey="tennis-note-auth-persistence";
  const records=new Map([["synthetic-old:route",{key:"synthetic-old:route",identity:"synthetic-old",payload:{version:"old"}}]]);
  const old={access_token:"synthetic-old-memory-token",user:{id:"synthetic-old"}};
  const fresh=same=>({access_token:"synthetic-new-memory-token",user:{id:same?"synthetic-old":"synthetic-new"}});
  function put(session,persistence="local") {
    localStorage.setItem(persistenceKey,persistence);
    for(const store of persistence==="session"?[sessionStorage]:[localStorage,sessionStorage]){
      store.setItem(authKey,JSON.stringify(session));store.setItem(providerKey,session===old?"synthetic-old-provider":"synthetic-new-provider");
    }
    if(persistence==="session"){localStorage.removeItem(authKey);localStorage.removeItem(providerKey);}
  }
  put(old,options.persistence||"local");
  const idb={opens:[],transactions:[],records};
  const database={close(){},objectStoreNames:{contains:()=>true},transaction(){
    const staged=[],transaction={done:false,request:null,keys:[],index:0,
      abort(){if(this.done)return;this.done=true;staged.length=0;stats.aborted++;this.onabort?.();},
      complete(){if(this.done)return;this.done=true;for(const key of staged){records.delete(key);stats.deleted++;}stats.completed++;this.oncomplete?.();},
      step(){if(this.done)return;const key=this.keys[this.index++];this.request.result=key?{primaryKey:key,continue:()=>{if(!options.holdCursor)queueMicrotask(()=>this.step());}}:null;this.request.onsuccess?.();if(!key&&!this.done)this.complete();},
      objectStore(){return {index:()=>({openKeyCursor:identity=>{this.keys=[...records].filter(([,r])=>r.identity===identity).map(([key])=>key);this.request={};if(!options.holdCursor)queueMicrotask(()=>this.step());return this.request;}}),delete:key=>staged.push(key)};}};
    idb.transactions.push(transaction);return transaction;
  }};
  const indexedDB={open(){const request={};idb.opens.push(request);if(!options.holdOpen)queueMicrotask(()=>{request.result=database;request.onsuccess?.();});return request;}};
  const response=()=>({ok:true,status:200,json:async()=>[],text:async()=>"[]"});
  const fetch=async(url,init)=>{
    if(init.headers.Authorization==="Bearer "+old.access_token)stats.oldHeaders++;else stats.newHeaders++;
    if(url.endsWith("/rest/v1/rpc/tn_disable_push_device")){stats.push++;return push.promise;}
    if(url.endsWith("/auth/v1/logout")){stats.logout++;return logout.promise;}
    stats.network++;throw Error("예상 밖 합성 요청");
  };
  const window={localStorage,sessionStorage,indexedDB,IDBKeyRange:{only:v=>v},location:{href:"https://synthetic.invalid/coach",pathname:"/coach"},
    TENNISNOTE_CONFIG:{supabaseUrl:"https://synthetic.invalid",supabasePublishableKey:"synthetic-publishable"},
    setTimeout,clearTimeout,addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
    dispatchEvent:event=>{if(event.type==="tennisnote:auth-session-cleared")stats.events++;for(const fn of events.get(event.type)||[])fn(event);return true;}};
  return {window,stats,localStorage,sessionStorage,idb,fetch,response,old,fresh,put,push,logout,authKey,providerKey,persistenceKey,
    releaseOpen(){for(const request of idb.opens){request.result=database;request.onsuccess?.();}},
    seedNewCache(same=true){const session=fresh(same);records.set(session.user.id+":route",{key:session.user.id+":route",identity:session.user.id,payload:{version:"new"}});}};
}
function actualClientSource(root,side){return read(path.join(root,side==="private"?"90-Dashboard/shared/tennisnote-data-client.js":"app/shared/tennisnote-data-client.js"));}
function coupledCoach(root,side,options={}) {
  const env=actualEnvironment(options),source=coachSources(root,side),buttons=new Map(),priv=side==="private";
  const stats={reset:0,render:0,returns:0,access:0};
  const history={coachSettlementReconciliationRequestId:0,coachSettlementReconciliation:{old:true}};
  const state={coach:{role:"coach",authUserId:"synthetic-old"},liveProfileId:"synthetic-profile",...history};
  class SyntheticEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
  const c=vm.createContext({window:env.window,localStorage:env.localStorage,sessionStorage:env.sessionStorage,navigator:{onLine:true},
    Event:SyntheticEvent,CustomEvent:SyntheticEvent,URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,setTimeout,clearTimeout,queueMicrotask,fetch:env.fetch,
    state,coachSettlementHistory:history,coachSettlementHistoryPending:null,coachSettlementRequestSequence:0,coachSettlementSelection:{old:true},coachPushProfileId:"synthetic-profile",
    currentCoachPushDeviceId:()=>"synthetic-device",setCoachPushNotificationState:()=>{},setCoachAccessMessage:()=>stats.access++,returnToMemberEntry:()=>stats.returns++,
    renderCoachSettlementHistory:()=>stats.render++,renderCoachSettlementReconciliation:()=>stats.render++,
    coachSettlementReconciliationScope:()=>({branchId:"synthetic-branch",coachRoleId:"synthetic-role",settlementMonth:"2099-01-01"}),
    coachSettlementReconciliationScopeSignature:()=>"synthetic-scope",
    $:selector=>{if(!buttons.has(selector))buttons.set(selector,{addEventListener:(kind,fn)=>{buttons.get(selector)[kind]=fn;}});return buttons.get(selector);}});
  vm.runInContext(options.actualSource||actualClientSource(root,side),c);
  vm.runInContext([source.reset,source.continuation,source.logout,source.push,source.binding].join("\n"),c);
  const name=priv?"resetCoachSettlementReconciliation":"resetCoachSettlementHistory",reset=c[name];c[name]=()=>{stats.reset++;return reset();};
  return {env,c,stats,client:c.window.TennisNoteDataClient,click:()=>buttons.get("#coachLogoutButton").click(),
    replacement(same=true,persistence="local",adopt=true){env.put(env.fresh(same),persistence);if(adopt){state.coach={role:"coach",authUserId:"synthetic-new"};state.liveProfileId="synthetic-new-profile";}}};
}
function registerActual(test,root,side) {
  const prefix="CI39 shared actual "+side+": ";
  for(const mode of ["direct","registered-click"])test(prefix+mode+" 실제 클라이언트 정상 정리",async()=>{
    const s=coupledCoach(root,side),work=mode==="direct"?s.c.logoutCoach():s.click();
    assert.equal(s.c.state.coach,null);assert.equal(s.stats.reset,1);assert.equal(s.stats.render,1);assert.equal(s.env.stats.push,1);
    s.env.push.resolve(s.env.response());await tick();assert.equal(s.client.getSession(),null);assert.equal(s.env.stats.events,1);assert.equal(s.env.stats.logout,1);
    s.env.logout.resolve(s.env.response());assert.equal(await work,true);assert.equal(s.stats.returns,1);assert.equal(s.env.stats.oldHeaders,2);assert.equal(s.env.stats.newHeaders,0);assert.equal(s.env.idb.records.size,0);
  });
  for(const same of [false,true])for(const outcome of ["success","failure","lost-response"])test(prefix+(same?"동일 사용자 새 토큰":"새 사용자")+" / "+outcome,async()=>{
    const s=coupledCoach(root,side,{holdOpen:true}),work=s.click();s.env.push.resolve(s.env.response());await tick();assert.equal(s.env.stats.logout,1);
    s.replacement(same,"session");s.env.seedNewCache(same);s.env.releaseOpen();await tick();
    assert.equal(s.env.stats.deleted,0);assert.equal(s.env.stats.aborted,1);
    if(outcome==="success")s.env.logout.resolve(s.env.response());else if(outcome==="failure")s.env.logout.reject(Error("합성 실패"));
    else {await tick();assert.equal(s.client.getSession().access_token===s.env.fresh(same).access_token,true);assert.equal(s.stats.returns,0);s.env.logout.reject(Error("합성 응답 유실 종료"));}
    assert.equal(await work,false);assert.equal(s.stats.returns,0);assert.equal(s.client.getSession().access_token===s.env.fresh(same).access_token,true);
    assert.equal(s.env.sessionStorage.getItem(s.env.providerKey),"synthetic-new-provider");assert.equal(s.client.sessionPersistence(),"session");assert.equal(s.env.stats.events,1);assert.equal(s.env.stats.newHeaders,0);
    assert.equal(s.env.idb.records.get(s.env.fresh(same).user.id+":route").payload.version,"new");
  });
  test(prefix+"이벤트 재진입 새 세션 / local·session",async()=>{
    for(const persistence of ["local","session"]){const s=coupledCoach(root,side,{holdOpen:true,persistence});s.env.window.addEventListener("tennisnote:auth-session-cleared",()=>s.replacement(true,persistence));
      const work=s.client.signOut();assert.equal(s.env.stats.logout,1);s.env.seedNewCache();s.env.releaseOpen();s.env.logout.resolve(s.env.response());await work;
      assert.equal(s.client.getSession().access_token===s.env.fresh(true).access_token,true);assert.equal(s.env.stats.deleted,0);assert.equal(s.env.stats.events,1);assert.equal(s.env.stats.oldHeaders,1);}
  });
  test(prefix+"cursor 중 교체는 이미 계획된 삭제도 원자 폐기",async()=>{
    const s=coupledCoach(root,side,{holdCursor:true}),work=s.client.signOut();await tick();const tx=s.env.idb.transactions[0];tx.step();
    s.replacement(true);s.env.seedNewCache();tx.step();s.env.logout.resolve(s.env.response());await work;
    assert.equal(s.env.stats.aborted,1);assert.equal(s.env.stats.deleted,0);assert.equal(s.env.idb.records.get("synthetic-old:route").payload.version,"new");
  });
  test(prefix+"push 대기 중 새 로그인은 실제 signOut 요청 0",async()=>{
    const s=coupledCoach(root,side),work=s.click();s.replacement();s.env.push.resolve(s.env.response());assert.equal(await work,false);assert.equal(s.env.stats.logout,0);assert.equal(s.stats.returns,0);
  });
  test(prefix+"저장소 정리 실패는 성공으로 가장하지 않음",async()=>{
    const s=coupledCoach(root,side);s.env.sessionStorage.removeItem=()=>{throw Error("합성 저장소 제한");};
    await assert.rejects(s.client.signOut(),/auth_session_clear_failed/);assert.equal(s.env.stats.logout,0);assert.equal(s.env.stats.events,0);
  });
  test(prefix+"중복 호출·무세션은 이전 서명 요청 추가 0",async()=>{
    const s=coupledCoach(root,side),first=s.client.signOut(),second=s.client.signOut();s.env.logout.resolve(s.env.response());await Promise.all([first,second]);assert.equal(s.env.stats.logout,1);assert.equal(s.env.stats.oldHeaders,1);
    await s.client.signOut();assert.equal(s.env.stats.logout,1);assert.equal(s.client.getSession(),null);
  });
  test(prefix+"일반 cache cleanup 기존 의미 유지",async()=>{
    const s=coupledCoach(root,side);assert.equal(await s.client.clearOfflineResponses("synthetic-old"),true);assert.equal(s.env.stats.deleted,1);assert.equal(s.client.getSession().access_token===s.env.old.access_token,true);
  });
}
module.exports={register,coachSources,extract,read,actualEnvironment,actualClientSource,coupledCoach,registerActual};
