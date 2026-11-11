-- UNBOUND: use the approved activation preimage epoch. Scope is v2 only.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='12s';
do $disable$
declare g private.tn_r4_prod_independent_v2_control%rowtype; e bigint:='__EXPECTED_EPOCH__'::bigint;
begin
  if e<0 or to_regclass('private.tn_r4_dev_independent_selfserve_gate') is not null
    or to_regclass('private.tn_r4_prod_independent_control') is null
    then raise exception 'independent_v2_disable_target'; end if;
  select * into strict g from private.tn_r4_prod_independent_v2_control where singleton for update;
  if g.mode='off' and g.epoch=e+2 then return; end if;
  if not((g.epoch=e and g.mode='off') or (g.epoch=e+1 and g.mode in ('pilot','designated')))
    then raise exception 'independent_v2_disable_epoch'; end if;
  update private.tn_r4_prod_independent_v2_control set mode='off',epoch=e+2 where singleton;
  update private.tn_r4_prod_independent_v2_pilot set revoked_at=clock_timestamp() where epoch=e+1 and revoked_at is null;
  update private.tn_r4_prod_independent_v2_designated set revoked_at=clock_timestamp() where epoch=e+1 and revoked_at is null;
end $disable$;
commit;
