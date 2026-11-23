-- 확인한 기존 관리자 지문과 일치하는 1계정만 지정한다. 역할·로그인은 변경하지 않는다.
begin;
set local lock_timeout='2s';
set local statement_timeout='10s';
do $designate$
declare actor uuid;
begin
 if current_setting('tennisnote.install_target',true) is distinct from 'cnympiwrwgouuvhaivbc'
 or exists(select from private.tn_r4_finance_owner_control where paid_enabled or terms_enabled or history_enabled)
 or exists(select from private.tn_r4_finance_admin_grants where enabled)
 or exists(select from private.tn_r4_finance_platform_admins)
 then raise exception 'finance_admin_designation_requires_pristine_off';end if;
 select u.id into strict actor from public.tn_users u where u.role='admin' and u.status='active'
 and u.merged_into_user_id is null and u.permanently_deleted_at is null
 and encode(sha256(convert_to(u.id::text,'UTF8')),'hex')=current_setting('tennisnote.platform_profile_hash',true)
 and encode(sha256(convert_to(u.auth_user_id::text,'UTF8')),'hex')=current_setting('tennisnote.platform_auth_hash',true)
 for share;
 insert into private.tn_r4_finance_platform_admins(user_id,active) values(actor,true);
end $designate$;
commit;
