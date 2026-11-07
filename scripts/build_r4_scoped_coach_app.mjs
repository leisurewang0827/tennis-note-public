import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,cpSync,mkdtempSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const walk=(dir,p='')=>Object.fromEntries(readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(e=>{
 assert.ok(!e.isSymbolicLink());return e.isDirectory()?Object.entries(walk(join(dir,e.name),p+e.name+'/')):[[p+e.name,hash(readFileSync(join(dir,e.name)))]];
}));
export const policy={
 dev:{site:'tennisnote-app-dev',branch:'dev',source:'58bb20d2f808d850973349cb62f2862edff8834a',base:'5dbaac5e',index:'70ac3d63a32dd0f6325db34aacbf997266d76df189430c505c91e2888afb0886'},
 prod:{site:'tennisnote-app',branch:'main',source:'dfee6f9324d12e914c65acf4ea4582bf807a839b',base:'9bf44517',index:'b329328db2bcabf746f782e0e585b31ba62379f5df7f317b5ba2d9efe8546f8d'}
};
const get=async url=>{
 const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,'BASE_READ_FAILED');return Buffer.from(await r.arrayBuffer());
};
export async function baselineCheck(mode){
 const p=policy[mode];for(const host of [p.site,p.base+'.'+p.site])assert.equal(hash(await get('https://'+host+'.pages.dev/tennis-note-coach-app/')),p.index,'LIVE_OR_RECOVERY_DRIFT');
}
export async function makeProductionBase(destination){
 const temp=mkdtempSync(join(tmpdir(),'tn-coach-current-prod-')),tar=join(temp,'allowed.tar');
 execFileSync('git',['archive','--output='+tar,policy.prod.source,'app/tennis-note-coach-app','app/tennis-note-member-app','app/shared','app/tennis-note-legal','app/release.json','commerce.html','support.html','delete-account.html','scripts/build_cloudflare_pages.py'],{stdio:'pipe'});
 execFileSync('tar',['-xf',tar,'-C',temp],{stdio:'pipe'});
 const env={...process.env,TENNISNOTE_ENVIRONMENT:'production',TENNISNOTE_SUPABASE_URL:'https://cnympiwrwgouuvhaivbc.supabase.co',TENNISNOTE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_compilation_only',TENNISNOTE_PAYMENTS_ENABLED:'false'};
 try{execFileSync(process.platform==='win32'?'python':'python3',['scripts/build_cloudflare_pages.py','--target','member','--output','dist/member'],{cwd:temp,env,stdio:'pipe'});}catch{throw Error('CURRENT_BASE_COMPILATION_FAILED');}
 const base=join(temp,'dist/member');
 for(const f of ['_headers','_worker.js','_redirects']){try{const path=join(base,f);writeFileSync(path,readFileSync(path,'utf8').replaceAll('\r\n','\n'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 const config=await get('https://tennisnote-app.pages.dev/shared/config.local.js');
 assert.ok(!/service_role|PORTONE_API_SECRET/.test(config.toString()));
 writeFileSync(join(base,'shared/config.local.js'),config);cpSync(base,destination,{recursive:true,force:false,errorOnExist:true});
}
export function overlay(folder,mode,sourceRoot=process.cwd()){
 const before=walk(folder),coach=join(folder,'tennis-note-coach-app');assert.equal(before['tennis-note-coach-app/index.html'],policy[mode].index);
 const module=readFileSync(join(sourceRoot,'app/tennis-note-coach-app/data/r4-scoped-workspace.js'));
 const css=readFileSync(join(sourceRoot,'app/tennis-note-coach-app/r4-scoped-workspace.css'));
 const authority=readFileSync(join(sourceRoot,'app/admin/r4-scoped-coach-workflows.js'));
 assert.equal(hash(authority),'88207f6aed31a50693a4a7554ca8a860ee67a74236a2d80591cccb3487fbba16');
 const workflow=Buffer.from(authority.toString().replaceAll('tennisnote-admin.pages.dev','tennisnote-app.pages.dev').replaceAll('tennisnote-admin-dev.pages.dev','tennisnote-app-dev.pages.dev').replace("primary?'primary-button':'ghost-button'","primary?'approve-button':'small-button'"));
 const token=hash(Buffer.concat([module,css,workflow])).slice(0,16);
 const read=f=>readFileSync(join(coach,f),'utf8');const write=(f,v)=>writeFileSync(join(coach,f),v);
 let auth=read('data/auth.js'),app=read('app.js'),index=read('index.html'),sw=read('service-worker.js');
 const authStart='async function applySupabaseCoachSession(showFromLogin = false) {';
 assert.equal(auth.split(authStart).length,2);auth=auth.replace(authStart,()=> 'async function applySupabaseCoachSession(showFromLogin = false, scopedAttempt) {\n  const r4Attempt = scopedAttempt ?? window.TennisNoteScopedCoachApp?.begin();');
 const authAnchor='    const { user, profile, coachRole } = await client.selectCurrentProfile();';
 assert.equal(auth.split(authAnchor).length,2);auth=auth.replace(authAnchor,()=>authAnchor+'\n    if (r4Attempt !== undefined && !window.TennisNoteScopedCoachApp.accepts(r4Attempt)) return false;\n    const scopedOpened = await window.TennisNoteScopedCoachApp?.activate({user,profile,coachRole,attempt:r4Attempt});\n    if (r4Attempt !== undefined && !window.TennisNoteScopedCoachApp.accepts(r4Attempt)) return false;\n    if (scopedOpened) return true;');
 const initAnchor='  if (!state.coach) {\n    $("#coachAppScreen").hidden = true;';
 assert.equal(app.split(initAnchor).length,2);app=app.replace(initAnchor,()=> '  if (window.TennisNoteScopedCoachApp?.isActive()) return;\n'+initAnchor);
 const race='  const coachAccessResult = await Promise.race([';
 assert.equal(app.split(race).length,2);app=app.replace(race,()=> '  const r4InitAttempt = window.TennisNoteScopedCoachApp?.begin();\n'+race);
 assert.equal(app.split('    applySupabaseCoachSession(false),').length,2);app=app.replace('    applySupabaseCoachSession(false),','    applySupabaseCoachSession(false, r4InitAttempt),');
 const afterRace='  const coachAccessTimedOut = coachAccessResult === "timeout";';
 assert.equal(app.split(afterRace).length,2);app=app.replace(afterRace,()=> '  if (r4InitAttempt !== undefined && !window.TennisNoteScopedCoachApp.accepts(r4InitAttempt)) return;\n'+afterRace);
 for(const anchor of ['  if (coachAccessTimedOut) {','  if (!openedFromSupabase) {']){assert.equal(app.split(anchor).length,2);app=app.replace(anchor,()=>anchor+'\n    window.TennisNoteScopedCoachApp?.reset(r4InitAttempt);');}
 const snapshotAnchor='  if (hasStoredSession && state.coach) openCoachApp(false);';
 assert.equal(app.split(snapshotAnchor).length,2);
 app=app.replace(snapshotAnchor,()=> '  if (hasStoredSession && state.coach && state.coach.authUserId === client.sessionSubject()) openCoachApp(false);');
 const authSrc=index.match(/\.\/data\/auth.js\?v=([^"\s]+)/)?.[0],appSrc=index.match(/\.\/app.js\?v=([^"\s]+)/)?.[0];
 assert.ok(authSrc&&appSrc);assert.equal(index.split(authSrc).length,2);assert.equal(index.split(appSrc).length,3);
 index=index.replace(authSrc,()=>`./data/auth.js?v=r4-${token}`).replaceAll(appSrc,`./app.js?v=r4-${token}`);
 assert.equal(index.split('</head>').length,2);index=index.replace('</head>',()=>`  <link rel="stylesheet" href="./r4-scoped-workspace.css?v=${token}" />\n</head>`);
 const beforeAuth=`<script defer src="./data/auth.js?v=r4-${token}"></script>`;
 assert.equal(index.split(beforeAuth).length,2);
 index=index.replace(beforeAuth,()=>`<script defer src="./data/r4-workflows.js?v=${token}"></script>\n    <script defer src="./data/r4-scoped-workspace.js?v=${token}"></script>\n    `+beforeAuth);
 sw=sw.replace(/(const CACHE_NAME = ")([^"]+)(";)/,(_,a,b,c)=>a+b+'-r4-'+token+c);
 sw=sw.replace(authSrc,()=>`./data/auth.js?v=r4-${token}`).replace(appSrc,()=>`./app.js?v=r4-${token}`);
 assert.equal(sw.split('const APP_SHELL = [').length,2);
 sw=sw.replace('const APP_SHELL = [',()=>`const APP_SHELL = [\n  "./data/r4-workflows.js?v=${token}",\n  "./data/r4-scoped-workspace.js?v=${token}",\n  "./r4-scoped-workspace.css?v=${token}",`);
 write('data/auth.js',auth);write('app.js',app);write('index.html',index);write('service-worker.js',sw);
 write('data/r4-scoped-workspace.js',module);write('data/r4-workflows.js',workflow);write('r4-scoped-workspace.css',css);
 const after=walk(folder),changed=Object.keys(after).filter(k=>after[k]!==before[k]).sort();
 assert.deepEqual(changed,['app.js','data/auth.js','data/r4-scoped-workspace.js','data/r4-workflows.js','index.html','r4-scoped-workspace.css','service-worker.js'].map(x=>'tennis-note-coach-app/'+x).sort());
 for(const [path,pin]of Object.entries(before))if(!path.startsWith('tennis-note-coach-app/'))assert.equal(after[path],pin,'NON_COACH_ASSET_CHANGED');
 return{files:after,baseFiles:before,changed,token};
}
if(process.argv[2]==='local'){
 const dest=resolve(process.argv[3]),devBase=resolve(process.argv[4]);mkdirSync(dest,{recursive:true});
 await baselineCheck('dev');await baselineCheck('prod');
 cpSync(devBase,join(dest,'dev'),{recursive:true,force:false,errorOnExist:true});
 await makeProductionBase(join(dest,'prod'));
 const manifest={dev:overlay(join(dest,'dev'),'dev'),prod:overlay(join(dest,'prod'),'prod')};
 writeFileSync(join(dest,'seal.json'),JSON.stringify(manifest)+'\n',{flag:'wx'});console.log(JSON.stringify({coachOnlyFiles:7,existingMemberAndConfigPreserved:true,devToken:manifest.dev.token,prodToken:manifest.prod.token}));
}
