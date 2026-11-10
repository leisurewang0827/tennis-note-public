-- One transaction/statement; substitute only validated PII-free literals:
-- __SESSION_SHA256__, __USER_AGENT_SHA256__, __ATTEMPT_START_UTC__.
-- UUIDs are selected only inside PostgreSQL; false admission raises and rolls back.
do $canary$
declare
  v_session_hash text:='__SESSION_SHA256__'; marker_hash text:='__USER_AGENT_SHA256__';
  began timestamptz:='__ATTEMPT_START_UTC__'::timestamptz;
  actor uuid; profile uuid; sid uuid; gate boolean;
  actor_pin constant text:='aeaa3810513ec00b6b86a5264f4ae1baa80b436a791ca7c894e0446c2b25c7b8';
begin
  if v_session_hash !~ '^[a-f0-9]{64}$' or marker_hash !~ '^[a-f0-9]{64}$'
    or began>clock_timestamp() or clock_timestamp()>=began+interval '90 seconds'
    then raise exception 'independent_canary_admission_expired'; end if;
  select enabled into strict gate from private.tn_r4_prod_independent_control where singleton for update;
  if gate or exists(select from private.tn_r4_prod_independent_closed_session c where c.session_hash=v_session_hash)
    or exists(select from private.tn_r4_prod_independent_access where revoked_at is null and expires_at>clock_timestamp())
    then raise exception 'independent_canary_closed_or_busy'; end if;
  select a.id,u.id,s.id into strict actor,profile,sid from auth.users a
    join auth.sessions s on s.user_id=a.id join public.tn_users u on u.auth_user_id=a.id
    where encode(sha256(convert_to(a.id::text,'UTF8')),'hex')=actor_pin
      and encode(sha256(convert_to(u.id::text,'UTF8')),'hex')=actor_pin
      and encode(sha256(convert_to(s.id::text,'UTF8')),'hex')=v_session_hash
      and encode(sha256(convert_to(coalesce(s.user_agent,''),'UTF8')),'hex')=marker_hash
      and s.created_at>=began and s.created_at<=clock_timestamp()
      and a.deleted_at is null and coalesce(a.banned_until<=clock_timestamp(),true)
      and coalesce(s.not_after>clock_timestamp(),true)
      and u.role='member' and u.status='active' and u.merged_into_user_id is null and u.permanently_deleted_at is null
      and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1
      and not exists(select from public.tn_user_auth_links l where l.auth_user_id=a.id and l.user_id<>u.id)
    for share of a,u,s;
  if clock_timestamp()>=began+interval '90 seconds' then raise exception 'independent_canary_admission_expired'; end if;
  insert into private.tn_r4_prod_independent_access(session_id,auth_id,owner_id,expires_at)
    values(sid,actor,profile,clock_timestamp()+interval '4 minutes');
  update private.tn_r4_prod_independent_control set enabled=true where singleton and not enabled;
  if not found or clock_timestamp()>=began+interval '90 seconds'
    then raise exception 'independent_canary_admission_expired'; end if;
end $canary$;
