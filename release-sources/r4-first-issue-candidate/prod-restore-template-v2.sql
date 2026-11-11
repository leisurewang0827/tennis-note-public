begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- Release-local coordination only; not a lock against unrelated DDL.
select pg_advisory_xact_lock(hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));
-- No supported receipt transport exists yet. No caller-set GUC can remove this stop.
do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;
do $restore$ declare b private.tn_r4_first_issue_ops_backup%rowtype; p pg_proc%rowtype; begin
  perform 1 from private.tn_r4_first_issue_control where singleton and not enabled for update;
  if not found then raise exception 'r4_restore_not_off'; end if;
  lock table private.tn_r4_first_issue_scope in share row exclusive mode;
  if exists(select from private.tn_r4_first_issue_scope where enabled) then raise exception 'r4_restore_scope_on'; end if;
  select * into strict b from private.tn_r4_first_issue_ops_backup where singleton for update;
  select * into strict p from pg_proc where oid='public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure;
  if b.pre_sha<>'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f' or b.post_sha<>'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286' or encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex')<>b.post_sha
     or encode(sha256(convert_to(b.definition,'UTF8')),'hex')<>b.pre_sha
     or p.proowner is distinct from b.owner_id or p.proacl is distinct from b.acl or p.proconfig is distinct from b.config
  then raise exception 'r4_restore_postimage_drift'; end if;
  execute b.definition;
  select * into strict p from pg_proc where oid='public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure;
  if encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex')<>b.pre_sha or p.proowner is distinct from b.owner_id
     or p.proacl is distinct from b.acl or p.proconfig is distinct from b.config
  then raise exception 'r4_restore_preimage_drift'; end if;
end $restore$;
commit;
