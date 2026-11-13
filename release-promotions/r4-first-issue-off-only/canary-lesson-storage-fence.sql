-- LOCAL REVIEW CANDIDATE; no standalone production authority.
begin;
do $stop$ begin raise exception 'r4_local_storage_fence_not_authorized'; end $stop$;
set local search_path=pg_catalog;

alter table private.tn_r4_first_lesson_canary
  add column claim_txid xid8,
  add column saved_lesson_id uuid unique,
  add column saved_participant_id uuid unique;

-- RLS/ACL continue to govern normal users. SECURITY DEFINER does not replace
-- auth.uid()/auth.jwt(); those identify the initiating authenticated request.
create function private.tn_r4_canary_storage_session() returns uuid
language plpgsql stable security definer set search_path=pg_catalog as $fn$
declare a uuid:=auth.uid(); j jsonb:=auth.jwt(); s uuid; marker text;
begin
  if a is null or encode(sha256(convert_to(a::text,'UTF8')),'hex')<>
    '9cbb59d76cab0693e7a43e89e0bdd332911130ec8e0979b6d6f6a17c7deb63e2'
  then return null; end if;
  if j->>'role' is distinct from 'authenticated'
    or coalesce(j->>'session_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then raise insufficient_privilege using message='r4_canary_storage_session_missing'; end if;
  s:=(j->>'session_id')::uuid;
  select user_agent into marker from auth.sessions where id=s and user_id=a
    and coalesce(not_after,'infinity'::timestamptz)>statement_timestamp();
  if not found then raise insufficient_privilege using message='r4_canary_storage_session_inactive'; end if;
  if coalesce(marker like 'TennisNote-R4-catalog-one-lesson/2 %',false)
    or exists(select from private.tn_r4_first_lesson_canary where session_id=s)
  then return s; end if;
  return null;
end $fn$;

-- The existing wrapper is the sole writer that can claim the private row.
-- Capture the current transaction, never a caller-supplied header or setting.
create function private.tn_r4_canary_capture_claim_tx() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
begin
  if old.lesson_key is null and new.lesson_key is not null then
    if private.tn_r4_canary_storage_session() is distinct from new.session_id
      or new.session_access_expires_at is null
      or new.session_access_expires_at<=new.deadline
      or to_timestamp((auth.jwt()->>'exp')::bigint) is distinct from new.session_access_expires_at
    then raise insufficient_privilege using message='r4_canary_claim_session_drift'; end if;
    new.claim_txid:=pg_current_xact_id();
  end if;
  return new;
end $fn$;
create trigger tn_r4_canary_capture_claim_tx before update on private.tn_r4_first_lesson_canary
for each row execute function private.tn_r4_canary_capture_claim_tx();

create function private.tn_r4_canary_fence_lesson_storage() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
declare
  sid uuid:=private.tn_r4_canary_storage_session();
  s private.tn_r4_first_lesson_canary%rowtype;
  issued uuid;
begin
  if sid is null then
    if tg_op='DELETE' then return old; end if;
    if tg_op='TRUNCATE' then return null; end if;
    return new;
  end if;
  -- No new requests, bookings, edits, deletions, or alternate table route.
  if tg_op<>'INSERT' or tg_table_schema<>'public' or tg_table_name not in ('tn_lessons','tn_lesson_participants')
  then raise insufficient_privilege using message='r4_canary_storage_write_denied'; end if;
  select * into s from private.tn_r4_first_lesson_canary
    where session_id=sid and auth_id=auth.uid() and phase='open' for update;
  if not found or s.deadline<=clock_timestamp() or s.lesson_key is null
    or s.claim_txid is distinct from pg_current_xact_id_if_assigned()
    or s.claim_txid is null
  then raise insufficient_privilege using message='r4_canary_storage_claim_required'; end if;
  select ticket_id into issued from private.tn_r4_first_issue_receipts where operation_id=s.operation_id
    and (branch_id,owner_id,member_id,product_id,coach_id)=(s.branch_id,s.owner_id,s.member_id,s.product_id,s.coach_id);
  if not found then raise insufficient_privilege using message='r4_canary_storage_ticket_missing'; end if;
  if tg_table_name='tn_lessons' then
    if s.saved_lesson_id is not null or new.id is null
      or (new.branch_id,new.member_ticket_id,new.coach_role_id,new.original_coach_role_id,
        new.lesson_date,new.start_time,new.duration_minutes,new.status,new.lesson_source,new.schedule_v2_kind)
      is distinct from (s.branch_id,issued,s.coach_id,s.coach_id,s.lesson_date,s.start_time,30,
        'scheduled'::text,'regular'::text,'regular'::text)
    then raise insufficient_privilege using message='r4_canary_storage_lesson_mismatch'; end if;
    update private.tn_r4_first_lesson_canary set saved_lesson_id=new.id where operation_id=s.operation_id;
  else
    if s.saved_lesson_id is null or s.saved_participant_id is not null or new.id is null
      or (new.lesson_id,new.user_id,new.ticket_id) is distinct from (s.saved_lesson_id,s.member_id,issued)
    then raise insufficient_privilege using message='r4_canary_storage_participant_mismatch'; end if;
    update private.tn_r4_first_lesson_canary set saved_participant_id=new.id where operation_id=s.operation_id;
  end if;
  return new;
end $fn$;

create function private.tn_r4_canary_check_saved_at_commit() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fn$
declare s private.tn_r4_first_lesson_canary%rowtype;
begin
  if old.lesson_key is not null or new.lesson_key is null then return null; end if;
  select * into s from private.tn_r4_first_lesson_canary where operation_id=new.operation_id;
  if not found or s.phase<>'open' or s.deadline<=clock_timestamp()
    or s.saved_lesson_id is null or s.saved_participant_id is null
    or not exists(select from public.tn_lessons l
      join private.tn_r4_first_issue_receipts i on i.operation_id=s.operation_id
      join public.tn_lesson_participants p on p.lesson_id=l.id and p.id=s.saved_participant_id
      where l.id=s.saved_lesson_id and
        (l.branch_id,l.member_ticket_id,l.coach_role_id,l.original_coach_role_id,l.lesson_date,l.start_time,
          l.duration_minutes,l.status,l.lesson_source,l.schedule_v2_kind,p.user_id,p.ticket_id)
          is not distinct from
        (s.branch_id,i.ticket_id,s.coach_id,s.coach_id,s.lesson_date,s.start_time,30,
          'scheduled'::text,'regular'::text,'regular'::text,s.member_id,i.ticket_id)
        and (select count(*) from public.tn_lesson_participants q where q.lesson_id=l.id)=1)
  then raise insufficient_privilege using message='r4_canary_storage_incomplete'; end if;
  return null;
end $fn$;
create constraint trigger tn_r4_canary_check_saved_at_commit after update on private.tn_r4_first_lesson_canary
deferrable initially deferred for each row execute function private.tn_r4_canary_check_saved_at_commit();

-- Final write targets shared by current and legacy schedulers; queued paths
-- are denied so this session cannot delegate a later write to another worker.
do $fences$
declare relation_name text;
begin
  foreach relation_name in array array['tn_lessons','tn_lesson_participants','tn_schedule_v2_requests','tn_lesson_change_requests','tn_one_day_bookings']
  loop
    if not exists(select from pg_class where oid=to_regclass('public.'||relation_name)
      and relkind='r' and not relispartition and not relhassubclass and relrowsecurity)
    then raise exception 'r4_canary_storage_catalog_drift'; end if;
    execute format('create trigger zz_tn_r4_canary_row_fence before insert or update or delete on public.%I for each row execute function private.tn_r4_canary_fence_lesson_storage()',relation_name);
    execute format('create trigger zz_tn_r4_canary_truncate_fence before truncate on public.%I for each statement execute function private.tn_r4_canary_fence_lesson_storage()',relation_name);
  end loop;
end $fences$;
revoke all on function private.tn_r4_canary_storage_session(), private.tn_r4_canary_capture_claim_tx(),
  private.tn_r4_canary_fence_lesson_storage(), private.tn_r4_canary_check_saved_at_commit()
  from public, anon, authenticated, service_role;
commit;
