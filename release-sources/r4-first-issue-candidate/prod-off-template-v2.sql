begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- Release-local coordination only; not a lock against unrelated DDL.
select pg_advisory_xact_lock(hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));
-- No supported receipt transport exists yet. No caller-set GUC can remove this stop.
do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;
do $off$ begin
  perform 1 from private.tn_r4_first_issue_control where singleton for update;
  if not found then raise exception 'r4_control_missing'; end if;
  lock table private.tn_r4_first_issue_scope in share row exclusive mode;
  update private.tn_r4_first_issue_control set enabled=false where singleton;
  update private.tn_r4_first_issue_scope set enabled=false where singleton;
  if exists(select from private.tn_r4_first_issue_control where enabled) or exists(select from private.tn_r4_first_issue_scope where enabled)
  then raise exception 'r4_off_failed'; end if;
end $off$;
commit;
