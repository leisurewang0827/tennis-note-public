begin;
set local lock_timeout='4s';
set local statement_timeout='10s';
update private.tn_r4_zero_personal_issue_gate set pending_registration_enabled=false
  where singleton and pending_registration_enabled;
commit;
