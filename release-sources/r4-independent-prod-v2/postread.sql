-- Separate committed read-only receipt; no raw profile, session, lesson or payment rows.
begin read only;
set local search_path=pg_catalog;
set local statement_timeout='8s';
with tables as (
  select to_regclass('private.tn_r4_prod_independent_v2_'||name)::oid oid
  from unnest(array['control','designated','pilot','label','lesson','op']) name
), defs as (
  select * from (values
    ('private.tn_r4_prod_independent_v2_actor(text)','c86aee3ac72128b423ad1e40d3607ac38c72853dcad9f79813f4e2a46ee0d269',false),
    ('public.tn_r4_prod_my_independent_v2_workspace(text)','de004e59df3125b76b49263fa556acac4a03e11bc4dee2a21c254241e05c9238',true),
    ('public.tn_r4_prod_my_independent_v2_lessons(text,uuid,uuid,integer,text,timestamptz,integer,timestamptz,uuid)','16bb334d13bcdcb33855757367f1bd33ea4caa3bd28e7ea89c38291a45e0610f',true)
  ) x(signature,body_sha,allow_auth)
), g as (select mode,epoch from private.tn_r4_prod_independent_v2_control where singleton)
select jsonb_build_object(
  'prodTarget',to_regclass('private.tn_r4_dev_independent_selfserve_gate') is null
    and (select count(*)=1 from private.tn_r4_prod_independent_control where singleton and not enabled),
  'mode',g.mode,'epoch',g.epoch,
  'effectivePilot',(select count(*) from private.tn_r4_prod_independent_v2_pilot p
    join auth.sessions s on s.id=p.session_id and s.user_id=p.auth_id
    where g.mode='pilot' and p.epoch=g.epoch and p.revoked_at is null and p.expires_at>clock_timestamp()
      and coalesce(s.not_after>clock_timestamp(),true)),
  'effectiveDesignated',(select count(*) from private.tn_r4_prod_independent_v2_designated a
    where g.mode='designated' and a.epoch=g.epoch and a.revoked_at is null),
  'unrevokedPilot',(select count(*) from private.tn_r4_prod_independent_v2_pilot where revoked_at is null),
  'unrevokedDesignated',(select count(*) from private.tn_r4_prod_independent_v2_designated where revoked_at is null),
  'v2Lessons',(select count(*) from private.tn_r4_prod_independent_v2_lesson),
  'v2Operations',(select count(*) from private.tn_r4_prod_independent_v2_op),
  'legacyLessonCount',(select count(*) from private.tn_r4_prod_independent_lesson),
  'legacyLessonDigest',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(l)::text,',' order by l.id),''),'UTF8')),'hex')
    from private.tn_r4_prod_independent_lesson l),
  'surfaceOk',(select count(*)=6 and coalesce(bool_and(c.relrowsecurity and c.relowner='postgres'::regrole
    and not exists(select from pg_policy where polrelid=c.oid)
    and not exists(select from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee<>c.relowner)
    and not exists(select from (values ('anon'),('authenticated'),('service_role')) r(name)
      where has_table_privilege(r.name,c.oid,'select,insert,update,delete,truncate,references,trigger'))),false)
    from tables t join pg_class c on c.oid=t.oid)
    and (select count(*)=3 and coalesce(bool_and(p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='v'
      and p.proconfig=array['search_path=pg_catalog'] and p.prolang=(select oid from pg_language where lanname='plpgsql')
      and encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=d.body_sha
      and has_function_privilege('authenticated',p.oid,'execute')=d.allow_auth
      and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('service_role',p.oid,'execute')
      and not exists(select from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>p.proowner
        and not(d.allow_auth and a.grantee='authenticated'::regrole and a.privilege_type='EXECUTE' and not a.is_grantable))),false)
      from defs d join pg_proc p on p.oid=to_regprocedure(d.signature))
) receipt from g;
rollback;
