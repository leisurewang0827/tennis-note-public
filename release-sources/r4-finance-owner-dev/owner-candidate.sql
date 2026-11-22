-- Apply this delta only over the six existing pinned functions. Never reinstall the baseline files on an existing DEV database.
-- Deliberately refuses production canary wrappers or any unknown preimage.
-- No activation rows, Auth changes, role grants, PG calls or public sale.
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
  if to_regclass('private.tn_r4_prod_selfserve_owners') is not null then
    execute 'select exists(select from private.tn_r4_prod_selfserve_owners where branch_id=$1 and user_id=$2 for share)'
      into owned using p_branch,actor;
  elsif to_regclass('private.tn_r4_selfserve_branches') is not null then
    execute 'select exists(select from private.tn_r4_selfserve_branches where branch_id=$1 and owner_id=$2 for share)'
      into owned using p_branch,actor;
  end if;
  if owned is distinct from true then raise insufficient_privilege using message='r4_finance_owner_denied'; end if;
  return actor;
end $owner$;
revoke all on function private.tn_r4_finance_owner_assert(uuid,text) from public,anon,authenticated,service_role;

-- Replacement is only permitted when every exact anchor occurs once.
create function pg_temp.tn_r4_owner_replace(src text,anchor text,replacement text)
returns text language plpgsql as $replace$
begin
  if anchor='' or (length(src)-length(replace(src,anchor,'')))/length(anchor)<>1 then
    raise exception 'r4_finance_owner_anchor_mismatch'; end if;
  return replace(src,anchor,replacement);
end $replace$;

do $install$
declare r record; original text; revised text; anchor text; tail text; cap text;
begin
  for r in select * from (values
    ('public.tn_r4_branch_settlement_term(uuid,uuid,text,uuid,text,integer,numeric,date)',
     '239a7c295699ec61cd9e4ad965e4267b92f2c8a1728ff58e8dcdb29a115aff2f','terms'),
    ('public.tn_r4_branch_register_manual_paid(uuid,uuid,uuid,uuid,text,date,uuid,integer)',
     '71829bf5cef81fee0ba534a2e44f706a7dddb50a80b8a1700f5e6850da5fe6a6','paid'),
    ('private.tn_r4_branch_paid_read_allowed(uuid)',
     'fc804f88ca81dce0de6671739b134457f259afaef9a2f421b64ed66d6d3ace42','paid'),
    ('public.tn_r4_branch_manual_paid_options(uuid)',
     '6a60f1ac1963103bc569c3583d29d8663f8718083fbb5789380eff78fdfa5966','paid'),
    ('public.tn_r4_branch_read_manual_paid(uuid,uuid)',
     '68089279d2083025e22caf9290cbcf842e5cefa84b4ff1cfc667e78815f840b3','paid'),
    ('public.tn_r4_branch_list_manual_paid(uuid)',
     '82be8de872d99c5936182838c4ad1a8c0687e94fd4f514026986eba931355c10','history')
  ) as pins(signature,sha256,capability) loop
    select pg_get_functiondef(p.oid) into strict original from pg_proc p where p.oid=to_regprocedure(r.signature);
    if encode(sha256(convert_to(original,'UTF8')),'hex')<>r.sha256 then
      raise exception 'r4_finance_owner_preimage_mismatch: %',r.signature; end if;
    insert into private.tn_r4_finance_owner_backup
      select r.signature,p.oid,original,r.sha256,null,
        jsonb_build_object('owner',p.proowner,'acl',p.proacl,'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile)
      from pg_proc p where p.oid=to_regprocedure(r.signature);
    revised:=original; cap:=r.capability;
    if r.signature like 'public.tn_r4_branch_settlement_term(%' then
      anchor:=substring(original from position('  -- Gate ties one owner' in original)
        for position('  -- Check the normal branch role' in original)-position('  -- Gate ties one owner' in original));
      revised:=pg_temp.tn_r4_owner_replace(revised,anchor,
        E'  actor:=private.tn_r4_finance_owner_assert(p_branch,''terms'');\n  deadline:=''infinity''::timestamptz;\n');
    elsif r.signature like 'public.tn_r4_branch_register_manual_paid(%' then
      anchor:=substring(original from position(' select a.expires_at into deadline' in original)
        for position(' request_hash:=' in original)-position(' select a.expires_at into deadline' in original));
      revised:=pg_temp.tn_r4_owner_replace(revised,anchor,
        E' actor:=private.tn_r4_finance_owner_assert(p_branch,''paid'');\n deadline:=''infinity''::timestamptz;\n');
      revised:=pg_temp.tn_r4_owner_replace(revised,
        E'   perform 1 from private.tn_r4_branch_paid_products x where x.branch_id=p_branch and x.product_id=p_product for share;\n   if not found then raise insufficient_privilege using message=''r4_paid_product_denied''; end if;\n','');
    elsif r.signature like 'private.tn_r4_branch_paid_read_allowed(%' then
      revised:=$read_allowed$CREATE OR REPLACE FUNCTION private.tn_r4_branch_paid_read_allowed(p_branch uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'pg_catalog'
AS $function$
begin
  perform private.tn_r4_finance_owner_assert(p_branch,'paid');
  return true;
exception when insufficient_privilege then return false;
end $function$;
$read_allowed$;
    elsif r.signature like 'public.tn_r4_branch_manual_paid_options(%' then
      revised:=pg_temp.tn_r4_owner_replace(revised,
        E'from private.tn_r4_branch_paid_products c\n   join public.tn_membership_products p on p.id=c.product_id and p.branch_id=c.branch_id\n   where c.branch_id=p_branch',
        'from public.tn_membership_products p where p.branch_id=p_branch');
    elsif r.signature like 'public.tn_r4_branch_read_manual_paid(%' then
      revised:=pg_temp.tn_r4_owner_replace(revised,
        E' join private.tn_r4_branch_paid_access g on g.branch_id=a.branch_id and g.owner_id=a.owner_id\n','');
      revised:=pg_temp.tn_r4_owner_replace(revised,' and g.expires_at>clock_timestamp()','');
      revised:=pg_temp.tn_r4_owner_replace(revised,' and b.status=''inactive''',' and b.status in (''active'',''inactive'')');
    elsif r.signature like 'public.tn_r4_branch_list_manual_paid(%' then
      anchor:=substring(original from position('  select a.expires_at into reader_expiry' in original)
        for position('  select coalesce(jsonb_agg' in original)-position('  select a.expires_at into reader_expiry' in original));
      revised:=pg_temp.tn_r4_owner_replace(revised,anchor,
        E'  actor:=private.tn_r4_finance_owner_assert(p_branch,''history'');\n  reader_expiry:=''infinity''::timestamptz;\n');
    end if;
    -- Every public result, including replay, revalidates authority. No legacy result shape change.
    if r.signature like 'public.%' then
      revised:=regexp_replace(revised,'(?m)^([ \t]*)return ',
        E'\\1perform private.tn_r4_finance_owner_assert(p_branch,'''||cap||E''');\n\\1return ','g');
    end if;
    revised:=replace(revised,' STABLE SECURITY DEFINER',' VOLATILE SECURITY DEFINER');
    if revised=original then raise exception 'r4_finance_owner_no_delta'; end if;
    execute revised;
    update private.tn_r4_finance_owner_backup set installed_sha256=
      encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(r.signature)),'UTF8')),'hex') where signature=r.signature;
    if not exists(select from pg_proc p join private.tn_r4_finance_owner_backup b on b.function_oid=p.oid
      where b.signature=r.signature and jsonb_build_object('owner',p.proowner,'acl',p.proacl,
        'definer',p.prosecdef,'config',p.proconfig)=b.original_metadata-'volatility') then
      raise exception 'r4_finance_owner_metadata_changed'; end if;
  end loop;
end $install$;
-- Narrow finance-only roster. Do not broaden the old coach onboarding/management RPC.
create function public.tn_r4_branch_finance_coaches(p_branch uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $coaches$
declare actor uuid; result jsonb;
begin
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
-- No capability rows are inserted: default OFF for every branch.
commit;
