-- R4 production catalog guard fragment. Only insert inside the outer candidate transaction.
-- ASSEMBLY_PHASE is an SQL literal replaced exactly once by the local packet assembler.
do $r4_storage_pin$
declare
  phase constant text := '__ASSEMBLY_PHASE__';
  expected record;
  actual_sha text;
  matching_fences integer;
  fence regprocedure;
  scheduler constant text := 'public.tn_schedule_v2_save_lesson(uuid,uuid,date,time without time zone,integer,text,jsonb,text,uuid,bigint,uuid,text)';
begin
  if phase not in ('baseline','installed') then raise exception 'r4_storage_phase_unbound'; end if;
  -- Fixed order. Held to commit, including while the original fragments modify triggers.
  lock table public.tn_lesson_change_requests,public.tn_lesson_participants,public.tn_lessons,
    public.tn_one_day_bookings,public.tn_schedule_v2_requests in share row exclusive mode;

  if encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(scheduler)),'UTF8')),'hex') is distinct from
    case phase when 'baseline' then 'e70d2c8bc200e8666a666cc3e32def051e44eadcedb7b4f76983a7c6ae1b24d6'
      else '1ee110c0ce5fe307bd314ab81b35a88496ae55027736fa43dd6934f539db5375' end
  then raise exception 'r4_scheduler_transition_pin_mismatch'; end if;

  fence := to_regprocedure('private.tn_r4_canary_fence_lesson_storage()');
  if phase='baseline' and fence is not null then raise exception 'r4_storage_fence_unexpected'; end if;
  if phase='installed' and not exists(select from pg_proc p join pg_language l on l.oid=p.prolang
    where p.oid=fence and p.proowner='postgres'::regrole and p.prorettype='trigger'::regtype
      and p.prokind='f' and p.pronargs=0 and p.prosecdef and not p.proisstrict
      and p.provolatile='v' and p.proparallel='u' and l.lanname='plpgsql' and p.proconfig=array['search_path=pg_catalog']
      and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')=
        '7bb26d7766396bacfaa2f6b408692a3d4375b0dc32826eab7e0ce8a05a84f37c'
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not has_function_privilege('service_role',p.oid,'EXECUTE')
      and not exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee<>p.proowner or a.grantor<>p.proowner or a.privilege_type<>'EXECUTE'))
  then raise exception 'r4_storage_fence_definition_or_acl_drift'; end if;

  for expected in select * from (values
    ('tn_lesson_change_requests','0a8acd1a079aba38beb452571d6e44a1c663177995bba7a8548e48f3b48b269c'),
    ('tn_lesson_participants','93e51565c5fad388564c815cd95a44f22e0aa630c31e6a9e64d171460fb5054d'),
    ('tn_lessons','289d2cb8865d65f46c5d0b4d5483c4c2cdc10335549e5423c4d2f36618a69e64'),
    ('tn_one_day_bookings','7096d6dade5a57d7eb8328046dc3a25e4dcd04007660ff10447baa8f4ecc3364'),
    ('tn_schedule_v2_requests','52d6fcc964ad5fbd3f796b46a601a27e7dac8c4e3eadf50b9a6d931d0a42a875')
  ) x(name,sha) loop
    select encode(sha256(convert_to(jsonb_build_object(
      'kind',r.relkind,'partition',r.relispartition,'inherits',r.relhassubclass,'rls',r.relrowsecurity,
      'forceRls',r.relforcerowsecurity,'acl',r.relacl::text,'owner',pg_get_userbyid(r.relowner),
      'cols',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum)
        from pg_attribute a where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
      'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,pg_get_triggerdef(t.oid),
        encode(sha256(convert_to(pg_get_functiondef(t.tgfoid),'UTF8')),'hex')) order by t.tgname)
        from pg_trigger t where t.tgrelid=r.oid and not t.tgisinternal
          and (phase='baseline' or t.tgname not in ('zz_tn_r4_canary_row_fence','zz_tn_r4_canary_truncate_fence'))),
      'policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles::text,
        pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
        from pg_policy p where p.polrelid=r.oid)
      )::text,'UTF8')),'hex') into actual_sha
    from pg_class r where r.oid=to_regclass('public.'||expected.name);
    if actual_sha is distinct from expected.sha then raise exception 'r4_storage_catalog_pin_mismatch:%',expected.name; end if;

    if phase='installed' then
      select count(*) into matching_fences from pg_trigger t
        where t.tgrelid=to_regclass('public.'||expected.name) and not t.tgisinternal and t.tgenabled='O'
          and t.tgfoid=fence and t.tgqual is null and t.tgnargs=0 and t.tgconstraint=0
          and t.tgoldtable is null and t.tgnewtable is null and t.tgparentid=0
          and (t.tgname,t.tgtype) in (('zz_tn_r4_canary_row_fence',31::smallint),('zz_tn_r4_canary_truncate_fence',34::smallint));
      if matching_fences<>2 then raise exception 'r4_storage_fence_pin_mismatch:%',expected.name; end if;
    end if;
  end loop;
end $r4_storage_pin$;
