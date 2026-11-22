-- Exact rollback of this delta only. Receipts, purchases, terms and control history remain.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $restore$
declare r record;
begin
  -- Stop/wait for admitted transactions before proving every capability OFF.
  perform 1 from private.tn_r4_finance_owner_control order by branch_id for update;
  if exists(select from private.tn_r4_finance_owner_control where paid_enabled or terms_enabled or history_enabled)
    or exists(select from private.tn_r4_branch_paid_access where expires_at>clock_timestamp())
    or exists(select from private.tn_r4_branch_finance_term_access where expires_at>clock_timestamp())
    or exists(select from private.tn_r4_branch_paid_history_access where expires_at>clock_timestamp()) then
    raise exception 'r4_finance_owner_close_first'; end if;
  if (select count(*) from private.tn_r4_finance_owner_backup)<>6 then raise exception 'r4_finance_owner_backup_incomplete'; end if;
  for r in select * from private.tn_r4_finance_owner_backup order by signature loop
    if encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(r.signature)),'UTF8')),'hex')
      is distinct from r.installed_sha256 or encode(sha256(convert_to(r.original_definition,'UTF8')),'hex')
      is distinct from r.original_sha256 then raise exception 'r4_finance_owner_restore_preimage_mismatch'; end if;
    if not exists(select from pg_proc p where p.oid=r.function_oid
      and jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)
        =r.original_metadata-'volatility') then raise exception 'r4_finance_owner_restore_metadata_mismatch'; end if;
  end loop;
  for r in select * from private.tn_r4_finance_owner_backup order by signature loop
    execute r.original_definition;
    if pg_get_functiondef(to_regprocedure(r.signature))<>r.original_definition then
      raise exception 'r4_finance_owner_restore_inexact'; end if;
  end loop;
end $restore$;
revoke all on function public.tn_r4_branch_finance_coaches(uuid) from public,anon,authenticated,service_role;
commit;

