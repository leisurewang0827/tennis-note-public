-- Synthetic baseline function; permissions and tables are created only in the disposable test DB.
create function public.tn_r4_prod_selfserve_ops_options(branch uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare policy_revision bigint; policy_mode text;
begin
  perform private.tn_r4_prod_selfserve_lock_owner(branch);
  select p.revision,p.coach_single_add_mode into policy_revision,policy_mode
    from public.tn_schedule_v2_policies p where p.branch_id=branch;
  return jsonb_build_object(
    'branchId',branch,'revision',coalesce(policy_revision,0),'mode',coalesce(policy_mode,'approval'),
    'coaches',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.display_name) order by c.display_name,c.id)
      from public.tn_coach_roles c where c.branch_id=branch and c.status='approved'),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'sessions',p.total_sessions) order by p.name,p.id)
      from public.tn_membership_products p where p.branch_id=branch and p.is_active and p.product_kind='regular'),'[]'::jsonb)
  );
end $$;
