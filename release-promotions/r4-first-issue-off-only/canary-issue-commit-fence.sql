begin;
do $stop$ begin raise exception 'r4_issue_commit_fence_review_only'; end $stop$;
-- BEGIN ISOLATED TEST BODY
create function private.tn_r4_issue_require_live_at_commit() returns trigger
language plpgsql security definer set search_path=pg_catalog as $fence$
declare claims jsonb:=auth.jwt(); allowed private.tn_r4_first_issue_scope%rowtype;
begin
  -- Same locking order as the issuer and OFF: control, then scope.
  perform 1 from private.tn_r4_first_issue_control where singleton and enabled for share;
  if not found then raise insufficient_privilege using message='r4_issue_commit_off'; end if;
  select * into allowed from private.tn_r4_first_issue_scope where singleton and enabled for update;
  if not found
     or (allowed.operation_id,allowed.branch_id,allowed.owner_id,allowed.member_id,allowed.product_id,allowed.coach_id)
        is distinct from (new.operation_id,new.branch_id,new.owner_id,new.member_id,new.product_id,new.coach_id)
     or allowed.auth_id is distinct from auth.uid()
     or allowed.session_id::text is distinct from claims->>'session_id'
     or claims->>'role' is distinct from 'authenticated'
     or coalesce(claims->>'exp','') !~ '^[0-9]{1,11}$'
  then raise insufficient_privilege using message='r4_issue_commit_scope'; end if;
  if not exists(select from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=allowed.session_id and s.user_id=allowed.auth_id and u.deleted_at is null
      and coalesce(u.banned_until<=clock_timestamp(),true)
      and coalesce(s.not_after,'infinity'::timestamptz)>clock_timestamp())
    or least(allowed.valid_until,to_timestamp((claims->>'exp')::bigint))<=clock_timestamp()
  then raise insufficient_privilege using message='r4_issue_commit_expired'; end if;
  return null;
end $fence$;
revoke all on function private.tn_r4_issue_require_live_at_commit() from public,anon,authenticated,service_role;
create constraint trigger tn_r4_issue_require_live_at_commit
after insert on private.tn_r4_first_issue_receipts
deferrable initially deferred for each row execute function private.tn_r4_issue_require_live_at_commit();
-- END ISOLATED TEST BODY
commit;
