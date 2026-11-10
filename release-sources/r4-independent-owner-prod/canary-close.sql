-- Substitute only a validated SHA256(session UUID text); never a raw UUID.
-- A durable no-reopen tombstone and conditional OFF share the control lock.
-- A late close for A never disables an unrelated live B lease.
do $canary$
declare v_session_hash text:='__SESSION_SHA256__'; gate boolean;
begin
  if v_session_hash !~ '^[a-f0-9]{64}$' then raise exception 'independent_canary_invalid'; end if;
  select enabled into strict gate from private.tn_r4_prod_independent_control where singleton for update;
  insert into private.tn_r4_prod_independent_closed_session(session_hash) values(v_session_hash)
    on conflict do nothing;
  update private.tn_r4_prod_independent_access set revoked_at=coalesce(revoked_at,clock_timestamp())
    where encode(sha256(convert_to(session_id::text,'UTF8')),'hex')=v_session_hash;
  if not exists(select from private.tn_r4_prod_independent_access a
    where a.revoked_at is null and a.expires_at>clock_timestamp()
      and encode(sha256(convert_to(a.session_id::text,'UTF8')),'hex')<>v_session_hash) then
    update private.tn_r4_prod_independent_control set enabled=false where singleton;
  end if;
end $canary$;
