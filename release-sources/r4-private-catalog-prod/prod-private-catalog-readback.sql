-- Exact Seoul PROD binding required. Read-only; no account, branch or business values.
begin read only;
set local statement_timeout='8s';
with rel(n) as (values ('control'),('access'),('drafts'),('registrations')),
t as (select c.* from rel join pg_class c on c.oid=to_regclass('private.tn_r4_prod_private_catalog_'||rel.n)),
r(name) as (values ('anon'),('authenticated'),('service_role')),
sig(name,client) as (values
 ('private.tn_r4_prod_private_catalog_manager(uuid)',false),
 ('private.tn_r4_prod_private_catalog_terms(private.tn_r4_prod_private_catalog_drafts)',false),
 ('public.tn_r4_prod_private_catalog_list(uuid)',true),
 ('public.tn_r4_prod_private_catalog_save(uuid,uuid,text,integer,integer,integer,bigint)',true),
 ('public.tn_r4_prod_private_catalog_register(uuid,uuid,uuid,jsonb)',true)),
f as (select p.*,s.name,s.client from sig s join pg_proc p on p.oid=to_regprocedure(s.name))
select jsonb_build_object(
 'off',(select count(*)=1 and coalesce(bool_and(not enabled),false) from private.tn_r4_prod_private_catalog_control),
 'activeGrants',(select count(*) from private.tn_r4_prod_private_catalog_access where enabled and valid_until>clock_timestamp()),
 'totalGrants',(select count(*) from private.tn_r4_prod_private_catalog_access),
 'drafts',(select count(*) from private.tn_r4_prod_private_catalog_drafts),
 'registrations',(select count(*) from private.tn_r4_prod_private_catalog_registrations),
 'tablesProtected',(select count(*)=4 and coalesce(bool_and(t.relkind='r' and t.relrowsecurity
    and not exists(select 1 from pg_policy p where p.polrelid=t.oid)
    and not exists(select 1 from r where has_table_privilege(r.name,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(r.name,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),false) from t),
 'apiProtected',(select count(*)=5 and coalesce(bool_and(prosecdef=(client or name like '%_manager(uuid)')
    and proconfig=array['search_path=pg_catalog']
    and has_function_privilege('authenticated',oid,'EXECUTE')=client
    and not has_function_privilege('anon',oid,'EXECUTE') and not has_function_privilege('service_role',oid,'EXECUTE')
    and not exists(select 1 from aclexplode(coalesce(proacl,acldefault('f',proowner))) x
      where x.grantee=0 and x.privilege_type='EXECUTE')),false) from f),
 'authRoleConstrained',(select count(*)=1 and coalesce(bool_and(not rolsuper and not rolbypassrls),false)
    from pg_roles where rolname='authenticated'),
 'legacyOff',(select count(*)=1 and coalesce(bool_and(not enabled),false) from private.tn_r4_product_draft_control)
    and (select count(*)=1 and coalesce(bool_and(not enabled),false) from private.tn_r4_internal_product_control),
 'legacyActiveScopes',(select count(*) from private.tn_r4_prod_internal_product_access where expires_at>clock_timestamp()),
 'pilotOff',not exists(select 1 from private.tn_r4_prod_pilot where enabled is distinct from false),
 'ownerDefinition',encode(sha256(convert_to(pg_get_functiondef('private.tn_r4_prod_selfserve_lock_owner(uuid)'::regprocedure),'UTF8')),'hex'),
 'functionDefinitions',(select jsonb_object_agg(name,encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')) from f)
) as receipt;
rollback;
