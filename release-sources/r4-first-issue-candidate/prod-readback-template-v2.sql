begin read only;
set local search_path=pg_catalog;
set local statement_timeout='10s';
do $external$ begin raise exception 'r4_external_authority_unbound'; end $external$;
select jsonb_build_object('controlOff',(select count(*)=1 from private.tn_r4_first_issue_control where singleton and not enabled),
  'activeScopeCount',(select count(*) from private.tn_r4_first_issue_scope where enabled),
  'backupPresent',(select count(*)=1 from private.tn_r4_first_issue_ops_backup where singleton and pre_sha='f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f' and post_sha='15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286'),
  'currentOptionsSha',encode(sha256(convert_to(pg_get_functiondef('public.tn_r4_prod_selfserve_ops_options(uuid)'::regprocedure),'UTF8')),'hex'),'expectedPreSha','f5a532f62d2c1287108445e45cd8a16f3d4caf7f100cb535bcd6ea88ef6f827f','expectedPostSha','15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286') as receipt;
rollback;
