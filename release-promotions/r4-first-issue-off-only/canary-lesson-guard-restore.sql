-- LOCAL REVIEW CANDIDATE. Emergency OFF is separate, and comes first.
begin;
do $stop$ begin raise exception 'r4_local_lesson_restore_not_authorized'; end $stop$;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='15s';
select pg_advisory_xact_lock(hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));

do $restore$
declare
  r text; def text; before_def text; p pg_proc%rowtype;
  f constant regprocedure:='public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)'::regprocedure;
  marker constant text:=E'  perform private.tn_r4_first_lesson_claim(target_branch_id,target_coach_role_id,target_lesson_date,target_start_time,target_duration_minutes,target_schedule_kind,target_participants,target_operation_key,target_lesson_id,target_expected_revision,target_request_id,target_note);\r\n';
begin
  -- Unlike OFF, DDL rollback cannot remove the stale-session fence until that
  -- exact session is gone and its last issued access token is expired.
  perform 1 from private.tn_r4_first_issue_control where singleton and not enabled for update;
  if not found then raise exception 'r4_canary_restore_not_off'; end if;
  lock table private.tn_r4_first_lesson_canary,private.tn_r4_first_issue_scope in share row exclusive mode;
  if exists(select from private.tn_r4_first_issue_scope where enabled)
    or exists(select from private.tn_r4_first_lesson_canary c where phase<>'closed'
      or session_access_expires_at is null or session_access_expires_at>=clock_timestamp()
      or exists(select from auth.sessions s where s.id=c.session_id and s.user_id=c.auth_id))
  then raise exception 'r4_canary_restore_session_not_drained'; end if;
  select * into strict p from pg_proc where oid=f;
  def:=pg_get_functiondef(f);
  before_def:=replace(def,marker,'');
  if length(def)-length(before_def)<>length(marker)
    or encode(sha256(convert_to(before_def,'UTF8')),'hex')<>
      'e70d2c8bc200e8666a666cc3e32def051e44eadcedb7b4f76983a7c6ae1b24d6'
  then raise exception 'r4_canary_restore_definition_drift'; end if;
  foreach r in array array['tn_lessons','tn_lesson_participants','tn_schedule_v2_requests','tn_lesson_change_requests','tn_one_day_bookings']
  loop
    if (select count(*) from pg_trigger where tgrelid=to_regclass('public.'||r) and not tgisinternal
      and (tgname,tgtype) in (('zz_tn_r4_canary_row_fence',31::smallint),('zz_tn_r4_canary_truncate_fence',34::smallint))
      and tgenabled='O' and tgfoid='private.tn_r4_canary_fence_lesson_storage()'::regprocedure)<>2
    then raise exception 'r4_canary_restore_trigger_drift'; end if;
    execute format('drop trigger zz_tn_r4_canary_row_fence on public.%I',r);
    execute format('drop trigger zz_tn_r4_canary_truncate_fence on public.%I',r);
  end loop;
  execute before_def;
  if pg_get_functiondef(f) is distinct from before_def or not exists(select from pg_proc
    where oid=p.oid and proowner=p.proowner and proacl is not distinct from p.proacl
      and proconfig is not distinct from p.proconfig and prosecdef=p.prosecdef
      and proargnames is not distinct from p.proargnames and prorettype=p.prorettype)
  then raise exception 'r4_canary_restore_preimage_drift'; end if;
end $restore$;

drop trigger tn_r4_canary_capture_claim_tx on private.tn_r4_first_lesson_canary;
drop trigger tn_r4_canary_check_saved_at_commit on private.tn_r4_first_lesson_canary;
drop trigger tn_r4_first_lesson_fresh_at_commit on private.tn_r4_first_lesson_canary;
drop function private.tn_r4_first_lesson_on(uuid,uuid), private.tn_r4_first_lesson_off(uuid,uuid),
  private.tn_r4_first_lesson_claim(uuid,uuid,date,time,integer,text,jsonb,text,uuid,bigint,uuid,text),
  private.tn_r4_first_lesson_fresh_at_commit(), private.tn_r4_canary_capture_claim_tx(),
  private.tn_r4_canary_check_saved_at_commit(), private.tn_r4_canary_fence_lesson_storage(),
  private.tn_r4_canary_storage_session();
-- Keep all private operation/receipt history, existing sessions, and product records.
commit;
