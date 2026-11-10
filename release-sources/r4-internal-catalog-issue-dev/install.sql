-- 서울 개발계 전용. 기존 발급 함수·공개 상품 정책은 수정하지 않는다.
create table private.tn_r4_dev_catalog_issue_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  actor_id uuid, profile_id uuid, session_id uuid, branch_id uuid,
  member_id uuid, registration_id uuid, until_at timestamptz,
  check (not enabled or (actor_id is not null and profile_id is not null and session_id is not null
    and branch_id is not null and member_id is not null and registration_id is not null and until_at is not null
    and profile_id <> member_id))
);
insert into private.tn_r4_dev_catalog_issue_gate default values;
create table private.tn_r4_dev_catalog_issue_receipt (
  operation_id uuid primary key,
  registration_id uuid not null,
  branch_id uuid not null,
  member_id uuid not null,
  product_id uuid not null unique,
  ticket_id uuid not null unique,
  unique (registration_id, member_id)
);
alter table private.tn_r4_dev_catalog_issue_gate enable row level security;
alter table private.tn_r4_dev_catalog_issue_receipt enable row level security;
revoke all on private.tn_r4_dev_catalog_issue_gate, private.tn_r4_dev_catalog_issue_receipt
  from public, anon, authenticated, service_role;

-- 비활성 참조 전용: 다른 상품의 동작은 그대로, 이 행은 수정·삭제·활성화할 수 없다.
create function private.tn_r4_dev_catalog_reference_fence()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if tg_op <> 'INSERT' and old.policy_settings->>'r4DevCatalogReference'='true' then
    raise insufficient_privilege using message='r4_catalog_reference_immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.policy_settings->>'r4DevCatalogReference'='true'
    and (tg_op <> 'INSERT' or current_user in ('anon','authenticated','service_role')
      or new.is_active or new.group_size<>1 or new.is_coupon
      or new.base_price<>0 or new.card_price<>0 or new.cash_price<>0 or new.settlement_base_price<>0)
  then raise insufficient_privilege using message='r4_catalog_reference_immutable'; end if;
  return new;
end $$;
revoke all on function private.tn_r4_dev_catalog_reference_fence() from public, anon, authenticated, service_role;
create trigger tn_r4_dev_catalog_reference_fence before insert or update or delete
  on public.tn_membership_products for each row execute function private.tn_r4_dev_catalog_reference_fence();

create function public.tn_r4_dev_issue_private_catalog(
  p_action text, p_branch uuid, p_member uuid, p_registration uuid default null, p_operation uuid default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
  g private.tn_r4_dev_catalog_issue_gate%rowtype;
  item record; rec private.tn_r4_dev_catalog_issue_receipt%rowtype; saved public.tn_member_tickets%rowtype;
  claims jsonb := auth.jwt(); deadline timestamptz; starts date; v_days int; v_minutes int; v_sessions int;
  out_value jsonb;
begin
  if auth.uid() is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'session_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or p_action is null or p_action not in ('list','issue','read')
  then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;

  -- 하나의 지정 검증만 허용. OFF와 발급이 같은 행에서 직렬화된다.
  select * into g from private.tn_r4_dev_catalog_issue_gate where singleton for update;
  if not found or not g.enabled or g.actor_id is distinct from auth.uid()
    or g.session_id is distinct from (claims->>'session_id')::uuid
    or g.branch_id is distinct from p_branch or g.member_id is distinct from p_member
  then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;
  select least(g.until_at,s.not_after,to_timestamp((claims->>'exp')::bigint)) into deadline
  from auth.sessions s join auth.users a on a.id=s.user_id
  join public.tn_users u on u.auth_user_id=a.id
  join public.tn_users m on m.id=g.member_id
  join public.tn_branches b on b.id=g.branch_id
  where s.id=g.session_id and a.id=g.actor_id and a.deleted_at is null
    and (a.banned_until is null or a.banned_until<=clock_timestamp())
    and u.id=g.profile_id and u.role='admin' and u.status='active'
    and m.role='member' and m.status='active' and b.status='inactive'
    and b.name='R4 Scoped Catalog QA 75370e04'
    and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
  for share of s,a,u,m,b;
  if not found or deadline is null or clock_timestamp()>=deadline
  then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;

  select r.id,d.name,d.sessions,d.minutes,d.days,d.price into item
  from private.tn_r4_member_catalog_registration r
  join private.tn_r4_member_catalog_draft d on d.id=r.draft_id and d.branch_id=r.branch_id and d.profile_id=r.profile_id
  where r.id=g.registration_id and r.branch_id=g.branch_id and r.profile_id=g.member_id
    and r.terms=jsonb_build_object('name',d.name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price)
  for share of r,d;
  if not found or item.price is distinct from 0 or item.sessions<1
    or item.minutes not in (20,30,40) or item.days not between 1 and 366
  then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;
  v_days:=item.days; v_minutes:=item.minutes; v_sessions:=item.sessions;

  if p_action='list' then
    if p_registration is not null or p_operation is not null
    then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;
    out_value:=jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'sessions',v_sessions,
      'minutes',v_minutes,'days',v_days,'price',0));
  else
    if p_registration is distinct from g.registration_id or p_operation is null
    then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;
    select * into rec from private.tn_r4_dev_catalog_issue_receipt
      where registration_id=g.registration_id and member_id=g.member_id;
    if not found and p_action='read' then return null; end if;
    if rec.ticket_id is null then
      if exists(select from public.tn_member_tickets t where t.user_id=g.member_id)
        or exists(select from public.tn_member_membership_records m where m.user_id=g.member_id)
        or exists(select from public.tn_member_database_records m where m.user_id=g.member_id)
      then raise insufficient_privilege using message='r4_catalog_issue_existing_record'; end if;
      -- DEV 합성 개인권. 결제·코치·고정 일정 없이 0원으로 한 번만 발급한다.
      rec.product_id:=gen_random_uuid(); rec.ticket_id:=gen_random_uuid();
      starts:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
      insert into public.tn_membership_products
        (id,branch_id,name,lesson_minutes,frequency_per_week,total_sessions,group_size,base_price,card_price,
         cash_price,settlement_base_price,validity_days,grace_days,product_kind,is_coupon,is_active,
         discount_enabled,coach_discount_allowed,policy_settings)
      values (rec.product_id,g.branch_id,item.name,v_minutes,0,v_sessions,1,0,0,0,0,v_days,0,'regular',false,false,
        false,false,'{"r4DevCatalogReference":true}'::jsonb);
      insert into public.tn_member_tickets
        (id,user_id,product_id,branch_id,total_sessions,used_sessions,remaining_sessions,
         starts_on,expires_on,status,purchased_price,settlement_base_price,source_payment_id,policy_snapshot)
      values (rec.ticket_id,g.member_id,rec.product_id,g.branch_id,v_sessions,0,v_sessions,
        starts,starts+v_days-1,'active',0,0,null,jsonb_build_object('r4DevInternalCatalog',g.registration_id));
      insert into private.tn_r4_dev_catalog_issue_receipt values
        (p_operation,g.registration_id,g.branch_id,g.member_id,rec.product_id,rec.ticket_id);
    end if;
    select t.* into strict saved from public.tn_member_tickets t
      where t.id=rec.ticket_id and t.user_id=g.member_id and t.branch_id=g.branch_id and t.product_id=rec.product_id;
    if saved.source_payment_id is not null or saved.purchased_price<>0 or saved.settlement_base_price<>0
    then raise exception 'r4_catalog_issue_financial_drift'; end if;
    out_value:=jsonb_build_object('ticketId',saved.id,'registrationId',g.registration_id,
      'total',saved.total_sessions,'remaining',saved.remaining_sessions,'startsOn',saved.starts_on,
      'expiresOn',saved.expires_on,'price',0,'public',false,'payment',false);
  end if;
  if clock_timestamp()>=deadline then raise insufficient_privilege using message='r4_catalog_issue_denied'; end if;
  return out_value;
end $$;
revoke all on function public.tn_r4_dev_issue_private_catalog(text,uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.tn_r4_dev_issue_private_catalog(text,uuid,uuid,uuid,uuid) to authenticated;
