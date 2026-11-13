-- Metadata delta only. No business rows, identities, definitions or credentials are returned.
begin read only;
set local search_path=pg_catalog;
set local statement_timeout='10s';
with targets(name, required_columns) as (values
  ('tn_lessons',array['id','branch_id','member_ticket_id','coach_role_id','original_coach_role_id','lesson_date','start_time','duration_minutes','status','lesson_source','schedule_v2_kind']),
  ('tn_lesson_participants',array['id','lesson_id','user_id','ticket_id']),
  ('tn_schedule_v2_requests',array[]::text[]),('tn_lesson_change_requests',array[]::text[]),('tn_one_day_bookings',array[]::text[])
), relations as (
  select t.*,c.oid,c.relkind,c.relispartition,c.relhassubclass,c.relrowsecurity,c.relforcerowsecurity,c.relowner,c.relacl
  from targets t left join pg_class c on c.oid=to_regclass('public.'||t.name)
), results as (
  select r.name,
    coalesce(r.relkind='r' and not r.relispartition and not r.relhassubclass and r.relrowsecurity,false) as eligible,
    (select count(*) from pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped
      and a.attname::text=any(r.required_columns))=cardinality(r.required_columns) as required_columns_present,
    (select count(*) from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal and t.tgname in
      ('zz_tn_r4_canary_row_fence','zz_tn_r4_canary_truncate_fence')) as trigger_name_conflicts,
    case when r.oid is not null then encode(sha256(convert_to(jsonb_build_object(
      'kind',r.relkind,'partition',r.relispartition,'inherits',r.relhassubclass,'rls',r.relrowsecurity,
      'forceRls',r.relforcerowsecurity,'acl',r.relacl::text,'owner',pg_get_userbyid(r.relowner),
      'cols',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
        from pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
      'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid),
        encode(sha256(convert_to(pg_get_functiondef(t.tgfoid),'UTF8')),'hex')) order by t.tgname)
        from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal),
      'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles::text,
        pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
        from pg_policy p where p.polrelid=r.oid)
      )::text,'UTF8')),'hex') end as metadata_sha256
  from relations r
), scheduler as (
  select p.prosrc,pg_get_functiondef(p.oid) as definition from pg_proc p where p.oid=to_regprocedure(
    'public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)')
), patch as (
  select prosrc,definition,E'begin\r\n  perform private.tn_r4_prod_selfserve_schedule_manager(' as anchor,
    E'begin\r\n  perform private.tn_r4_first_lesson_claim(target_branch_id,target_coach_role_id,target_lesson_date,target_start_time,target_duration_minutes,target_schedule_kind,target_participants,target_operation_key,target_lesson_id,target_expected_revision,target_request_id,target_note);\r\n  perform private.tn_r4_prod_selfserve_schedule_manager(' as replacement
  from scheduler
)
select jsonb_build_object(
  'readOnly',current_setting('transaction_read_only')='on',
  'storage',(select jsonb_agg(to_jsonb(r) order by name) from results r),
  'schedulerKnown',(select encode(sha256(convert_to(definition,'UTF8')),'hex')=
    'e70d2c8bc200e8666a666cc3e32def051e44eadcedb7b4f76983a7c6ae1b24d6' from patch),
  'schedulerAnchorOnce',(select length(prosrc)-length(replace(prosrc,anchor,''))=length(anchor)
    and length(definition)-length(replace(definition,prosrc,''))=length(prosrc) from patch),
  'schedulerExpectedPostSha',(select encode(sha256(convert_to(
    replace(definition,prosrc,replace(prosrc,anchor,replacement)),'UTF8')),'hex') from patch
    where length(prosrc)-length(replace(prosrc,anchor,''))=length(anchor)
      and length(definition)-length(replace(definition,prosrc,''))=length(prosrc)),
  'issueBackupAbsent',to_regclass('private.tn_r4_first_issue_ops_backup') is null,
  'lessonCanaryAbsent',to_regclass('private.tn_r4_first_lesson_canary') is null,
  'issueFenceAbsent',to_regprocedure('private.tn_r4_issue_require_live_at_commit()') is null,
  'storageFenceAbsent',to_regprocedure('private.tn_r4_canary_fence_lesson_storage()') is null
) as r4_storage_preimage_delta;
rollback;
