-- Candidate DEV emergency close. Retains all workspaces, lessons and receipts.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='20s';
do $guard$
begin
  if to_regclass('private.tn_r4_general_dev_control') is null
    or to_regclass('private.tn_r4_prod_independent_control') is not null then
    raise exception 'independent_dev_preimage_mismatch';
  end if;
end $guard$;
update private.tn_r4_dev_independent_selfserve_gate
  set create_enabled=false,lessons_enabled=false,test_closed_at=coalesce(test_closed_at,clock_timestamp()) where singleton;
update private.tn_r4_dev_independent_selfserve_access
  set revoked_at=clock_timestamp() where revoked_at is null;
commit;
