-- Read only, after commit. Substitute validated __SESSION_SHA256__; no identities returned.
select (select count(*)=1 and bool_and(not enabled) from private.tn_r4_prod_independent_control) as feature_off,
  (select count(*)=1 and bool_and(revoked_at is not null) from private.tn_r4_prod_independent_access
    where encode(sha256(convert_to(session_id::text,'UTF8')),'hex')='__SESSION_SHA256__') as exact_lease_revoked,
  (select count(*)=0 from private.tn_r4_prod_independent_access where revoked_at is null and expires_at>clock_timestamp()) as no_live_leases,
  (select count(*)=1 from private.tn_r4_prod_independent_closed_session where session_hash='__SESSION_SHA256__') as no_reopen_marker;
