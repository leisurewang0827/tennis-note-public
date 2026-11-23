-- Restore only this PROD management delta. Keep all audit/control/business records.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $restore$
declare b private.tn_r4_finance_admin_backup; meta jsonb;
begin
 if current_setting('tennisnote.install_target',true) is distinct from 'cnympiwrwgouuvhaivbc' then
  raise exception 'finance_admin_prod_target_required'; end if;
 update private.tn_r4_finance_platform_admins set active=false;
 if exists(select from private.tn_r4_finance_admin_grants where enabled)
 or exists(select from private.tn_r4_finance_admin_grants g join private.tn_r4_finance_owner_control c using(branch_id)
   where c.paid_enabled or c.terms_enabled or c.history_enabled) then raise exception 'finance_admin_close_first'; end if;
 select * into strict b from private.tn_r4_finance_admin_backup;
 select jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef)
 into meta from pg_proc p where p.oid='private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure;
 if meta<>b.original_metadata or encode(sha256(convert_to(pg_get_functiondef('private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure),'UTF8')),'hex')<>b.installed_hash
 then raise exception 'finance_admin_restore_drift'; end if;
 execute b.original_definition;
end $restore$;
revoke all on function public.tn_r4_finance_admin_state(uuid),public.tn_r4_finance_admin_set(uuid,uuid,boolean,bigint,uuid) from public,anon,authenticated,service_role;
update private.tn_r4_finance_platform_admins set active=false;
commit;
