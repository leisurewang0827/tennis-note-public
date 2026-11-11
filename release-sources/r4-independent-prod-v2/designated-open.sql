-- UNBOUND: separate approval for the precise profile/auth pairs and release epoch.
-- __DESIGNATED_JSON__ must be a validated JSON array [{ "owner_sha": "...", "auth_sha": "..." }].
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='12s';
do $designated$
declare g private.tn_r4_prod_independent_v2_control%rowtype; ts timestamptz; v jsonb; n integer;
  e bigint:='__EXPECTED_EPOCH__'::bigint; approve_until timestamptz:='__APPROVAL_UNTIL_UTC__'::timestamptz;
  targets jsonb:=$targets$__DESIGNATED_JSON__$targets$::jsonb;
begin
  if e<0 or to_regclass('private.tn_r4_dev_independent_selfserve_gate') is not null
    or jsonb_typeof(targets) is distinct from 'array' then raise exception 'independent_v2_designated_target'; end if;
  if jsonb_array_length(targets) not between 1 and 20 then raise exception 'independent_v2_designated_count'; end if;
  perform 1 from private.tn_r4_prod_independent_control where singleton and not enabled for share;
  if not found then raise exception 'independent_v2_legacy_open'; end if;
  select * into strict g from private.tn_r4_prod_independent_v2_control where singleton for update;
  ts:=clock_timestamp();
  if g.mode<>'off' or g.epoch<>e or approve_until<=ts or approve_until>ts+interval '90 seconds'
    or exists(select from private.tn_r4_prod_independent_v2_pilot where revoked_at is null)
    then raise exception 'independent_v2_designated_preimage'; end if;
  for v in select value from jsonb_array_elements(targets) loop
    if jsonb_typeof(v) is distinct from 'object'
      or coalesce(v->>'auth_sha','') !~ '^[a-f0-9]{64}$' or coalesce(v->>'owner_sha','') !~ '^[a-f0-9]{64}$'
      or v-'auth_sha'-'owner_sha'<>'{}'::jsonb then raise exception 'independent_v2_designated_unbound'; end if;
    insert into private.tn_r4_prod_independent_v2_designated(epoch,owner_id,auth_id)
    select e+1,p.id,a.id from public.tn_users p join auth.users a on a.id=p.auth_user_id
    where encode(sha256(convert_to(p.id::text,'UTF8')),'hex')=v->>'owner_sha'
      and encode(sha256(convert_to(a.id::text,'UTF8')),'hex')=v->>'auth_sha'
      and not coalesce(a.is_anonymous,true) and a.deleted_at is null and coalesce(a.banned_until<=ts,true)
      and (a.email_confirmed_at is not null or a.phone_confirmed_at is not null)
      and p.role='member' and p.status='active' and p.merged_into_user_id is null and p.permanently_deleted_at is null
      and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
      and not exists(select from public.tn_user_auth_links l where l.auth_user_id=a.id and l.user_id<>p.id)
    for share of p,a;
    get diagnostics n=row_count;
    if n<>1 then raise exception 'independent_v2_designated_binding'; end if;
  end loop;
  if clock_timestamp()>=approve_until then raise exception 'independent_v2_designated_stale'; end if;
  update private.tn_r4_prod_independent_v2_control set mode='designated',epoch=e+1 where singleton;
end $designated$;
commit;
