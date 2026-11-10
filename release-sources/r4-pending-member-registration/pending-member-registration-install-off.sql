-- Add the normal no-ticket registration path. Existing first/standing switches stay unchanged.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='15s';
do $install$
begin
  perform 1 from private.tn_r4_zero_personal_issue_gate
    where singleton and enabled and issue_mode='standing' and not first_enabled for update;
  if not found or
    (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
      where oid='public.tn_r4_prod_zero_personal_issue(text,uuid,uuid,uuid,uuid)'::regprocedure)
    is distinct from '68e95b142ffe5748b845879fcaad1db9a6d87c9bd098134a929cd3f6855936c8'
  then raise exception 'r4_pending_registration_install_preimage'; end if;
end $install$;
alter table private.tn_r4_zero_personal_issue_gate
  add column pending_registration_enabled boolean not null default false;

create table private.tn_r4_pending_registration_receipts(
  operation_id uuid primary key,
  actor_id uuid not null,
  profile_id uuid not null,
  branch_id uuid not null,
  member_id uuid not null unique,
  coach_id uuid not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table private.tn_r4_pending_registration_receipts enable row level security;
revoke all on private.tn_r4_pending_registration_receipts from public,anon,authenticated,service_role;

create function public.tn_r4_prod_pending_member_registration(p_action text,p_branch uuid,
  p_name text default null,p_coach uuid default null,p_operation uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $pending$
declare
  g private.tn_r4_zero_personal_issue_gate%rowtype;
  receipt private.tn_r4_pending_registration_receipts%rowtype;
  claims jsonb:=auth.jwt();
  actor uuid:=auth.uid();
  expires_at timestamptz;
  input_name text:=btrim(p_name);
  input_digest text:=encode(sha256(convert_to(jsonb_build_array(btrim(p_name),p_coach)::text,'UTF8')),'hex');
  saved jsonb;
begin
  if actor is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or p_action is null or p_action not in ('coaches','save','read') or p_branch is null
    or (p_action='coaches' and num_nonnulls(p_name,p_coach,p_operation)<>0)
    or (p_action='read' and (p_operation is null or num_nonnulls(p_name,p_coach)<>0))
    or (p_action='save' and (p_operation is null or p_coach is null or input_name is null
      or char_length(input_name) not between 2 and 50 or input_name ~ '[[:cntrl:]]'))
  then raise insufficient_privilege using message='r4_pending_registration_denied'; end if;

  select * into strict g from private.tn_r4_zero_personal_issue_gate where singleton for update;
  if not g.pending_registration_enabled or not g.enabled or g.issue_mode<>'standing'
    or (g.actor_id,g.branch_id) is distinct from (actor,p_branch)
  then raise insufficient_privilege using message='r4_pending_registration_denied'; end if;
  select least(s.not_after,to_timestamp((claims->>'exp')::bigint)) into expires_at
  from auth.sessions s join auth.users a on a.id=s.user_id
  join public.tn_users u on u.id=g.profile_id and u.auth_user_id=a.id
  join public.tn_branches b on b.id=g.branch_id
  join private.tn_r4_prod_member_catalog_standing st on st.singleton and st.enabled and not st.cancelled
    and st.verify_until is null and (st.actor_id,st.profile_id,st.branch_id)=(g.actor_id,g.profile_id,g.branch_id)
  where s.id=(claims->>'session_id')::uuid and s.user_id=actor and a.deleted_at is null
    and coalesce(a.banned_until<=clock_timestamp(),true) and u.role='admin' and u.status='active'
    and b.name='테니스클럽하우스' and b.status='active'
    and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
  for share of s,a,u,b,st;
  if not found or expires_at is null or clock_timestamp()>=expires_at
  then raise insufficient_privilege using message='r4_pending_registration_denied'; end if;

  if p_action='coaches' then
    select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.display_name) order by c.display_name,c.id),'[]'::jsonb)
      into saved from public.tn_coach_roles c where c.branch_id=g.branch_id
      and c.status='approved' and c.employment_status='active' and c.archived_at is null and c.deleted_at is null;
  else
    select * into receipt from private.tn_r4_pending_registration_receipts r where r.operation_id=p_operation;
    if found and ((receipt.actor_id,receipt.profile_id,receipt.branch_id) is distinct from (g.actor_id,g.profile_id,g.branch_id)
      or (p_action='save' and receipt.input_hash is distinct from input_digest))
    then raise insufficient_privilege using message='r4_pending_registration_conflict'; end if;

    if receipt.member_id is null and p_action='save' then
      if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
        where oid='public.tn_admin_update_member_database_record(jsonb)'::regprocedure)
          is distinct from 'e1acdea797c7c7ed090f69d63be2baf38682e4746e5895b02edc8a04affba33b'
        or (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc
        where oid='public.tn_save_member_database_record_internal(jsonb,uuid,uuid,uuid,text)'::regprocedure)
          is distinct from '68ac7227023cb56703f853489812d24b1b47af2cbb786677ebe78a0e9c1c30c7'
      then raise exception 'r4_pending_registration_writer_drift'; end if;
      perform 1 from public.tn_coach_roles c where c.id=p_coach and c.branch_id=g.branch_id
        and c.status='approved' and c.employment_status='active' and c.archived_at is null and c.deleted_at is null
        for share;
      if not found then raise insufficient_privilege using message='r4_pending_registration_denied'; end if;
      insert into private.tn_r4_pending_registration_receipts(operation_id,actor_id,profile_id,branch_id,member_id,coach_id,input_hash)
        values(p_operation,g.actor_id,g.profile_id,g.branch_id,gen_random_uuid(),p_coach,input_digest) returning * into receipt;
      insert into public.tn_users(id,name,role,status,member_kind,auth_user_id,phone)
        values(receipt.member_id,input_name,'member','active','journal_only',null,null);
      perform public.tn_admin_update_member_database_record(jsonb_build_object(
        'userId',receipt.member_id,'name',input_name,'branchId',g.branch_id,'coachRoleId',p_coach,
        'recordStatus','pending','scheduleScope','mixed','weeklyFrequency',1,'lessonType','one_on_one',
        'lessonDays','[]'::jsonb,'paymentAmount',0,'reason','회원권 없는 대기 회원 등록'));
      if not exists(select from public.tn_member_database_records m
        join public.tn_users u on u.id=m.user_id and u.auth_user_id is null and u.phone is null
        where m.user_id=receipt.member_id and m.branch_id=g.branch_id and m.created_by_user_id=g.profile_id
          and m.coach_role_id=p_coach and m.record_status='pending' and m.last_updated_via='admin_manual'
          and m.current_ticket_id is null and m.lesson_start_on is null and m.lesson_days='{}'::smallint[]
          and num_nonnulls(m.total_sessions,m.used_sessions,m.remaining_sessions)=0
          and m.payment_amount=0 and m.payment_method is null and m.payment_recorded_on is null
          and exists(select from public.tn_audit_logs a where a.actor_user_id=g.profile_id
            and a.action='member_database_record_updated' and a.target_table='tn_member_database_records'
            and a.target_id=m.id and a.metadata->'ticketId'='null'::jsonb))
        or exists(select from public.tn_member_tickets t where t.user_id=receipt.member_id)
        or exists(select from public.tn_payments t where t.user_id=receipt.member_id)
        or exists(select from public.tn_ticket_participants t where t.user_id=receipt.member_id)
        or exists(select from public.tn_group_ticket_links t where t.user_id=receipt.member_id)
        or exists(select from public.tn_group_account_members t where t.user_id=receipt.member_id)
        or exists(select from public.tn_member_membership_records t where t.user_id=receipt.member_id)
        or exists(select from public.tn_one_day_bookings t where t.linked_user_id=receipt.member_id)
      then raise exception 'r4_pending_registration_footprint'; end if;
    end if;
    if receipt.member_id is not null then
      select jsonb_build_object('memberId',m.user_id,'status',m.record_status,'name',u.name,
        'hasTicket',m.current_ticket_id is not null) into strict saved
      from public.tn_member_database_records m join public.tn_users u on u.id=m.user_id
      where (m.user_id,m.branch_id)=(receipt.member_id,g.branch_id);
    end if;
  end if;
  if clock_timestamp()>=expires_at then raise insufficient_privilege using message='r4_pending_registration_denied'; end if;
  return saved;
end $pending$;
revoke all on function public.tn_r4_prod_pending_member_registration(text,uuid,text,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_prod_pending_member_registration(text,uuid,text,uuid,uuid) to authenticated;
commit;
