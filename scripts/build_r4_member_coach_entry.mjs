import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const replace=(text,anchor,replacement)=>{assert.equal(text.split(anchor).length,2,'ANCHOR_DRIFT');return text.replace(anchor,()=>replacement);};
export function memberCoachEntry(folder,authority){
 const helper=readFileSync(authority),token=hash(helper).slice(0,16);
 const read=path=>readFileSync(join(folder,path),'utf8'),write=(path,value)=>writeFileSync(join(folder,path),value);
 write('shared/tennisnote-r4-coach-entry.js',helper);
 const m='',c='tennis-note-coach-app/'; // 게시된 회원 PWA는 루트에 평탄화되어 있다.
 let session=read(m+'actions/session.js');
 session=replace(session,'async function applySupabaseMemberSession(showNotice = false) {','async function applySupabaseMemberSession(showNotice = false) {\n  const r4EntryAttempt = window.TennisNoteR4CoachEntry?.reset();');
 session=replace(session,'    const current = await client.selectCurrentProfile();','    const current = await client.selectCurrentProfile();\n    if (r4EntryAttempt !== undefined && !window.TennisNoteR4CoachEntry.accepts(r4EntryAttempt)) return false;');
 const memberStart=session.indexOf('async function applySupabaseMemberSession(showNotice = false) {');
 session=session.slice(0,memberStart)+session.slice(memberStart).replace('  await client.consumeOAuthRedirect?.();','  await client.consumeOAuthRedirect?.();\n  if (r4EntryAttempt !== undefined && !window.TennisNoteR4CoachEntry.accepts(r4EntryAttempt)) return false;').replace('  const session = await client.ensureSession?.() || client.getSession?.();','  const session = await client.ensureSession?.() || client.getSession?.();\n  if (r4EntryAttempt !== undefined && !window.TennisNoteR4CoachEntry.accepts(r4EntryAttempt)) return false;');
 session=replace(session,'  } catch (error) {\n    const status = $("#memberEmailLoginStatus");','  } catch (error) {\n    if (r4EntryAttempt !== undefined && !window.TennisNoteR4CoachEntry.accepts(r4EntryAttempt)) return false;\n    const status = $("#memberEmailLoginStatus");');
 const assigned='    state.coachModeAllowed = state.member.coachApproved;';
 session=replace(session,assigned,assigned+'\n    await window.TennisNoteR4CoachEntry?.refresh({user,profile,coachRole,attempt:r4EntryAttempt});\n    if (r4EntryAttempt !== undefined && !window.TennisNoteR4CoachEntry.accepts(r4EntryAttempt)) return false;\n    if (window.TennisNoteR4CoachEntry?.requested() && canUseCoachMode()) {\n      window.TennisNoteR4CoachEntry.remember(false);\n      openCoachMode();\n      return true;\n    }');
 session=replace(session,'  button.hidden = !canUseCoachMode();','  button.hidden = !canUseCoachMode();\n  const hint = button.querySelector("small");\n  if (hint) hint.textContent = "내 지점 수업·피드백·정산";\n  const status = button.querySelector(".settings-row-status");\n  if (status) status.textContent = "열기";');
 write(m+'actions/session.js',session);
 write(m+'domain/coaches.js',replace(read(m+'domain/coaches.js'),'  return state.member?.coachApproved === true && !isApprovalPending();','  return (state.member?.coachApproved === true && !isApprovalPending()) || window.TennisNoteR4CoachEntry?.canUse(state.member) === true;'));
 let memberAuth=read(m+'data/auth.js');
 for(const anchor of ['function activateLiveMemberProfile(profileId) {','async function logout() {']){
  // 프로필 전환은 refresh 이전이므로 이전 권한만 지우되 현재 시도 토큰은 보존한다.
  if(anchor.startsWith('async'))memberAuth=replace(memberAuth,anchor,anchor+'\n  window.TennisNoteR4CoachEntry?.reset();\n  window.TennisNoteR4CoachEntry?.remember(false);');
 }
 write(m+'data/auth.js',memberAuth);
 let coachAuth=read(c+'data/auth.js');
 coachAuth=replace(coachAuth,'  if (!session?.access_token) {','  if (!session?.access_token) {\n    window.TennisNoteR4CoachEntry?.remember(true);');
 coachAuth=replace(coachAuth,'async function logoutCoach() {','async function logoutCoach() {\n  window.TennisNoteR4CoachEntry?.remember(false);\n  window.TennisNoteR4CoachEntry?.reset();\n  window.TennisNoteScopedCoachApp?.reset();');
 write(c+'data/auth.js',coachAuth);
 let workspace=read(c+'data/r4-scoped-workspace.js');
 const legacyGuard=" if(root.Capacitor?.isNativePlatform?.()||!target||!client?.rpc||config?.environment!==target[0]||config.supabaseUrl!=='https://'+target[1]+'.supabase.co'||config.projectFingerprint!==target[2])return;";
 workspace=replace(workspace,legacyGuard,' if(!root.TennisNoteR4CoachEntry?.bound)return;');
 workspace=replace(workspace," const rpc=(name,args)=>client.rpc(name,args,{requireCurrentSession:true,retryAuth:false});"," const rpc=async(name,args)=>{if(!await root.TennisNoteR4CoachEntry.ready)throw Error('runtime_denied');return client.rpc(name,args,{requireCurrentSession:true,retryAuth:false});};");
 workspace=replace(workspace,"  const back=el('a','회원 화면');back.href='/?mode=member';back.className='small-button';","  const back=el('a','회원 화면');back.href=root.TennisNoteR4CoachEntry.memberUrl();back.className='small-button';\n  back.addEventListener('click',()=>root.TennisNoteR4CoachEntry.remember(false));");
 write(c+'data/r4-scoped-workspace.js',workspace);
 let workflow=read(c+'data/r4-workflows.js');
 workflow=replace(workflow," if(!client?.rpc||!target||config.environment!==target[0]||config.supabaseUrl!=='https://'+target[1]+'.supabase.co'||config.projectFingerprint!==target[2])return;",' if(!root.TennisNoteR4CoachEntry?.bound)return;');
 workflow=replace(workflow,' const rpc=(name,args)=>client.rpc(name,args,auth);'," const rpc=async(name,args)=>{if(!await root.TennisNoteR4CoachEntry.ready)throw Error('runtime_denied');return client.rpc(name,args,auth);};");
 write(c+'data/r4-workflows.js',workflow);
 for(const surface of [m,c]){
  let index=read(surface+'index.html'),sw=read(surface+'service-worker.js');
  const dataScript=index.match(/<script defer src="[^\"]*tennisnote-data-client.js[^\"]*"><\/script>/)?.[0];assert.ok(dataScript);
  index=replace(index,dataScript,dataScript+`\n    <script defer src="../shared/tennisnote-r4-coach-entry.js?v=${token}"></script>`);
  const paths=surface===m?['actions/session.js','domain/coaches.js','data/auth.js']:['data/auth.js','data/r4-scoped-workspace.js','data/r4-workflows.js'];
  for(const path of paths){const pattern=new RegExp('(\\./'+path.replaceAll('.','\\.')+'\\?v=)[^"\\s]+','g');index=index.replace(pattern,(_,prefix)=>prefix+'r4-entry-'+token);sw=sw.replace(pattern,(_,prefix)=>prefix+'r4-entry-'+token);}
  sw=replace(sw,'const APP_SHELL = [',`const APP_SHELL = [\n  "../shared/tennisnote-r4-coach-entry.js?v=${token}",`);
  sw=sw.replace(/(const CACHE_NAME = ")([^\"]+)(";)/,(_,a,b,z)=>a+b+'-entry-'+token+z);
  write(surface+'index.html',index);write(surface+'service-worker.js',sw);
 }
 return {token,helperHash:hash(helper)};
}
if(process.argv[2]==='local'){
 const [base,out,authority]=process.argv.slice(3).map(x=>resolve(x));mkdirSync(out,{recursive:true});
 for(const mode of ['dev','prod']){cpSync(join(base,mode),join(out,mode),{recursive:true,errorOnExist:true,force:false});memberCoachEntry(join(out,mode),authority);}
 console.log(JSON.stringify({memberCoachEntry:true,productionNativeOriginsBound:true,existingDataConfigPreserved:true}));
}
