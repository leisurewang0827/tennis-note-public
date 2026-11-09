-- Exact Seoul PROD project and installed release binding required before execution.
-- Scope: close only the new master gate. Keep grants, drafts and registrations intact.
begin;
set local lock_timeout='5s';
set local statement_timeout='10s';
do $off$
begin
  if to_regclass('private.tn_r4_dev_internal_product_scope') is not null
    or to_regclass('private.tn_r4_prod_internal_product_access') is null
    or to_regprocedure('public.tn_r4_prod_private_catalog_list(uuid)') is null
  then raise exception 'r4_private_catalog_prod_contract_drift'; end if;
  perform 1 from private.tn_r4_prod_private_catalog_control where singleton for update;
  if not found then raise exception 'r4_private_catalog_gate_missing'; end if;
  update private.tn_r4_prod_private_catalog_control set enabled=false where singleton and enabled;
end $off$;
commit;
