// Isolated synthetic PostgreSQL only; no production/DEV connections.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
const bundle=join(process.env.TEMP||tmpdir(),'tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f');
const {Client}=createRequire(join(process.env.R4_PG_DRIVER_ROOT||join(bundle,'driver'),'package.json'))('pg');
const bin=process.env.R4_PG_BIN||join(bundle,'package','native','bin'),dir=mkdtempSync(join(tmpdir(),'tn-independent-prod-test-'));
const service=process.env.R4_EPHEMERAL_CI==='1';
if(service)assert.equal(process.env.GITHUB_ACTIONS,'true','external test DB is CI-only');
const port=service?Number(process.env.R4_EPHEMERAL_PORT):await new Promise((resolve,reject)=>{const s=createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
assert.ok(Number.isInteger(port)&&port>0&&port<65536);
const run=(name,args)=>{const r=spawnSync(join(bin,name+(process.platform==='win32'?'.exe':'')),args,{cwd:dir,windowsHide:true,encoding:'utf8',timeout:25000});if(r.status!==0)throw Error(name+' failed');};
const connection={host:'127.0.0.1',port,user:'postgres',database:'postgres',statement_timeout:6000,...(service?{password:'synthetic-ci-only'}:{})};
const db=new Client(connection);
const ids=Object.fromEntries(['owner','other','a','b','session','session2','otherSession'].map(k=>[k,randomUUID()]));
let started=false,connected=false;
try{
  if(!service){run('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',dir,'-l',join(dir,'pg.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);started=true;}
  await db.connect();connected=true;
  await db.query(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create function auth.uid() returns uuid language sql stable as $$select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid$$;
    create table auth.users(id uuid primary key,deleted_at timestamptz,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz,created_at timestamptz default clock_timestamp(),user_agent text);
    create table public.tn_users(id uuid primary key,auth_user_id uuid unique,role text,status text,merged_into_user_id uuid,permanently_deleted_at timestamptz);
    create table public.tn_user_auth_links(id uuid primary key,user_id uuid references public.tn_users(id),auth_user_id uuid unique);
    create function private.tn_r4_actor() returns uuid language sql security definer set search_path=pg_catalog as $$select null::uuid$$;
    create function private.tn_r4_prod_selfserve_actor() returns uuid language sql security definer set search_path=pg_catalog as $$select id from public.tn_users where auth_user_id=auth.uid()$$;
    create function private.tn_r4_scoped_coach_current_actor() returns uuid language sql security definer set search_path=pg_catalog as $$select null::uuid$$;
    create function private.tn_lock_account_deletion_barrier_shared() returns void language sql security definer set search_path=pg_catalog, pg_temp as $$select pg_advisory_xact_lock_shared(51239)$$;
    create function private.tn_lock_auth_identities(uuid[]) returns void language sql security definer set search_path=pg_catalog, pg_temp as $$select pg_advisory_xact_lock(51240)$$;
    create function public.tn_guard_account_deletion_auth_mapping() returns trigger language plpgsql as $$begin return case when tg_op='DELETE' then old else new end;end$$;
    create function private.tn_signup_relation_owner_lock() returns trigger language plpgsql as $$begin return case when tg_op='DELETE' then old else new end;end$$;
    create trigger tn_guard_account_deletion_user_auth_mapping before insert or update or delete on public.tn_users for each row execute function public.tn_guard_account_deletion_auth_mapping();
    create trigger tn_guard_account_deletion_auth_link_mapping before insert or update or delete on public.tn_user_auth_links for each row execute function public.tn_guard_account_deletion_auth_mapping();
    create trigger tn_signup_relation_owner_lock before insert or update or delete on public.tn_user_auth_links for each row execute function private.tn_signup_relation_owner_lock();
    revoke all on all functions in schema private from public,anon,authenticated,service_role;`);
  await db.query('insert into auth.users(id) values($1),($2)',[ids.a,ids.b]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$2),($4,$5)',[ids.session,ids.a,ids.session2,ids.otherSession,ids.b]);
  await db.query("insert into public.tn_users(id,auth_user_id,role,status) values($1,$2,'member','active'),($3,$4,'member','active')",[ids.owner,ids.a,ids.other,ids.b]);
  const src=readFileSync(new URL('./install-off.sql',import.meta.url),'utf8');
  const productionHashes=['a95541a89dd724b19cee57b4082a5a8c682775bc66b3e4cbb681438a672010f3','9acdc7fa374422386a6751b1c09190b6a5054af7ba524ee0d94a8a86fbc39a1b','620289045798ec005ea4392f0c1ee4a936b1210afa2db75ab601f97d094a03b0','daf068904e765d1723470b822efd7d7d44968e3836d90172508280c88b9212f8','b2d36f535496f4affbbfd0835f8ee1b5b4fc91e3405298fb509cebd4173f57ea','addb10a55d448f6da2143e03d497aa5251d5652d7cbbe5137964d0f3fbc680c4','84bed79306596aeb57baa1df7be0ad187b6a13f0282cd90e9d9beaa5b6af78ad'];
  const signatures=['private.tn_r4_actor()','private.tn_r4_prod_selfserve_actor()','private.tn_r4_scoped_coach_current_actor()','private.tn_lock_account_deletion_barrier_shared()','private.tn_lock_auth_identities(uuid[])','public.tn_guard_account_deletion_auth_mapping()','private.tn_signup_relation_owner_lock()'];
  let synthetic=src;
  for(let i=0;i<signatures.length;i++){const x=await db.query('select prosrc from pg_proc where oid=to_regprocedure($1)',[signatures[i]]);const h=createHash('sha256').update(x.rows[0].prosrc).digest('hex');assert.ok(synthetic.includes(productionHashes[i]));synthetic=synthetic.replaceAll(productionHashes[i],h);}
  await db.query(synthetic);
  async function act(auth,session,sql,args=[]){await db.query('begin');try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:auth,session_id:session,exp:Math.floor(Date.now()/1000)+600})]);await db.query('set local role authenticated');const r=await db.query(sql,args);await db.query('commit');return r.rows[0].value;}catch(e){await db.query('rollback');throw e;}}
  const call=(action,operation=null,title=null,start=null,minutes=null,auth=ids.a,session=ids.session)=>act(auth,session,'select public.tn_r4_prod_my_independent($1,$2,$3,$4,$5) value',[action,operation,title,start,minutes]);
  const denied=e=>e.code==='42501';
  if(process.env.R4_INDEPENDENT_CANARY_ONLY){
    // Only the synthetic fixture substitutes both pinned owner hashes; production file is unchanged.
    const actorHash=createHash('sha256').update(ids.a).digest('hex');
    await db.query('update public.tn_users set id=$1 where id=$2',[ids.a,ids.owner]);
    const marker='synthetic-agent',markerHash=createHash('sha256').update(marker).digest('hex');
    await db.query('update auth.sessions set user_agent=$1 where id=$2',[marker,ids.session]);
    const sessionHash=createHash('sha256').update(ids.session).digest('hex');
    const began=new Date(Date.now()-(process.env.R4_INDEPENDENT_CANARY_EXPIRED_ONLY?89000:20000)).toISOString();
    const opened=readFileSync(new URL('./canary-open.sql',import.meta.url),'utf8').replaceAll('aeaa3810513ec00b6b86a5264f4ae1baa80b436a791ca7c894e0446c2b25c7b8',actorHash).replaceAll('__SESSION_SHA256__',sessionHash).replaceAll('__USER_AGENT_SHA256__',markerHash).replaceAll('__ATTEMPT_START_UTC__',began);
    const close=readFileSync(new URL('./canary-close.sql',import.meta.url),'utf8').replaceAll('__SESSION_SHA256__',sessionHash),read=readFileSync(new URL('./canary-postread.sql',import.meta.url),'utf8').replaceAll('__SESSION_SHA256__',sessionHash);
    if(process.env.R4_INDEPENDENT_LATE_CLOSE_ONLY){
      await db.query(close);
      await db.query("insert into private.tn_r4_prod_independent_access(session_id,auth_id,owner_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '2 minutes')",[ids.session2,ids.a,ids.a]);
      await db.query('update private.tn_r4_prod_independent_control set enabled=true');
      await db.query(close);
      const state=(await db.query('select (select enabled from private.tn_r4_prod_independent_control) enabled,(select revoked_at is null from private.tn_r4_prod_independent_access where session_id=$1) other_live,(select count(*)::int from private.tn_r4_prod_independent_closed_session where session_hash=$2) exact_tombstone',[ids.session2,sessionHash])).rows[0];
      assert.deepEqual(state,{enabled:true,other_live:true,exact_tombstone:1});
      console.log('PASS synthetic PG delta: late close A keeps B enabled and writes only A tombstone');
    }else if(process.env.R4_INDEPENDENT_POSTREAD_ONLY){
      await db.query("insert into private.tn_r4_prod_independent_access(session_id,auth_id,owner_id,expires_at,revoked_at) values($1,$2,$3,clock_timestamp()+interval '2 minutes',clock_timestamp())",[ids.session,ids.a,ids.a]);
      await db.query('insert into private.tn_r4_prod_independent_closed_session(session_hash) values($1)',[sessionHash]);
      assert.deepEqual((await db.query(read)).rows[0],{feature_off:true,exact_lease_revoked:true,no_live_leases:true,no_reopen_marker:true});
      console.log('PASS synthetic PG delta: placeholder-only committed postread reports off/revoked/no-reopen');
    }else if(process.env.R4_INDEPENDENT_CANARY_RACE_ONLY||process.env.R4_INDEPENDENT_CANARY_EXPIRED_ONLY){
      const locker=new Client(connection);await locker.connect();
      try{await locker.query('begin');await locker.query('select * from private.tn_r4_prod_independent_control for update');
        const pid=(await db.query('select pg_backend_pid() pid')).rows[0].pid;
        const blocked=db.query(opened).then(()=>({ok:true}),error=>({error}));let waiting=false;
        for(let i=0;i<30;i++){const p=await locker.query("select wait_event_type='Lock' waiting from pg_stat_activity where pid=$1",[pid]);if(p.rows[0]?.waiting){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,30));}
        assert.equal(waiting,true,'canary request did not reach held control lock');
        if(process.env.R4_INDEPENDENT_CANARY_EXPIRED_ONLY)await new Promise(resolve=>setTimeout(resolve,1800));
        else await locker.query(close);
        await locker.query('commit');assert.ok((await blocked).error);
        const state=(await db.query('select (select enabled from private.tn_r4_prod_independent_control) enabled,(select count(*)::int from private.tn_r4_prod_independent_access) leases')).rows[0];
        assert.deepEqual(state,{enabled:false,leases:0});
      }finally{await locker.end();}
      console.log(process.env.R4_INDEPENDENT_CANARY_EXPIRED_ONLY?'PASS synthetic PG canary: deadline expires during gate lock; no lease or opening':'PASS synthetic PG canary race: observed gate lock wait; close tombstone blocks delayed open');
    }else{
      await db.query(opened);await assert.rejects(()=>db.query(opened));
      await db.query(close);await db.query(close);await assert.rejects(()=>db.query(opened));
      assert.deepEqual((await db.query(read)).rows[0],{feature_off:true,exact_lease_revoked:true,no_live_leases:true,no_reopen_marker:true});
      console.log('PASS synthetic PG canary: exact admission once, no reopen after off, revocation replay, committed readback');
    }
  }else{
  await assert.rejects(()=>call('read'),denied);
  await db.query('update private.tn_r4_prod_independent_control set enabled=true');
  await db.query("insert into private.tn_r4_prod_independent_access(session_id,auth_id,owner_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '2 minutes')",[ids.session,ids.a,ids.owner]);
  if(process.env.R4_INDEPENDENT_EXPIRY_ONLY){
    await db.query("update private.tn_r4_prod_independent_access set issued_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute'");
    await assert.rejects(()=>call('register',randomUUID()),denied);
    assert.equal((await db.query('select count(*)::int n from private.tn_r4_prod_independent_workspace')).rows[0].n,0);
    console.log('PASS synthetic PG delta: expired lease rejects registration without writes');
  }else if(process.env.R4_INDEPENDENT_LOCK_ONLY){
    const locker=new Client(connection);await locker.connect();
    try{await locker.query('begin');await locker.query("select pg_advisory_xact_lock(hashtextextended('tennisnote-auth-identity:'||$1::text,0))",[ids.a]);
      await assert.rejects(()=>call('register',randomUUID()),denied);
      assert.equal((await locker.query('select count(*)::int n from private.tn_r4_prod_independent_workspace')).rows[0].n,0);
      await locker.query('commit');
    }finally{await locker.end();}
    await db.query('alter table public.tn_user_auth_links disable trigger tn_signup_relation_owner_lock');
    await assert.rejects(()=>call('register',randomUUID()),denied);
    await db.query('alter table public.tn_user_auth_links enable trigger tn_signup_relation_owner_lock');
    const op=randomUUID(),x=await call('register',op);assert.ok(x.workspace.id);
    console.log('PASS synthetic PG delta: busy identity lock fails closed, disabled mapping trigger fails closed, retry after restoration works');
  }else{
  await assert.rejects(()=>call('read',null,null,null,null,ids.a,ids.session2),denied);
  await assert.rejects(()=>call('read',null,null,null,null,ids.b,ids.otherSession),denied);
  const op=randomUUID(),one=await call('register',op),again=await call('register',op);
  assert.equal(one.workspace.id,again.workspace.id);
  await assert.rejects(()=>call('register',randomUUID()),e=>e.code==='23505');
  const lessonOp=randomUUID(),start=new Date(Math.ceil((Date.now()+3600000)/60000)*60000).toISOString();
  const lesson=await call('save',lessonOp,'Synthetic lesson',start,20),repeat=await call('save',lessonOp,'Synthetic lesson',start,20);
  assert.equal(lesson.lesson.id,repeat.lesson.id);assert.equal((await call('read')).lesson.id,lesson.lesson.id);
  await assert.rejects(()=>call('save',lessonOp,'Different synthetic',start,20),e=>e.code==='23505');
  await assert.rejects(()=>act(ids.a,ids.session,'select * from private.tn_r4_prod_independent_workspace'),denied);
  await db.query('update private.tn_r4_prod_independent_access set revoked_at=clock_timestamp()');await assert.rejects(()=>call('read'),denied);
  await db.query('update private.tn_r4_prod_independent_control set enabled=false');await assert.rejects(()=>call('read'),denied);
  const counts=(await db.query('select (select count(*)::int from private.tn_r4_prod_independent_workspace) workspaces,(select count(*)::int from private.tn_r4_prod_independent_lesson) lessons')).rows[0];
  assert.deepEqual(counts,{workspaces:1,lessons:1});
  console.log('PASS synthetic PG: default off, exact session/actor, idempotency, conflicts, direct table denial, revoke/off, one workspace and lesson');
  }
  }
}finally{if(connected)await db.end();if(started)run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}
