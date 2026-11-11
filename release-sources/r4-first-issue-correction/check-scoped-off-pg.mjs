// New delta only: do not rerun the prior install/restore lifecycle suite.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renderGuardedBoundOff} from './first-issue-db-actions.mjs';
import {STOP} from './verify-first-issue-correction.mjs';

const base=process.argv[2]??'C:/Codex/tennis-note-public-release-20260815/release-sources/r4-first-issue-candidate';
const bundle=join(tmpdir(),'tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f');
const bin=process.env.R4_PG_BIN??join(bundle,'package','native','bin');
const {Client}=createRequire(process.env.R4_PG_PACKAGE_JSON??join(bundle,'driver','package.json'))('pg');
const dir=mkdtempSync(join(tmpdir(),'tn-r4-bound-off-'));
const port=await new Promise((resolve,reject)=>{
  const s=createServer().once('error',reject);
  s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
});
const options=readFileSync(new URL('./prod-install-corrected.sql',import.meta.url),'utf8')
  .match(/create or replace function public\.tn_r4_prod_selfserve_ops_options\(branch uuid\)[\s\S]*?end \$\$;/)?.[0];
assert.ok(options);
const exact='11111111-2222-4333-8444-555555555555', other='22222222-2222-4333-8444-555555555555';
const guarded=renderGuardedBoundOff(readFileSync(join(base,'prod-off-template-v2.sql')),exact);
const run=(n,args)=>{
  const r=spawnSync(join(bin,n+(process.platform==='win32'?'.exe':'')),args,{cwd:dir,windowsHide:true,timeout:20000});
  assert.equal(r.status,0,`${n}_FAILED`);
};
const con={host:'127.0.0.1',port,user:'postgres',database:'postgres',statement_timeout:6000};
const db=new Client(con), observer=new Client(con);
let started=false, connected=false, observing=false;
try{
  run('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',dir,'-l',join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
  await db.connect();connected=true;
  for(const c of [db,observer]){
    if(c===observer){await c.connect();observing=true;}
    const r=(await c.query("select host(inet_server_addr()) as host,current_setting('data_directory') as root")).rows[0];
    assert.equal(r.host,'127.0.0.1');assert.equal(r.root.replaceAll('\\','/').toLowerCase(),dir.replaceAll('\\','/').toLowerCase());
  }
  await db.query(`set check_function_bodies=off; create schema private;
    create table private.tn_r4_first_issue_control(singleton boolean primary key,enabled boolean);
    create table private.tn_r4_first_issue_scope(singleton boolean primary key,enabled boolean,operation_id uuid);
    insert into private.tn_r4_first_issue_control values(true,true);
    ${options}`);
  await db.query('insert into private.tn_r4_first_issue_scope values(true,true,$1::uuid)',[other]);
  const scopedSql=guarded.replace(STOP,'-- Disposable loopback fixture only.');
  const flags=async()=> (await observer.query('select c.enabled control,s.enabled scope from private.tn_r4_first_issue_control c cross join private.tn_r4_first_issue_scope s')).rows[0];
  await assert.rejects(db.query(scopedSql),e=>e.code==='P0001'&&e.message==='r4_off_operation_or_options_drift');
  await db.query('rollback');
  assert.deepEqual(await flags(),{control:true,scope:true});
  await db.query('update private.tn_r4_first_issue_scope set operation_id=$1::uuid',[exact]);
  await db.query(scopedSql);
  assert.deepEqual(await flags(),{control:false,scope:false});
  console.log(JSON.stringify({disposableLoopback:true,foreignOperationDenied:true,approvedOperationOff:true,independentReadback:true,productionWrites:0}));
}finally{
  try{if(observing)await observer.end();}finally{try{if(connected)await db.end();}finally{if(started)run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}}
}
