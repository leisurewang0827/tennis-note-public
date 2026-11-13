-- Run separately, against the same primary, after the install transaction returns.
-- Metadata and counts only. Missing candidate objects are an error, never an OFF result.
begin isolation level repeatable read read only;
set local search_path=pg_catalog;
set local statement_timeout='10s';
set local lock_timeout='3s';

select jsonb_build_object(
  'kind','R4_FIRST_ISSUE_INSTALLED_OFF_V1',
  'onPrimary',not pg_is_in_recovery(),
  'controlRows',(select count(*) from private.tn_r4_first_issue_control),
  'disabledControlRows',(select count(*) from private.tn_r4_first_issue_control where singleton and not enabled),
  'scopeRows',(select count(*) from private.tn_r4_first_issue_scope),
  'enabledScopeRows',(select count(*) from private.tn_r4_first_issue_scope where enabled),
  'canaryRows',(select count(*) from private.tn_r4_first_lesson_canary),
  'issuanceRows',(select count(*) from private.tn_r4_first_issue_receipts),
  'independentOff',(select count(*)=1 and count(*) filter (where singleton and not enabled)=1
    from private.tn_r4_prod_independent_control),
  'independentV2Off',(select count(*)=1 and count(*) filter (where singleton and mode='off')=1
    from private.tn_r4_prod_independent_v2_control),
  'schedulerSha',encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(
    'public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)')),'UTF8')),'hex'),
  'optionsSha',encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(
    'public.tn_r4_prod_selfserve_ops_options(uuid)')),'UTF8')),'hex'),
  'optionsBackupMatches',((select count(*)=1 from private.tn_r4_first_issue_ops_backup) and (
    select count(*)=1 from private.tn_r4_first_issue_ops_backup b
    join pg_proc p on p.oid=to_regprocedure('public.tn_r4_prod_selfserve_ops_options(uuid)')
    where b.singleton
      and b.pre_sha='f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f'
      and b.post_sha='15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286'
      and encode(sha256(convert_to(b.definition,'UTF8')),'hex')=b.pre_sha
      and p.proowner=b.owner_id and p.proacl is not distinct from b.acl
      and p.proconfig is not distinct from b.config
  ))
) as receipt;
rollback;
