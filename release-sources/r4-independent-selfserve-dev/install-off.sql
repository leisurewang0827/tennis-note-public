-- R4 G2/G3: local candidate for the DEV draft model only. Do not run on PROD.
-- Installation is OFF. Existing trial/branch/role/first-lesson records are not changed.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '4s';
set local statement_timeout = '20s';

do $guard$
begin
  if to_regclass('private.tn_r4_general_dev_control') is null
    or to_regclass('private.tn_r4_prod_independent_control') is not null
    or to_regprocedure('private.tn_r4_scoped_coach_current_actor()') is null
    or to_regprocedure('private.tn_lock_account_deletion_barrier_shared()') is null
    or to_regprocedure('private.tn_lock_auth_identities(uuid[])') is null
    or not exists(select from pg_class where oid=to_regclass('private.tn_r4_seller_workspace_drafts') and relrowsecurity)
    or not exists(select from pg_constraint where conrelid=to_regclass('private.tn_r4_seller_workspace_drafts')
                  and contype='u' and not condeferrable and convalidated and pg_get_constraintdef(oid)='UNIQUE (owner_id, kind)')
  then raise exception 'independent_dev_preimage_mismatch'; end if;
end $guard$;

create table private.tn_r4_dev_independent_selfserve_gate (
  singleton boolean primary key default true check(singleton),
  create_enabled boolean not null default false,
  lessons_enabled boolean not null default false,
  test_closed_at timestamptz
);
insert into private.tn_r4_dev_independent_selfserve_gate default values;

-- DEV shared-environment guard. A separate approved action must bind exact synthetic sessions.
create table private.tn_r4_dev_independent_selfserve_access (
  session_id uuid primary key,
  auth_id uuid not null references auth.users(id),
  owner_id uuid not null references public.tn_users(id),
  issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check(expires_at>issued_at and expires_at<=issued_at+interval '5 minutes')
);

create table private.tn_r4_dev_independent_private_lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references private.tn_r4_seller_workspace_drafts(id),
  title text not null check(char_length(title) between 2 and 80 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  starts_at timestamptz not null check(isfinite(starts_at)),
  minutes integer not null check(minutes in (20,30,40)),
  revision integer not null default 1 check(revision>0),
  cancelled_at timestamptz,
  unique(workspace_id,id)
);
create index tn_r4_dev_independent_private_lessons_list on private.tn_r4_dev_independent_private_lessons(workspace_id,starts_at,id);

create table private.tn_r4_dev_independent_private_ops (
  workspace_id uuid not null,
  operation_id uuid not null,
  lesson_id uuid not null,
  request jsonb not null,
  result_revision integer not null check(result_revision>0),
  primary key(workspace_id,operation_id),
  foreign key(workspace_id,lesson_id) references private.tn_r4_dev_independent_private_lessons(workspace_id,id)
);

alter table private.tn_r4_dev_independent_selfserve_gate enable row level security;
alter table private.tn_r4_dev_independent_selfserve_access enable row level security;
alter table private.tn_r4_dev_independent_private_lessons enable row level security;
alter table private.tn_r4_dev_independent_private_ops enable row level security;
revoke all on private.tn_r4_dev_independent_selfserve_gate,private.tn_r4_dev_independent_selfserve_access,private.tn_r4_dev_independent_private_lessons,
  private.tn_r4_dev_independent_private_ops from public,anon,authenticated,service_role;

create function private.tn_r4_dev_independent_selfserve_actor(p_action text)
returns table(actor_id uuid,deadline timestamptz,create_enabled boolean,lessons_enabled boolean)
language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare
  g private.tn_r4_dev_independent_selfserve_gate%rowtype;
  claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  sid text:=claims->>'session_id'; exp text:=claims->>'exp';
  v_auth_id uuid:=auth.uid(); session_end timestamptz; access_end timestamptz;
begin
  if p_action is null or p_action not in ('workspace','register','list','receipt','create','edit','cancel') then
    raise invalid_parameter_value;
  end if;
  select * into strict g from private.tn_r4_dev_independent_selfserve_gate where singleton for share;
  if (p_action='register' and not g.create_enabled)
    or (p_action='workspace' and not (g.create_enabled or g.lessons_enabled))
    or (p_action in ('list','receipt','create','edit','cancel') and not g.lessons_enabled)
  then raise insufficient_privilege using message='independent_selfserve_off'; end if;
  if v_auth_id is null or claims->>'role' is distinct from 'authenticated'
    or coalesce(claims->>'is_anonymous','false')<>'false'
    or sid is null or sid !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or exp is null or exp !~ '^[0-9]{1,10}$' then raise insufficient_privilege; end if;
  -- Existing DEV resolver requires a verified email or phone and locks the active profile/account.
  perform private.tn_lock_account_deletion_barrier_shared();
  perform private.tn_lock_auth_identities(array[v_auth_id]);
  actor_id:=private.tn_r4_scoped_coach_current_actor();
  select s.not_after into session_end from auth.sessions s join auth.users a on a.id=s.user_id
    where s.id=sid::uuid and a.id=v_auth_id and a.deleted_at is null and coalesce(a.banned_until<=clock_timestamp(),true)
      and coalesce(s.not_after>clock_timestamp(),true)
      and (not a.is_anonymous) for share of s,a;
  if not found or actor_id is null then raise insufficient_privilege; end if;
  if (select count(*) from public.tn_users u where u.auth_user_id=v_auth_id)<>1
    or exists(select from public.tn_user_auth_links l where l.auth_user_id=v_auth_id and l.user_id<>actor_id)
  then raise insufficient_privilege; end if;
  select a.expires_at into access_end from private.tn_r4_dev_independent_selfserve_access a
    where a.session_id=sid::uuid and a.auth_id=v_auth_id and a.owner_id=actor_id
      and a.revoked_at is null and a.expires_at>clock_timestamp() for share of a;
  if not found then raise insufficient_privilege; end if;
  deadline:=least(access_end,coalesce(session_end,'infinity'::timestamptz),to_timestamp(exp::double precision));
  if deadline<=clock_timestamp() then raise insufficient_privilege; end if;
  create_enabled:=g.create_enabled; lessons_enabled:=g.lessons_enabled;
  return next;
end $fn$;
revoke all on function private.tn_r4_dev_independent_selfserve_actor(text) from public,anon,authenticated,service_role;

create function public.tn_r4_dev_my_independent_workspace(p_name text default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare
  g record; w private.tn_r4_seller_workspace_drafts%rowtype; label text:=btrim(p_name);
begin
  select * into strict g from private.tn_r4_dev_independent_selfserve_actor(case when p_name is null then 'workspace' else 'register' end);
  if p_name is not null then
    if char_length(label) not between 2 and 100 or label ~ '[[:cntrl:]]' then raise invalid_parameter_value; end if;
    insert into private.tn_r4_seller_workspace_drafts(owner_id,kind,display_name)
      values(g.actor_id,'independent_coach',label) on conflict(owner_id,kind) do nothing;
  end if;
  select * into w from private.tn_r4_seller_workspace_drafts d where d.owner_id=g.actor_id and d.kind='independent_coach';
  if clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  return jsonb_build_object('canCreate',g.create_enabled,'canManageLessons',g.lessons_enabled,
    'workspace',case when w.id is null then null else jsonb_build_object('id',w.id,'displayName',w.display_name,'kind',w.kind) end);
end $fn$;

create function public.tn_r4_dev_my_independent_lessons(
  p_action text,p_operation uuid default null,p_lesson uuid default null,p_revision integer default null,
  p_title text default null,p_start timestamptz default null,p_minutes integer default null,
  p_after_start timestamptz default null,p_after_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare
  g record; w_id uuid; l private.tn_r4_dev_independent_private_lessons%rowtype;
  op private.tn_r4_dev_independent_private_ops%rowtype; req jsonb;
  label text:=btrim(p_title); result jsonb; t timestamptz;
begin
  if p_action is null or p_action not in ('list','receipt','create','edit','cancel') then raise invalid_parameter_value; end if;
  select * into strict g from private.tn_r4_dev_independent_selfserve_actor(p_action);
  -- Use the same workspace lock for all writes; never accept a client workspace/owner ID.
  if p_action in ('list','receipt') then
    select d.id into w_id from private.tn_r4_seller_workspace_drafts d where d.owner_id=g.actor_id and d.kind='independent_coach' for share;
  else
    select d.id into w_id from private.tn_r4_seller_workspace_drafts d where d.owner_id=g.actor_id and d.kind='independent_coach' for update;
  end if;
  if w_id is null or clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  if p_action='receipt' then
    if p_operation is null or num_nonnulls(p_lesson,p_revision,p_title,p_start,p_minutes,p_after_start,p_after_id)<>0
    then raise invalid_parameter_value; end if;
    select * into op from private.tn_r4_dev_independent_private_ops o where o.workspace_id=w_id and o.operation_id=p_operation;
    result:=case when found then jsonb_build_object('found',true,'id',op.lesson_id,'revision',op.result_revision)
      else jsonb_build_object('found',false) end;
  elsif p_action='list' then
    if num_nonnulls(p_operation,p_lesson,p_revision,p_title,p_start,p_minutes)<>0
      or (p_after_start is null)<>(p_after_id is null) or (p_after_start is not null and not isfinite(p_after_start))
    then raise invalid_parameter_value; end if;
    select jsonb_build_object('lessons',coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,
      'startsAt',x.starts_at,'minutes',x.minutes,'revision',x.revision,'cancelled',x.cancelled_at is not null,'visibility','private')
      order by x.starts_at,x.id),'[]'::jsonb),'next',case when count(*)=51 then
        jsonb_build_object('startsAt',(array_agg(x.starts_at order by x.starts_at,x.id))[50],
          'id',(array_agg(x.id order by x.starts_at,x.id))[50]) end)
    into result from (select * from private.tn_r4_dev_independent_private_lessons s where s.workspace_id=w_id
      and (p_after_start is null or (s.starts_at,s.id)>(p_after_start,p_after_id)) order by s.starts_at,s.id limit 51) x;
    if result->'next'<>'null'::jsonb then result:=jsonb_set(result,'{lessons}',(result->'lessons')-50); end if;
  else
    if p_operation is null or num_nonnulls(p_after_start,p_after_id)<>0
      or (p_action='create' and num_nonnulls(p_lesson,p_revision)<>0)
      or (p_action<>'create' and (p_lesson is null or p_revision is null or p_revision<1))
      or (p_action='cancel' and num_nonnulls(p_title,p_start,p_minutes)<>0)
    then raise invalid_parameter_value; end if;
    if p_action in ('create','edit') and (label is null or char_length(label) not between 2 and 80 or label ~ '[[:cntrl:]]'
      or p_start is null or not isfinite(p_start) or p_minutes is null or p_minutes not in (20,30,40))
    then raise invalid_parameter_value; end if;
    req:=jsonb_build_array(p_action,p_lesson,p_revision,label,extract(epoch from p_start),p_minutes);
    select * into op from private.tn_r4_dev_independent_private_ops o where o.workspace_id=w_id and o.operation_id=p_operation;
    if found then
      if op.request is distinct from req then raise unique_violation using message='independent_operation_conflict'; end if;
      result:=jsonb_build_object('id',op.lesson_id,'revision',op.result_revision);
    else
      if p_action<>'create' then
        select * into l from private.tn_r4_dev_independent_private_lessons s where s.workspace_id=w_id and s.id=p_lesson;
        if not found then raise insufficient_privilege; end if;
        if l.revision<>p_revision or l.cancelled_at is not null then raise serialization_failure using message='independent_lesson_changed'; end if;
      end if;
      t:=clock_timestamp();
      if (p_action<>'create' and l.starts_at<=t)
        or (p_action in ('create','edit') and (p_start<=t or p_start>t+interval '30 days'
          or date_trunc('minute',p_start)<>p_start
          or (p_start at time zone 'Asia/Seoul')::date<>((p_start+make_interval(mins=>p_minutes)) at time zone 'Asia/Seoul')::date))
      then raise check_violation using message='independent_lesson_time'; end if;
      if p_action='create' then
        insert into private.tn_r4_dev_independent_private_lessons(workspace_id,title,starts_at,minutes)
          values(w_id,label,p_start,p_minutes) returning * into l;
      elsif p_action='edit' then
        update private.tn_r4_dev_independent_private_lessons s set title=label,starts_at=p_start,minutes=p_minutes,revision=s.revision+1
          where s.workspace_id=w_id and s.id=p_lesson returning * into l;
      else
        update private.tn_r4_dev_independent_private_lessons s set cancelled_at=t,revision=s.revision+1
          where s.workspace_id=w_id and s.id=p_lesson returning * into l;
      end if;
      insert into private.tn_r4_dev_independent_private_ops(workspace_id,operation_id,lesson_id,request,result_revision)
        values(w_id,p_operation,l.id,req,l.revision);
      result:=jsonb_build_object('id',l.id,'revision',l.revision);
    end if;
  end if;
  if clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  return result;
end $fn$;

revoke all on function public.tn_r4_dev_my_independent_workspace(text),
  public.tn_r4_dev_my_independent_lessons(text,uuid,uuid,integer,text,timestamptz,integer,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_dev_my_independent_workspace(text),
  public.tn_r4_dev_my_independent_lessons(text,uuid,uuid,integer,text,timestamptz,integer,timestamptz,uuid)
  to authenticated;
commit;
