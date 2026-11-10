-- Open only the pending registration route, after the approved administrator artifact is live.
begin;
set local search_path=pg_catalog;
set local lock_timeout='4s';
set local statement_timeout='12s';
do $gate$
declare g private.tn_r4_zero_personal_issue_gate%rowtype;
begin
  select * into strict g from private.tn_r4_zero_personal_issue_gate where singleton for update;
  if not g.enabled or g.issue_mode<>'standing' or g.first_enabled or g.pending_registration_enabled
    or (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where
      oid='public.tn_r4_prod_pending_member_registration(text,uuid,text,uuid,uuid)'::regprocedure) is distinct from 'ccf15461df5d824a6c6ba607eb61ba1ef571ead55356087e5591010084db97ce'
    or not exists(select from private.tn_r4_prod_member_catalog_standing s
      join public.tn_users u on u.id=s.profile_id and u.auth_user_id=s.actor_id and u.role='admin' and u.status='active'
      join auth.users a on a.id=s.actor_id and a.deleted_at is null and coalesce(a.banned_until<=clock_timestamp(),true)
      join public.tn_branches b on b.id=s.branch_id and b.name='테니스클럽하우스' and b.status='active'
      where s.singleton and s.enabled and not s.cancelled and s.verify_until is null
        and (s.actor_id,s.profile_id,s.branch_id)=(g.actor_id,g.profile_id,g.branch_id)
        and (select count(*) from public.tn_users x where x.auth_user_id=a.id)=1)
  then raise exception 'r4_pending_registration_open_not_ready'; end if;
  update private.tn_r4_zero_personal_issue_gate set pending_registration_enabled=true
    where singleton and not pending_registration_enabled;
end $gate$;
commit;
