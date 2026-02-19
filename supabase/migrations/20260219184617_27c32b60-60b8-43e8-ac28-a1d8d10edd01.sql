
DO $$
DECLARE
  v_result jsonb;
  v_deps   jsonb;
  v_surf   jsonb;
  v_flags  jsonb;
  v_det    jsonb;
BEGIN
  v_result := public.rpc_get_os_system_inventory();
  v_deps   := v_result -> 'executive_layer_dependencies';
  v_surf   := v_result -> 'executive_surface_summary';
  v_flags  := v_result -> 'flag_canonicalization_audit';
  v_det    := v_result -> 'aggregation_determinism_scan';

  RAISE NOTICE '=== INVENTORY VERSION: % ===', v_result ->> 'inventory_version';
  RAISE NOTICE 'executive_layer_dependencies: %', v_deps::text;
  RAISE NOTICE 'executive_surface_summary: %', v_surf::text;
  RAISE NOTICE 'flag_canonicalization_audit: %', v_flags::text;
  RAISE NOTICE 'aggregation_determinism_scan (violation_count=%): %',
    v_det ->> 'violation_count',
    v_det::text;
END;
$$;
