
-- Ephemeral probe: write result into a temp table then select it back
-- This runs at migration time under service role, so we can call the function.

CREATE TEMP TABLE _inv_probe AS
SELECT
  (public.rpc_get_os_system_inventory()) AS result;

-- Now expose it as notices via a plpgsql block so we can see the data
DO $$
DECLARE
  r record;
  v jsonb;
BEGIN
  SELECT result INTO v FROM _inv_probe;
  RAISE NOTICE 'VERSION: %', v ->> 'inventory_version';
  RAISE NOTICE 'DEPS: %',    (v -> 'executive_layer_dependencies')::text;
  RAISE NOTICE 'SURFACE: %', (v -> 'executive_surface_summary')::text;
  RAISE NOTICE 'FLAGS: %',   (v -> 'flag_canonicalization_audit')::text;
  RAISE NOTICE 'DET_COUNT: %', (v -> 'aggregation_determinism_scan' ->> 'violation_count');
  RAISE NOTICE 'DET_FUNCS: %', (v -> 'aggregation_determinism_scan' -> 'suspect_functions')::text;
END;
$$;

DROP TABLE IF EXISTS _inv_probe;
