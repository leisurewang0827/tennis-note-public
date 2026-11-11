-- UNBOUND: requires separate exact production pilot approval. No credentials in this file.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='12s';
do $pilot$
declare g private.tn_r4_prod_independent_v2_control%rowtype; ts timestamptz; v record; n integer;
  e bigint:='__EXPECTED_EPOCH__'::bigint; approve_until timestamptz:='__APPROVAL_UNTIL_UTC__'::timestamptz;
begin
  if e<0 or to_regclass('private.tn_r4_dev_independent_selfserve_gate') is not null
    then raise exception 'independent_v2_pilot_target'; end if;
  perform 1 from private.tn_r4_prod_independent_control where singleton and not enabled for share;
  if not found then raise exception 'independent_v2_legacy_open'; end if;
  select * into strict g from private.tn_r4_prod_independent_v2_control where singleton for update;
  ts:=clock_timestamp();
  if g.mode<>'off' or g.epoch<>e or approve_until<=ts or approve_until>ts+interval '90 seconds'
    or '__A_AUTH_SHA__'='__B_AUTH_SHA__' or '__A_OWNER_SHA__'='__B_OWNER_SHA__' or '__A_SESSION_SHA__'='__B_SESSION_SHA__'
    or exists(select from private.tn_r4_prod_independent_v2_pilot where revoked_at is null)
    then raise exception 'independent_v2_pilot_preimage'; end if;
  for v in select * from (values
    ('__A_AUTH_SHA__','__A_OWNER_SHA__','__A_SESSION_SHA__','__A_MARKER_SHA__',true),
    ('__B_AUTH_SHA__','__B_OWNER_SHA__','__B_SESSION_SHA__','__B_MARKER_SHA__',false)
  ) t(auth_hash,owner_hash,session_hash,marker_hash,writer) loop
    if v.auth_hash !~ '^[a-f0-9]{64}$' or v.owner_hash !~ '^[a-f0-9]{64}$'
      or v.session_hash !~ '^[a-f0-9]{64}$' or v.marker_hash !~ '^[a-f0-9]{64}$'
      then raise exception 'independent_v2_pilot_unbound'; end if;
    insert into private.tn_r4_prod_independent_v2_pilot(session_id,owner_id,auth_id,epoch,can_write,issued_at,expires_at)
    select s.id,p.id,a.id,e+1,v.writer,ts,ts+interval '240 seconds'
    from auth.sessions s join auth.users a on a.id=s.user_id join public.tn_users p on p.auth_user_id=a.id
    where encode(sha256(convert_to(a.id::text,'UTF8')),'hex')=v.auth_hash
      and encode(sha256(convert_to(p.id::text,'UTF8')),'hex')=v.owner_hash
      and encode(sha256(convert_to(s.id::text,'UTF8')),'hex')=v.session_hash
      and encode(sha256(convert_to(coalesce(s.user_agent,''),'UTF8')),'hex')=v.marker_hash
      and s.created_at between ts-interval '2 minutes' and ts and coalesce(s.not_after>ts+interval '240 seconds',true)
      and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,true) and a.deleted_at is null
      and coalesce(a.banned_until<=ts,true)
      and lower(split_part(a.email,'@',2)) in ('example.com','example.invalid','users.tennisnote.local')
      and p.role='member' and p.status='active' and p.merged_into_user_id is null and p.permanently_deleted_at is null
      and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
      and not exists(select from public.tn_user_auth_links l where l.auth_user_id=a.id and l.user_id<>p.id)
    for share of p,a,s;
    get diagnostics n=row_count;
    if n<>1 then raise exception 'independent_v2_pilot_binding'; end if;
  end loop;
  if clock_timestamp()>=approve_until then raise exception 'independent_v2_pilot_stale'; end if;
  update private.tn_r4_prod_independent_v2_control set mode='pilot',epoch=e+1 where singleton;
end $pilot$;
commit;
