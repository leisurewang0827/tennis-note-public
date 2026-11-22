-- One result, read-only PROD post-install seal. No business RPC calls or authority activation.
begin read only;
set local statement_timeout='8s';
select jsonb_build_object(
 'effective_access',(select count(*) from private.tn_r4_finance_owner_control where paid_enabled or terms_enabled or history_enabled),
 'control_rows',(select count(*) from private.tn_r4_finance_owner_control),
 'old_paid_access',(select count(*) from private.tn_r4_branch_paid_access where expires_at>clock_timestamp()),
 'old_terms_access',(select count(*) from private.tn_r4_branch_finance_term_access where expires_at>clock_timestamp()),
 'old_history_access',(select count(*) from private.tn_r4_branch_paid_history_access where expires_at>clock_timestamp()),
 'backup_rows',(select count(*) from private.tn_r4_finance_owner_backup),
 'exact_installed',(select count(*) from private.tn_r4_finance_owner_backup b join pg_proc p on p.oid=b.function_oid
    where encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')=b.installed_sha256
    and jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility'),
 'private_tables_protected',(select count(*) from pg_class c where c.oid in ('private.tn_r4_finance_owner_control'::regclass,'private.tn_r4_finance_owner_backup'::regclass)
    and c.relrowsecurity and not has_table_privilege('anon',c.oid,'select,insert,update,delete')
    and not has_table_privilege('authenticated',c.oid,'select,insert,update,delete')
    and not has_table_privilege('service_role',c.oid,'select,insert,update,delete')),
 'assert_direct',has_function_privilege('authenticated','private.tn_r4_finance_owner_assert(uuid,text)','execute'),
 'probe_direct',has_function_privilege('authenticated','private.tn_r4_finance_owner_try(uuid,text)','execute'),
 'roster_anonymous',has_function_privilege('anon','public.tn_r4_branch_finance_coaches(uuid)','execute'),
 'roster_authenticated',has_function_privilege('authenticated','public.tn_r4_branch_finance_coaches(uuid)','execute'),
 'definitions',(select jsonb_object_agg(p.oid::regprocedure::text,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('tn_r4_finance_canary_admitted','tn_r4_finance_canary_assert','tn_r4_finance_canary_check_commit','tn_r4_finance_canary_note_activation',
       'tn_capture_manual_purchase','tn_r4_capture_branch_manual_purchase','tn_r3_manual_purchase_context','tn_r4_finance_owner_assert','tn_r4_finance_owner_try'))
       or (n.nspname='public' and p.proname='tn_r4_branch_finance_coaches'))
) as state;
rollback;

