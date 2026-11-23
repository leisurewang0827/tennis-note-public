-- R4-FINANCE-ADMIN-01 / G2: PROD-only exact-preimage platform control; every branch remains OFF.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $preflight$
begin
 if current_setting('tennisnote.install_target',true) is distinct from 'cnympiwrwgouuvhaivbc'
   or to_regclass('private.tn_r4_prod_selfserve_owners') is null
   or encode(sha256(convert_to(pg_get_functiondef('private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure),'UTF8')),'hex')
      <> '944facf8eb4a1f6cdf3890ecb8a8cd6e3500ad834142e66ce7adad5c8c5a83f9'
 then raise exception 'finance_admin_prod_preimage_required'; end if;
 if not exists(select from pg_proc p where p.oid='private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure
   and pg_get_userbyid(p.proowner)='postgres' and p.proacl::text='{postgres=X/postgres}'
   and p.proconfig=ARRAY['search_path=pg_catalog'] and p.prosecdef and p.provolatile='v')
 then raise exception 'finance_admin_prod_metadata_required';end if;
end $preflight$;

create table private.tn_r4_finance_platform_admins (
 user_id uuid primary key references public.tn_users(id), active boolean not null default false
);
create table private.tn_r4_finance_admin_grants (
 branch_id uuid primary key references public.tn_branches(id),
 manager_id uuid not null references public.tn_users(id),
 enabled boolean not null default false, revision bigint not null check(revision>0)
);
create table private.tn_r4_finance_admin_audit (
 operation_id uuid primary key, actor_id uuid not null, branch_id uuid not null,
 manager_id uuid not null, enabled boolean not null, expected_revision bigint not null,
 previous_state jsonb not null, resulting_revision bigint not null,
 created_at timestamptz not null default clock_timestamp()
);
create table private.tn_r4_finance_admin_backup (
 singleton boolean primary key default true check(singleton), original_definition text not null,
 installed_hash text, original_metadata jsonb not null
);
alter table private.tn_r4_finance_platform_admins enable row level security;
alter table private.tn_r4_finance_admin_grants enable row level security;
alter table private.tn_r4_finance_admin_audit enable row level security;
alter table private.tn_r4_finance_admin_backup enable row level security;
revoke all on private.tn_r4_finance_platform_admins,private.tn_r4_finance_admin_grants,
 private.tn_r4_finance_admin_audit,private.tn_r4_finance_admin_backup from public,anon,authenticated,service_role;

create function private.tn_r4_finance_platform_assert() returns uuid
language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare actor uuid:=public.tn_current_user_id();
begin
 if actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated' then
  raise insufficient_privilege using message='finance_platform_admin_required'; end if;
 perform 1 from private.tn_r4_finance_platform_admins a join public.tn_users u on u.id=a.user_id
 where a.user_id=actor and a.active and u.auth_user_id=auth.uid() and u.role='admin' and u.status='active'
 and u.merged_into_user_id is null and u.permanently_deleted_at is null for share of a,u;
 if not found then raise insufficient_privilege using message='finance_platform_admin_required'; end if;
 return actor;
end $fn$;
revoke all on function private.tn_r4_finance_platform_assert() from public,anon,authenticated,service_role;

-- Bind the selected manager without replacing the existing ownership/role/capability rules.
do $guard$
declare src text; revised text;
begin
 src:=pg_get_functiondef('private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure);
 if (length(src)-length(replace(src,'  return actor;','')))/length('  return actor;')<>1 then
  raise exception 'finance_admin_guard_anchor'; end if;
 insert into private.tn_r4_finance_admin_backup(original_definition,original_metadata)
 select src,jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef)
 from pg_proc p where p.oid='private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure;
 revised:=replace(src,'  return actor;',$binding$
  perform 1 from private.tn_r4_finance_admin_grants where branch_id=p_branch for share;
  if found and not exists(select from private.tn_r4_finance_admin_grants
    where branch_id=p_branch and manager_id=actor and enabled) then
    raise insufficient_privilege using message='finance_selected_manager_required'; end if;
  return actor;$binding$);
 execute revised;
 update private.tn_r4_finance_admin_backup set installed_hash=
 encode(sha256(convert_to(pg_get_functiondef('private.tn_r4_finance_owner_assert(uuid,text)'::regprocedure),'UTF8')),'hex');
end $guard$;

create function public.tn_r4_finance_admin_state(p_branch uuid default null) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare actor uuid; result jsonb;
begin
 actor:=private.tn_r4_finance_platform_assert();
 select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)) into result from (
  select b.id as "branchId",b.name as "branchName",s.user_id as "managerId",u.name as "managerName",
   coalesce(g.revision,0) as revision,
   coalesce(c.paid_enabled,false) as "paidEnabled",coalesce(c.terms_enabled,false) as "termsEnabled",
   coalesce(c.history_enabled,false) as "historyEnabled",
   coalesce(g.enabled,false) as "managedEnabled",
   (b.status in ('active','inactive') and u.role='member' and u.status='active' and u.auth_user_id is not null
    and u.merged_into_user_id is null and u.permanently_deleted_at is null and exists(
     select from private.tn_r4_branch_roles r where r.branch_id=b.id and r.user_id=s.user_id and r.role_code='manager' and r.active)) as eligible
  from private.tn_r4_prod_selfserve_owners s join public.tn_branches b on b.id=s.branch_id
  join public.tn_users u on u.id=s.user_id
  left join private.tn_r4_finance_owner_control c on c.branch_id=b.id
  left join private.tn_r4_finance_admin_grants g on g.branch_id=b.id
  where p_branch is null or b.id=p_branch order by b.name,b.id limit 201
 ) x;
 if jsonb_array_length(result->'rows')>200 then raise exception 'finance_admin_narrow_branch_required'; end if;
 perform private.tn_r4_finance_platform_assert();
 return result;
end $fn$;

create function public.tn_r4_finance_admin_set(p_branch uuid,p_manager uuid,p_enabled boolean,p_revision bigint,p_operation uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare actor uuid; g private.tn_r4_finance_admin_grants; c private.tn_r4_finance_owner_control;
 prior private.tn_r4_finance_admin_audit; rev bigint; owner_id uuid; result jsonb;
begin
 actor:=private.tn_r4_finance_platform_assert();
 if p_branch is null or p_manager is null or p_enabled is null or p_revision is null or p_revision<0 or p_operation is null then
  raise invalid_parameter_value using message='finance_admin_invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation::text,271));
 select * into prior from private.tn_r4_finance_admin_audit where operation_id=p_operation;
 if found then
  if prior.actor_id<>actor or prior.branch_id<>p_branch or prior.manager_id<>p_manager
   or prior.enabled<>p_enabled or prior.expected_revision<>p_revision then
   raise unique_violation using message='finance_admin_operation_conflict'; end if;
  result:=public.tn_r4_finance_admin_state(p_branch);
  return result||jsonb_build_object('replay',true);
 end if;
 insert into private.tn_r4_finance_owner_control(branch_id) values(p_branch) on conflict do nothing;
 select * into strict c from private.tn_r4_finance_owner_control where branch_id=p_branch for update;
 select * into g from private.tn_r4_finance_admin_grants where branch_id=p_branch for update;
 rev:=coalesce(g.revision,0);
 if rev<>p_revision then raise serialization_failure using message='finance_admin_refresh_required'; end if;
 -- OFF remains possible after a manager leaves or ownership changes. It never grants a replacement.
 select s.user_id into owner_id from private.tn_r4_prod_selfserve_owners s where s.branch_id=p_branch for share;
 if owner_id is distinct from p_manager and g.manager_id is distinct from p_manager then
  raise insufficient_privilege using message='finance_admin_manager_mismatch'; end if;
 if p_enabled then
  if rev=0 and (c.paid_enabled or c.terms_enabled or c.history_enabled) then
   raise exception 'finance_admin_existing_access_close_first'; end if;
  perform 1 from private.tn_r4_prod_selfserve_owners s join public.tn_users u on u.id=s.user_id
   join private.tn_r4_branch_roles r on r.user_id=u.id and r.branch_id=s.branch_id
   join public.tn_branches b on b.id=s.branch_id
   where s.branch_id=p_branch and s.user_id=p_manager and u.auth_user_id is not null
   and u.role='member' and u.status='active' and u.merged_into_user_id is null and u.permanently_deleted_at is null
   and r.active and r.role_code='manager' and b.status in ('active','inactive') for share of s,u,r,b;
  if not found then raise insufficient_privilege using message='finance_admin_ineligible_manager'; end if;
 end if;
 insert into private.tn_r4_finance_admin_grants values(p_branch,p_manager,p_enabled,rev+1)
 on conflict(branch_id) do update set manager_id=excluded.manager_id,enabled=excluded.enabled,revision=excluded.revision;
 update private.tn_r4_finance_owner_control set paid_enabled=p_enabled,terms_enabled=p_enabled,history_enabled=p_enabled where branch_id=p_branch;
 insert into private.tn_r4_finance_admin_audit(operation_id,actor_id,branch_id,manager_id,enabled,expected_revision,previous_state,resulting_revision)
 values(p_operation,actor,p_branch,p_manager,p_enabled,p_revision,to_jsonb(c),rev+1);
 perform private.tn_r4_finance_platform_assert();
 result:=public.tn_r4_finance_admin_state(p_branch);
 return result||jsonb_build_object('replay',false);
end $fn$;
revoke all on function public.tn_r4_finance_admin_state(uuid),public.tn_r4_finance_admin_set(uuid,uuid,boolean,bigint,uuid) from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_finance_admin_state(uuid),public.tn_r4_finance_admin_set(uuid,uuid,boolean,bigint,uuid) to authenticated;
-- No platform administrators, branch grants or openings are seeded by installation.
commit;
