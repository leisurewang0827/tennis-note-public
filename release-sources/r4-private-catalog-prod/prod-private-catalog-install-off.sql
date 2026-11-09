-- BRANCH-02 Seoul production, additive/default OFF. Do not execute standalone.
-- External project binding: tennisnote-prod-seoul / ap-northeast-2 / exact approved fingerprint.
-- All changes commit as one transaction. This file performs no activation or data migration.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
lock table private.tn_r4_product_draft_control,private.tn_r4_internal_product_control,
  private.tn_r4_prod_internal_product_access,private.tn_r4_prod_pilot in share mode;
do $pre$
declare p oid;
begin
  p:=to_regprocedure('private.tn_r4_prod_selfserve_lock_owner(uuid)');
  if p is null or encode(sha256(convert_to(pg_get_functiondef(p),'UTF8')),'hex')
      is distinct from 'e8366bd1a1fce390ccc694638105a82d8a06f1605004addd914c5ada792fce8d'
    or not exists(select 1 from pg_proc where oid=p and prosecdef)
    or has_function_privilege('anon',p,'EXECUTE') or has_function_privilege('authenticated',p,'EXECUTE')
    or has_function_privilege('service_role',p,'EXECUTE')
    or to_regclass('private.tn_r4_dev_internal_product_scope') is not null
    or to_regprocedure('public.tn_r4_dev_private_catalog_list(uuid)') is not null
    or (select count(*) from private.tn_r4_product_draft_control where singleton and not enabled)<>1
    or (select count(*) from private.tn_r4_internal_product_control where singleton and not enabled)<>1
    or exists(select 1 from private.tn_r4_prod_internal_product_access where expires_at>clock_timestamp())
    or exists(select 1 from private.tn_r4_prod_pilot where enabled is distinct from false)
    or exists(select 1 from pg_proc x join pg_namespace n on n.oid=x.pronamespace
       where n.nspname in ('public','private') and x.proname like 'tn_r4_prod_private_catalog_%')
    then raise exception 'r4_private_catalog_prod_contract_drift'; end if;
end $pre$;

-- Independent of the canary, branch creation and all customer-facing products.
create table private.tn_r4_prod_private_catalog_control (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false
);
insert into private.tn_r4_prod_private_catalog_control default values;
create table private.tn_r4_prod_private_catalog_access (
  branch_id uuid not null, manager_id uuid not null,
  enabled boolean not null default false,
  valid_until timestamptz not null,
  bound_session_id uuid,
  primary key(branch_id,manager_id)
);
create table private.tn_r4_prod_private_catalog_drafts (
  operation_id uuid primary key, branch_id uuid not null, manager_id uuid not null,
  product_name text not null check(char_length(product_name) between 1 and 100),
  sessions integer not null check(sessions>0), minutes integer not null check(minutes>0),
  days integer not null check(days>0), price bigint not null check(price between 0 and 9007199254740991),
  created_at timestamptz not null default statement_timestamp(),
  unique(branch_id,manager_id,operation_id)
);
create table private.tn_r4_prod_private_catalog_registrations (
  operation_id uuid primary key, draft_id uuid not null unique, branch_id uuid not null, manager_id uuid not null,
  terms jsonb not null check(jsonb_typeof(terms)='object'),
  registered_at timestamptz not null default statement_timestamp(),
  foreign key(branch_id,manager_id,draft_id)
    references private.tn_r4_prod_private_catalog_drafts(branch_id,manager_id,operation_id)
);
alter table private.tn_r4_prod_private_catalog_control enable row level security;
alter table private.tn_r4_prod_private_catalog_access enable row level security;
alter table private.tn_r4_prod_private_catalog_drafts enable row level security;
alter table private.tn_r4_prod_private_catalog_registrations enable row level security;
revoke all on private.tn_r4_prod_private_catalog_control,private.tn_r4_prod_private_catalog_access,private.tn_r4_prod_private_catalog_drafts,
  private.tn_r4_prod_private_catalog_registrations from public,anon,authenticated,service_role;

create function private.tn_r4_prod_private_catalog_manager(p_branch uuid)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare who uuid; gate boolean; grant_end timestamptz; session_end timestamptz;
begin
  -- Emergency OFF and grants synchronize with all three RPCs via row locks.
  select enabled into gate from private.tn_r4_prod_private_catalog_control where singleton for share;
  if gate is distinct from true then raise insufficient_privilege using message='r4_private_catalog_denied'; end if;
  select enabled into gate from private.tn_r4_product_draft_control where singleton for share;
  if gate is distinct from false then raise insufficient_privilege using message='r4_private_catalog_legacy_open'; end if;
  select enabled into gate from private.tn_r4_internal_product_control where singleton for share;
  if gate is distinct from false then raise insufficient_privilege using message='r4_private_catalog_legacy_open'; end if;
  who:=private.tn_r4_prod_selfserve_lock_owner(p_branch);
  select a.valid_until,s.not_after into grant_end,session_end
    from private.tn_r4_prod_private_catalog_access a
    join public.tn_users u on u.id=a.manager_id and u.auth_user_id=auth.uid()
    join public.tn_branches b on b.id=a.branch_id and b.status='inactive'
    join auth.users au on au.id=u.auth_user_id
    join auth.sessions s on s.user_id=u.auth_user_id and s.id::text=auth.jwt()->>'session_id'
    where a.branch_id=p_branch and a.manager_id=who and a.enabled
      and (a.bound_session_id is null or a.bound_session_id=s.id)
      and u.role='member' and u.status='active'
      and (au.banned_until is null or au.banned_until<=clock_timestamp())
    for share of a,u,b,au,s;
  if not found or grant_end<=clock_timestamp() or session_end<=clock_timestamp()
    then raise insufficient_privilege using message='r4_private_catalog_denied'; end if;
  return who;
end $$;

create function private.tn_r4_prod_private_catalog_terms(d private.tn_r4_prod_private_catalog_drafts)
returns jsonb language sql immutable set search_path=pg_catalog as $$
  select jsonb_build_object('name',d.product_name,'sessions',d.sessions,'minutes',d.minutes,'days',d.days,'price',d.price)
$$;
revoke all on function private.tn_r4_prod_private_catalog_manager(uuid),
  private.tn_r4_prod_private_catalog_terms(private.tn_r4_prod_private_catalog_drafts) from public,anon,authenticated,service_role;

create function public.tn_r4_prod_private_catalog_list(p_branch uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare who uuid:=private.tn_r4_prod_private_catalog_manager(p_branch);
begin
  return (select coalesce(jsonb_agg(j.item order by j.at desc,j.id desc),'[]'::jsonb)
    from (select d.created_at at,d.operation_id id,
      jsonb_build_object('draftId',d.operation_id,'terms',private.tn_r4_prod_private_catalog_terms(d),
        'registrationId',r.operation_id,'public',false,'saleEnabled',false,'paymentEnabled',false,'membershipEnabled',false) item
      from private.tn_r4_prod_private_catalog_drafts d
      left join private.tn_r4_prod_private_catalog_registrations r
        on r.branch_id=d.branch_id and r.manager_id=d.manager_id and r.draft_id=d.operation_id
      where d.branch_id=p_branch and d.manager_id=who order by d.created_at desc,d.operation_id desc limit 50) j);
end $$;

create function public.tn_r4_prod_private_catalog_save(p_branch uuid,p_operation uuid,p_name text,
  p_sessions integer,p_minutes integer,p_days integer,p_price bigint)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare who uuid:=private.tn_r4_prod_private_catalog_manager(p_branch);
  d private.tn_r4_prod_private_catalog_drafts; n text:=btrim(p_name);
begin
  if p_operation is null or n is null or char_length(n) not between 1 and 100 or coalesce(p_sessions,0)<=0
    or coalesce(p_minutes,0)<=0 or coalesce(p_days,0)<=0 or p_price is null or p_price not between 0 and 9007199254740991
    then raise invalid_parameter_value using message='r4_private_catalog_terms_invalid'; end if;
  insert into private.tn_r4_prod_private_catalog_drafts(operation_id,branch_id,manager_id,product_name,sessions,minutes,days,price)
    values(p_operation,p_branch,who,n,p_sessions,p_minutes,p_days,p_price) on conflict(operation_id) do nothing;
  select * into d from private.tn_r4_prod_private_catalog_drafts where operation_id=p_operation and branch_id=p_branch and manager_id=who;
  if not found or (d.product_name,d.sessions,d.minutes,d.days,d.price) is distinct from (n,p_sessions,p_minutes,p_days,p_price)
    then raise unique_violation using message='r4_private_catalog_operation_conflict'; end if;
  -- A uniqueness wait can outlive the grant or session; an exception rolls back this write.
  perform private.tn_r4_prod_private_catalog_manager(p_branch);
  return jsonb_build_object('draftId',d.operation_id,'terms',private.tn_r4_prod_private_catalog_terms(d),
    'public',false,'saleEnabled',false,'paymentEnabled',false,'membershipEnabled',false);
end $$;

create function public.tn_r4_prod_private_catalog_register(p_branch uuid,p_draft uuid,p_operation uuid,p_confirmed_terms jsonb)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare who uuid:=private.tn_r4_prod_private_catalog_manager(p_branch);
  d private.tn_r4_prod_private_catalog_drafts; terms_now jsonb;
  r private.tn_r4_prod_private_catalog_registrations;
begin
  if p_operation is null or p_operation=p_draft then raise invalid_parameter_value using message='r4_private_catalog_operation_invalid'; end if;
  select * into d from private.tn_r4_prod_private_catalog_drafts
    where operation_id=p_draft and branch_id=p_branch and manager_id=who for share;
  if not found then raise insufficient_privilege using message='r4_private_catalog_draft_denied'; end if;
  terms_now:=private.tn_r4_prod_private_catalog_terms(d);
  if terms_now is distinct from p_confirmed_terms then raise invalid_parameter_value using message='r4_private_catalog_terms_mismatch'; end if;
  insert into private.tn_r4_prod_private_catalog_registrations(operation_id,draft_id,branch_id,manager_id,terms)
    values(p_operation,p_draft,p_branch,who,terms_now) on conflict do nothing;
  select * into r from private.tn_r4_prod_private_catalog_registrations
    where operation_id=p_operation and draft_id=p_draft and branch_id=p_branch and manager_id=who;
  if not found then raise unique_violation using message='r4_private_catalog_operation_conflict'; end if;
  -- Recheck with wall-clock time after blocking DML and before returning success.
  perform private.tn_r4_prod_private_catalog_manager(p_branch);
  return jsonb_build_object('registrationId',r.operation_id,'draftId',r.draft_id,'terms',r.terms,
    'public',false,'saleEnabled',false,'paymentEnabled',false,'membershipEnabled',false);
end $$;

revoke all on function public.tn_r4_prod_private_catalog_list(uuid),
  public.tn_r4_prod_private_catalog_save(uuid,uuid,text,integer,integer,integer,bigint),
  public.tn_r4_prod_private_catalog_register(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_prod_private_catalog_list(uuid),
  public.tn_r4_prod_private_catalog_save(uuid,uuid,text,integer,integer,integer,bigint),
  public.tn_r4_prod_private_catalog_register(uuid,uuid,uuid,jsonb) to authenticated;
commit;
