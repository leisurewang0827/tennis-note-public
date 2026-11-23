-- 새 관리 경로만 닫고 업무·감사 기록은 삭제하지 않는다.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $guard$ begin
 if current_setting('tennisnote.install_target',true) is distinct from 'cnympiwrwgouuvhaivbc'
 then raise exception 'finance_admin_prod_target_required';end if;
end $guard$;
-- 먼저 관리자 행을 잠가 신규 개방을 막고 기존 개방 요청의 종료를 기다린다.
update private.tn_r4_finance_platform_admins set active=false;
update private.tn_r4_finance_owner_control c set paid_enabled=false,terms_enabled=false,history_enabled=false
 where exists(select from private.tn_r4_finance_admin_grants g where g.branch_id=c.branch_id);
update private.tn_r4_finance_admin_grants set enabled=false;
do $closed$ begin
 if exists(select from private.tn_r4_finance_admin_grants where enabled)
 or exists(select from private.tn_r4_finance_admin_grants g join private.tn_r4_finance_owner_control c using(branch_id)
 where c.paid_enabled or c.terms_enabled or c.history_enabled)
 then raise exception 'finance_admin_off_incomplete';end if;
end $closed$;
commit;
