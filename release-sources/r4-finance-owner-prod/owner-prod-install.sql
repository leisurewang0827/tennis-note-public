-- PROD-only exact-preimage delta. Existing canary and legacy gates retained.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';

create table private.tn_r4_finance_owner_control (
  branch_id uuid primary key references public.tn_branches(id),
  paid_enabled boolean not null default false,
  terms_enabled boolean not null default false,
  history_enabled boolean not null default false
);
create table private.tn_r4_finance_owner_backup (
  signature text primary key, function_oid oid not null,
  original_definition text not null, original_sha256 text not null,
  installed_sha256 text, original_metadata jsonb not null
);
alter table private.tn_r4_finance_owner_control enable row level security;
alter table private.tn_r4_finance_owner_backup enable row level security;
revoke all on private.tn_r4_finance_owner_control, private.tn_r4_finance_owner_backup
  from public,anon,authenticated,service_role;

create function private.tn_r4_finance_owner_assert(p_branch uuid,p_capability text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $owner$
declare actor uuid:=public.tn_current_user_id(); owned boolean;
begin
  if actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated'
    or p_branch is null then raise insufficient_privilege using message='r4_finance_owner_denied'; end if;
  if p_capability is null or p_capability not in ('paid','terms','history') then raise invalid_parameter_value; end if;
  -- The same row is locked by reads/writes and OFF. A completed OFF fences every later request.
  perform 1 from private.tn_r4_finance_owner_control g where g.branch_id=p_branch
    and case p_capability when 'paid' then g.paid_enabled when 'terms' then g.terms_enabled else g.history_enabled end
    for share;
  if not found then raise insufficient_privilege using message='r4_finance_owner_off'; end if;
  perform 1 from public.tn_users u join private.tn_r4_branch_roles r on r.user_id=u.id
    join public.tn_branches b on b.id=r.branch_id
    where u.id=actor and u.auth_user_id=auth.uid() and u.role='member' and u.status='active'
      and u.merged_into_user_id is null and u.permanently_deleted_at is null
      and r.branch_id=p_branch and r.role_code='manager' and r.active
      and b.status in ('active','inactive') for share of u,r,b;
  if not found then raise insufficient_privilege using message='r4_finance_owner_denied'; end if;
  select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=p_branch and user_id=actor for share) into owned;
  if owned is distinct from true then raise insufficient_privilege using message='r4_finance_owner_denied'; end if;
  return actor;
end $owner$;
revoke all on function private.tn_r4_finance_owner_assert(uuid,text) from public,anon,authenticated,service_role;

create function private.tn_r4_finance_owner_try(p_branch uuid,p_capability text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $probe$
begin
 perform private.tn_r4_finance_owner_assert(p_branch,p_capability);
 return true;
exception when insufficient_privilege then return false;
end $probe$;
revoke all on function private.tn_r4_finance_owner_try(uuid,text) from public,anon,authenticated,service_role;
do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION public.tn_r4_branch_settlement_term(p_branch uuid, p_coach uuid, p_action text, p_operation uuid DEFAULT NULL::uuid, p_type text DEFAULT NULL::text, p_hourly integer DEFAULT NULL::integer, p_ratio numeric DEFAULT NULL::numeric, p_start date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare owner_mode boolean:=false;
  actor uuid:=public.tn_current_user_id();
  deadline timestamptz;
  today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date;
  term public.tn_coach_settlement_terms%rowtype;
  hash text;
  prior private.tn_r4_branch_finance_term_receipt%rowtype;
  result jsonb;
  next_start date;
  overlapping integer;
  owned boolean;
begin
  perform private.tn_r4_finance_canary_assert(p_branch,'{prepare}'::text[],'owner',p_coach);
  owner_mode:=private.tn_r4_finance_owner_try(p_branch,'terms');
  if actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise insufficient_privilege using message='r4_term_sign_in_required';
  end if;
  if owner_mode then
    actor:=private.tn_r4_finance_owner_assert(p_branch,'terms');
    deadline:='infinity'::timestamptz;
  else
  -- Gate ties one owner to one branch and is held until commit so OFF serializes with a write.
  select a.expires_at into deadline from private.tn_r4_branch_finance_term_access a
    where a.branch_id=p_branch and a.owner_id=actor and a.expires_at>clock_timestamp() for share;
  if not found then raise insufficient_privilege using message='r4_term_scope_denied'; end if;
  if to_regclass('private.tn_r4_prod_selfserve_owners') is not null then
    execute 'select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=$1 and user_id=$2 for share)'
      into owned using p_branch,actor;
  elsif to_regclass('private.tn_r4_selfserve_branches') is not null then
    execute 'select exists(select from private.tn_r4_selfserve_branches where branch_id=$1 and owner_id=$2 for share)'
      into owned using p_branch,actor;
  end if;
  if owned is distinct from true then raise insufficient_privilege using message='r4_term_scope_denied'; end if;
  perform 1 from public.tn_users u join private.tn_r4_branch_roles r on r.user_id=u.id
    join public.tn_branches b on b.id=r.branch_id
    where u.id=actor and u.auth_user_id=auth.uid() and u.role='member' and u.status='active'
      and u.merged_into_user_id is null and u.permanently_deleted_at is null
      and r.branch_id=p_branch and r.role_code='manager' and r.active and b.status='inactive'
    for share of u,r,b;
  if not found then raise insufficient_privilege using message='r4_term_scope_denied'; end if;
  end if;
  -- Check the normal branch role and the connected coach separately; both rows are locked.
  perform 1 from public.tn_coach_roles c where c.id=p_coach and c.branch_id=p_branch
    and c.status='approved' and c.archived_at is null and c.deleted_at is null
    and c.employment_status is distinct from 'terminated' for update;
  if not found then raise insufficient_privilege using message='r4_term_coach_denied'; end if;
  perform 1 from private.tn_r4_scoped_coach_links l join public.tn_users u on u.id=l.coach_user_id
    where l.branch_id=p_branch and l.roster_role_id=p_coach and l.manager_user_id=actor and l.revoked_at is null
    and u.auth_user_id=l.coach_auth_id and u.role='member' and u.status='active'
    and u.merged_into_user_id is null and u.permanently_deleted_at is null for share of l,u;
  if not found then raise insufficient_privilege using message='r4_term_coach_denied'; end if;

  if p_action='read' then
    if num_nonnulls(p_operation,p_type,p_hourly,p_ratio)<>0 then raise invalid_parameter_value; end if;
    select * into term from public.tn_coach_settlement_terms t where t.coach_role_id=p_coach
      and (case when p_start is not null then t.effective_from=p_start
                else coalesce(t.effective_to,'infinity'::date)>=today end) order by t.effective_from limit 1;
  elsif p_action='save' then
    if p_operation is null or p_start is null or p_type is null or p_type not in ('ratio','hourly')
      or (p_type='hourly' and (p_hourly is null or p_hourly<=0 or p_ratio is not null))
      or (p_type='ratio' and (p_ratio is null or not (p_ratio between 0 and 1) or scale(p_ratio)>4 or p_hourly is not null))
    then raise invalid_parameter_value using message='r4_term_invalid'; end if;
    hash:=encode(sha256(convert_to(jsonb_build_array(p_coach,p_type,p_hourly,p_ratio,p_start)::text,'UTF8')),'hex');
    -- Serializes same owner/operation even if conflicting requests name different coaches.
    perform pg_advisory_xact_lock(hashtextextended(actor::text||':r4-term:'||p_operation::text,0));
    select * into prior from private.tn_r4_branch_finance_term_receipt r where r.branch_id=p_branch
      and r.owner_id=actor and r.operation_id=p_operation;
    if found then
      if prior.request_hash is distinct from hash then raise unique_violation using message='r4_term_operation_conflict'; end if;
      if clock_timestamp()>=deadline then raise insufficient_privilege using message='r4_term_expired'; end if;
      if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'terms'); end if;
      return prior.result || jsonb_build_object('replay',true);
    end if;
    -- Tomorrow or later: never recalculate an already completed day or overwrite a planned term.
    if p_start<=today or p_start>today+366 then raise invalid_parameter_value using message='r4_term_date'; end if;
    if exists(select from public.tn_coach_settlement_terms t where t.coach_role_id=p_coach and t.effective_from=p_start)
      then raise unique_violation using message='r4_term_date_conflict'; end if;
    select count(*) into overlapping from public.tn_coach_settlement_terms t where t.coach_role_id=p_coach
      and t.effective_from<p_start and coalesce(t.effective_to,'infinity'::date)>=p_start;
    if overlapping>1 then raise integrity_constraint_violation using message='r4_term_existing_overlap'; end if;
    select min(t.effective_from) into next_start from public.tn_coach_settlement_terms t
      where t.coach_role_id=p_coach and t.effective_from>p_start;
    update public.tn_coach_settlement_terms t set effective_to=p_start-1,updated_at=clock_timestamp()
      where t.coach_role_id=p_coach and t.effective_from<p_start and coalesce(t.effective_to,'infinity'::date)>=p_start;
    insert into public.tn_coach_settlement_terms(coach_role_id,settlement_type,coach_rate,hourly_rate,settlement_basis,
      substitute_policy,effective_from,effective_to,status,created_by_user_id,settlement_calculation_mode)
    values(p_coach,p_type,p_ratio,p_hourly,'actual_paid_inc_vat','actualCoach',p_start,next_start-1,'scheduled',actor,'session_progress')
      returning * into term;
    insert into public.tn_audit_logs(actor_user_id,action,target_table,target_id,metadata)
    values(actor,'r4_branch_coach_term_saved','tn_coach_roles',p_coach,jsonb_build_object('branchId',p_branch,'effectiveFrom',p_start));
  else raise invalid_parameter_value;
  end if;
  result:=jsonb_build_object('branchId',p_branch,'coachId',p_coach,'termId',term.id,'type',term.settlement_type,
    'effectiveFrom',term.effective_from,'effectiveTo',term.effective_to,'hourly',term.hourly_rate,'ratio',term.coach_rate,'replay',false);
  if p_action='save' then
    insert into private.tn_r4_branch_finance_term_receipt values(p_branch,actor,p_operation,hash,result);
  end if;
  if clock_timestamp()>=deadline then raise insufficient_privilege using message='r4_term_expired'; end if;
  if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'terms'); end if;
  return result;
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'3f577c040338f20403b15c830f3e382d1f87fed3eaf4330c3446efbe5c079214' then raise exception 'r4_owner_prod_preimage_mismatch: public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)',p.oid,original,'3f577c040338f20403b15c830f3e382d1f87fed3eaf4330c3446efbe5c079214',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;

do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION public.tn_r4_branch_register_manual_paid(p_branch uuid, p_member uuid, p_product uuid, p_coach uuid, p_method text, p_paid_on date, p_operation uuid, p_expected_amount integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare owner_mode boolean:=false; actor uuid:=public.tn_current_user_id(); owned boolean; deadline timestamptz;
  item public.tn_membership_products%rowtype; m public.tn_member_database_records%rowtype;
  prior private.tn_r4_branch_paid_receipt%rowtype; t public.tn_member_tickets%rowtype; p public.tn_payments%rowtype;
  today date:=(clock_timestamp() at time zone 'Asia/Seoul')::date; op_hash text; request_hash text;
  amount integer; paid_time timestamptz; replay boolean:=false;
begin
  perform private.tn_r4_finance_canary_assert(p_branch,'{issue}'::text[],'owner',p_coach);
  owner_mode:=private.tn_r4_finance_owner_try(p_branch,'paid');
 if actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated' then raise insufficient_privilege; end if;
 if p_branch is null or p_member is null or p_product is null or p_coach is null or p_operation is null
    or p_method is null or p_method not in ('cash','bank_transfer','card') or p_paid_on is null or p_paid_on>today
    or p_paid_on<today-366 or p_expected_amount is null or p_expected_amount<=0 then raise invalid_parameter_value using message='r4_paid_invalid_input'; end if;
  if owner_mode then
    actor:=private.tn_r4_finance_owner_assert(p_branch,'paid');
    deadline:='infinity'::timestamptz;
  else
 select a.expires_at into deadline from private.tn_r4_branch_paid_access a where a.branch_id=p_branch
   and a.owner_id=actor and a.expires_at>clock_timestamp() for share;
 if not found then raise insufficient_privilege using message='r4_paid_scope_denied'; end if;
 perform 1 from public.tn_users u join private.tn_r4_branch_roles r on r.user_id=u.id
   join public.tn_branches b on b.id=r.branch_id where u.id=actor and u.auth_user_id=auth.uid()
   and u.role='member' and u.status='active' and u.merged_into_user_id is null and u.permanently_deleted_at is null
   and r.branch_id=p_branch and r.role_code='manager' and r.active and b.status='inactive' for share of u,r,b;
 if not found then raise insufficient_privilege using message='r4_paid_scope_denied'; end if;
 if to_regclass('private.tn_r4_prod_selfserve_owners') is not null then
   execute 'select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=$1 and user_id=$2 for share)' into owned using p_branch,actor;
 elsif to_regclass('private.tn_r4_selfserve_branches') is not null then
   execute 'select exists(select from private.tn_r4_selfserve_branches where branch_id=$1 and owner_id=$2 for share)' into owned using p_branch,actor;
 end if;
 if owned is distinct from true then raise insufficient_privilege using message='r4_paid_scope_denied'; end if;
  end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_array(p_member,p_product,p_coach,p_method,p_paid_on,p_expected_amount)::text,'UTF8')),'hex');
 op_hash:=encode(sha256(convert_to(p_operation::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_branch::text||':r4-paid:'||p_operation::text,0));
 select * into prior from private.tn_r4_branch_paid_receipt x where x.branch_id=p_branch and x.owner_id=actor and x.operation_id=p_operation;
 if found then
   if prior.request_hash is distinct from request_hash then raise unique_violation using message='r4_paid_operation_conflict'; end if;
   select * into strict t from public.tn_member_tickets x where x.id=prior.ticket_id and x.branch_id=p_branch and x.user_id=p_member;
   select * into strict p from public.tn_payments x where x.id=prior.payment_id and x.branch_id=p_branch and x.ticket_id=t.id;
   replay:=true;
 else
   if not owner_mode then
   perform 1 from private.tn_r4_branch_paid_products x where x.branch_id=p_branch and x.product_id=p_product for share;
   if not found then raise insufficient_privilege using message='r4_paid_product_denied'; end if;
   end if;
   select * into item from public.tn_membership_products x where x.id=p_product and x.branch_id=p_branch
     and not x.is_active and not x.is_coupon and x.product_kind='regular' and x.group_size=1
     and x.lesson_minutes in (20,30,40) and x.total_sessions>0 and x.validity_days between 1 and 366
     and x.base_price>0 and x.card_price=x.base_price and x.cash_price=x.base_price for share;
   if not found then raise insufficient_privilege using message='r4_paid_product_denied'; end if;
   amount:=item.base_price;
   if amount<>p_expected_amount then raise invalid_parameter_value using message='r4_paid_price_changed'; end if;
   perform 1 from public.tn_coach_roles x where x.id=p_coach and x.branch_id=p_branch and x.status='approved'
     and x.deleted_at is null and x.archived_at is null and x.employment_status is distinct from 'terminated' for share;
   if not found then raise insufficient_privilege using message='r4_paid_coach_denied'; end if;
   perform 1 from public.tn_users u where u.id=p_member and u.role='member' and u.status='active' and u.member_kind='lesson_member'
     and u.merged_into_user_id is null and u.permanently_deleted_at is null for update;
   if not found then raise insufficient_privilege using message='r4_paid_member_denied'; end if;
   select * into m from public.tn_member_database_records x where x.user_id=p_member and x.branch_id=p_branch
     and x.record_status='pending' and x.current_ticket_id is null and x.coach_role_id=p_coach
     and x.payment_amount=0 and x.payment_record_state is not distinct from 'unentered' for update;
   if not found then raise insufficient_privilege using message='r4_paid_member_denied'; end if;
   if exists(select from public.tn_member_tickets x where x.user_id=p_member and x.branch_id=p_branch and x.status in ('active','paused','pending_payment'))
     then raise unique_violation using message='r4_paid_active_ticket'; end if;
   paid_time:=case when p_paid_on=today then transaction_timestamp() else p_paid_on::timestamp at time zone 'Asia/Seoul' end;
   insert into public.tn_member_tickets(user_id,product_id,branch_id,coach_role_id,status,total_sessions,used_sessions,
     remaining_sessions,starts_on,expires_on,purchased_price,settlement_base_price,policy_snapshot)
   values(p_member,p_product,p_branch,p_coach,'active',item.total_sessions,0,item.total_sessions,today,today+item.validity_days-1,
     amount,amount,jsonb_build_object('source','r4_branch_manual_paid','lessonMinutes',item.lesson_minutes)) returning * into t;
   insert into public.tn_payments(user_id,branch_id,product_id,ticket_id,provider,original_amount,amount,final_amount,
     settlement_base_amount,method,status,paid_at,verified_at)
   values(p_member,p_branch,p_product,t.id,'admin_manual',amount,amount,amount,amount,p_method,'verified',paid_time,transaction_timestamp()) returning * into p;
   update public.tn_member_tickets set source_payment_id=p.id where id=t.id;
   insert into public.tn_ticket_participants(ticket_id,user_id,participant_order) values(t.id,p_member,1);
   insert into public.tn_member_membership_records(user_id,ticket_id,branch_id,coach_role_id,record_status,
     lesson_type,lesson_minutes,lesson_start_on,total_sessions,used_sessions,remaining_sessions,payment_amount,
     payment_recorded_on,payment_method,payment_record_state,last_updated_via,created_by_user_id)
   values(p_member,t.id,p_branch,p_coach,'active','one_on_one',item.lesson_minutes,today,item.total_sessions,0,item.total_sessions,amount,
     p_paid_on,p_method,'complete','r4_branch_manual_paid',actor);
   update public.tn_member_database_records set current_ticket_id=t.id,record_status='active',lesson_type='one_on_one',
     lesson_start_on=today,total_sessions=item.total_sessions,used_sessions=0,remaining_sessions=item.total_sessions,
     payment_recorded_on=p_paid_on,payment_method=p_method,payment_amount=amount,payment_record_state='complete',
     last_updated_via='r4_branch_manual_paid' where id=m.id;
   insert into private.tn_r4_branch_paid_receipt values(p_branch,actor,p_operation,request_hash,p_member,p_product,p.id,t.id);
   perform private.tn_r4_capture_branch_manual_purchase(p.id,t.id,'assign',op_hash);
   insert into public.tn_audit_logs(actor_user_id,action,target_table,target_id,metadata)
   values(actor,'r4_branch_manual_membership_recorded','tn_member_tickets',t.id,jsonb_build_object('branchId',p_branch,'paymentId',p.id));
 end if;
 if private.tn_r3_manual_purchase_context(p.id) is null then raise exception 'r4_paid_evidence_missing'; end if;
 if clock_timestamp()>=deadline then raise insufficient_privilege using message='r4_paid_expired'; end if;
 if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'paid'); end if;
 return jsonb_build_object('branchId',p_branch,'memberId',p_member,'productId',p_product,'ticketId',t.id,'paymentId',p.id,
   'amount',p.amount,'replay',replay,'charged',false);
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'e60e6672d8042ed625d2d375b794281f0ca8f94e0be5851546672b466adc068c' then raise exception 'r4_owner_prod_preimage_mismatch: public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)',p.oid,original,'e60e6672d8042ed625d2d375b794281f0ca8f94e0be5851546672b466adc068c',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;

do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION private.tn_r4_branch_paid_read_allowed(p_branch uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare actor uuid:=public.tn_current_user_id(); owned boolean;
begin
  if not private.tn_r4_finance_canary_admitted(p_branch,'{issue}'::text[],'owner',null::uuid) then return false; end if;
 if actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated' then return false; end if;
 if private.tn_r4_finance_owner_try(p_branch,'paid') then return true; end if;
 if not exists(select from private.tn_r4_branch_paid_access g join private.tn_r4_branch_roles m
   on m.branch_id=g.branch_id and m.user_id=g.owner_id join public.tn_users u on u.id=m.user_id
   join public.tn_branches b on b.id=g.branch_id where g.branch_id=p_branch and g.owner_id=actor
   and g.expires_at>clock_timestamp() and m.active and m.role_code='manager' and b.status='inactive'
   and u.auth_user_id=auth.uid() and u.role='member' and u.status='active'
   and u.merged_into_user_id is null and u.permanently_deleted_at is null) then return false; end if;
 if to_regclass('private.tn_r4_prod_selfserve_owners') is not null then
   execute 'select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=$1 and user_id=$2)' into owned using p_branch,actor;
 elsif to_regclass('private.tn_r4_selfserve_branches') is not null then
   execute 'select exists(select from private.tn_r4_selfserve_branches where branch_id=$1 and owner_id=$2)' into owned using p_branch,actor;
 end if;
 return coalesce(owned,false);
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('private.tn_r4_branch_paid_read_allowed(uuid)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'5c283db246720558a25843fab52520bb11ab1cce5f8368bf7d382c61ef8583d9' then raise exception 'r4_owner_prod_preimage_mismatch: private.tn_r4_branch_paid_read_allowed(uuid)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('private.tn_r4_branch_paid_read_allowed(uuid)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'private.tn_r4_branch_paid_read_allowed(uuid)',p.oid,original,'5c283db246720558a25843fab52520bb11ab1cce5f8368bf7d382c61ef8583d9',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('private.tn_r4_branch_paid_read_allowed(uuid)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='private.tn_r4_branch_paid_read_allowed(uuid)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='private.tn_r4_branch_paid_read_allowed(uuid)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;

do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION public.tn_r4_branch_read_manual_paid(p_branch uuid, p_operation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare owner_mode boolean:=false; actor uuid:=public.tn_current_user_id(); r record;
begin
  owner_mode:=private.tn_r4_finance_owner_try(p_branch,'paid');
 if not private.tn_r4_branch_paid_read_allowed(p_branch) then raise insufficient_privilege; end if;
 select a.ticket_id,a.payment_id,a.member_id,a.product_id,p.amount,p.status into r
 from private.tn_r4_branch_paid_receipt a
 left join private.tn_r4_branch_paid_access g on g.branch_id=a.branch_id and g.owner_id=a.owner_id
 join private.tn_r4_branch_roles m on m.branch_id=a.branch_id and m.user_id=a.owner_id
 join public.tn_users u on u.id=m.user_id and u.auth_user_id=auth.uid()
 join public.tn_branches b on b.id=a.branch_id
 join public.tn_payments p on p.id=a.payment_id and p.branch_id=a.branch_id and p.ticket_id=a.ticket_id
 join public.tn_member_tickets t on t.id=a.ticket_id and t.source_payment_id=p.id and t.branch_id=a.branch_id
 where a.branch_id=p_branch and a.owner_id=actor and a.operation_id=p_operation and (owner_mode or g.expires_at>clock_timestamp())
 and m.active and m.role_code='manager' and (b.status='inactive' or (owner_mode and b.status='active')) and u.status='active' and u.role='member'
 and u.merged_into_user_id is null and u.permanently_deleted_at is null;
 if not found then raise insufficient_privilege using message='r4_paid_receipt_denied'; end if;
 if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'paid'); end if;
 return jsonb_build_object('branchId',p_branch,'memberId',r.member_id,'productId',r.product_id,'ticketId',r.ticket_id,
   'paymentId',r.payment_id,'amount',r.amount,'status',r.status,'charged',false);
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('public.tn_r4_branch_read_manual_paid(uuid,uuid)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'68089279d2083025e22caf9290cbcf842e5cefa84b4ff1cfc667e78815f840b3' then raise exception 'r4_owner_prod_preimage_mismatch: public.tn_r4_branch_read_manual_paid(uuid,uuid)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_read_manual_paid(uuid,uuid)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'public.tn_r4_branch_read_manual_paid(uuid,uuid)',p.oid,original,'68089279d2083025e22caf9290cbcf842e5cefa84b4ff1cfc667e78815f840b3',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_read_manual_paid(uuid,uuid)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='public.tn_r4_branch_read_manual_paid(uuid,uuid)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='public.tn_r4_branch_read_manual_paid(uuid,uuid)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;

do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION public.tn_r4_branch_manual_paid_options(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare owner_mode boolean:=false; result jsonb;
begin
  owner_mode:=private.tn_r4_finance_owner_try(p_branch,'paid');
 if not private.tn_r4_branch_paid_read_allowed(p_branch) then raise insufficient_privilege; end if;
 result:=jsonb_build_object('branchId',p_branch,'products',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select p.id,p.name,p.base_price as amount from public.tn_membership_products p
   where p.branch_id=p_branch and (owner_mode or exists(select from private.tn_r4_branch_paid_products c where c.branch_id=p.branch_id and c.product_id=p.id)) and not p.is_active and not p.is_coupon and p.product_kind='regular' and p.group_size=1
     and p.lesson_minutes in (20,30,40) and p.total_sessions>0 and p.validity_days between 1 and 366
     and p.base_price>0 and p.card_price=p.base_price and p.cash_price=p.base_price order by p.name,p.id) x),'[]'::jsonb),
   'members',coalesce((select jsonb_agg(to_jsonb(x)) from (
    select u.id,u.name,r.coach_role_id as "coachId" from public.tn_member_database_records r
    join public.tn_users u on u.id=r.user_id join public.tn_coach_roles c on c.id=r.coach_role_id and c.branch_id=r.branch_id
    where r.branch_id=p_branch and r.record_status='pending' and r.current_ticket_id is null and r.payment_amount=0
      and r.payment_record_state='unentered' and u.role='member' and u.status='active' and u.member_kind='lesson_member'
      and u.merged_into_user_id is null and u.permanently_deleted_at is null and c.status='approved'
      and c.deleted_at is null and c.archived_at is null and c.employment_status is distinct from 'terminated'
    order by u.name,u.id) x),'[]'::jsonb));
 if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'paid'); end if;
 return result;
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('public.tn_r4_branch_manual_paid_options(uuid)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'6a60f1ac1963103bc569c3583d29d8663f8718083fbb5789380eff78fdfa5966' then raise exception 'r4_owner_prod_preimage_mismatch: public.tn_r4_branch_manual_paid_options(uuid)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_manual_paid_options(uuid)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'public.tn_r4_branch_manual_paid_options(uuid)',p.oid,original,'6a60f1ac1963103bc569c3583d29d8663f8718083fbb5789380eff78fdfa5966',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_manual_paid_options(uuid)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='public.tn_r4_branch_manual_paid_options(uuid)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='public.tn_r4_branch_manual_paid_options(uuid)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;

do $install$
declare original text; revised text:=$definition$CREATE OR REPLACE FUNCTION public.tn_r4_branch_list_manual_paid(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare owner_mode boolean:=false;
  actor uuid:=public.tn_current_user_id();
  reader_expiry timestamptz;
  owns boolean;
  receipts jsonb;
begin
  perform private.tn_r4_finance_canary_assert(p_branch,'{issue}'::text[],'owner',null::uuid);
  owner_mode:=private.tn_r4_finance_owner_try(p_branch,'history');
  if p_branch is null or actor is null or auth.uid() is null or auth.role() is distinct from 'authenticated'
     then raise insufficient_privilege using message='r4_paid_history_denied'; end if;
  if owner_mode then
    actor:=private.tn_r4_finance_owner_assert(p_branch,'history');
    reader_expiry:='infinity'::timestamptz;
  else
  select a.expires_at into reader_expiry
    from private.tn_r4_branch_paid_history_access a
    join private.tn_r4_branch_roles m on m.branch_id=a.branch_id and m.user_id=a.owner_id
    join public.tn_users u on u.id=m.user_id and u.auth_user_id=auth.uid()
    join public.tn_branches b on b.id=a.branch_id
    where a.branch_id=p_branch and a.owner_id=actor and a.expires_at>clock_timestamp()
      and m.role_code='manager' and m.active and b.status='inactive'
      and u.role='member' and u.status='active' and u.merged_into_user_id is null and u.permanently_deleted_at is null
    for share of a,m,u,b;
  if reader_expiry is null then raise insufficient_privilege using message='r4_paid_history_denied'; end if;
  if to_regclass('private.tn_r4_prod_selfserve_owners') is not null then
    execute 'select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=$1 and user_id=$2 for share)'
      into owns using p_branch,actor;
  elsif to_regclass('private.tn_r4_selfserve_branches') is not null then
    execute 'select exists(select from private.tn_r4_selfserve_branches where branch_id=$1 and owner_id=$2 for share)'
      into owns using p_branch,actor;
  end if;
  if owns is distinct from true then raise insufficient_privilege using message='r4_paid_history_denied'; end if;
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x."recordedAt" desc,x."ticketRef"),'[]'::jsonb) into receipts
  from (
    select u.name as "memberName",s.name as "productName",t.id as "ticketRef",
      (p.paid_at at time zone 'Asia/Seoul')::date as "paidOn",p.verified_at as "recordedAt",
      p.amount,p.method,p.status::text as "paymentStatus",t.status::text as "ticketStatus",
      t.total_sessions as "totalSessions",t.used_sessions as "usedSessions",t.remaining_sessions as "remainingSessions"
    from private.tn_r4_branch_paid_receipt a
    join public.tn_payments p on p.id=a.payment_id and p.ticket_id=a.ticket_id and p.branch_id=a.branch_id
      and p.user_id=a.member_id and p.product_id=a.product_id
    join public.tn_member_tickets t on t.id=a.ticket_id and t.source_payment_id=p.id and t.branch_id=a.branch_id
      and t.user_id=a.member_id and t.product_id=a.product_id
    join public.tn_membership_products s on s.id=a.product_id and s.branch_id=a.branch_id
    left join public.tn_users u on u.id=a.member_id and u.merged_into_user_id is null and u.permanently_deleted_at is null
    where a.branch_id=p_branch and a.owner_id=actor and p.provider='admin_manual' and p.provider_payment_id is null
      and p.paid_at is not null and p.verified_at is not null
    order by p.verified_at desc,t.id limit 20
  ) x;
  if clock_timestamp()>=reader_expiry then raise insufficient_privilege using message='r4_paid_history_denied'; end if;
  if owner_mode then perform private.tn_r4_finance_owner_assert(p_branch,'history'); end if;
  return jsonb_build_object('branchId',p_branch,'rows',
    (select coalesce(jsonb_agg(value-'ticketRef'-'recordedAt' order by ord),'[]'::jsonb)
     from jsonb_array_elements(receipts) with ordinality as r(value,ord)));
end $function$
$definition$;
begin
 original:=pg_get_functiondef(to_regprocedure('public.tn_r4_branch_list_manual_paid(uuid)'));
 if encode(sha256(convert_to(original,'UTF8')),'hex')<>'13bd295c6bd4ebcdb626c109c52cb95809371a17299f9210c86d343a33dccbad' then raise exception 'r4_owner_prod_preimage_mismatch: public.tn_r4_branch_list_manual_paid(uuid)'; end if;
 if not exists(select from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_list_manual_paid(uuid)') and p.prosecdef
 and p.proconfig=ARRAY['search_path=pg_catalog'] and p.proowner=(select oid from pg_roles where rolname='postgres')
 and p.proacl::text='{postgres=X/postgres,authenticated=X/postgres}')
 then raise exception 'r4_owner_prod_initial_metadata_mismatch'; end if;
 insert into private.tn_r4_finance_owner_backup
 select 'public.tn_r4_branch_list_manual_paid(uuid)',p.oid,original,'13bd295c6bd4ebcdb626c109c52cb95809371a17299f9210c86d343a33dccbad',null,
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
 from pg_proc p where p.oid=to_regprocedure('public.tn_r4_branch_list_manual_paid(uuid)');
 execute revised;
 update private.tn_r4_finance_owner_backup set installed_sha256=encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(signature)),'UTF8')),'hex') where signature='public.tn_r4_branch_list_manual_paid(uuid)';
 if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid where b.signature='public.tn_r4_branch_list_manual_paid(uuid)' and
 jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then raise exception 'r4_owner_prod_metadata_mismatch'; end if;
end $install$;
-- Narrow finance-only roster. Do not broaden the old coach onboarding/management RPC.
create function public.tn_r4_branch_finance_coaches(p_branch uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $coaches$
declare actor uuid; result jsonb;
begin
  perform private.tn_r4_finance_canary_assert(p_branch,'{prepare,issue,settle}'::text[],'owner',null::uuid);
  if not private.tn_r4_finance_owner_try(p_branch,'terms') then
    return public.tn_r4_list_scoped_coach_roster(p_branch);
  end if;
  perform private.tn_r4_finance_canary_assert(p_branch,'{prepare}'::text[],'owner',null::uuid);
  actor:=private.tn_r4_finance_owner_assert(p_branch,'terms');
  select jsonb_build_object('branchId',p_branch,'rows',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb))
    into result from (
      select c.id,coalesce(c.display_name,'코치') as name,true as linked
      from public.tn_coach_roles c join private.tn_r4_scoped_coach_links l
        on l.branch_id=c.branch_id and l.roster_role_id=c.id and l.manager_user_id=actor and l.revoked_at is null
      join public.tn_users u on u.id=l.coach_user_id and u.auth_user_id=l.coach_auth_id
      where c.branch_id=p_branch and c.status='approved' and c.archived_at is null and c.deleted_at is null
        and c.employment_status is distinct from 'terminated' and u.role='member' and u.status='active'
        and u.merged_into_user_id is null and u.permanently_deleted_at is null
      order by c.display_name,c.id limit 100
    ) x;
  perform private.tn_r4_finance_owner_assert(p_branch,'terms');
  return result;
end $coaches$;
revoke all on function public.tn_r4_branch_finance_coaches(uuid) from public,anon,authenticated,service_role;
grant execute on function public.tn_r4_branch_finance_coaches(uuid) to authenticated;

-- No control rows: every branch remains OFF.
commit;

