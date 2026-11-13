-- LOCAL REVIEW CANDIDATE. There is intentionally no production installer or operator caller.
begin;
do $stop$ begin raise exception 'r4_local_canary_candidate_not_authorized'; end $stop$;
set local search_path=pg_catalog;

create table private.tn_r4_first_lesson_canary (
  operation_id uuid primary key, session_id uuid not null unique, auth_id uuid not null,
  owner_id uuid not null, branch_id uuid not null, member_id uuid not null,
  product_id uuid not null, coach_id uuid not null,
  lesson_date date not null, start_time time not null, deadline timestamptz not null,
  session_access_expires_at timestamptz not null,
  phase text not null default 'prepared' check (phase in ('prepared','open','closed')),
  lesson_key text unique
);
alter table private.tn_r4_first_lesson_canary enable row level security;
revoke all on private.tn_r4_first_lesson_canary from public, anon, authenticated, service_role;

-- Not an RPC. The operator reserves the exact row in a reviewed separate transaction before ON.
-- The same control lock serializes reserve/ON/OFF against issue and lesson writes.
create function private.tn_r4_first_lesson_on(p_operation uuid, p_session uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
declare s private.tn_r4_first_lesson_canary%rowtype;
begin
  perform 1 from private.tn_r4_first_issue_control where singleton and not enabled for update;
  if not found then raise exception 'r4_canary_not_off'; end if;
  select * into s from private.tn_r4_first_lesson_canary
    where operation_id=p_operation and session_id=p_session and phase='prepared' for update;
  if not found or s.deadline<=clock_timestamp() or s.deadline>clock_timestamp()+interval '120 seconds'
    or s.session_access_expires_at<=s.deadline
    or s.lesson_key is not null or exists(select from private.tn_r4_first_issue_scope)
    or encode(sha256(convert_to(s.auth_id::text,'UTF8')),'hex')<>
      '9cbb59d76cab0693e7a43e89e0bdd332911130ec8e0979b6d6f6a17c7deb63e2'
    or encode(sha256(convert_to(s.branch_id::text,'UTF8')),'hex')<>
      '3046e7120d51ee5c74517ad75df05d57a9e4bb860011b661c8bfb79978383cc3'
    or encode(sha256(convert_to(s.coach_id::text,'UTF8')),'hex')<>
      'b2dc4cd821a1349dc9f7109995f6853323546062306be214955ddd1dbaf8bd4b'
    or encode(sha256(convert_to(s.member_id::text,'UTF8')),'hex')<>
      'd829ab5d057598ee2dbe5d35f009fcf5954c0c030c1d6bb554065a4122b00e7a'
    or encode(sha256(convert_to(s.product_id::text,'UTF8')),'hex')<>
      'ca0b9e2c99fe4633194a578c9ede672d2f1a1be304158c282a4bf240ac06b413'
    or not exists(select from public.tn_users u where u.id=s.owner_id and u.auth_user_id=s.auth_id
      and u.role='member' and u.status='active'
      and exists(select from private.tn_r4_prod_selfserve_owners o where o.branch_id=s.branch_id and o.user_id=u.id)
      and exists(select from private.tn_r4_branch_roles b where b.branch_id=s.branch_id and b.user_id=u.id
        and b.active and b.role_code='manager'))
    or not exists(select from auth.sessions a where a.id=s.session_id and a.user_id=s.auth_id
      and a.user_agent like 'TennisNote-R4-catalog-one-lesson/2 %'
      and coalesce(a.not_after,'infinity'::timestamptz)>s.deadline)
  then raise exception 'r4_canary_open_denied'; end if;
  insert into private.tn_r4_first_issue_scope
    (singleton,enabled,branch_id,owner_id,auth_id,session_id,member_id,product_id,coach_id,operation_id,valid_until)
  values (true,true,s.branch_id,s.owner_id,s.auth_id,s.session_id,s.member_id,s.product_id,s.coach_id,s.operation_id,s.deadline);
  update private.tn_r4_first_lesson_canary set phase='open' where operation_id=p_operation;
  update private.tn_r4_first_issue_control set enabled=true where singleton;
  if s.deadline<=clock_timestamp() then raise exception 'r4_canary_open_expired'; end if;
end $fn$;

create function private.tn_r4_first_lesson_off(p_operation uuid, p_session uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $fn$
begin
  perform 1 from private.tn_r4_first_issue_control where singleton for update;
  if not found then raise exception 'r4_canary_control_missing'; end if;
  perform 1 from private.tn_r4_first_lesson_canary where operation_id=p_operation and session_id=p_session for update;
  if not found or exists(select from private.tn_r4_first_issue_scope
    where operation_id is distinct from p_operation or session_id is distinct from p_session)
  then raise exception 'r4_canary_close_mismatch'; end if;
  update private.tn_r4_first_issue_control set enabled=false where singleton;
  update private.tn_r4_first_issue_scope set enabled=false where operation_id=p_operation and session_id=p_session;
  update private.tn_r4_first_lesson_canary set phase='closed' where operation_id=p_operation;
end $fn$;

create function private.tn_r4_first_lesson_claim(
  b uuid,c uuid,d date,t time,n integer,k text,participants jsonb,op text,
  lesson_id uuid,revision bigint,request_id uuid,note text
) returns void language plpgsql security definer set search_path=pg_catalog as $fn$
declare
  a uuid:=auth.uid(); claims jsonb:=auth.jwt(); sid uuid;
  s private.tn_r4_first_lesson_canary%rowtype; r private.tn_r4_first_issue_receipts%rowtype;
begin
  -- Every other account takes the existing scheduler path, without taking canary locks.
  if a is null or encode(sha256(convert_to(a::text,'UTF8')),'hex')
    <> '9cbb59d76cab0693e7a43e89e0bdd332911130ec8e0979b6d6f6a17c7deb63e2' then return; end if;
  if coalesce(claims->>'session_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    raise insufficient_privilege using message='r4_canary_session_missing';
  end if;
  sid:=(claims->>'session_id')::uuid;
  if not exists(select from auth.sessions where id=sid and user_id=a
    and coalesce(not_after,'infinity'::timestamptz)>clock_timestamp()) then
    raise insufficient_privilege using message='r4_canary_session_inactive';
  end if;
  if not exists(select from private.tn_r4_first_lesson_canary where session_id=sid)
    and not exists(select from auth.sessions where id=sid and user_id=a
      and user_agent like 'TennisNote-R4-catalog-one-lesson/2 %')
  then return; end if;

  perform 1 from private.tn_r4_first_issue_control where singleton and enabled for share;
  if not found then raise insufficient_privilege using message='r4_canary_lesson_off'; end if;
  select * into s from private.tn_r4_first_lesson_canary where session_id=sid and auth_id=a for update;
  if not found or s.phase<>'open' or s.lesson_key is not null or s.deadline<=clock_timestamp()
    or (b,c,d,t,n,k) is distinct from (s.branch_id,s.coach_id,s.lesson_date,s.start_time,30,'regular'::text)
    or lesson_id is not null or revision is not null or request_id is not null or nullif(note,'') is not null
    or coalesce(op,'') !~ '^r4-admin-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or claims->>'role' is distinct from 'authenticated' or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or to_timestamp((claims->>'exp')::bigint)<=clock_timestamp()
  then raise insufficient_privilege using message='r4_canary_lesson_scope'; end if;
  perform 1 from auth.sessions where id=sid and user_id=a
    and coalesce(not_after,'infinity'::timestamptz)>clock_timestamp() for share;
  if not found then raise insufficient_privilege using message='r4_canary_lesson_session'; end if;
  select * into r from private.tn_r4_first_issue_receipts where operation_id=s.operation_id;
  if not found or (r.branch_id,r.owner_id,r.member_id,r.product_id,r.coach_id)
      is distinct from (s.branch_id,s.owner_id,s.member_id,s.product_id,s.coach_id)
    or participants is distinct from jsonb_build_array(jsonb_build_object('userId',s.member_id,'ticketId',r.ticket_id))
  then raise insufficient_privilege using message='r4_canary_lesson_ticket'; end if;
  update private.tn_r4_first_lesson_canary set lesson_key=op where operation_id=s.operation_id;
end $fn$;

-- Commit-time fence, even when the existing scheduler returns early.
create function private.tn_r4_first_lesson_fresh_at_commit()
returns trigger language plpgsql security definer set search_path=pg_catalog as $fn$
begin
  if old.phase='prepared' and new.phase='open' and clock_timestamp()>=new.deadline then
    raise insufficient_privilege using message='r4_canary_open_commit_expired';
  end if;
  if old.lesson_key is null and new.lesson_key is not null then
    if clock_timestamp()>=new.deadline or not exists(select from auth.sessions a
       where a.id=new.session_id and a.user_id=new.auth_id
         and coalesce(a.not_after,'infinity'::timestamptz)>clock_timestamp())
       or coalesce(auth.jwt()->>'exp','') !~ '^[0-9]{1,11}$'
       or to_timestamp((auth.jwt()->>'exp')::bigint)<=clock_timestamp()
    then raise insufficient_privilege using message='r4_canary_lesson_commit_expired'; end if;
  end if;
  return null;
end $fn$;
create constraint trigger tn_r4_first_lesson_fresh_at_commit
after update on private.tn_r4_first_lesson_canary deferrable initially deferred
for each row execute function private.tn_r4_first_lesson_fresh_at_commit();

revoke all on function private.tn_r4_first_lesson_on(uuid,uuid), private.tn_r4_first_lesson_off(uuid,uuid),
  private.tn_r4_first_lesson_claim(uuid,uuid,date,time,integer,text,jsonb,text,uuid,bigint,uuid,text),
  private.tn_r4_first_lesson_fresh_at_commit() from public, anon, authenticated, service_role;

-- Replace only one anchored insertion in the exact existing public function; no new public RPC,
-- changes to defaults, grants, owner, security settings, or alternate scheduler function.
do $install$
declare
  oid_ oid:=to_regprocedure('public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)');
  src text; def text; patched text;
  anchor constant text:=E'begin\r\n  perform private.tn_r4_prod_selfserve_schedule_manager(';
  addition constant text:=E'begin\r\n  perform private.tn_r4_first_lesson_claim(target_branch_id,target_coach_role_id,target_lesson_date,target_start_time,target_duration_minutes,target_schedule_kind,target_participants,target_operation_key,target_lesson_id,target_expected_revision,target_request_id,target_note);\r\n  perform private.tn_r4_prod_selfserve_schedule_manager(';
  prior_acl aclitem[]; prior_owner oid;
begin
  select prosrc,pg_get_functiondef(oid),proacl,proowner into src,def,prior_acl,prior_owner from pg_proc where oid=oid_;
  if not found or encode(sha256(convert_to(def,'UTF8')),'hex')<>
    'e70d2c8bc200e8666a666cc3e32def051e44eadcedb7b4f76983a7c6ae1b24d6'
    or length(src)-length(replace(src,anchor,''))<>length(anchor)
    or length(def)-length(replace(def,src,''))<>length(src)
  then raise exception 'r4_scheduler_preimage_drift'; end if;
  patched:=replace(src,anchor,addition);
  execute replace(def,src,patched);
  if not exists(select from pg_proc where oid=oid_ and prosrc=patched and proowner=prior_owner and proacl is not distinct from prior_acl)
  then raise exception 'r4_scheduler_metadata_drift'; end if;
end $install$;
commit;
