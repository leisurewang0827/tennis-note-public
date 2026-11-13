// 실제 보호 실행의 진입점. 비밀값·본문·개인정보는 출력하지 않는다.
import { createHash } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPinnedReviewSql } from './r4-prod-catalog-pinned-db-packet.mjs';
import { buildOffOnlyReviewBundle } from './r4-off-only-review-bundle.mjs';
import { bindOffOnlyDbTransport } from './r4-off-only-db-transport.mjs';
import { bindOffOnlyPages } from './r4-off-only-pages-transport.mjs';
import { readExactGitHubRelease, releaseApprovalComment, scope } from './r4-off-only-github-admission.mjs';
import { runOffOnlyProtectedSequence } from './r4-off-only-protected-sequence.mjs';

const sha = x => createHash('sha256').update(x).digest('hex');
const pin = (file, want) => { const b=readFileSync(new URL(file,import.meta.url)); if(sha(b)!==want) throw Error('R4_CATALOG_SOURCE_DRIFT');
  return b.toString('utf8'); };
const source = '30bdd59100426cc6cee740c9b52b84c1e6c10c5d';
const recovery = '80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4';
const oldOptions = 'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f';
const newOptions = '15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286';

export function operationFor(commit, runId) {
  const h=sha(`${scope.repo}:${commit}:${runId}:install-off-admin-only`);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}

export function buildCatalogReads() {
  const original = pin('prod-r4-storage-preimage-delta-readonly.sql','6b9330ac75c1ecf36a4b88bc04ab1a37a485261f3773cd5673c53031a1119bd7');
  const guard = pin('prod-r4-storage-transition-pin.sql','09d354721813053a4c63f4d7a78ca35c43d2a12771863ca5a3615f02cba1aaf8');
  const lock = /  lock table public\.tn_lesson_change_requests,[\s\S]*?in share row exclusive mode;\r?\n/;
  if (!lock.test(guard) || original.split(/\r?\nrollback;/i).length!==2) throw Error('R4_CATALOG_GUARD_DRIFT');
  const header = "begin isolation level repeatable read read only;\nset local search_path=pg_catalog;\nset local statement_timeout='10s';\n";
  const common = `not pg_is_in_recovery() as "primary", 
    encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.tn_r4_prod_selfserve_ops_options(uuid)')),'UTF8')),'hex') as "optionsSha",
    (select count(*)=1 and count(*) filter (where singleton and not enabled)=1 from private.tn_r4_prod_independent_control) as "independentOff",
    (select count(*)=1 and count(*) filter (where singleton and mode='off')=1 from private.tn_r4_prod_independent_v2_control) as "independentV2Off"`;
  const installedOrRestored = phase => header + guard.replace(lock,'').replace('__ASSEMBLY_PHASE__',phase) + `
    select ${common}, (select count(*)=1 and count(*) filter(where singleton and not enabled)=1 from private.tn_r4_first_issue_control) as "controlOff",
    (select count(*) from private.tn_r4_first_issue_scope where enabled) as "enabledScopeRows",
    (select count(*) from private.tn_r4_first_issue_scope) as "scopeRows",
    (select count(*) from private.tn_r4_first_lesson_canary) as "canaryRows",
    (select count(*) from private.tn_r4_first_issue_receipts) as "issuanceRows",
    exists(select from pg_trigger t join pg_constraint c on c.oid=t.tgconstraint join pg_proc p on p.oid=t.tgfoid
      where t.tgrelid=to_regclass('private.tn_r4_first_issue_receipts') and t.tgname='tn_r4_issue_require_live_at_commit'
      and t.tgfoid=to_regprocedure('private.tn_r4_issue_require_live_at_commit()') and t.tgenabled='O'
      and t.tgdeferrable and t.tginitdeferred and t.tgtype=5 and t.tgnargs=0 and not t.tgisinternal
      and t.tgqual is null and c.contype='t' and c.condeferrable and c.condeferred
      and p.proowner='postgres'::regrole and p.prosecdef and p.proconfig=array['search_path=pg_catalog']
      and not exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>p.proowner)
      and encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')=
        'db8996a2bdb28d01c04afe8cd74271b592f5b2ededed83630476c88f17ef5fd1') as "issueFenceExact",
    (to_regprocedure('private.tn_r4_issue_require_live_at_commit()') is null and
     to_regprocedure('private.tn_r4_first_lesson_on(uuid,uuid)') is null) as "closedFencesRemoved"${phase==='installed'?`,
    (select count(*)=1 and count(*) filter(where b.singleton and b.pre_sha='${oldOptions}' and b.post_sha='${newOptions}'
      and encode(sha256(convert_to(b.definition,'UTF8')),'hex')=b.pre_sha
      and p.proowner=b.owner_id and p.proacl is not distinct from b.acl and p.proconfig is not distinct from b.config)=1
      from private.tn_r4_first_issue_ops_backup b join pg_proc p
      on p.oid=to_regprocedure('public.tn_r4_prod_selfserve_ops_options(uuid)')) as "optionsBackupMatches"`:''};
    \nrollback;\n`;
  const baseline = header + guard.replace(lock,'').replace('__ASSEMBLY_PHASE__','baseline') + `
    select ${common}, to_regclass('private.tn_r4_first_issue_ops_backup') is null
    and to_regclass('private.tn_r4_first_lesson_canary') is null and to_regclass('private.tn_r4_first_issue_control') is null
    and to_regclass('private.tn_r4_first_issue_scope') is null and to_regclass('private.tn_r4_first_issue_receipts') is null
    and to_regprocedure('public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)') is null
    and to_regprocedure('private.tn_r4_issue_require_live_at_commit()') is null as "newObjectsAbsent";
    \nrollback;\n`;
  return { baseline, installed: installedOrRestored('installed'), restored: installedOrRestored('baseline') };
}

const onlyRow = value => Array.isArray(value) && value.length===1 ? value[0] : null;
export function dbObserver(transport, reads, plan) {
  const context={candidate:plan.commit, packageSha:plan.packageSha, operation:plan.operation, separateRead:true, target:plan.dbFingerprint};
  const safe = row => row?.primary===true && row.independentOff===true && row.independentV2Off===true;
  const get = async sql => onlyRow(await transport.observeExact(sql,sha(sql)));
  return async () => {
    try {
      const row=await get(reads.baseline);
      if(safe(row) && row.optionsSha===oldOptions && row.newObjectsAbsent===true)
        return {...context,primary:true,state:'baseline',exactOriginalCatalog:true};
    } catch { /* only guarded readback, never a write retry */ }
    try {
      const row=await get(reads.installed);
      if(safe(row) && row.optionsSha===newOptions && row.issueFenceExact===true && row.optionsBackupMatches===true) {
        // The evidence fields and exact installed metadata came from one read-only snapshot.
        const receipt={kind:'R4_FIRST_ISSUE_INSTALLED_OFF_V1',onPrimary:row.primary,controlRows:row.controlOff?1:0,
          disabledControlRows:row.controlOff?1:0,scopeRows:row.scopeRows,enabledScopeRows:row.enabledScopeRows,
          canaryRows:row.canaryRows,issuanceRows:row.issuanceRows,independentOff:row.independentOff,
          independentV2Off:row.independentV2Off,optionsSha:row.optionsSha,optionsBackupMatches:row.optionsBackupMatches,
          schedulerSha:'1ee110c0ce5fe307bd314ab81b35a88496ae55027736fa43dd6934f539db5375'};
        return {...context,primary:true,state:'installed',exactInstalledCatalog:true,receipt};
      }
    } catch { /* a restored state is distinct from a missing baseline */ }
    try {
      const row=await get(reads.restored);
      if(safe(row) && row.optionsSha===oldOptions && row.closedFencesRemoved===true &&
          row.canaryRows===0 && row.issuanceRows===0 && row.controlOff===true && row.enabledScopeRows===0)
        return {...context,primary:true,state:'restored',exactOriginalCatalog:true,controlOff:true,enabledScopeRows:0};
    } catch { /* no state is inferred */ }
    return null;
  };
}

async function planFor(checkout, requireRunning) {
  const {manifest,sha256:packageSha}=buildOffOnlyReviewBundle(checkout);
  const runId=Number(process.env.GITHUB_RUN_ID), commit=process.env.GITHUB_SHA;
  const token=process.env.GITHUB_TOKEN;
  if(process.env.GITHUB_ACTIONS!=='true' || !token || !Number.isSafeInteger(runId) || runId<=0 || !/^[a-f0-9]{40}$/.test(commit??''))
    throw Error('R4_OFF_ONLY_WORKFLOW_REQUIRED');
  const r=await fetch(`https://api.github.com/repos/${scope.repo}/actions/runs/${runId}/attempts/1/jobs?per_page=100`,
    {headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(r.status!==200) throw Error('R4_JOB_LIST_UNAVAILABLE');
  const list=(await r.json()).jobs?.filter(j=>j.name===scope.job && j.head_sha===commit);
  if(list?.length!==1 || (requireRunning && list[0].status!=='in_progress')) throw Error('R4_JOB_NOT_BOUND');
  return {commit,packageSha,runId,jobId:list[0].id,operation:operationFor(commit,runId),source,recovery,
    project:'tennisnote-admin',dbFingerprint:manifest.db.fingerprint,scope:'install-off-admin-only'};
}

export async function main(checkout) {
  const plan=await planFor(checkout,true);
  const token=process.env.GITHUB_TOKEN;
  if(await readExactGitHubRelease(plan,token)!==true) throw Error('R4_OFF_ONLY_AUTHORITY_MISSING');
  const work=join(process.env.RUNNER_TEMP,'r4-off-only-once');
  mkdirSync(work,{mode:0o700});
  const claim=(p,stage='release')=>{
    const f=join(work,sha(JSON.stringify([p.commit,p.runId,p.jobId,p.operation,stage])));
    let fd;try{fd=openSync(f,'wx',0o600);}catch(e){if(e.code==='EEXIST')return false;throw e;}
    try{writeFileSync(fd,'attempted\n');fsyncSync(fd);}finally{closeSync(fd);} return true;
  };
  const b=buildPinnedReviewSql(checkout,{offOnly:true});
  const sql={install:b.install.sql,restore:b.restore.sql,
    off:readFileSync(join(checkout,'release-sources/r4-first-issue-candidate/prod-off-template-v2.sql'),'utf8'),
    observe:readFileSync(new URL('prod-r4-install-committed-off-readonly.sql',import.meta.url),'utf8')};
  const db=bindOffOnlyDbTransport({checkout,sql,readToken:process.env.R4_DB_READ_TOKEN,writeToken:process.env.R4_DB_WRITE_TOKEN,
    claimOnce:claim,githubToken:token});
  const pages=bindOffOnlyPages({checkout,assets:join(process.env.RUNNER_TEMP,'r4-source','admin'),
    publisher:join(process.env.RUNNER_TEMP,'r4-wrangler','node_modules','wrangler','wrangler-dist','cli-r4-single.cjs'),
    account:process.env.CLOUDFLARE_ACCOUNT_ID,accountSha:process.env.R4_CLOUDFLARE_ACCOUNT_SHA,
    pagesToken:process.env.CLOUDFLARE_API_TOKEN,githubToken:token,packageSha:plan.packageSha,claimOnce:claim});
  return runOffOnlyProtectedSequence(plan,{assertAuthority:p=>readExactGitHubRelease(p,token),claimOnce:claim,
    readDb:dbObserver(db,buildCatalogReads(),plan),readWeb:pages.observe,installDbOnce:db.install,offDbOnce:db.off,
    restoreDbOnce:db.restore,publishAdminOnce:pages.publish,restoreAdminOnce:pages.restore});
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const checkout=resolve(process.argv[3]??'.');
  try {
    if(process.argv[2]==='release') {
      const r=await main(checkout);console.log(JSON.stringify(r));
      if(r.status!=='ADMIN_PUBLISHED_DB_OFF_VERIFIED') process.exitCode=1;
    } else if(process.argv[2]==='package') {
      console.log(buildOffOnlyReviewBundle(checkout).sha256);
    } else throw Error('R4_OFF_ONLY_MODE');
  } catch(e) {
    console.error(/^R4_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'R4_OFF_ONLY_FAILED_CLOSED');process.exitCode=1;
  }
}

import { fileURLToPath } from 'node:url';
