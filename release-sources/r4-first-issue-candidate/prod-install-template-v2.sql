begin;
set local search_path=pg_catalog;
set local lock_timeout='3s';
set local statement_timeout='20s';
-- Release-local coordination only; not a lock against unrelated DDL.
select pg_advisory_xact_lock(hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));
-- No supported receipt transport exists yet. No caller-set GUC can remove this stop.
do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;
do $pre$ declare r record; p pg_proc%rowtype; begin
  if not coalesce((with
requested(schema_name, object_name) as (values
  ('auth','users'),('auth','sessions'),('public','tn_users'),('public','tn_branches'),
  ('public','tn_coach_roles'),('public','tn_member_database_records'),
  ('public','tn_membership_products'),('public','tn_schedule_v2_policies'),
  ('public','tn_member_tickets'),('public','tn_ticket_participants'),
  ('public','tn_member_membership_records'),('public','tn_payments'),('public','tn_audit_logs'),
  ('private','tn_r4_first_issue_control'),('private','tn_r4_first_issue_scope'),
  ('private','tn_r4_first_issue_receipts')),
relations as (
  select x.*,c.oid,c.relacl,c.relowner,c.relrowsecurity,c.relforcerowsecurity
  from requested x left join pg_namespace n on n.nspname=x.schema_name
  left join pg_class c on c.relnamespace=n.oid and c.relname=x.object_name
),
catalog_rows as (
  select concat_ws('.',r.schema_name,r.object_name) as name,r.oid is not null as present,
    case when r.oid is not null then jsonb_build_object(
      'acl',r.relacl::text,'owner',pg_get_userbyid(r.relowner),'rls',r.relrowsecurity,'force',r.relforcerowsecurity,
      'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),a.attacl::text) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
      'constraints',(select jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) order by c.conname) from pg_constraint c where c.conrelid=r.oid),
      'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=r.oid),
      'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid),encode(sha256(convert_to(pg_get_functiondef(t.tgfoid),'UTF8')),'hex')) order by t.tgname) from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal),
      'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles::text,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname) from pg_policy p where p.polrelid=r.oid)
    ) end as state
  from relations r
), expected(name,present,hash) as (values
('auth.sessions',true,'ddd8901a6e88c534817ba4bc349f6180c966034ae4e7337d622201168773bd7b'),
('auth.users',true,'71ca50d85c9a31709e53763c1a2611381ffcf92855029647073e571349528b38'),
('public.tn_audit_logs',true,'2f06e1da2d6a0f9436ee3d6d4850e7ac46229e9929e13eadc874f12ca5e1cd5e'),
('public.tn_branches',true,'0cdc177b777cb637818692cf8ef0d6925e40b53aec2943711a0437f9dde3f9ad'),
('public.tn_coach_roles',true,'7f66ef7becf633c9342ce7d2dfb2581ad92078bb9718a1e4cedae8eb8b4390e0'),
('public.tn_member_database_records',true,'fd4b2b71e7c3301b98bd527c0f86af1056a4e546826aa083ca551e1b3d436825'),
('public.tn_member_membership_records',true,'2ccce29eda7037930df1776b8ab1049adfde61097cb163449e229b77580126c1'),
('public.tn_member_tickets',true,'c1fb39a2b0ecab1227cd28958085e5fa0e68d42e69b929b4a37d6e26bc91653f'),
('public.tn_membership_products',true,'ca3804019484c8b60ff365562717de966401df353e123c7f151497cea01d30e7'),
('public.tn_payments',true,'ada1940106f4b5680aee13ed0a4f71931080278b33fe9101542f0d29a9a9265e'),
('public.tn_schedule_v2_policies',true,'6854b163e1ce90f88387706b7a49a47b94fcf3ae7fce2cb131a3f1fd56bb55ff'),
('public.tn_ticket_participants',true,'aa0843f47697d73db5137d47be96546c60746fb1f76b03ab11fb58ee67eef818'),
('public.tn_users',true,'6dd0875ec48883685c2b09a57cb3d9666bd79fbd53f9faab76027ab38b2fd797'),
('private.tn_r4_first_issue_control',false,null),
('private.tn_r4_first_issue_receipts',false,null),
('private.tn_r4_first_issue_scope',false,null)
),
actual as (select name,present,case when present then encode(sha256(convert_to(state::text,'UTF8')),'hex') end as hash from catalog_rows)
select count(*)=16 and bool_and(coalesce(a.present=e.present and a.hash is not distinct from e.hash,false)) as catalog_preimage_pass
from expected e left join actual a using(name)),false) then raise exception 'r4_catalog_drift'; end if;
  for r in select * from (values
('private.tn_r4_prod_selfserve_lock_owner(uuid)','e8366bd1a1fce390ccc694638105a82d8a06f1605004addd914c5ada792fce8d',false,false,false,array['search_path=pg_catalog']),
('public.tn_r4_prod_selfserve_ops_options(uuid)','f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f',false,true,false,array['search_path=pg_catalog']),
('public.tn_r4_prod_selfserve_save_options(uuid,text)','e81bb54c4eaf0697f6808421c69809b8c22d43fc6b62836eca453aba48772b26',false,true,false,array['search_path=pg_catalog']),
('public.tn_r4_prod_selfserve_saved_lesson(uuid,uuid,uuid)','342166b0f7955ff5777d1c0a26346fd6b2b119e00fdf813e0439d8b8875dd33b',false,true,false,array['search_path=pg_catalog']),
('public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)','e70d2c8bc200e8666a666cc3e32def051e44eadcedb7b4f76983a7c6ae1b24d6',false,true,true,array['search_path=private, public, pg_temp','row_security=off'])
) x(signature,hash,anon_allowed,auth_allowed,service_allowed,config) loop
    select * into p from pg_proc where oid=to_regprocedure(r.signature);
    if not found or p.proowner<>'postgres'::regrole or not p.prosecdef or p.provolatile<>'v' or p.proparallel<>'u' or p.proisstrict
       or p.proconfig is distinct from r.config or encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') is distinct from r.hash
       or has_function_privilege('anon',p.oid,'execute') is distinct from r.anon_allowed
       or has_function_privilege('authenticated',p.oid,'execute') is distinct from r.auth_allowed
       or has_function_privilege('service_role',p.oid,'execute') is distinct from r.service_allowed
       or exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
         where a.grantor<>'postgres'::regrole or a.privilege_type<>'EXECUTE' or a.is_grantable
           or (a.grantee<>p.proowner and not(r.auth_allowed and a.grantee='authenticated'::regrole)
             and not(r.service_allowed and a.grantee='service_role'::regrole)))
    then raise exception 'r4_routine_preimage_drift'; end if;
  end loop;
  if to_regprocedure('public.tn_r4_first_zero_issue(uuid,uuid,uuid,uuid,uuid)') is not null
    or to_regclass('private.tn_r4_first_issue_ops_backup') is not null
  then raise exception 'r4_issue_already_installed'; end if;
  perform 1 from private.tn_r4_prod_independent_control where singleton and not enabled for share;
  if not found then raise exception 'r4_independent_not_off'; end if;
  perform 1 from private.tn_r4_prod_independent_v2_control where singleton and mode='off' for share;
  if not found then raise exception 'r4_independent_v2_not_off'; end if;
end $pre$;
create table private.tn_r4_first_issue_ops_backup(singleton boolean primary key default true check(singleton),
  definition text not null,pre_sha text not null,post_sha text not null,owner_id oid not null,acl aclitem[],config text[]);
alter table private.tn_r4_first_issue_ops_backup enable row level security;
revoke all on private.tn_r4_first_issue_ops_backup from public,anon,authenticated,service_role;
insert into private.tn_r4_first_issue_ops_backup(definition,pre_sha,post_sha,owner_id,acl,config)
  select pg_get_functiondef(p.oid),encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex'),'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286',p.proowner,p.proacl,p.proconfig from pg_proc p where p.oid='public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure;

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


create or replace function public.tn_r4_prod_selfserve_ops_options(branch uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare policy_revision bigint; policy_mode text; result jsonb; capability jsonb; claims jsonb:=auth.jwt(); actual_owner uuid;
begin
  actual_owner:=private.tn_r4_prod_selfserve_lock_owner(branch);
  select p.revision,p.coach_single_add_mode into policy_revision,policy_mode
    from public.tn_schedule_v2_policies p where p.branch_id=branch;
  result:=jsonb_build_object(
    'branchId',branch,'revision',coalesce(policy_revision,0),'mode',coalesce(policy_mode,'approval'),
    'coaches',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name) order by c.display_name,c.id)
      from public.tn_coach_roles c where c.branch_id=branch and c.status='approved'),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'sessions',p.total_sessions) order by p.name,p.id)
      from public.tn_membership_products p where p.branch_id=branch and p.is_active and p.product_kind='regular'),'[]'::jsonb));
  if claims->>'role'='authenticated' and coalesce(claims->>'session_id','') ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    and coalesce(claims->>'exp','') ~ '^[0-9]{1,11}$' then
    select jsonb_build_object('enabled',true,'actor',s.auth_id,'branch',s.branch_id,'member',s.member_id,
      'product',s.product_id,'coach',s.coach_id,'operation',s.operation_id,
      'expiresAt',floor(extract(epoch from least(s.valid_until,coalesce(a.not_after,'infinity'::timestamptz),
        to_timestamp((claims->>'exp')::bigint)))*1000)::bigint,
      'display',jsonb_build_object(
        'owner',jsonb_build_object('id',s.auth_id,'label',o.name),
        'branch',jsonb_build_object('id',b.id,'label',b.name),
        'member',jsonb_build_object('id',m.id,'label',m.name),
        'coach',jsonb_build_object('id',cr.id,'label',cr.display_name),
        'product',jsonb_build_object('id',p.id,'label',p.name,'price',p.base_price,
          'minutes',p.lesson_minutes,'sessions',p.total_sessions,'days',p.validity_days)))
    into capability from private.tn_r4_first_issue_control c
      join private.tn_r4_first_issue_scope s on s.singleton and s.enabled
      join auth.sessions a on a.id=s.session_id and a.user_id=s.auth_id
      join auth.users u on u.id=s.auth_id and u.deleted_at is null
      join public.tn_users o on o.id=s.owner_id and o.auth_user_id=s.auth_id and o.status='active'
      join public.tn_branches b on b.id=s.branch_id and b.status='inactive'
      join public.tn_users m on m.id=s.member_id and m.role='member' and m.status='active'
        and m.member_kind='journal_only' and m.auth_user_id is null and m.phone is null
        and m.merged_into_user_id is null and m.permanently_deleted_at is null
      join public.tn_member_database_records mr on mr.user_id=m.id and mr.branch_id=b.id
        and mr.coach_role_id=s.coach_id and mr.record_status='pending'
      join public.tn_coach_roles cr on cr.id=s.coach_id and cr.branch_id=b.id and cr.status='approved'
        and cr.employment_status='active' and cr.deleted_at is null and cr.archived_at is null
      join public.tn_membership_products p on p.id=s.product_id and p.branch_id=b.id
        and not p.is_active and not p.is_coupon and p.group_size=1 and p.product_kind='regular'
        and p.base_price=0 and p.card_price=0 and p.cash_price=0 and p.settlement_base_price=0
        and p.total_sessions between 1 and 52 and p.validity_days between 1 and 366 and p.lesson_minutes in (20,30,40)
      where c.singleton and c.enabled and s.branch_id=branch and s.owner_id=actual_owner and s.auth_id=auth.uid()
        and coalesce(u.banned_until<=clock_timestamp(),true)
        and length(btrim(o.name)) between 1 and 100 and length(btrim(b.name)) between 1 and 100
        and length(btrim(m.name)) between 1 and 100 and length(btrim(cr.display_name)) between 1 and 100
        and length(btrim(p.name)) between 1 and 100
        and s.session_id::text=claims->>'session_id' and s.valid_until>clock_timestamp()
        and s.valid_until<=clock_timestamp()+interval '5 minutes'
        and coalesce(a.not_after,'infinity'::timestamptz)>clock_timestamp()
        and to_timestamp((claims->>'exp')::bigint)>clock_timestamp();
  end if;
  return case when capability is null then result else result||jsonb_build_object('firstIssue',capability) end;
end $$;

do $after$ declare b private.tn_r4_first_issue_ops_backup%rowtype; p pg_proc%rowtype; begin
  select * into strict b from private.tn_r4_first_issue_ops_backup where singleton;
  select * into strict p from pg_proc where oid='public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure;
  if b.pre_sha<>'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f' or encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex')<>'15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286' or p.proowner is distinct from b.owner_id
     or p.proacl is distinct from b.acl or p.proconfig is distinct from b.config
     or (select count(*) from private.tn_r4_first_issue_control where singleton and not enabled)<>1
     or exists(select from private.tn_r4_first_issue_scope)
  then raise exception 'r4_install_postimage_drift'; end if;
end $after$;
commit;
