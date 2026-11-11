// Isolated PostgreSQL on loopback; validates the new production delta only.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const tools=join(tmpdir(),'tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f');
const {Client}=createRequire(join(tools,'driver','package.json'))('pg');
const bin=join(tools,'package','native','bin'),dir=mkdtempSync(join(tmpdir(),'tn-r4-prod-v2-'));
const port=await new Promise((resolve,reject)=>{const s=createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const exec=(name,args)=>assert.equal(spawnSync(join(bin,name+'.exe'),args,{cwd:dir,windowsHide:true,timeout:25000}).status,0,name);
const db=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres',statement_timeout:15000});
const read=n=>readFileSync(new URL(n,import.meta.url),'utf8');
const old=n=>execFileSync('git',['show','7ba4e453e5e89540c0578db1dd76312c6f8d9442:release-sources/r4-independent-owner-prod/'+n],{cwd:'C:/Codex/tennis-note-public-release-20260815',encoding:'utf8',windowsHide:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const id=Object.fromEntries('a b c pa pb pc sa sb sc alt wa prev'.split(' ').map(x=>[x,randomUUID()]));
const bind=(s,dict)=>Object.entries(dict).reduce((a,[k,v])=>a.replaceAll('__'+k+'__',String(v)),s);
const readyUntil=()=>new Date(Date.now()+45000).toISOString();
let started=false,connected=false;
try{
  exec('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
  exec('pg_ctl',['-D',dir,'-l',join(dir,'pg.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true;
  await db.connect();connected=true;
  const schema=old('check-db.mjs').match(/await db.query\(`(create role anon;[\s\S]+?revoke all on all functions in schema private from public,anon,authenticated,service_role;)`\);/)?.[1];
  assert.ok(schema);await db.query(schema);
  await db.query('alter table auth.users add column is_anonymous boolean not null default false, add column email text, add column email_confirmed_at timestamptz, add column phone_confirmed_at timestamptz');
  const mocked={
    'private.tn_r4_actor()':'a95541a89dd724b19cee57b4082a5a8c682775bc66b3e4cbb681438a672010f3',
    'private.tn_r4_prod_selfserve_actor()':'9acdc7fa374422386a6751b1c09190b6a5054af7ba524ee0d94a8a86fbc39a1b',
    'private.tn_r4_scoped_coach_current_actor()':'620289045798ec005ea4392f0c1ee4a936b1210afa2db75ab601f97d094a03b0',
    'private.tn_lock_account_deletion_barrier_shared()':'daf068904e765d1723470b822efd7d7d44968e3836d90172508280c88b9212f8',
    'private.tn_lock_auth_identities(uuid[])':'b2d36f535496f4affbbfd0835f8ee1b5b4fc91e3405298fb509cebd4173f57ea',
    'public.tn_guard_account_deletion_auth_mapping()':'addb10a55d448f6da2143e03d497aa5251d5652d7cbbe5137964d0f3fbc680c4',
    'private.tn_signup_relation_owner_lock()':'84bed79306596aeb57baa1df7be0ad187b6a13f0282cd90e9d9beaa5b6af78ad'
  };
  let substitutions={};
  const sourceHash=async sig=>sha((await db.query('select prosrc from pg_proc where oid=to_regprocedure($1)',[sig])).rows[0].prosrc);
  for(const [sig,expected] of Object.entries(mocked))substitutions[expected]=await sourceHash(sig);
  const local=text=>Object.entries(substitutions).reduce((s,[a,b])=>s.replaceAll(a,b),text);
  await db.query(local(old('install-off.sql')));
  for(const [sig,h] of Object.entries({
    'private.tn_r4_prod_independent_guard()':'295e40f3006ed11d69bc0a8b89aa96564355fcce4cadb7e3ec93f00c5ee1e9d2',
    'public.tn_r4_prod_my_independent(text,uuid,text,timestamptz,integer)':'65332c3d3f54e6207b2817d7e4c617a3f4869ffa9d1d8efd889b19482687fb1f'
  }))substitutions[h]=await sourceHash(sig);
  for(const k of ['a','b','c']){
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id[k],k+'@example.invalid']);
    await db.query("insert into public.tn_users(id,auth_user_id,role,status) values($1,$2,'member','active')",[id['p'+k],id[k]]);
    await db.query('insert into auth.sessions(id,user_id,user_agent) values($1,$2,$3)',[id['s'+k],id[k],'marker-'+k]);
  }
  await db.query('insert into auth.sessions(id,user_id,user_agent) values($1,$2,$3)',[id.alt,id.a,'prior-login']);
  await db.query('insert into private.tn_r4_prod_independent_workspace(id,owner_id,operation_id) values($1,$2,$3)',[id.wa,id.pa,randomUUID()]);
  await db.query("insert into private.tn_r4_prod_independent_lesson(id,owner_id,workspace_id,operation_id,title,starts_at,minutes) values($1,$2,$3,$4,'보존 레슨',now()+interval '2 days',20)",[id.prev,id.pa,id.wa,randomUUID()]);
  const snapshot=async()=>(await db.query("select (select to_jsonb(w) from private.tn_r4_prod_independent_workspace w where id=$1) w,(select to_jsonb(l) from private.tn_r4_prod_independent_lesson l where id=$2) l,(select jsonb_agg(s order by s.id) from auth.sessions s) s,(select jsonb_agg(u order by u.id) from public.tn_users u) u",[id.wa,id.prev])).rows[0];
  const before=await snapshot();
  await assert.rejects(db.query(read('install-off.sql')),{message:'independent_v2_function_preimage'});
  await db.query('rollback');
  await db.query('grant select on private.tn_r4_prod_independent_workspace to authenticated');
  await assert.rejects(db.query(local(read('install-off.sql'))),{message:'independent_v2_table_preimage'});
  await db.query('rollback; revoke select on private.tn_r4_prod_independent_workspace from authenticated');
  await db.query(local(read('install-off.sql')));
  substitutions['c86aee3ac72128b423ad1e40d3607ac38c72853dcad9f79813f4e2a46ee0d269']=await sourceHash('private.tn_r4_prod_independent_v2_actor(text)');
  const ctl=async()=>(await db.query('select mode,epoch::int from private.tn_r4_prod_independent_v2_control')).rows[0];
  const act=async(k,s,call,args)=>{
    await db.query('begin');
    try{
      await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id[k],role:'authenticated',session_id:id[s],exp:Math.floor(Date.now()/1000)+600})]);
      await db.query('set local role authenticated');
      const r=await db.query(call,args);await db.query('commit');return r.rows[0].v;
    }catch(e){await db.query('rollback');throw e;}
  };
  const ws=(k,s,name=null)=>act(k,s,'select public.tn_r4_prod_my_independent_v2_workspace($1) v',[name]);
  const lesson=(k,s,action,op=null,lessonId=null,revision=null,title=null,start=null,minutes=null)=>act(k,s,
    'select public.tn_r4_prod_my_independent_v2_lessons($1,$2,$3,$4,$5,$6,$7) v',[action,op,lessonId,revision,title,start,minutes]);
  const denied=e=>e.code==='42501';
  const proof=async()=>(await db.query(local(read('postread.sql')))).find(q=>q.rows?.[0]?.receipt).rows[0].receipt;
  assert.deepEqual(await ctl(),{mode:'off',epoch:0});
  assert.equal((await proof()).surfaceOk,true);
  await assert.rejects(ws('a','sa'),denied);
  const pilot=e=>bind(read('pilot-open.sql'),{EXPECTED_EPOCH:e,APPROVAL_UNTIL_UTC:readyUntil(),
    A_AUTH_SHA:sha(id.a),A_OWNER_SHA:sha(id.pa),A_SESSION_SHA:sha(id.sa),A_MARKER_SHA:sha('marker-a'),
    B_AUTH_SHA:sha(id.b),B_OWNER_SHA:sha(id.pb),B_SESSION_SHA:sha(id.sb),B_MARKER_SHA:sha('marker-b')});
  const off=e=>bind(read('disable.sql'),{EXPECTED_EPOCH:e});
  await db.query(off(0));
  await assert.rejects(db.query(pilot(0)),{message:'independent_v2_pilot_preimage'});
  await db.query('rollback');
  await db.query(pilot(2));
  assert.equal((await proof()).effectivePilot,2);
  assert.equal((await db.query("select count(*)::int n from private.tn_r4_prod_independent_v2_pilot where expires_at-issued_at=interval '240 seconds'")).rows[0].n,2);
  await assert.rejects(ws('a','alt'),denied);
  await assert.rejects(ws('b','sb','B cannot register'),denied);
  assert.equal((await ws('b','sb')).canWriteLessons,false);
  const registered=await ws('a','sa','지정 작업공간');
  assert.equal(registered.workspace.id,id.wa);assert.equal((await ws('a','sa','이름 덮기')).workspace.displayName,'지정 작업공간');
  await assert.rejects(lesson('b','sb','create',randomUUID()),denied);
  await db.query(off(2));await db.query(off(2));
  assert.deepEqual(await ctl(),{mode:'off',epoch:4});
  assert.equal((await proof()).effectivePilot,0);
  const designated=(e,targets)=>bind(read('designated-open.sql'),{EXPECTED_EPOCH:e,APPROVAL_UNTIL_UTC:readyUntil(),DESIGNATED_JSON:JSON.stringify(targets)});
  const a={owner_sha:sha(id.pa),auth_sha:sha(id.a)},b={owner_sha:sha(id.pb),auth_sha:sha(id.b)};
  await assert.rejects(db.query(designated(4,[{owner_sha:a.owner_sha,auth_sha:b.auth_sha}])),{message:'independent_v2_designated_binding'});
  await db.query('rollback');
  await db.query(designated(4,[a,b]));
  await assert.rejects(ws('c','sc'),denied);
  assert.equal((await ws('b','sb','신규 B')).workspace.kind,'independent_coach');
  const date=new Date();date.setUTCDate(date.getUTCDate()+2);date.setUTCHours(5,0,0,0);
  const op=randomUUID(),args=['create',op,null,null,'새 비공개 레슨',date,20];
  const created=await lesson('a','sa',...args);assert.equal(created.revision,1);
  assert.deepEqual(await lesson('a','sa',...args),created);
  assert.equal((await lesson('b','sb','list')).lessons.length,0);
  assert.deepEqual(await lesson('b','sb','receipt',op),{found:false});
  await assert.rejects(lesson('b','sb','edit',randomUUID(),created.id,1,'타인 수정',date,20),denied);
  assert.equal((await lesson('a','sa','edit',randomUUID(),created.id,1,'수정',date,20)).revision,2);
  await assert.rejects(lesson('a','sa','cancel',randomUUID(),created.id,1),e=>e.code==='40001');
  assert.equal((await lesson('a','sa','cancel',randomUUID(),created.id,2)).revision,3);
  assert.equal((await lesson('a','sa','list')).lessons[0].cancelled,true);
  await db.query(off(4));
  await assert.rejects(ws('a','sa'),denied);
  const final=await proof();
  assert.equal(final.surfaceOk,true);assert.equal(final.effectivePilot,0);assert.equal(final.effectiveDesignated,0);
  assert.equal(final.unrevokedPilot+final.unrevokedDesignated,0);assert.equal(final.v2Lessons,1);assert.equal(final.v2Operations,3);
  assert.deepEqual(await snapshot(),before);
  console.log('PROD_V2_LOCAL_DB_PASS: preimage, OFF, exact pilot, stale open, designated, owner isolation, replay/revision/cancel, recovery/preservation');
}finally{
  if(connected)await db.end();
  if(started)exec('pg_ctl',['-D',dir,'-m','fast','-w','stop']);
}
