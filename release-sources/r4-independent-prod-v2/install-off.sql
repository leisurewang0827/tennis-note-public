-- LOCAL CANDIDATE ONLY. Additive PROD v2, installs OFF; never use on DEV.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='20s';
do $preimage$
declare r record; p pg_proc%rowtype; legacy_table pg_class%rowtype;
begin
  if to_regclass('private.tn_r4_dev_independent_selfserve_gate') is not null
    or to_regclass('private.tn_r4_prod_independent_control') is null
    or not exists(select from pg_constraint c where c.conrelid='private.tn_r4_prod_independent_workspace'::regclass
      and c.contype='u' and not c.condeferrable and c.convalidated and pg_get_constraintdef(c.oid)='UNIQUE (owner_id)')
    or (select count(*) from pg_attribute where attrelid='auth.users'::regclass and not attisdropped
      and ((attname='is_anonymous' and atttypid='boolean'::regtype)
        or (attname in ('email_confirmed_at','phone_confirmed_at') and atttypid='timestamptz'::regtype)))<>3
    then raise exception 'independent_v2_prod_preimage'; end if;
  perform 1 from private.tn_r4_prod_independent_control where singleton and not enabled for share;
  if not found or exists(select from private.tn_r4_prod_independent_access where revoked_at is null)
    then raise exception 'independent_v2_legacy_open'; end if;
  for r in select unnest(array['control','access','closed_session','workspace','lesson']) name loop
    select * into legacy_table from pg_class where oid=to_regclass('private.tn_r4_prod_independent_'||r.name);
    if not found or legacy_table.relowner<>'postgres'::regrole or not legacy_table.relrowsecurity
      or exists(select from pg_policy where polrelid=legacy_table.oid)
      or exists(select from aclexplode(coalesce(legacy_table.relacl,acldefault('r',legacy_table.relowner))) a where a.grantee<>legacy_table.relowner)
      or exists(select from (values ('anon'),('authenticated'),('service_role')) x(name)
        where has_table_privilege(x.name,legacy_table.oid,'select,insert,update,delete,truncate,references,trigger'))
      then raise exception 'independent_v2_table_preimage'; end if;
  end loop;
  for r in select * from (values
    ('private.tn_r4_prod_independent_guard()','295e40f3006ed11d69bc0a8b89aa96564355fcce4cadb7e3ec93f00c5ee1e9d2',false),
    ('public.tn_r4_prod_my_independent(text,uuid,text,timestamptz,integer)','65332c3d3f54e6207b2817d7e4c617a3f4869ffa9d1d8efd889b19482687fb1f',true),
    ('private.tn_r4_prod_selfserve_actor()','9acdc7fa374422386a6751b1c09190b6a5054af7ba524ee0d94a8a86fbc39a1b',false)
  ) x(signature,body_hash,allow_auth) loop
    select * into p from pg_proc where oid=to_regprocedure(r.signature);
    if not found or p.proowner<>'postgres'::regrole or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog']
      or encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.body_hash
      or has_function_privilege('anon',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute')
      or has_function_privilege('authenticated',p.oid,'execute')<>r.allow_auth
      or exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee<>p.proowner and not(r.allow_auth and a.grantee='authenticated'::regrole
          and a.privilege_type='EXECUTE' and not a.is_grantable))
      then raise exception 'independent_v2_function_preimage'; end if;
  end loop;
end $preimage$;
create table private.tn_r4_prod_independent_v2_control(
  singleton boolean primary key default true check(singleton),
  mode text not null default 'off' check(mode in ('off','pilot','designated')),
  epoch bigint not null default 0 check(epoch>=0)
);
insert into private.tn_r4_prod_independent_v2_control default values;
create table private.tn_r4_prod_independent_v2_designated(
  epoch bigint not null, owner_id uuid not null references public.tn_users(id),
  auth_id uuid not null references auth.users(id),
  designated_at timestamptz not null default clock_timestamp(), revoked_at timestamptz,
  primary key(epoch,owner_id), unique(epoch,auth_id)
);
create table private.tn_r4_prod_independent_v2_pilot(
  session_id uuid primary key, owner_id uuid not null references public.tn_users(id),
  auth_id uuid not null references auth.users(id), epoch bigint not null,
  can_write boolean not null, issued_at timestamptz not null, expires_at timestamptz not null,
  revoked_at timestamptz, check(expires_at>issued_at and expires_at<=issued_at+interval '240 seconds')
);
create table private.tn_r4_prod_independent_v2_label(
  workspace_id uuid primary key references private.tn_r4_prod_independent_workspace(id),
  display_name text not null check(char_length(display_name) between 2 and 100 and display_name=btrim(display_name) and display_name !~ '[[:cntrl:]]')
);
create table private.tn_r4_prod_independent_v2_lesson(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references private.tn_r4_prod_independent_workspace(id),
  title text not null check(char_length(title) between 2 and 80 and title=btrim(title) and title !~ '[[:cntrl:]]'),
  starts_at timestamptz not null check(isfinite(starts_at)), minutes integer not null check(minutes in (20,30,40)),
  revision integer not null default 1 check(revision>0), cancelled_at timestamptz,
  unique(workspace_id,id)
);
create index tn_r4_prod_independent_v2_lesson_list on private.tn_r4_prod_independent_v2_lesson(workspace_id,starts_at,id);
create table private.tn_r4_prod_independent_v2_op(
  workspace_id uuid not null, operation_id uuid not null, lesson_id uuid not null,
  request jsonb not null, result_revision integer not null check(result_revision>0),
  recorded_at timestamptz not null default clock_timestamp(),
  primary key(workspace_id,operation_id),
  foreign key(workspace_id,lesson_id) references private.tn_r4_prod_independent_v2_lesson(workspace_id,id)
);
alter table private.tn_r4_prod_independent_v2_control enable row level security;
alter table private.tn_r4_prod_independent_v2_designated enable row level security;
alter table private.tn_r4_prod_independent_v2_pilot enable row level security;
alter table private.tn_r4_prod_independent_v2_label enable row level security;
alter table private.tn_r4_prod_independent_v2_lesson enable row level security;
alter table private.tn_r4_prod_independent_v2_op enable row level security;
revoke all on private.tn_r4_prod_independent_v2_control,private.tn_r4_prod_independent_v2_designated,
  private.tn_r4_prod_independent_v2_pilot,private.tn_r4_prod_independent_v2_label,
  private.tn_r4_prod_independent_v2_lesson,private.tn_r4_prod_independent_v2_op from public,anon,authenticated,service_role;

create function private.tn_r4_prod_independent_v2_actor(p_action text)
returns table(actor_id uuid,deadline timestamptz,can_write boolean)
language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare actor uuid; claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  token_session text:=claims->>'session_id'; token_exp text:=claims->>'exp';
  g private.tn_r4_prod_independent_v2_control%rowtype;
  lease private.tn_r4_prod_independent_v2_pilot%rowtype;
  t record; actual_hash text; session_end timestamptz; allowed_until timestamptz:='infinity';
begin
  if p_action is null or p_action not in ('workspace','register','list','receipt','create','edit','cancel')
    or claims->>'role' is distinct from 'authenticated' or coalesce(claims->>'is_anonymous','false')<>'false'
    or token_session is null or token_session !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    or token_exp is null or token_exp !~ '^[0-9]{1,10}$' or auth.uid() is null
    then raise insufficient_privilege; end if;
  perform 1 from private.tn_r4_prod_independent_control where singleton and not enabled for share;
  if not found then raise insufficient_privilege; end if;
  select * into strict g from private.tn_r4_prod_independent_v2_control where singleton for share;
  if g.mode='off' then raise insufficient_privilege using message='independent_v2_off'; end if;
  -- ACCESS SHARE blocks concurrent trigger/DDL changes, not ordinary profile writes.
  perform 1 from public.tn_users limit 0;
  perform 1 from public.tn_user_auth_links limit 0;
  for t in select * from (values
    ('public.tn_users','tn_guard_account_deletion_user_auth_mapping','addb10a55d448f6da2143e03d497aa5251d5652d7cbbe5137964d0f3fbc680c4'),
    ('public.tn_user_auth_links','tn_guard_account_deletion_auth_link_mapping','addb10a55d448f6da2143e03d497aa5251d5652d7cbbe5137964d0f3fbc680c4'),
    ('public.tn_user_auth_links','tn_signup_relation_owner_lock','84bed79306596aeb57baa1df7be0ad187b6a13f0282cd90e9d9beaa5b6af78ad')
  ) x(rel,trigger_name,expected_hash) loop
    select encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') into actual_hash
      from pg_trigger tr join pg_proc p on p.oid=tr.tgfoid
      where tr.tgrelid=to_regclass(t.rel) and tr.tgname=t.trigger_name
        and tr.tgenabled='O' and tr.tgtype=31 and not tr.tgisinternal;
    if actual_hash is distinct from t.expected_hash then
      raise insufficient_privilege using message='independent_mapping_guard_changed'; end if;
  end loop;
  if (select count(*) from pg_constraint c where c.conrelid='public.tn_user_auth_links'::regclass
      and c.contype='u' and not c.condeferrable and c.convalidated
      and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='auth_user_id')]::smallint[])<>1
    then raise insufficient_privilege using message='independent_link_unique_missing'; end if;
  for t in select * from (values
    ('private.tn_lock_account_deletion_barrier_shared()','daf068904e765d1723470b822efd7d7d44968e3836d90172508280c88b9212f8'),
    ('private.tn_lock_auth_identities(uuid[])','b2d36f535496f4affbbfd0835f8ee1b5b4fc91e3405298fb509cebd4173f57ea')
  ) x(signature,expected_hash) loop
    select encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') into actual_hash from pg_proc p
      where p.oid=to_regprocedure(t.signature) and p.prosecdef and p.proconfig=array['search_path=pg_catalog, pg_temp'];
    if actual_hash is distinct from t.expected_hash then
      raise insufficient_privilege using message='independent_identity_guard_changed'; end if;
  end loop;
  perform private.tn_lock_account_deletion_barrier_shared();
  if not pg_try_advisory_xact_lock(hashtextextended('tennisnote-auth-identity:'||auth.uid()::text,0))
    then raise insufficient_privilege using message='independent_identity_busy'; end if;
  actor:=private.tn_r4_prod_selfserve_actor();
  perform 1 from public.tn_users u where u.id=actor and u.auth_user_id=auth.uid()
    and u.role='member' and u.status='active' and u.merged_into_user_id is null
    and u.permanently_deleted_at is null for share nowait;
  if not found or (select count(*) from public.tn_users u where u.auth_user_id=auth.uid())<>1
    or exists(select from public.tn_user_auth_links l where l.auth_user_id=auth.uid() and l.user_id<>actor)
    then raise insufficient_privilege; end if;
  select s.not_after into session_end from auth.sessions s join auth.users a on a.id=s.user_id
    where s.id=token_session::uuid and a.id=auth.uid() and a.deleted_at is null and not coalesce(a.is_anonymous,true)
      and (a.email_confirmed_at is not null or a.phone_confirmed_at is not null)
      and coalesce(a.banned_until<=clock_timestamp(),true)
      and coalesce(s.not_after>clock_timestamp(),true) for share of s,a;
  if not found then raise insufficient_privilege; end if;
  if g.mode='pilot' then
    select * into lease from private.tn_r4_prod_independent_v2_pilot a
      where a.session_id=token_session::uuid and a.epoch=g.epoch and a.auth_id=auth.uid() and a.owner_id=actor
        and a.revoked_at is null and a.expires_at>clock_timestamp() for share;
    if not found then raise insufficient_privilege; end if;
    can_write:=lease.can_write;allowed_until:=lease.expires_at;
  elsif g.mode='designated' then
    perform 1 from private.tn_r4_prod_independent_v2_designated a
      where a.epoch=g.epoch and a.auth_id=auth.uid() and a.owner_id=actor and a.revoked_at is null for share;
    if not found then raise insufficient_privilege; end if;
    can_write:=true;
  else raise insufficient_privilege;
  end if;
  if not can_write and p_action in ('register','create','edit','cancel') then raise insufficient_privilege; end if;
  actor_id:=actor;deadline:=least(allowed_until,coalesce(session_end,'infinity'::timestamptz),to_timestamp(token_exp::double precision));
  if deadline<=clock_timestamp() then raise insufficient_privilege; end if;
  return next;
end $fn$;
revoke all on function private.tn_r4_prod_independent_v2_actor(text) from public,anon,authenticated,service_role;

create function public.tn_r4_prod_my_independent_v2_workspace(p_name text default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare g record; w private.tn_r4_prod_independent_workspace%rowtype; label text:=btrim(p_name); display text;
begin
  select * into strict g from private.tn_r4_prod_independent_v2_actor(case when p_name is null then 'workspace' else 'register' end);
  if p_name is not null then
    if char_length(label) not between 2 and 100 or label ~ '[[:cntrl:]]' then raise invalid_parameter_value; end if;
    insert into private.tn_r4_prod_independent_workspace(owner_id,operation_id)
      values(g.actor_id,gen_random_uuid()) on conflict(owner_id) do nothing;
  end if;
  select * into w from private.tn_r4_prod_independent_workspace d where d.owner_id=g.actor_id;
  if p_name is not null then
    insert into private.tn_r4_prod_independent_v2_label(workspace_id,display_name)
      values(w.id,label) on conflict(workspace_id) do nothing;
  end if;
  select l.display_name into display from private.tn_r4_prod_independent_v2_label l where l.workspace_id=w.id;
  if clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  return jsonb_build_object('canCreate',g.can_write,'canManageLessons',true,'canWriteLessons',g.can_write,
    'workspace',case when w.id is null then null else jsonb_build_object('id',w.id,
      'displayName',coalesce(display,'내 독립 코치 작업공간'),'kind','independent_coach') end);
end $fn$;

create function public.tn_r4_prod_my_independent_v2_lessons(
  p_action text,p_operation uuid default null,p_lesson uuid default null,p_revision integer default null,
  p_title text default null,p_start timestamptz default null,p_minutes integer default null,
  p_after_start timestamptz default null,p_after_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $fn$
declare
  g record; w_id uuid; l private.tn_r4_prod_independent_v2_lesson%rowtype;
  op private.tn_r4_prod_independent_v2_op%rowtype; req jsonb;
  label text:=btrim(p_title); result jsonb; t timestamptz;
begin
  if p_action is null or p_action not in ('list','receipt','create','edit','cancel') then raise invalid_parameter_value; end if;
  select * into strict g from private.tn_r4_prod_independent_v2_actor(p_action);
  -- Use the same workspace lock for all writes; never accept a client workspace/owner ID.
  if p_action in ('list','receipt') then
    select d.id into w_id from private.tn_r4_prod_independent_workspace d where d.owner_id=g.actor_id for share;
  else
    select d.id into w_id from private.tn_r4_prod_independent_workspace d where d.owner_id=g.actor_id for update;
  end if;
  if w_id is null or clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  if p_action='receipt' then
    if p_operation is null or num_nonnulls(p_lesson,p_revision,p_title,p_start,p_minutes,p_after_start,p_after_id)<>0
    then raise invalid_parameter_value; end if;
    select * into op from private.tn_r4_prod_independent_v2_op o where o.workspace_id=w_id and o.operation_id=p_operation;
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
    into result from (select * from private.tn_r4_prod_independent_v2_lesson s where s.workspace_id=w_id
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
    select * into op from private.tn_r4_prod_independent_v2_op o where o.workspace_id=w_id and o.operation_id=p_operation;
    if found then
      if op.request is distinct from req then raise unique_violation using message='independent_operation_conflict'; end if;
      result:=jsonb_build_object('id',op.lesson_id,'revision',op.result_revision);
    else
      if p_action<>'create' then
        select * into l from private.tn_r4_prod_independent_v2_lesson s where s.workspace_id=w_id and s.id=p_lesson;
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
        insert into private.tn_r4_prod_independent_v2_lesson(workspace_id,title,starts_at,minutes)
          values(w_id,label,p_start,p_minutes) returning * into l;
      elsif p_action='edit' then
        update private.tn_r4_prod_independent_v2_lesson s set title=label,starts_at=p_start,minutes=p_minutes,revision=s.revision+1
          where s.workspace_id=w_id and s.id=p_lesson returning * into l;
      else
        update private.tn_r4_prod_independent_v2_lesson s set cancelled_at=t,revision=s.revision+1
          where s.workspace_id=w_id and s.id=p_lesson returning * into l;
      end if;
      insert into private.tn_r4_prod_independent_v2_op(workspace_id,operation_id,lesson_id,request,result_revision)
        values(w_id,p_operation,l.id,req,l.revision);
      result:=jsonb_build_object('id',l.id,'revision',l.revision);
    end if;
  end if;
  if clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  return result;
end $fn$;

revoke all on function public.tn_r4_prod_my_independent_v2_workspace(text),
  public.tn_r4_prod_my_independent_v2_lessons(text,uuid,uuid,integer,text,timestamptz,integer,timestamptz,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_prod_my_independent_v2_workspace(text),
  public.tn_r4_prod_my_independent_v2_lessons(text,uuid,uuid,integer,text,timestamptz,integer,timestamptz,uuid)
  to authenticated;
commit;
