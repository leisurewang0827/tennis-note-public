-- Future emergency OFF only; no deletion, role/session, or other feature changes.
begin;
set local lock_timeout='4s';
set local statement_timeout='12s';
do $off$
begin
  perform 1 from private.tn_r4_zero_personal_issue_gate where singleton for update;
  if not found then raise exception 'r4_zero_issue_gate_missing'; end if;
  update private.tn_r4_zero_personal_issue_gate set enabled=false where singleton and enabled;
end $off$;
commit;
