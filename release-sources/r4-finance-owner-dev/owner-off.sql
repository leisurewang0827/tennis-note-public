-- Operator must explicitly name one branch in this transaction/session.
begin;
set local lock_timeout='2s';
set local statement_timeout='8s';
do $off$
declare target uuid:=nullif(current_setting('tennisnote.r4_finance_target_branch',true),'')::uuid;
begin
  if target is null then raise exception 'r4_finance_owner_exact_branch_required'; end if;
  if not exists(select from private.tn_r4_finance_owner_control where branch_id=target) then
    raise exception 'r4_finance_owner_target_missing'; end if;
  update private.tn_r4_finance_owner_control set paid_enabled=false,terms_enabled=false,history_enabled=false
    where branch_id=target;
  if exists(select from private.tn_r4_finance_owner_control where branch_id=target
    and (paid_enabled or terms_enabled or history_enabled)) then raise exception 'r4_finance_owner_off_failed'; end if;
end $off$;
commit;
