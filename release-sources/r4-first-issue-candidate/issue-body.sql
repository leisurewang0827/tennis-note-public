-- LOCAL EXPERIMENT. Never execute this file in development or production.
-- Tests explicitly isolate the body below after starting a disposable local database.
begin;
do $stop$ begin raise exception 'r4_local_candidate_never_install_directly'; end $stop$;
-- BEGIN ISOLATED TEST BODY
create table private.tn_r4_first_issue_control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into private.tn_r4_first_issue_control default values;
create table private.tn_r4_first_issue_scope (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  branch_id uuid not null, owner_id uuid not null, auth_id uuid not null,
  session_id uuid not null, member_id uuid not null, product_id uuid not null,
  coach_id uuid not null, operation_id uuid not null, valid_until timestamptz not null
);
create table private.tn_r4_first_issue_receipts (
  operation_id uuid primary key, branch_id uuid not null, owner_id uuid not null,
  member_id uuid not null unique, product_id uuid not null, coach_id uuid not null,
  ticket_id uuid not null unique, result jsonb not null
);
alter table private.tn_r4_first_issue_control enable row level security;
alter table private.tn_r4_first_issue_scope enable row level security;
alter table private.tn_r4_first_issue_receipts enable row level security;
revoke all on private.tn_r4_first_issue_control,private.tn_r4_first_issue_scope,
  private.tn_r4_first_issue_receipts from public,anon,authenticated,service_role;

create function public.tn_r4_first_zero_issue(
  p_branch uuid,p_member uuid,p_product uuid,p_coach uuid,p_operation uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $issue$
declare
  allowed private.tn_r4_first_issue_scope%rowtype;
  old private.tn_r4_first_issue_receipts%rowtype;
  actor uuid; session_expiry timestamptz; product public.tn_membership_products%rowtype;
  tid uuid; starts date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  answer jsonb; claims jsonb:=auth.jwt();
begin
  if num_nonnulls(p_branch,p_member,p_product,p_coach,p_operation)<>5
    or auth.uid() is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
  then raise insufficient_privilege using message='r4_first_issue_denied'; end if;
  perform 1 from private.tn_r4_first_issue_control where singleton and enabled for share;
  if not found then raise insufficient_privilege using message='r4_first_issue_off'; end if;
  select * into allowed from private.tn_r4_first_issue_scope where singleton and enabled for update;
  if not found or (allowed.branch_id,allowed.member_id,allowed.product_id,allowed.coach_id,allowed.operation_id)
       is distinct from (p_branch,p_member,p_product,p_coach,p_operation)
    or allowed.auth_id is distinct from auth.uid()
    or allowed.session_id::text is distinct from claims->>'session_id'
    or allowed.valid_until<=clock_timestamp() or allowed.valid_until>clock_timestamp()+interval '5 minutes'
  then raise insufficient_privilege using message='r4_first_issue_scope'; end if;
  actor:=private.tn_r4_prod_selfserve_lock_owner(p_branch);
  if actor is distinct from allowed.owner_id or actor=p_member
  then raise insufficient_privilege using message='r4_first_issue_owner'; end if;
  select least(coalesce(s.not_after,'infinity'::timestamptz),to_timestamp((claims->>'exp')::bigint))
    into session_expiry from auth.sessions s join auth.users a on a.id=s.user_id
    join public.tn_users u on u.id=actor and u.auth_user_id=a.id
    where s.id=allowed.session_id and s.user_id=allowed.auth_id and a.deleted_at is null
      and coalesce(a.banned_until<=clock_timestamp(),true) and u.status='active'
    for share of s,a,u;
  if not found or session_expiry<=clock_timestamp()
  then raise insufficient_privilege using message='r4_first_issue_session'; end if;
  select * into old from private.tn_r4_first_issue_receipts where operation_id=p_operation;
  if found then
    if (old.branch_id,old.owner_id,old.member_id,old.product_id,old.coach_id)
       is distinct from (p_branch,actor,p_member,p_product,p_coach)
    then raise insufficient_privilege using message='r4_first_issue_conflict'; end if;
    perform 1 from public.tn_member_tickets t where t.id=old.ticket_id
      and (t.user_id,t.branch_id,t.product_id,t.coach_role_id)=(p_member,p_branch,p_product,p_coach)
      and t.source_payment_id is null and t.purchased_price=0 and t.settlement_base_price=0
      and t.status='active' and t.total_sessions=(old.result->>'total')::integer
      and t.remaining_sessions=(old.result->>'remaining')::integer
      and t.used_sessions=0 and t.starts_on=(old.result->>'startsOn')::date
      and t.expires_on=(old.result->>'expiresOn')::date
      and t.expires_on >= (clock_timestamp() at time zone 'Asia/Seoul')::date
      and t.policy_snapshot=jsonb_build_object('source','r4_first_zero_issue',
        'lessonMinutes',(old.result->>'minutes')::integer,'validityDays',(old.result->>'days')::integer,'financialEvidence',false)
      for share;
    if not found then raise insufficient_privilege using message='r4_first_issue_receipt_drift'; end if;
    perform 1 from public.tn_ticket_participants x where x.ticket_id=old.ticket_id for share;
    perform 1 from public.tn_member_membership_records m where m.ticket_id=old.ticket_id for share;
    if not exists(select from public.tn_ticket_participants x
      where x.ticket_id=old.ticket_id and x.user_id=p_member and x.participant_order=1)
      or (select count(*) from public.tn_ticket_participants x where x.ticket_id=old.ticket_id)<>1
      or not exists(select from public.tn_member_membership_records m
        where (m.user_id,m.ticket_id,m.branch_id,m.coach_role_id)=(p_member,old.ticket_id,p_branch,p_coach)
          and m.record_status='active' and m.lesson_type='one_on_one'
          and m.lesson_minutes=(old.result->>'minutes')::integer
          and m.lesson_start_on=(old.result->>'startsOn')::date
          and m.total_sessions=(old.result->>'total')::integer and m.used_sessions=0
          and m.remaining_sessions=(old.result->>'remaining')::integer and m.payment_amount=0)
      or (select count(*) from public.tn_member_membership_records m where m.user_id=p_member)<>1
      or exists(select from public.tn_payments p where p.user_id=p_member or p.ticket_id=old.ticket_id)
    then raise insufficient_privilege using message='r4_first_issue_receipt_drift'; end if;
    if clock_timestamp()>=allowed.valid_until or clock_timestamp()>=session_expiry
      or (old.result->>'expiresOn')::date < (clock_timestamp() at time zone 'Asia/Seoul')::date
    then raise insufficient_privilege using message='r4_first_issue_expired'; end if;
    return old.result;
  end if;
  perform 1 from public.tn_users u where u.id=p_member and u.role='member' and u.status='active'
    and u.member_kind='journal_only' and u.auth_user_id is null and u.phone is null
    and u.merged_into_user_id is null and u.permanently_deleted_at is null for update;
  if not found then raise insufficient_privilege using message='r4_first_issue_member'; end if;
  perform 1 from public.tn_member_database_records m join public.tn_coach_roles c
    on c.id=m.coach_role_id and c.branch_id=m.branch_id
    where m.user_id=p_member and m.branch_id=p_branch and m.record_status='pending' and c.id=p_coach
      and c.status='approved' and c.employment_status='active' and c.deleted_at is null and c.archived_at is null
    for update of m,c;
  if not found then raise insufficient_privilege using message='r4_first_issue_coach'; end if;
  select p.* into product from public.tn_membership_products p where p.id=p_product and p.branch_id=p_branch
    and not p.is_active and not p.is_coupon and p.group_size=1 and p.product_kind='regular'
    and p.base_price=0 and p.card_price=0 and p.cash_price=0 and p.settlement_base_price=0
    and p.total_sessions between 1 and 52 and p.validity_days between 1 and 366
    and p.lesson_minutes in (20,30,40) for share;
  if not found then raise insufficient_privilege using message='r4_first_issue_product'; end if;
  if exists(select from public.tn_member_tickets t where t.user_id=p_member)
    or exists(select from public.tn_member_membership_records m where m.user_id=p_member)
    or exists(select from public.tn_ticket_participants t where t.user_id=p_member)
    or exists(select from public.tn_payments p where p.user_id=p_member)
    or exists(select from private.tn_r4_first_issue_receipts r where r.member_id=p_member)
  then raise insufficient_privilege using message='r4_first_issue_history'; end if;
  -- Compute the first day after potentially waiting for all locks. Never commit across KST midnight.
  starts:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
  insert into public.tn_member_tickets(user_id,product_id,branch_id,coach_role_id,status,total_sessions,
    used_sessions,remaining_sessions,starts_on,expires_on,purchased_price,settlement_base_price,source_payment_id,policy_snapshot)
  values(p_member,p_product,p_branch,p_coach,'active',product.total_sessions,0,product.total_sessions,starts,
    starts+product.validity_days-1,0,0,null,jsonb_build_object('source','r4_first_zero_issue',
    'lessonMinutes',product.lesson_minutes,'validityDays',product.validity_days,'financialEvidence',false)) returning id into tid;
  insert into public.tn_ticket_participants(ticket_id,user_id,participant_order) values(tid,p_member,1);
  insert into public.tn_member_membership_records(user_id,ticket_id,branch_id,coach_role_id,record_status,
    lesson_type,lesson_minutes,lesson_start_on,total_sessions,used_sessions,remaining_sessions,payment_amount,
    last_updated_via,created_by_user_id)
  values(p_member,tid,p_branch,p_coach,'active','one_on_one',product.lesson_minutes,starts,product.total_sessions,0,
    product.total_sessions,0,'r4_first_zero_issue',actor);
  answer:=jsonb_build_object('branchId',p_branch,'memberId',p_member,'productId',p_product,'coachId',p_coach,
    'ticketId',tid,'total',product.total_sessions,'remaining',product.total_sessions,'minutes',product.lesson_minutes,
    'days',product.validity_days,'price',0,'payment',false,'startsOn',starts,'expiresOn',starts+product.validity_days-1);
  insert into private.tn_r4_first_issue_receipts values(p_operation,p_branch,actor,p_member,p_product,p_coach,tid,answer);
  insert into public.tn_audit_logs(actor_user_id,action,target_table,target_id,metadata)
  values(actor,'r4_first_zero_issue','tn_member_tickets',tid,jsonb_build_object('branchId',p_branch));
  if clock_timestamp()>=allowed.valid_until or clock_timestamp()>=session_expiry
    or (clock_timestamp() at time zone 'Asia/Seoul')::date is distinct from starts
  then raise insufficient_privilege using message='r4_first_issue_expired'; end if;
  return answer;
end
$issue$;
revoke all on function public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid) to authenticated;
