-- Candidate only: production independent owner and private first lesson.
-- This file does not open the feature or create a session, user, or business record.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='20s';
do $preimage$
declare r record; p pg_proc%rowtype;
begin
  for r in select * from (values
    ('private.tn_r4_actor()','a95541a89dd724b19cee57b4082a5a8c682775bc66b3e4cbb681438a672010f3'),
    ('private.tn_r4_prod_selfserve_actor()','9acdc7fa374422386a6751b1c09190b6a5054af7ba524ee0d94a8a86fbc39a1b'),
    ('private.tn_r4_scoped_coach_current_actor()','620289045798ec005ea4392f0c1ee4a936b1210afa2db75ab601f97d094a03b0'),
    ('private.tn_lock_account_deletion_barrier_shared()','daf068904e765d1723470b822efd7d7d44968e3836d90172508280c88b9212f8'),
    ('private.tn_lock_auth_identities(uuid[])','b2d36f535496f4affbbfd0835f8ee1b5b4fc91e3405298fb509cebd4173f57ea')
  ) x(signature,source_sha) loop
    select * into p from pg_proc where oid=to_regprocedure(r.signature);
    if not found or not p.prosecdef or p.proconfig is distinct from
      (case when r.signature like 'private.tn_lock_%' then array['search_path=pg_catalog, pg_temp'] else array['search_path=pg_catalog'] end)
      or encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>r.source_sha
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE') then
      raise exception 'independent_owner_preimage_mismatch';
    end if;
  end loop;
end $preimage$;
create table private.tn_r4_prod_independent_control (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into private.tn_r4_prod_independent_control default values;
create table private.tn_r4_prod_independent_access (
  session_id uuid primary key, auth_id uuid not null references auth.users(id),
  owner_id uuid not null references public.tn_users(id), issued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null, revoked_at timestamptz,
  check(expires_at>issued_at and expires_at<=issued_at+interval '5 minutes')
);
create table private.tn_r4_prod_independent_closed_session (
  session_hash text primary key check(session_hash ~ '^[a-f0-9]{64}$'),
  closed_at timestamptz not null default clock_timestamp()
);
create table private.tn_r4_prod_independent_workspace (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.tn_users(id),
  operation_id uuid not null unique, created_at timestamptz not null default clock_timestamp()
);
create table private.tn_r4_prod_independent_lesson (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.tn_users(id),
  workspace_id uuid not null unique references private.tn_r4_prod_independent_workspace(id),
  operation_id uuid not null unique, title text not null, starts_at timestamptz not null,
  minutes integer not null check(minutes in (20,30,40)), created_at timestamptz not null default clock_timestamp()
);
alter table private.tn_r4_prod_independent_control enable row level security;
alter table private.tn_r4_prod_independent_access enable row level security;
alter table private.tn_r4_prod_independent_closed_session enable row level security;
alter table private.tn_r4_prod_independent_workspace enable row level security;
alter table private.tn_r4_prod_independent_lesson enable row level security;
revoke all on private.tn_r4_prod_independent_control,private.tn_r4_prod_independent_access,private.tn_r4_prod_independent_closed_session,
  private.tn_r4_prod_independent_workspace,private.tn_r4_prod_independent_lesson
  from public,anon,authenticated,service_role;

create function private.tn_r4_prod_independent_guard()
returns table(actor_id uuid,deadline timestamptz)
language plpgsql security definer set search_path=pg_catalog as $fn$
declare actor uuid; claims jsonb; token_session text; token_exp text; t record; actual_hash text;
  lease private.tn_r4_prod_independent_access%rowtype; session_end timestamptz;
begin
  claims:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
  token_session:=claims->>'session_id'; token_exp:=claims->>'exp';
  if token_session is null or token_exp is null or token_exp !~ '^[0-9]{1,10}$'
     or auth.uid() is null then raise insufficient_privilege; end if;
  perform 1 from private.tn_r4_prod_independent_control c where c.singleton and c.enabled for share;
  if not found then raise insufficient_privilege using message='independent_feature_off'; end if;
  select a.* into lease from private.tn_r4_prod_independent_access a
    where a.session_id::text=token_session and a.auth_id=auth.uid()
      and a.revoked_at is null and a.expires_at>clock_timestamp() for share;
  if not found then raise insufficient_privilege; end if;
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
  if lease.owner_id is distinct from actor then raise insufficient_privilege; end if;
  select s.not_after into session_end from auth.sessions s join auth.users a on a.id=s.user_id
    where s.id::text=token_session and a.id=auth.uid() and a.deleted_at is null
      and coalesce(a.banned_until<=clock_timestamp(),true)
      and coalesce(s.not_after>clock_timestamp(),true) for share of s,a;
  if not found then raise insufficient_privilege; end if;
  actor_id:=actor;
  deadline:=least(lease.expires_at,coalesce(session_end,'infinity'::timestamptz),to_timestamp(token_exp::double precision));
  if deadline<=clock_timestamp() then raise insufficient_privilege; end if;
  return next;
end $fn$;
revoke all on function private.tn_r4_prod_independent_guard() from public,anon,authenticated,service_role;

create function public.tn_r4_prod_my_independent(p_action text,p_operation uuid default null,
  p_title text default null,p_start timestamptz default null,p_minutes integer default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare g record; w private.tn_r4_prod_independent_workspace%rowtype;
  l private.tn_r4_prod_independent_lesson%rowtype; label text:=btrim(p_title);
begin
  select * into strict g from private.tn_r4_prod_independent_guard();
  perform pg_advisory_xact_lock(hashtextextended('r4-prod-independent:'||g.actor_id::text,0));
  if p_action='register' then
    if p_operation is null or num_nonnulls(p_title,p_start,p_minutes)<>0 then raise invalid_parameter_value; end if;
    select * into w from private.tn_r4_prod_independent_workspace where owner_id=g.actor_id;
    if found then
      if w.operation_id<>p_operation then raise unique_violation using message='independent_operation_conflict'; end if;
    else
      insert into private.tn_r4_prod_independent_workspace(owner_id,operation_id)
        values(g.actor_id,p_operation) returning * into w;
    end if;
  elsif p_action in ('read','save') then
    select * into w from private.tn_r4_prod_independent_workspace where owner_id=g.actor_id;
    if not found and p_action='save' then raise insufficient_privilege; end if;
    if p_action='save' then
      if p_operation is null or label is null or char_length(label) not between 2 and 80
        or label ~ '[[:cntrl:]]' or p_start is null or not isfinite(p_start)
        or p_minutes is null or p_minutes not in (20,30,40) then raise invalid_parameter_value; end if;
      select * into l from private.tn_r4_prod_independent_lesson where owner_id=g.actor_id;
      if found then
        if (l.workspace_id,l.operation_id,l.title,l.starts_at,l.minutes)
          is distinct from (w.id,p_operation,label,p_start,p_minutes) then
          raise unique_violation using message='independent_lesson_conflict'; end if;
      else
        if p_start<=clock_timestamp() or p_start>clock_timestamp()+interval '30 days'
          or date_trunc('minute',p_start)<>p_start
          or (p_start at time zone 'Asia/Seoul')::date<>((p_start+make_interval(mins=>p_minutes)) at time zone 'Asia/Seoul')::date
          then raise check_violation; end if;
        insert into private.tn_r4_prod_independent_lesson(owner_id,workspace_id,operation_id,title,starts_at,minutes)
          values(g.actor_id,w.id,p_operation,label,p_start,p_minutes) returning * into l;
      end if;
    else
      if num_nonnulls(p_title,p_start,p_minutes)<>0 then raise invalid_parameter_value; end if;
      select * into l from private.tn_r4_prod_independent_lesson where owner_id=g.actor_id
        and workspace_id=w.id and (p_operation is null or operation_id=p_operation);
    end if;
  else raise invalid_parameter_value; end if;
  if clock_timestamp()>=g.deadline then raise insufficient_privilege; end if;
  return jsonb_build_object('available',true,'workspace',case when w.id is null then null
    else jsonb_build_object('id',w.id,'operation',w.operation_id) end,
    'lesson',case when l.id is null then null else jsonb_build_object('id',l.id,'workspaceId',l.workspace_id,
      'title',l.title,'startsAt',l.starts_at,'minutes',l.minutes,'visibility','private') end);
end $fn$;
revoke all on function public.tn_r4_prod_my_independent(text,uuid,text,timestamptz,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_prod_my_independent(text,uuid,text,timestamptz,integer) to authenticated;
commit;
