-- LOCAL DRAFT ONLY: direct execution is blocked. Existing production function is not changed here.
begin;
do $stop$ begin raise exception 'r4_local_overlay_never_install_directly'; end $stop$;
-- BEGIN ISOLATED TEST BODY
do $pre$
declare p oid:=to_regprocedure('public.tn_r4_prod_selfserve_ops_options(uuid)');
begin
  if p is null or encode(sha256(convert_to(pg_get_functiondef(p),'UTF8')),'hex')
      is distinct from 'f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f'
    or has_function_privilege('anon',p,'EXECUTE') or has_function_privilege('service_role',p,'EXECUTE')
    or not has_function_privilege('authenticated',p,'EXECUTE')
  then raise exception 'r4_ops_preimage_drift'; end if;
end $pre$;
-- BEGIN ISOLATED OVERLAY DEFINITION
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
