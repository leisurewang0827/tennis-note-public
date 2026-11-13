-- REVIEW ONLY: emergency OFF and session revocation come before this DDL.
begin;
do $stop$ begin raise exception 'r4_local_issue_fence_restore_not_authorized'; end $stop$;
-- BEGIN ISOLATED TEST BODY
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));

do $restore$
declare f regprocedure;
begin
  perform 1 from private.tn_r4_first_issue_control where singleton and not enabled for update;
  if not found then raise exception 'r4_issue_fence_restore_not_off'; end if;

  lock table private.tn_r4_first_lesson_canary, private.tn_r4_first_issue_scope
    in share row exclusive mode;
  if exists(select from private.tn_r4_first_issue_scope where enabled)
    or exists(select from private.tn_r4_first_lesson_canary c where c.phase<>'closed'
      or c.session_access_expires_at is null or c.session_access_expires_at>=clock_timestamp()
      or exists(select from auth.sessions s where s.id=c.session_id and s.user_id=c.auth_id))
    or exists(select from private.tn_r4_first_issue_scope s where not exists(
      select from private.tn_r4_first_lesson_canary c where
        (s.operation_id,s.session_id,s.auth_id,s.branch_id,s.owner_id,s.member_id,s.product_id,s.coach_id)
        =(c.operation_id,c.session_id,c.auth_id,c.branch_id,c.owner_id,c.member_id,c.product_id,c.coach_id)))
  then raise exception 'r4_issue_fence_restore_session_not_drained'; end if;

  lock table private.tn_r4_first_issue_receipts in access exclusive mode;
  f:=to_regprocedure('private.tn_r4_issue_require_live_at_commit()');
  if not exists(select from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=f and p.prorettype='trigger'::regtype and p.prosecdef
      and l.lanname='plpgsql' and p.proconfig=array['search_path=pg_catalog']
      and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')
        ='db8996a2bdb28d01c04afe8cd74271b592f5b2ededed83630476c88f17ef5fd1'
      and not exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee<>p.proowner))
    or not exists(select from pg_trigger t join pg_constraint c on c.oid=t.tgconstraint
      where t.tgrelid='private.tn_r4_first_issue_receipts'::regclass
        and t.tgname='tn_r4_issue_require_live_at_commit' and t.tgfoid=f
        and not t.tgisinternal and t.tgenabled='O' and t.tgtype=5 and t.tgnargs=0
        and t.tgqual is null and t.tgdeferrable and t.tginitdeferred
        and c.contype='t' and c.conrelid=t.tgrelid and c.condeferrable and c.condeferred)
  then raise exception 'r4_issue_fence_restore_definition_drift'; end if;

  drop trigger tn_r4_issue_require_live_at_commit on private.tn_r4_first_issue_receipts;
  drop function private.tn_r4_issue_require_live_at_commit() restrict;
end $restore$;
-- END ISOLATED TEST BODY
-- Retain original issue control, session and operation evidence, receipts and records.
commit;
