// 합성 계약은 private 860b53fa의 checker에서 기계적으로 추출. 외부 요청/DB 없음.
const helperNames = ["invalidateMemberHomeSchedule", "memberHomeScheduleReadKey", "memberHomeScheduleAuthority", "memberHomeScheduleLessons", "memberHomeScheduleTicketKey", "loadMemberHomeScheduleWorkspace", "captureMemberHomeSchedule"];
const names = [...helperNames, "memberScheduleV2Context", "scheduleV2MemberOutcomeStatus", "scheduleV2MemberLessonKind", "applyScheduleV2MemberWorkspace", "memberLessonTicketId", "upcomingMemberLessons", "memberScheduleRoundLabel", "memberHomeUpcomingLessonsMarkup", "syncMemberScheduleV2", "syncMemberLessonsFromServer", "readMemberLessonsFromServer", "refreshMemberLiveSchedule", "installMemberLiveScheduleRefresh", "installMemberScheduleRevisionWatcher", "installMemberConnectivityStatus", "memberScheduleIdentityIssue", "rejectMemberScheduleIdentity"];
const bootstrap = `
var state = { dataMode: "live", member: { profileId: "member-a" }, liveLessons: [], liveLessonsLoaded: true };
var memberHomeScheduleSnapshot = null, memberScheduleV2WorkspaceCache = null, memberScheduleV2RequestSequence = 0;
var memberHomeScheduleInFlight = null, memberHomeScheduleEpoch = 0, today = "2026-10-05";
var memberLiveScheduleRefreshInFlight = null, memberLiveScheduleLastRefreshKey = "", memberLiveScheduleLastRefreshAt = 0;
var MEMBER_LIVE_REFRESH_STALE_MS = 20000, ticketReads = 0;
var memberLiveScheduleRefreshTimer = 0;
function enterMemberCurriculum() {}
function renderMemberConnectivityStatus() {}
function memberRevisionBranchId() { return "synthetic-branch"; }
function $(selector) { return {hidden:false}; }
async function syncMemberTicketsFromServer() { ticketReads++; return true; }
async function syncMemberRefundRequests() {}
async function syncMemberPendingPurchaseSchedulesFromServer() {}
async function syncMemberChangeRequestsFromServer() { return true; }
async function syncMemberNotificationsFromServer() { return {ok:true}; }
async function syncMemberPaymentOptionsFromServer() {}
async function syncMemberDiscountCouponsFromServer() {}
function renderActiveMemberView() {}
function showToast() {}
var memberScheduleWorkspaceDays = 31, memberScheduleRevisionWatcher = null;
var days = ["월", "화", "수", "목", "금", "토", "일"], view = "homeView";
function localDateKey(value) { if (!value) return today; const pad = n => String(n).padStart(2, "0"); return value.getFullYear()+"-"+pad(value.getMonth()+1)+"-"+pad(value.getDate()); }
function activeMemberWeek() { return {startDate:"2026-11-23"}; }
function activeMemberViewId() { return view; }
function currentMemberName() { return "합성회원"; }
function isOwnMemberScheduleLesson(row) { return row.isOwnLesson === true; }
function memberLessonPriority() { return {group:0}; }
function compareMemberLessonsByNearest(a,b) { return (a.lessonDate+a.time).localeCompare(b.lessonDate+b.time); }
function mergeScheduleV2MemberRecords() {}
function renderMemberRuntimeDiagnostics() {}
async function hydrateMemberWorkspaceSessionSnapshots(client, workspace) { return workspace; }
async function loadMemberOwnOneDayBookingIds() { return new Set(); }
function memberOneDayLessonFromSlot(row) { return row; }
function memberTicketSessionSnapshot(row) { return {label:row.immutableLabel || "기록 당시 회차 미확정"}; }
function memberScheduleTicketOptions() { return [{id:"old",title:"합성권"},{id:"new",title:"합성권"}]; }
function memberTicketCompactLabel(t) { return t.title; }
function memberLessonChangeContext() { return null; }
function memberCoachShortName() { return "합성코치"; }
function lessonDateTimeLabel(l) { return l.lessonDate; }
function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, "_"); }
`;

async function runCases() {
  const cases = [];
  const check = (name, actual, expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(name); cases.push(name); };
  const copy = x => JSON.parse(JSON.stringify(x));
  const tickets = [{id:"new",status:"active",totalSessions:5,usedSessions:0,remainingSessions:5,startsOn:"2026-10-26",expiresOn:"2026-11-30"}];
  const dates = ["2026-10-26","2026-11-02","2026-11-09","2026-11-16","2026-11-23"];
  const fresh = dates.map((lessonDate,i) => ({id:"new-"+i,memberTicketId:"new",lessonDate,startTime:"06:40",status:"scheduled",isOwnLesson:true,durationMinutes:20,revision:1}));
  const old = ["2026-10-19",...dates.slice(0,4)].map((lessonDate,i)=>({id:"old-"+i,ticketId:"old",lessonDate,time:"06:40",status:"scheduled",isOwnLesson:true,ticketTotalSessions:5}));
  let serverTickets = copy(tickets), serverRows = copy(fresh), fault = "", reads = [];
  const client = { readiness:()=>({ready:true}), getSession:()=>({access_token:"synthetic-session"}), rpc:async (name,args) => {
    if (name !== "tn_schedule_v2_member_workspace") return name === "tn_current_member_schedule_integrity" ? null : [];
    reads.push(args);
    if (fault === "failure" && reads.length > 1) throw Error("synthetic_network_failure");
    if (fault === "superseded") memberScheduleV2RequestSequence++;
    const rows = serverRows.filter(r=>r.lessonDate>=args.target_from&&r.lessonDate<=args.target_to);
    const response = {actorUserId:fault==="actor"?"other-member":"member-a",from:args.target_from,to:args.target_to,tickets:copy(serverTickets),lessons:copy(rows),branches:[],coaches:[]};
    if (fault === "ticket-drift" && reads.length>1) response.tickets[0].usedSessions++;
    return response;
  }};
  window.TennisNoteDataClient = client;
  const reset = () => { state.member={profileId:"member-a"}; state.liveTickets=[]; state.liveLessons=[...copy(old),...copy(fresh.slice(3)).map(x=>({...x,ticketId:"new",time:"06:40",ticketTotalSessions:5}))]; state.scheduleV2SyncErrorCode=""; memberHomeScheduleSnapshot=null; memberHomeScheduleInFlight=null;memberHomeScheduleEpoch=0;memberLiveScheduleRefreshInFlight=null;memberLiveScheduleLastRefreshAt=0;ticketReads=0;today="2026-10-05"; memberScheduleV2WorkspaceCache={key:"calendar-sentinel"}; view="homeView"; fault="";reads=[];serverTickets=copy(tickets);serverRows=copy(fresh); };
  const refresh = () => syncMemberLessonsFromServer(null,{force:true});
  reset();
  check("no-snapshot-no-stale-home",upcomingMemberLessons(24),[]);
  check("partial-round-is-unknown",memberScheduleRoundLabel(old[0],true),"");
  check("home-refresh-success",await refresh(),true);
  check("home-context-not-last-calendar-week",reads[0].target_from,"2026-10-05");
  check("rpc-31-day-limit",reads.every(x=>(new Date(x.target_to)-new Date(x.target_from))/86400000<=31),true);
  check("home-new-five-exact",upcomingMemberLessons(24).map(x=>x.id),fresh.map(x=>x.id));
  check("home-rounds",upcomingMemberLessons(24).map(x=>memberScheduleRoundLabel(x,true)),["1/5회차","2/5회차","3/5회차","4/5회차","5/5회차"]);
  check("calendar-cache-preserved",memberScheduleV2WorkspaceCache.key,"calendar-sentinel");
  const markup=memberHomeUpcomingLessonsMarkup(upcomingMemberLessons(24));
  check("three-card-cap-preserved",(markup.match(/data-home-change-lesson=/g)||[]).length,3);
  check("old-ticket-not-in-home",markup.includes('data-home-ticket-id="old"'),false);
  view="scheduleView"; reads=[];
  check("calendar-narrow-success",await syncMemberLessonsFromServer(null,{force:true,week:{startDate:"2026-11-23"}}),true);
  check("calendar-narrow-range",reads[0].target_from,"2026-11-23");
  check("narrow-does-not-restart-home",memberScheduleRoundLabel(upcomingMemberLessons(24)[4],true),"5/5회차");
  view="homeView";check("return-refresh",await refresh(),true);
  const past={id:"past",lessonDate:"2025-01-01",status:"completed",isOwnLesson:true,participantRecord:{recordStatus:"final",immutableLabel:"이번 수업 2/5회차"}};
  state.liveLessons.push(past);await refresh();
  check("past-calendar-retained",state.liveLessons.some(x=>x.id==="past"),true);
  check("final-snapshot-preserved",memberScheduleRoundLabel(past,true),"이번 수업 2/5회차");
  reset();serverTickets[0].totalSessions=7;serverTickets[0].usedSessions=2;await refresh();
  check("used-offset",upcomingMemberLessons(24).map(x=>memberScheduleRoundLabel(x,true)),["3/7회차","4/7회차","5/7회차","6/7회차","7/7회차"]);
  reset();serverTickets.push({...tickets[0],id:"other-ticket"});serverRows.push({...fresh[0],id:"other-lesson",memberTicketId:"other-ticket"});await refresh();
  check("multiple-exact-ticket-round",memberScheduleRoundLabel(upcomingMemberLessons(24).find(x=>x.id==="other-lesson"),true),"1/5회차");
  state.member={profileId:"another-login"};check("new-login-isolated",upcomingMemberLessons(24),[]);
  reset();serverTickets=[];serverRows=[];await refresh();check("empty-clears-only-home",upcomingMemberLessons(24),[]);
  reset();serverTickets[0].expiresOn=null;await refresh();check("unknown-period-no-round",memberScheduleRoundLabel(upcomingMemberLessons(24)[0],true),"");
  reset();serverTickets[0].status="voided";await refresh();check("voided-ticket-excluded",upcomingMemberLessons(24),[]);
  reset();serverRows[0].status="cancelled";await refresh();check("cancelled-row-excluded",upcomingMemberLessons(24).some(x=>x.id==="new-0"),false);
  reset();serverRows.push({...fresh[0],id:"other-participant",isOwnLesson:false});await refresh();check("other-participant-not-visible",upcomingMemberLessons(24).length,5);
  reset();serverTickets[0].startsOn="2026-02-31";await refresh();check("invalid-period-no-round",memberScheduleRoundLabel(upcomingMemberLessons(24)[0],true),"");
  for (const failure of ["actor","failure","ticket-drift","superseded"]) {
    reset();fault=failure;check(failure+"-fail-closed",await refresh(),false);check(failure+"-no-partial-home",upcomingMemberLessons(24),[]);
  }
  reset();serverTickets[0].expiresOn="2035-01-01";check("bounded-range-fail",await refresh(),false);check("range-limit-no-partial",upcomingMemberLessons(24),[]);
  reset();await refresh();serverRows=[];view="scheduleView";await syncMemberLessonsFromServer(null,{force:true,week:{startDate:"2026-11-23"}});check("deleted-calendar-row-invalidates-home",upcomingMemberLessons(24),[]);
  reset();
  check("concurrent-home-shared",await Promise.all([refreshMemberLiveSchedule(),refreshMemberLiveSchedule(),refreshMemberLiveSchedule()]),[true,true,true]);
  check("five-week-workspace-reads",reads.length,2);
  check("concurrent-ticket-read-once",ticketReads,1);
  view="profileView";view="homeView";
  await refreshMemberLiveSchedule();await refreshMemberLiveSchedule();
  check("reentry-workspace-extra-zero",reads.length,2);check("reentry-ticket-extra-zero",ticketReads,1);
  await Promise.all([refreshMemberLiveSchedule({force:true}),refreshMemberLiveSchedule({force:true})]);
  check("explicit-force-one-set",reads.length,4);check("force-ticket-once",ticketReads,2);
  memberHomeScheduleSnapshot.loadedAt -= 10001;
  check("expired-authority-hidden",upcomingMemberLessons(24),[]);
  await refreshMemberLiveSchedule();check("expired-refresh-bypasses-outer-throttle",reads.length,6);
  state.liveTickets=copy(serverTickets);check("ticket-change-invalidates",memberHomeScheduleAuthority(),null);
  await refreshMemberLiveSchedule();check("ticket-change-refresh",reads.length,8);
  today="2026-10-06";check("day-change-invalidates",memberHomeScheduleAuthority(),null);
  await refreshMemberLiveSchedule();check("day-change-refresh",reads.length,10);
  invalidateMemberHomeSchedule();await refreshMemberLiveSchedule();check("revision-or-logout-epoch-refresh",reads.length,12);
  fault="failure";check("force-page-failure",await refresh(),false);check("failed-authority-does-not-reuse-good-card",upcomingMemberLessons(24),[]);
  reset();serverTickets=[];serverRows=[];fault="actor";check("empty-ticket-failure",await refresh(),false);check("empty-ticket-failure-code",state.scheduleV2SyncErrorCode,"member_schedule_load_failed");
  const costs=[];
  for(const [label,start,end] of [["five-week","2026-10-26","2026-11-30"],["three-month","2026-10-05","2027-01-02"],["elapsed-three-month","2026-08-06","2026-11-03"],["aligned-limit","2026-10-05","2028-11-10"],["unaligned-limit","2026-10-04","2028-11-09"]]){
    reset();serverTickets[0].startsOn=start;serverTickets[0].expiresOn=end;
    check(label+"-loaded",await refresh(),true);
    const datesRead=new Set();let overlaps=0;
    for(const r of reads) for(let d=new Date(r.target_from+"T12:00:00");localDateKey(d)<=r.target_to;d.setDate(d.getDate()+1)){const k=localDateKey(d);if(datesRead.has(k))overlaps++;datesRead.add(k);}
    check(label+"-no-overlap",overlaps,0);check(label+"-bounded-25",reads.length<=25,true);
    costs.push({label,workspaceRpc:reads.length,inclusiveDays:datesRead.size});
  }
  check("measured-workspace-counts",costs.map(x=>x.workspaceRpc),[2,3,3,24,25]);
  reset();const one=syncMemberLessonsFromServer();const two=syncMemberLessonsFromServer();await Promise.all([one,two]);check("direct-inflight-deduped",reads.length,2);
  reset();const obsolete=refresh();invalidateMemberHomeSchedule();await obsolete;check("epoch-during-read-no-authority",memberHomeScheduleAuthority(),null);
  reset();await refresh();return {passed:cases.length,costs,markup:memberHomeUpcomingLessonsMarkup(upcomingMemberLessons(24))};
}

// 실제 제품의 이벤트 등록 함수를 실행하고, 등록된 callback에 합성 경합을 전달한다.
// 외부 이벤트/네트워크/DB 없이 force 보장의 의미를 검사한다.
async function runRefreshEventCases() {
  const cases=[];
  const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name);cases.push(name);};
  const handlers={};
  const old={windowAdd:window.addEventListener,documentAdd:document.addEventListener,interval:window.setInterval,
    revision:window.TennisNoteScheduleRevision,hidden:Object.getOwnPropertyDescriptor(document,"hidden")};
  window.addEventListener=(name,fn)=>{handlers[name]=fn;};
  document.addEventListener=(name,fn)=>{handlers[name]=fn;};
  window.setInterval=()=>1;
  Object.defineProperty(document,"hidden",{value:false,configurable:true});
  let revisionHandler,version=1,reads=0,release=null;
  let pauseNext=false;
  const drain=async()=>{for(let i=0;i<100;i++){await Promise.resolve();if(!memberLiveScheduleRefreshInFlight&&!memberHomeScheduleInFlight)return;}throw Error("event_read_did_not_settle");};
  const untilPaused=async()=>{for(let i=0;i<100&&!release;i++)await Promise.resolve();check("request-paused-for-race",typeof release,"function");};
  const ticket={id:"event-ticket",status:"active",totalSessions:5,usedSessions:0,remainingSessions:5,startsOn:"2026-10-05",expiresOn:"2026-10-30"};
  const client={readiness:()=>({ready:true}),getSession:()=>({access_token:"synthetic-session"}),rpc:async(name,args)=>{
    if(name!=="tn_schedule_v2_member_workspace")return name==="tn_current_member_schedule_integrity"?null:[];
    reads++;
    const response={actorUserId:"member-a",from:args.target_from,to:args.target_to,tickets:[ticket],branches:[],coaches:[],
      lessons:[{id:"event-"+version,memberTicketId:ticket.id,lessonDate:"2026-10-26",startTime:"06:40",status:"scheduled",isOwnLesson:true,durationMinutes:20,revision:version}]};
    if(pauseNext){pauseNext=false;await new Promise(resolve=>{release=resolve;});}
    return response;
  }};
  try{
    state.member={profileId:"member-a"};state.liveTickets=[ticket];state.liveLessons=[];state.scheduleV2SyncErrorCode="";
    today="2026-10-05";view="homeView";memberHomeScheduleSnapshot=null;memberHomeScheduleInFlight=null;
    memberLiveScheduleRefreshInFlight=null;memberHomeScheduleEpoch=0;memberLiveScheduleRefreshTimer=0;memberScheduleRevisionWatcher=null;
    window.TennisNoteDataClient=client;window.TennisNoteScheduleRevision={watch:options=>{revisionHandler=options.onChange;return {check:()=>{}};}};
    installMemberLiveScheduleRefresh();installMemberScheduleRevisionWatcher();installMemberConnectivityStatus();
    check("real-event-wiring",Object.keys(handlers).sort(),["focus","offline","online","visibilitychange"]);
    check("real-revision-wiring",typeof revisionHandler,"function");
    await handlers.focus();check("focus-initial-read",reads,1);
    await refreshMemberLiveSchedule();check("ordinary-fresh-reentry-no-read",reads,1);
    version=2;pauseNext=true;release=null;const focus=handlers.focus();await untilPaused();
    handlers.visibilitychange();check("focus-visibility-share-one-read",reads,2);
    release();await focus;await drain();check("force-bypasses-completed-freshness",reads,2);
    check("focus-new-server-result",upcomingMemberLessons(24).map(r=>r.id),["event-2"]);
    version=3;pauseNext=true;release=null;const beforeReconnect=handlers.focus();await untilPaused();
    version=4;handlers.online();check("reconnect-immediately-revokes-authority",memberHomeScheduleAuthority(),null);
    release();await beforeReconnect;await drain();check("reconnect-invalidated-context-fresh-read",reads,4);
    check("old-pre-reconnect-result-never-authority",upcomingMemberLessons(24).map(r=>r.id),["event-4"]);
    version=5;pauseNext=true;release=null;const beforeRevision=handlers.focus();await untilPaused();
    version=6;const changed=revisionHandler();release();await beforeRevision;await changed;await drain();
    check("revision-invalidated-inflight-read",reads,6);check("revision-result-exact",upcomingMemberLessons(24).map(r=>r.id),["event-6"]);
    pauseNext=true;release=null;const beforeLogout=handlers.focus();await untilPaused();
    state.member=null;invalidateMemberHomeSchedule();release();await beforeLogout;await drain();
    check("logout-race-no-authority",memberHomeScheduleAuthority(),null);check("logout-no-extra-read",reads,7);
    return {passed:cases.length,workspaceRpc:reads};
  }finally{
    window.addEventListener=old.windowAdd;document.addEventListener=old.documentAdd;window.setInterval=old.interval;
    window.TennisNoteScheduleRevision=old.revision;
    if(old.hidden)Object.defineProperty(document,"hidden",old.hidden);else delete document.hidden;
  }
}

module.exports = { names, bootstrap, runCases, runRefreshEventCases };
