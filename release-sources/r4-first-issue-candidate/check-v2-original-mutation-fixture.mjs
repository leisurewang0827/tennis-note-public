// Local disposable PG only. Production preimage is deliberately NOT asserted here.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {join} from 'node:path';
const root=new URL('./',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const hashes={
 'prod-install-template-v2.sql':'ddc5691f8977dadcb0091cd2a6f49122f8c82f121caab6a675e1108f8efb1063',
 'prod-off-template-v2.sql':'06b8d930275ee7b98d2796a5decd158994f572b1d5a25f0e60967126e204feb0',
 'prod-restore-template-v2.sql':'29ad67c914d1a2efff2c8d3bfcc8f78b64eb63ab21787b426f6a02472c9715d6',
 'prod-readback-template-v2.sql':'6a4afce725c7b1c1fe09692f046fe3ffe83133e54c730b780ee17bc2bebaf6a8'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const templates=Object.fromEntries(Object.entries(hashes).map(([n,h])=>{const s=read(n);assert.equal(sha(s),h,'ORIGINAL_TEMPLATE_DRIFT');return [n,s];}));
const marker="do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;";
function body(n,install=false){
 const s=templates[n];assert.equal(s.split(marker).length,2);
 const tail=s.split(marker)[1];
 if(!install)return tail;
 const parts=tail.split('end $pre$;');assert.equal(parts.length,2);
 assert.match(parts[0],/^\s*do \$pre\$/);assert.match(parts[1],/^\s*create table private\.tn_r4_first_issue_ops_backup/);
 return parts[1];
}
const bundle=join(process.env.TEMP||process.env.TMPDIR||'/tmp','tn-r4-catalog-pg17-592178bf01254892ad2f48f45428600f');
const bin=process.env.R4_PG_BIN||join(bundle,'package','native','bin');
const packageJson=process.env.R4_PG_PACKAGE_JSON||join(bundle,'driver','package.json');
const {Client}=createRequire(packageJson)('pg');
const dir=mkdtempSync(join(process.env.TEMP||process.env.TMPDIR||'/tmp','tn-r4-original-v2-'));
const port=await new Promise((resolve,reject)=>{const s=createServer().once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
function run(n,a){const r=spawnSync(join(bin,n+(process.platform==='win32'?'.exe':'')),a,{cwd:dir,windowsHide:true,timeout:25000,encoding:'utf8'});assert.equal(r.status,0,n+' failed');}
const base={host:'127.0.0.1',port,user:'postgres',statement_timeout:8000};
const admin=new Client({...base,database:'postgres'}),db=new Client({...base,database:'r4_original_v2_fixture'}),reader=new Client({...base,database:'r4_original_v2_fixture'});
const bootstrap=read('check-issue-isolated.mjs').match(/await db\.query\(`([\s\S]*?)`\);/)?.[1];assert.ok(bootstrap&&!bootstrap.includes('${'));
const old=read('fixture-original-ops.sql').match(/create function public\.tn_r4_prod_selfserve_ops_options\(branch uuid\)[\s\S]*?end \$\$;/)?.[0];assert.ok(old);
const guard=`do $fixture$ begin if current_database()<>'r4_original_v2_fixture' or inet_server_addr() is distinct from '127.0.0.1'::inet or current_setting('r4.original_fixture',true) is distinct from 'yes' then raise exception 'fixture_only'; end if; end $fixture$;`;
const fn="'public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure";
const fingerprint=async c=>(await c.query(`select encode(sha256(convert_to(pg_get_functiondef(${fn}),'UTF8')),'hex') sha,p.proowner::regrole::text owner,p.proacl::text acl,p.proconfig::text config from pg_proc p where p.oid=${fn}`)).rows[0];
let up=false,adminOn=false,dbOn=false,readerOn=false;
try{
 run('initdb',['-D',dir,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8']);
 run('pg_ctl',['-D',dir,'-l',join(dir,'pg.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);up=true;
 await admin.connect();adminOn=true;await admin.query('create database r4_original_v2_fixture');
 await db.connect();dbOn=true;await reader.connect();readerOn=true;await db.query(bootstrap);
 await db.query('alter table public.tn_users add column name text; alter table public.tn_coach_roles add column display_name text; alter table public.tn_payments add column ticket_id uuid; create table public.tn_branches(id uuid primary key,name text,status text); create table public.tn_schedule_v2_policies(branch_id uuid,revision bigint,coach_single_add_mode text)');
 // Production's function body stores CRLF. Preserve its exact body bytes only;
 // the frozen v2 templates and all SQL extracted from them remain untouched.
 const oldCrLf=old.replace(/(as \$\$)([\s\S]*?)(\$\$;)/,(_m,a,b,c)=>a+b.replace(/\r?\n/g,'\r\n')+c);
 assert.notEqual(oldCrLf,old);await db.query(oldCrLf);
 await db.query('revoke all on function public.tn_r4_prod_selfserve_ops_options(uuid) from public,anon,service_role; grant execute on function public.tn_r4_prod_selfserve_ops_options(uuid) to authenticated');
 // pg_get_functiondef resolves names according to search_path. Match the unchanged
 // production templates, which explicitly use pg_catalog for their pre/post hashes.
 await db.query('set search_path=pg_catalog');await reader.query('set search_path=pg_catalog');
 const before=await fingerprint(db);
 assert.equal(before.sha,'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f','ORIGINAL_FUNCTION_PREIMAGE_MISMATCH');
 // Each original body is run verbatim, within a transaction on our guarded loopback DB.
 await db.query("set r4.original_fixture='yes'");
 await db.query('begin; '+guard+'\n'+body('prod-install-template-v2.sql',true));
 const post=await fingerprint(reader);assert.equal(post.sha,'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286');
 assert.deepEqual((await reader.query('select enabled,(select count(*)::int from private.tn_r4_first_issue_scope) scopes from private.tn_r4_first_issue_control')).rows,[{enabled:false,scopes:0}]);
 const ids=Array.from({length:8},()=>randomUUID());
 await db.query("insert into private.tn_r4_first_issue_scope(branch_id,owner_id,auth_id,session_id,member_id,product_id,coach_id,operation_id,valid_until,enabled) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp()+interval '2 minutes',true)",ids);
 await db.query('update private.tn_r4_first_issue_control set enabled=true');
 await db.query('begin; '+guard+'\n'+body('prod-off-template-v2.sql'));
 const off=(await reader.query('select enabled,(select count(*)::int from private.tn_r4_first_issue_scope where enabled) active from private.tn_r4_first_issue_control')).rows;assert.deepEqual(off,[{enabled:false,active:0}]);
 await reader.query("set r4.original_fixture='yes'");
 const results=await reader.query('begin read only; '+guard+'\n'+body('prod-readback-template-v2.sql'));
 const result=(Array.isArray(results)?results:[results]).flatMap(x=>x.rows||[]).find(x=>x.receipt)?.receipt;
 assert.equal(result?.controlOff,true);assert.equal(result?.activeScopeCount,0);assert.equal(result?.backupPresent,true);assert.equal(result?.currentOptionsSha,post.sha);
 await db.query('begin; '+guard+'\n'+body('prod-restore-template-v2.sql'));
 assert.deepEqual(await fingerprint(reader),before);
 console.log(JSON.stringify({originalHashes:4,originalMutationBodies:'PASS',readback:'PASS',off:'PASS',originalOptionsOwnerAclConfigRestored:'PASS',productionPreimage:'NOT_TESTED',db:'DISPOSABLE_LOOPBACK_ONLY'}));
}finally{if(readerOn)await reader.end();if(dbOn)await db.end();if(adminOn)await admin.end();if(up)run('pg_ctl',['-D',dir,'-m','fast','-w','stop']);}
