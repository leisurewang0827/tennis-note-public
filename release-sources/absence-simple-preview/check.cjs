const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root='release-sources/absence-simple-preview',m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(m.kind,'ABSENCE_SIMPLE_DEV_PREVIEW_V41');assert.equal(m.parent,'f614ba302dd0293cdf845ce6683777eabc039da8');assert.equal(m.branch,'codex/tennisnote-r4-admin-prod-candidate');assert.equal(m.previewBranch,'r4-absence-group-qa');assert.equal(m.coach.project,'tennisnote-app-dev');assert.equal(m.admin.project,'tennisnote-admin-dev');
assert.equal(Object.keys(m.coach.baseline).length,254);assert.equal(Object.keys(m.admin.baseline).length,173);assert.equal(Object.keys(m.coach.changed).length,9);assert.equal(Object.keys(m.admin.changed).length,4);
for(const mode of ['coach','admin'])for(const [name,sha] of Object.entries(m[mode].changed)){assert(m[mode].baseline[name]);assert.equal(hash(fs.readFileSync(path.join(root,'assets',mode,name))),sha,'asset mismatch '+mode+'/'+name)}
for(const n of ['_headers','_redirects','_worker.js'])assert.equal(hash(fs.readFileSync(path.join(root,'admin-controls',n))),m.admin.baseline[n]);
assert(!fs.existsSync(path.join(root,'assets/coach/shared/config.local.js')));assert(!fs.existsSync(path.join(root,'assets/admin/shared/config.local.js')));
console.log('PASS: exact preview target, 13 sealed assets, admin control hashes, no committed runtime config');

// New v7 adapter/identity/cache guard checks only.
{
const vm=require("node:vm");const read=p=>fs.readFileSync(path.join(root,"assets/coach/tennis-note-coach-app",p),"utf8");const sync=read("data/sync.js"),schedule=read("actions/schedule.js"),screens=read("ui/screens.js"),domain=read("domain/lessons.js");const fn=(s,n)=>{const m=s.match(new RegExp("^(?:async )?function "+n+"\\([^]*?^}","m"));assert(m,n);return m[0]};
const c=vm.createContext({Date,console});vm.runInContext(`const state={dataMode:'live',liveProfileId:'profile',coach:{branchId:'branch'}};let token='token';const currentCoachRoleId=()=> 'role';const client={getSession:()=>({access_token:token})};\n${['beginCoachPastAbsenceScope','activateCoachPastAbsenceScope','coachPastAbsenceProof','coachPastAbsenceProofCurrent'].map(n=>fn(domain,n)).join('\n')}\n${fn(sync,'coachFutureLegacyEntitlements')}\n${fn(screens,'coachReleasedAbsenceStatus')}`,c);
// Scope epoch globals precede the existing functions in the production domain module.
vm.runInContext('var coachPastAbsenceScopeEpoch=0,coachPastAbsenceCurrentScope=null;',c);
const base={branchId:'branch',actor:{userId:'profile',coachRoleId:'role'},lessons:[{id:'source',status:'cancelled',coachRoleId:'role',lessonDate:'2099-01-01',startTime:'13:00:00',durationMinutes:20,participants:[{userId:'member',ticketId:'ticket',name:'합성'}]}],makeupEntitlements:[]};
const rows=[{id:'legacy',source_lesson_id:'source',ticket_id:'ticket',branch_id:'branch',coach_role_id:'role',duration_minutes:20,status:'open'}];
c.workspace=structuredClone(base);c.rows=structuredClone(rows);vm.runInContext("var scope=beginCoachPastAbsenceScope(client);activateCoachPastAbsenceScope(scope,'branch');",c);
const count=()=>vm.runInContext('coachFutureLegacyEntitlements(workspace,rows,scope).length',c);assert.equal(count(),1);let cases=1;
for(const edit of [w=>w.branchId='other',w=>w.actor.userId='other',w=>w.actor.coachRoleId='other',w=>w.lessons[0].coachRoleId='other',w=>w.lessons[0].status='scheduled',w=>w.lessons[0].lessonDate='2020-01-01',w=>w.lessons[0].lessonDate='2099-02-30',w=>w.lessons[0].startTime='25:00',w=>w.lessons[0].durationMinutes=40,w=>w.lessons[0].participants[0].ticketId='other',w=>w.lessons[0].participants[0].name='',w=>w.lessons.push(structuredClone(w.lessons[0])),w=>w.makeupEntitlements.push({id:'legacy'})]){c.workspace=structuredClone(base);edit(c.workspace);assert.equal(count(),0);cases++;}
for(const edit of [r=>r[0].branch_id='other',r=>r[0].coach_role_id='other',r=>r[0].status='cancelled',r=>r[0].duration_minutes=0,r=>r.push({...r[0]}),r=>r.push({...r[0],id:'duplicate'})]){c.workspace=structuredClone(base);c.rows=structuredClone(rows);edit(c.rows);assert.equal(count(),0);cases++;}
c.workspace=structuredClone(base);c.rows=structuredClone(rows);vm.runInContext("token='changed'",c);assert.equal(count(),0);cases++;
vm.runInContext("token='token';var oldScope=scope;scope=beginCoachPastAbsenceScope(client);activateCoachPastAbsenceScope(scope,'branch')",c);assert.equal(count(),1);assert.equal(vm.runInContext('coachFutureLegacyEntitlements(workspace,rows,oldScope).length',c),0);cases+=2;
vm.runInContext(`var entitlement=coachFutureLegacyEntitlements(workspace,rows,scope)[0];entitlement.pastAbsenceProof=coachPastAbsenceProof(scope,'branch','source','role','member','ticket',workspace.lessons,workspace.lessons[0].participants,'합성');Object.assign(entitlement,{originalDate:'2099-01-01',originalTime:'13:00'});var slot={...entitlement,entitlementId:'legacy',lessonDate:'2099-01-01',time:'13:00',day:'목'};state.makeupEntitlements=[entitlement];state.releasedMakeupSlots=[slot];state.liveLessons=[];var canProcessLesson=()=>true,minutesFromTime=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5)),lessonDuration=()=>20,loadCoachSchedulePolicy=()=>({coaches:[{roleId:'role'}]}),coachSlotAccess=()=>({allowed:true});`,c);
assert.equal(vm.runInContext("coachReleasedAbsenceStatus('legacy').canAdd",c),true);cases++;
for(const field of ['branchId','sourceLessonId','coachRoleId','lessonDate','time','durationMinutes','userId','ticketId']){const saved=c.slot[field];c.slot[field]='changed';assert(vm.runInContext("coachReleasedAbsenceStatus('legacy').message",c));c.slot[field]=saved;cases++;}
vm.runInContext("token='expired'",c);assert(vm.runInContext("coachReleasedAbsenceStatus('legacy').message",c));cases++;
assert(schedule.includes('coachFutureLegacyEntitlements(workspace, workspace.futureLegacyAbsenceRows, pastAbsenceScope)'));assert(sync.includes('workspace.futureLegacyAbsenceRows = Array.isArray(legacyRows) ? legacyRows : []'));

console.log(JSON.stringify({newFutureAdapterCases:cases,status:"PASS"}));
}
