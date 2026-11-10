-- Bind only with the exact target, previously installed catalogue, and approved account.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '12s';
do $$
begin
  perform 1 from private.__CATALOG___gate where singleton and not enabled for update;
  if not found or exists (select from private.__CATALOG___grant where enabled)
     or (select count(*) from public.tn_users u join auth.users a on a.id = u.auth_user_id
          join public.tn_branches b on b.status = 'active'
          where u.status = 'active' and u.role = '__ROLE__' and a.deleted_at is null
            and (a.banned_until is null or a.banned_until <= clock_timestamp())
            and (select count(*) from public.tn_users x where x.auth_user_id = a.id) = 1
            and encode(sha256(convert_to(a.id::text,'UTF8')),'hex') = '__ACTOR_SHA__'
            and encode(sha256(convert_to(u.id::text,'UTF8')),'hex') = '__PROFILE_SHA__'
            and encode(sha256(convert_to(b.id::text,'UTF8')),'hex') = '__BRANCH_SHA__') <> 1
     or encode(sha256(convert_to(pg_get_functiondef('public.__OLD_RPC__(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex')
          is distinct from '__BASE_RPC_SHA__'
  then raise exception 'r4_standing_catalog_preimage_drift'; end if;
end $$;

create table private.__CATALOG___standing (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  branch_id uuid references public.tn_branches(id),
  profile_id uuid references public.tn_users(id),
  actor_id uuid,
  cancelled boolean not null default false,
  verify_until timestamptz,
  verify_session uuid,
  verify_draft uuid,
  verify_registration uuid,
  verify_name text,
  check ((enabled and branch_id is not null and profile_id is not null and actor_id is not null)
      or (not enabled and branch_id is null and profile_id is null and actor_id is null and verify_until is null)),
  check (not (enabled and cancelled)),
  check ((verify_until is null and verify_session is null and verify_draft is null and verify_registration is null and verify_name is null)
      or (verify_until is not null and verify_session is not null and verify_draft is not null and verify_registration is not null
          and verify_draft <> verify_registration and verify_name is not null and verify_name ~ '^R4 비공개 상시 권한 검증 [a-f0-9]{8}$'))
);
insert into private.__CATALOG___standing default values;
alter table private.__CATALOG___standing enable row level security;
revoke all on private.__CATALOG___standing from public,anon,authenticated,service_role;

create function public.__RPC__(p_action text,p_branch uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
  claims jsonb := auth.jwt(); actor uuid := auth.uid();
  target record; deadline timestamptz;
  d private.__CATALOG___draft; registration uuid; operation uuid; draft uuid;
  n text; uses integer; mins integer; duration integer; amount bigint; terms jsonb; result jsonb;
  closed constant jsonb := '{"public":false,"saleEnabled":false,"paymentEnabled":false,"membershipEnabled":false}';
begin
  if actor is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
    or coalesce(claims->>'session_id','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
  then raise insufficient_privilege using message='r4_member_catalog_denied'; end if;

  -- OFF serializes on this row; after OFF commits no new read or write is admitted.
  select g.branch_id,g.profile_id,b.name,s.not_after,g.verify_until,g.verify_draft,g.verify_registration,g.verify_name into target
  from private.__CATALOG___standing g
  join public.tn_users u on u.id=g.profile_id and u.auth_user_id=actor and u.role='__ROLE__' and u.status='active'
  join public.tn_branches b on b.id=g.branch_id and b.status='active'
  join auth.users a on a.id=actor and a.deleted_at is null and (a.banned_until is null or a.banned_until <= clock_timestamp())
  join auth.sessions s on s.id=(claims->>'session_id')::uuid and s.user_id=actor
  where g.singleton and g.enabled and not g.cancelled and g.actor_id=actor
    and (g.verify_until is null or s.id=g.verify_session)
    and encode(sha256(convert_to(a.id::text,'UTF8')),'hex')='__ACTOR_SHA__'
    and encode(sha256(convert_to(u.id::text,'UTF8')),'hex')='__PROFILE_SHA__'
    and encode(sha256(convert_to(b.id::text,'UTF8')),'hex')='__BRANCH_SHA__'
    and (select count(*) from public.tn_users x where x.auth_user_id=actor)=1
  for share of g,u,b,a,s;
  if not found or (p_action is distinct from 'scope' and p_branch is distinct from target.branch_id)
    or (p_action='scope' and p_branch is not null)
  then raise insufficient_privilege using message='r4_member_catalog_denied'; end if;
  deadline := least(target.verify_until,target.not_after,to_timestamp((claims->>'exp')::bigint));
  perform private.__CATALOG___deadline(deadline);

  case p_action
  when 'scope' then
    result := jsonb_build_object('branchId',target.branch_id,'branchName',target.name,'standing',true,
      'verification',case when target.verify_until is not null then
        jsonb_build_object('draft',target.verify_draft,'registration',target.verify_registration)
        else null end);
  when 'list' then
    select coalesce(jsonb_agg(item order by created_at desc,id desc),'[]'::jsonb) into result from (
      select d0.created_at,d0.id,closed || jsonb_build_object('draftId',d0.id,'registrationId',r.id,
        'terms',jsonb_build_object('name',d0.name,'sessions',d0.sessions,'minutes',d0.minutes,'days',d0.days,'price',d0.price)) item
      from private.__CATALOG___draft d0 left join private.__CATALOG___registration r on r.draft_id=d0.id
      where d0.branch_id=target.branch_id and d0.profile_id=target.profile_id
      order by d0.created_at desc,id desc limit 50
    ) entries;
  when 'save' then
    operation := (p_payload->>'operationId')::uuid;
    n := btrim(p_payload->>'name'); uses := (p_payload->>'sessions')::integer; mins := (p_payload->>'minutes')::integer;
    duration := (p_payload->>'days')::integer; amount := (p_payload->>'price')::bigint;
    if target.verify_until is not null and (operation,n,uses,mins,duration,amount)
         is distinct from (target.verify_draft,target.verify_name,1,20,7,0::bigint)
    then raise insufficient_privilege using message='r4_member_catalog_denied'; end if;
    if operation is null or n is null or char_length(n) not between 1 and 100
      or coalesce(uses,0)<=0 or coalesce(mins,0)<=0 or coalesce(duration,0)<=0
      or amount is null or amount not between 0 and 9007199254740991
    then raise invalid_parameter_value using message='r4_member_catalog_terms_invalid'; end if;
    insert into private.__CATALOG___draft(id,branch_id,profile_id,name,sessions,minutes,days,price)
      values(operation,target.branch_id,target.profile_id,n,uses,mins,duration,amount) on conflict(id) do nothing;
    select * into d from private.__CATALOG___draft where id=operation and branch_id=target.branch_id and profile_id=target.profile_id;
    if not found or (d.name,d.sessions,d.minutes,d.days,d.price) is distinct from (n,uses,mins,duration,amount)
    then raise unique_violation using message='r4_member_catalog_operation_conflict'; end if;
    result := closed || jsonb_build_object('draftId',d.id,'terms',jsonb_build_object('name',d.name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price));
  when 'register' then
    operation := (p_payload->>'operationId')::uuid; draft := (p_payload->>'draftId')::uuid;
    if target.verify_until is not null and (operation,draft) is distinct from (target.verify_registration,target.verify_draft)
    then raise insufficient_privilege using message='r4_member_catalog_denied'; end if;
    if operation is null or draft is null or operation=draft then raise invalid_parameter_value; end if;
    select * into d from private.__CATALOG___draft where id=draft and branch_id=target.branch_id and profile_id=target.profile_id for share;
    if not found then raise insufficient_privilege using message='r4_member_catalog_denied'; end if;
    terms := jsonb_build_object('name',d.name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price);
    if terms is distinct from p_payload->'terms' then raise invalid_parameter_value using message='r4_member_catalog_terms_mismatch'; end if;
    insert into private.__CATALOG___registration(id,draft_id,branch_id,profile_id,terms)
      values(operation,draft,target.branch_id,target.profile_id,terms) on conflict do nothing;
    select id into registration from private.__CATALOG___registration
      where draft_id=draft and branch_id=target.branch_id and profile_id=target.profile_id;
    if not found then raise unique_violation using message='r4_member_catalog_operation_conflict'; end if;
    result := closed || jsonb_build_object('registrationId',registration,'draftId',draft,'terms',terms);
  else raise invalid_parameter_value using message='r4_member_catalog_action_invalid';
  end case;
  perform private.__CATALOG___deadline(deadline);
  return result;
end $$;

revoke all on function public.__RPC__(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.__RPC__(text,uuid,jsonb) to authenticated;
commit;
