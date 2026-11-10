-- Prepared candidate; do not execute against production without a separate approval.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '4s';
set local statement_timeout = '30s';

-- Pin the existing one-admin boundary and the business table trigger surface before installing.
do $pre$
begin
  if encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_admin_standing_catalog(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex')
      <> 'e76652c1e8d06edfc790e5a1552691369fb2453ad5734b8b8da26d05568e52cf'
    or encode(sha256(convert_to(coalesce((select string_agg(
      concat_ws(':',tgrelid::regclass::text,tgname,tgenabled::text,pg_get_triggerdef(oid),pg_get_functiondef(tgfoid)),
      chr(10) order by tgrelid::regclass::text,tgname)
      from pg_trigger where not tgisinternal and tgrelid in
      ('public.tn_member_tickets'::regclass,'public.tn_membership_products'::regclass,'public.tn_payments'::regclass)),''),'UTF8')),'hex')
      <> '420c228b364835151a2e09a288a44c4cd146fa1e795122ab6d130ae922537dba'
    or not exists(select from pg_constraint where conrelid='public.tn_member_database_records'::regclass and contype='u'
      and conkey=array[(select attnum from pg_attribute where attrelid='public.tn_member_database_records'::regclass and attname='user_id')])
  then raise exception 'r4_zero_issue_preimage_drift'; end if;
end $pre$;

create table private.tn_r4_zero_personal_issue_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  actor_id uuid not null,
  profile_id uuid not null,
  branch_id uuid not null
);

insert into private.tn_r4_zero_personal_issue_gate(actor_id,profile_id,branch_id)
select s.actor_id,s.profile_id,s.branch_id
from private.tn_r4_prod_member_catalog_standing s
join auth.users a on a.id=s.actor_id and a.deleted_at is null and coalesce(a.banned_until<=clock_timestamp(),true)
join public.tn_users u on u.id=s.profile_id and u.auth_user_id=a.id and u.role='admin' and u.status='active'
join public.tn_branches b on b.id=s.branch_id and b.status='active' and b.name='테니스클럽하우스'
where s.singleton and s.enabled and not s.cancelled and s.verify_until is null
  and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
for share of s,a,u,b;
do $bound$ begin
  if (select count(*) from private.tn_r4_zero_personal_issue_gate where not enabled)<>1
  then raise exception 'r4_zero_issue_binding_missing'; end if;
end $bound$;

create table private.tn_r4_zero_personal_issue_receipts (
  operation_id uuid primary key,
  branch_id uuid not null,
  registration_id uuid not null,
  member_id uuid not null,
  profile_id uuid not null,
  product_id uuid not null unique,
  ticket_id uuid not null unique,
  issued_at timestamptz not null default clock_timestamp(),
  removed_at timestamptz,
  unique (branch_id,registration_id,member_id),
  check (profile_id<>member_id)
);
create table private.tn_r4_zero_personal_issue_requests (
  operation_id uuid primary key,
  ticket_id uuid not null references private.tn_r4_zero_personal_issue_receipts(ticket_id),
  recorded_at timestamptz not null default clock_timestamp()
);
alter table private.tn_r4_zero_personal_issue_gate enable row level security;
alter table private.tn_r4_zero_personal_issue_receipts enable row level security;
alter table private.tn_r4_zero_personal_issue_requests enable row level security;
revoke all on private.tn_r4_zero_personal_issue_gate,private.tn_r4_zero_personal_issue_receipts,private.tn_r4_zero_personal_issue_requests
  from public,anon,authenticated,service_role;

-- Reference and ticket identifiers are reserved in a private receipt before insertion.
-- The three guards leave every legacy row unchanged and remain installed after OFF.
create function private.tn_r4_zero_personal_reference_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $guard$
declare rec private.tn_r4_zero_personal_issue_receipts%rowtype;
begin
  if tg_op <> 'INSERT' then
    if exists(select from private.tn_r4_zero_personal_issue_receipts x where x.product_id=old.id)
      or coalesce(old.policy_settings ? 'r4ProdZeroPersonal',false)
    then raise insufficient_privilege using message='r4_zero_personal_reference_immutable'; end if;
    if tg_op='DELETE' then return old; end if;
  end if;
  select * into rec from private.tn_r4_zero_personal_issue_receipts x where x.product_id=new.id;
  if found or coalesce(new.policy_settings ? 'r4ProdZeroPersonal',false) then
    if rec.product_id is null or tg_op<>'INSERT' or new.branch_id is distinct from rec.branch_id
      or new.policy_settings is distinct from jsonb_build_object('r4ProdZeroPersonal',rec.registration_id)
      or new.is_active is distinct from false or new.group_size is distinct from 1
      or new.is_coupon is distinct from false or new.product_kind is distinct from 'regular'
      or new.frequency_per_week is distinct from 0 or new.base_price is distinct from 0
      or new.card_price is distinct from 0 or new.cash_price is distinct from 0
      or new.settlement_base_price is distinct from 0 or new.discount_enabled is distinct from false
      or new.coach_discount_allowed is distinct from false
    then raise insufficient_privilege using message='r4_zero_personal_reference_immutable'; end if;
  end if;
  return new;
end $guard$;

create function private.tn_r4_zero_personal_ticket_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $guard$
declare rec private.tn_r4_zero_personal_issue_receipts%rowtype; protected_old boolean:=false;
begin
  if tg_op<>'INSERT' then
    protected_old:=exists(select from private.tn_r4_zero_personal_issue_receipts x
      where x.ticket_id=old.id or x.product_id=old.product_id);
    if tg_op='DELETE' then
      -- The existing authorized deletion path still works, but never erases the one-issue ledger.
      if protected_old then
        update private.tn_r4_zero_personal_issue_receipts x set removed_at=clock_timestamp()
        where (x.ticket_id,x.product_id,x.member_id,x.branch_id)=(old.id,old.product_id,old.user_id,old.branch_id)
          and x.removed_at is null;
        if not found then raise exception 'r4_zero_personal_receipt_drift'; end if;
      end if;
      return old;
    end if;
    if protected_old and (old.id,old.user_id,old.branch_id,old.product_id) is distinct from
      (new.id,new.user_id,new.branch_id,new.product_id)
    then raise insufficient_privilege using message='r4_zero_personal_ticket_guard'; end if;
  end if;
  select * into rec from private.tn_r4_zero_personal_issue_receipts x where x.ticket_id=new.id;
  if not found then
    select * into rec from private.tn_r4_zero_personal_issue_receipts x where x.product_id=new.product_id;
  end if;
  if found or protected_old or coalesce(new.policy_snapshot ? 'r4ProdZeroPersonal',false) then
    if rec.ticket_id is null or rec.removed_at is not null
      or (new.id,new.user_id,new.branch_id,new.product_id) is distinct from (rec.ticket_id,rec.member_id,rec.branch_id,rec.product_id)
      or new.policy_snapshot->>'r4ProdZeroPersonal' is distinct from rec.registration_id::text
      or new.purchased_price is distinct from 0 or new.settlement_base_price is distinct from 0
      or new.source_payment_id is not null or (tg_op='INSERT' and new.coach_role_id is not null)
    then raise insufficient_privilege using message='r4_zero_personal_ticket_guard'; end if;
  end if;
  return new;
end $guard$;

create function private.tn_r4_zero_personal_payment_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog as $guard$
begin
  if exists(select from private.tn_r4_zero_personal_issue_receipts x where x.product_id=new.product_id or x.ticket_id=new.ticket_id)
  then raise insufficient_privilege using message='r4_zero_personal_payment_denied'; end if;
  return new;
end $guard$;

revoke all on function private.tn_r4_zero_personal_reference_guard(),private.tn_r4_zero_personal_ticket_guard(),
  private.tn_r4_zero_personal_payment_guard() from public,anon,authenticated,service_role;
create trigger tn_r4_zero_personal_ref_guard before insert or update or delete on public.tn_membership_products
  for each row execute function private.tn_r4_zero_personal_reference_guard();
create trigger tn_r4_zero_personal_ticket_guard before insert or update or delete on public.tn_member_tickets
  for each row execute function private.tn_r4_zero_personal_ticket_guard();
create trigger tn_r4_zero_personal_payment_guard before insert or update of product_id,ticket_id on public.tn_payments
  for each row execute function private.tn_r4_zero_personal_payment_guard();

create function public.tn_r4_prod_zero_personal_issue(p_action text,p_branch uuid,p_member uuid,
  p_registration uuid default null,p_operation uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog
set tennisnote.skip_future_regular_reconcile = 'on'
as $issue$
declare
  g private.tn_r4_zero_personal_issue_gate%rowtype;
  receipt private.tn_r4_zero_personal_issue_receipts%rowtype;
  crm public.tn_member_database_records%rowtype;
  saved public.tn_member_tickets%rowtype;
  claims jsonb:=auth.jwt();
  actor uuid:=auth.uid();
  expires_at timestamptz;
  start_day date;
  item record;
  result jsonb;
begin
  if actor is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or p_action is null or p_action not in ('list','read','issue')
    or p_branch is null or p_member is null
    or (p_action='list' and (p_registration is not null or p_operation is not null))
    or (p_action in ('read','issue') and (p_registration is null or p_operation is null))
  then raise insufficient_privilege using message='r4_zero_personal_denied'; end if;

  -- Same lock as OFF, acquired before any other business locks.
  select * into g from private.tn_r4_zero_personal_issue_gate where singleton for update;
  if not found or not g.enabled or g.actor_id is distinct from actor or g.branch_id is distinct from p_branch
    or g.profile_id=p_member
  then raise insufficient_privilege using message='r4_zero_personal_denied'; end if;

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
  then raise insufficient_privilege using message='r4_zero_personal_denied'; end if;

  -- Only an already-active member with a current, same-branch ticket can use this path.
  -- The existing AFTER INSERT CRM trigger cannot replace that active current-ticket link.
  select m.* into crm from public.tn_member_database_records m
  join public.tn_users u on u.id=m.user_id and u.role='member' and u.status='active'
    and u.merged_into_user_id is null and u.permanently_deleted_at is null
  join public.tn_member_tickets t on t.id=m.current_ticket_id and t.user_id=m.user_id
    and t.branch_id=m.branch_id and t.status in ('active','paused') and t.remaining_sessions>0 and t.refund_hold_at is null
  where m.user_id=p_member and m.branch_id=g.branch_id and m.record_status='active'
  for share of m,u,t;
  if not found then raise insufficient_privilege using message='r4_zero_personal_member_scope'; end if;

  if p_action='list' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
      select r.id,d.name,d.sessions,d.minutes,d.days,d.price
      from private.tn_r4_prod_member_catalog_registration r
      join private.tn_r4_prod_member_catalog_draft d on (d.id,d.branch_id,d.profile_id)=(r.draft_id,r.branch_id,r.profile_id)
      where r.branch_id=g.branch_id and r.profile_id=g.profile_id and d.price=0
        and d.sessions>0 and d.minutes in (20,30,40) and d.days between 1 and 366
        and r.terms=jsonb_build_object('name',d.name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price)
      order by r.registered_at desc,r.id limit 100
    ) x;
  else
    select r.id,d.name,d.sessions,d.minutes,d.days,d.price into item
    from private.tn_r4_prod_member_catalog_registration r
    join private.tn_r4_prod_member_catalog_draft d on (d.id,d.branch_id,d.profile_id)=(r.draft_id,r.branch_id,r.profile_id)
    where r.id=p_registration and r.branch_id=g.branch_id and r.profile_id=g.profile_id and d.price=0
      and d.sessions>0 and d.minutes in (20,30,40) and d.days between 1 and 366
      and r.terms=jsonb_build_object('name',d.name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price)
    for share of r,d;
    if not found then raise insufficient_privilege using message='r4_zero_personal_product_scope'; end if;
    if exists(select from private.tn_r4_zero_personal_issue_requests k
      join private.tn_r4_zero_personal_issue_receipts x on x.ticket_id=k.ticket_id where k.operation_id=p_operation
      and (x.branch_id,x.registration_id,x.member_id,x.profile_id) is distinct from (p_branch,p_registration,p_member,g.profile_id))
    then raise insufficient_privilege using message='r4_zero_personal_operation_conflict'; end if;
    select * into receipt from private.tn_r4_zero_personal_issue_receipts
      where branch_id=g.branch_id and registration_id=p_registration and member_id=p_member;
    if not found and p_action='issue' then
      -- This is a fresh write, not a read or replay. No write on a changed legacy trigger surface.
      if encode(sha256(convert_to(coalesce((select string_agg(
        concat_ws(':',tgrelid::regclass::text,tgname,tgenabled::text,pg_get_triggerdef(oid),pg_get_functiondef(tgfoid)),
        chr(10) order by tgrelid::regclass::text,tgname) from pg_trigger where not tgisinternal and tgrelid in
        ('public.tn_member_tickets'::regclass,'public.tn_membership_products'::regclass,'public.tn_payments'::regclass)
        and tgname not in ('tn_r4_zero_personal_ref_guard','tn_r4_zero_personal_ticket_guard','tn_r4_zero_personal_payment_guard')) ,''),'UTF8')),'hex')
        <> '420c228b364835151a2e09a288a44c4cd146fa1e795122ab6d130ae922537dba'
      then raise exception 'r4_zero_issue_preimage_drift'; end if;
      if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and
        (tgrelid,tgname,tgfoid) in (
          ('public.tn_membership_products'::regclass,'tn_r4_zero_personal_ref_guard','private.tn_r4_zero_personal_reference_guard()'::regprocedure),
          ('public.tn_member_tickets'::regclass,'tn_r4_zero_personal_ticket_guard','private.tn_r4_zero_personal_ticket_guard()'::regprocedure),
          ('public.tn_payments'::regclass,'tn_r4_zero_personal_payment_guard','private.tn_r4_zero_personal_payment_guard()'::regprocedure)
        ))<>3 then raise exception 'r4_zero_issue_guard_drift'; end if;
      start_day:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
      insert into private.tn_r4_zero_personal_issue_receipts(operation_id,branch_id,registration_id,member_id,profile_id,product_id,ticket_id)
      values(p_operation,g.branch_id,item.id,p_member,g.profile_id,gen_random_uuid(),gen_random_uuid())
      returning * into receipt;
      insert into public.tn_membership_products
        (id,branch_id,name,lesson_minutes,frequency_per_week,total_sessions,group_size,base_price,card_price,
         cash_price,settlement_base_price,validity_days,grace_days,product_kind,is_coupon,is_active,
         discount_enabled,coach_discount_allowed,policy_settings)
      values(receipt.product_id,g.branch_id,item.name,item.minutes,0,item.sessions,1,0,0,0,0,item.days,0,
        'regular',false,false,false,false,jsonb_build_object('r4ProdZeroPersonal',item.id));
      insert into public.tn_member_tickets
        (id,user_id,product_id,branch_id,total_sessions,used_sessions,remaining_sessions,
         starts_on,expires_on,status,purchased_price,settlement_base_price,source_payment_id,policy_snapshot)
      values(receipt.ticket_id,p_member,receipt.product_id,g.branch_id,item.sessions,0,item.sessions,
        start_day,start_day+item.days-1,'active',0,0,null,jsonb_build_object('r4ProdZeroPersonal',item.id));
      if not exists(select from public.tn_member_database_records m where m.id=crm.id and to_jsonb(m)=to_jsonb(crm))
      then raise exception 'r4_zero_issue_existing_member_record_changed'; end if;
    end if;
    if receipt.ticket_id is not null then
      if receipt.profile_id is distinct from g.profile_id
      then raise exception 'r4_zero_personal_receipt_drift'; end if;
      if p_action='issue' then
        insert into private.tn_r4_zero_personal_issue_requests(operation_id,ticket_id)
        values(p_operation,receipt.ticket_id) on conflict(operation_id) do nothing;
        if not exists(select from private.tn_r4_zero_personal_issue_requests k
          where k.operation_id=p_operation and k.ticket_id=receipt.ticket_id)
        then raise insufficient_privilege using message='r4_zero_personal_operation_conflict'; end if;
      end if;
      if receipt.removed_at is not null then
        result:=jsonb_build_object('ticketId',receipt.ticket_id,'registrationId',item.id,'price',0,
          'removed',true,'public',false,'payment',false);
      else
        select t.* into strict saved from public.tn_member_tickets t
        join public.tn_membership_products p on p.id=t.product_id and p.branch_id=t.branch_id and not p.is_active
        where (t.id,t.user_id,t.branch_id,t.product_id)=(receipt.ticket_id,p_member,g.branch_id,receipt.product_id);
        if saved.purchased_price is distinct from 0 or saved.settlement_base_price is distinct from 0 or saved.source_payment_id is not null
        then raise exception 'r4_zero_personal_receipt_drift'; end if;
        result:=jsonb_build_object('ticketId',saved.id,'registrationId',item.id,'price',0,'remaining',saved.remaining_sessions,
          'total',saved.total_sessions,'expiresOn',saved.expires_on,'removed',false,'public',false,'payment',false);
      end if;
    end if;
  end if;
  if clock_timestamp()>=expires_at then raise insufficient_privilege using message='r4_zero_personal_denied'; end if;
  return result;
end $issue$;
revoke all on function public.tn_r4_prod_zero_personal_issue(text,uuid,uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_prod_zero_personal_issue(text,uuid,uuid,uuid,uuid) to authenticated;
commit;
