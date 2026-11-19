const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve('app/tennis-note-coach-app'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const domain=read('domain/lessons.js'),actions=read('actions/schedule.js'),sync=read('data/sync.js');
const fn=(s,n)=>{const m=s.match(new RegExp(`^function ${n}\\([^]*?^}`,'m'));assert(m,n);return m[0];};
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j);};
const code=['let coachPastAbsenceScopeEpoch = 0;','let coachPastAbsenceCurrentScope = null;',...['beginCoachPastAbsenceScope','activateCoachPastAbsenceScope','coachPastAbsenceProof','coachPastAbsenceProofCurrent','coachPastAbsenceDetailContext'].map(n=>fn(domain,n))].join('\n');
const v2=slice(actions,'  const rawLessonsById = new Map(','  const latestLessonByUserId = new Map();');
const legacy=slice(sync,'    const lessonRowsById = new Map(','    const ticketIdsByUser = new Map();');
const prelude=String.raw`
let token='token-a';
const state={dataMode:'live',liveProfileId:'profile-a',coach:{branchId:'branch-a'},liveLessons:[],makeupEntitlements:[],releasedMakeupSlots:[]};
const client={getSession:()=>({access_token:token})};
const currentCoachRoleId=()=> 'coach-a';
const canProcessLesson=()=>true, canRescheduleLesson=()=>false;
const localDateKey=()=> '2026-01-01',scheduleDays=['월','화','수','목','금','토','일'];
const minutesFromTime=x=>Number(x.slice(0,2))*60+Number(x.slice(3,5));const lessonDuration=()=>20;
`;
const v2data=String.raw`
const workspace={branchId:'branch-a',coaches:[{roleId:'coach-a',name:'코치'}],lessons:[{id:'lesson-a',coachRoleId:'coach-a',lessonDate:'2000-01-01',startTime:'09:20',status:'cancelled',participants:[{userId:'user-a',ticketId:'ticket-a'}]}],makeupEntitlements:[{id:'ent-a',sourceLessonId:'lesson-a',ticketId:'ticket-a',userId:'user-a',coachRoleId:'coach-a',memberName:'회원',durationMinutes:20,status:'open'}]};
`;
function v2case(mutation='',after=''){const c=vm.createContext({Date,Number,String,Array,Map,console});vm.runInContext(prelude+'\n'+code+'\n'+v2data+'\n'+mutation+'\nconst pastAbsenceScope=beginCoachPastAbsenceScope(client); activateCoachPastAbsenceScope(pastAbsenceScope,workspace.branchId);\n'+v2+'\n'+after+'\nresult=!!coachPastAbsenceDetailContext("ent-a");',c);return c.result;}
assert.equal(v2case(),true);
for(const mutation of ["workspace.branchId='branch-b';","workspace.lessons[0].participants[0].userId='other';","workspace.lessons[0].participants[0].ticketId='other';","workspace.lessons[0].participants.push({...workspace.lessons[0].participants[0]});","workspace.lessons[0].coachRoleId='other';","workspace.lessons.push({...workspace.lessons[0]});","workspace.makeupEntitlements[0].userId='';"])assert.equal(v2case(mutation),false,mutation);
assert.equal(v2case('',"token='token-b';"),false);assert.equal(v2case('',"state.coach.branchId='branch-b';"),false);
assert.equal(v2case('',"beginCoachPastAbsenceScope(client);"),false);
assert.equal(v2case('',"client.getSession=()=>{throw Error('unavailable');};"),false); 
const legacyData=String.raw`
const lessonRows=[{id:'lesson-a',branch_id:'branch-a',coach_role_id:'coach-a',lesson_date:'2000-01-01',start_time:'09:20',status:'cancelled'}];
const participantRows=[{lesson_id:'lesson-a',user_id:'user-a',ticket_id:'ticket-a'}];
const makeupEntitlementRows=[{id:'ent-a',source_lesson_id:'lesson-a',ticket_id:'ticket-a',branch_id:'branch-a',coach_role_id:'coach-a',duration_minutes:20,status:'open'}];
const participantIdsByLesson=new Map([['lesson-a',['user-a']]]),usersById=new Map([['user-a','회원']]),coachesById=new Map([['coach-a',{display_name:'코치'}]]);
`;
function legacyCase(mutation=''){const c=vm.createContext({Date,Number,String,Array,Map,console});vm.runInContext(prelude+'\n'+code+'\n'+legacyData+'\n'+mutation+'\nconst legacyPastScope=beginCoachPastAbsenceScope(client);\n'+legacy+'\nresult=!!coachPastAbsenceDetailContext("ent-a");',c);return c.result;}
assert.equal(legacyCase(),true);
for(const mutation of ["makeupEntitlementRows[0].branch_id='other';","participantRows[0].ticket_id='other';","participantRows.push({...participantRows[0],user_id:'user-b'});","lessonRows[0].coach_role_id='other';"])assert.equal(legacyCase(mutation),false,mutation);
assert(!/select: "id,source_lesson_id,ticket_id,branch_id,coach_role_id,duration_minutes,status,reason,marked_at,booked_lesson_id,booked_at,user_id"/.test(sync));
console.log('PASS: actual V2 and legacy mapper slices to read context; exact pair/branch/coach/duplicates/session/generation fail closed; no DB/network');
