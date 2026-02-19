
-- View: v_ai_brain_build_status
CREATE OR REPLACE VIEW public.v_ai_brain_build_status AS
WITH view_checks AS (
  SELECT
    bool_and(EXISTS(
      SELECT 1 FROM information_schema.views v2
      WHERE v2.table_schema = 'public' AND v2.table_name = vn.name
    )) AS all_present
  FROM (VALUES
    ('v_project_economic_snapshot'),
    ('v_org_margin_performance'),
    ('v_project_labor_burn_index'),
    ('v_project_margin_projection')
  ) AS vn(name)
),
func_checks AS (
  SELECT
    bool_and(p.oid IS NOT NULL) AS all_present,
    bool_and(COALESCE(p.prosecdef, false)) AS all_secdef,
    bool_and(p.proconfig IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(p.proconfig) c WHERE c ILIKE 'search_path=%public%'
    )) AS all_pinned
  FROM (VALUES
    ('rpc_generate_project_margin_control'),
    ('rpc_get_operating_system_score'),
    ('rpc_get_executive_dashboard')
  ) AS fn(name)
  LEFT JOIN pg_proc p ON p.proname = fn.name
    AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
)
SELECT
  vc.all_present AS views_present,
  fc.all_present AS functions_present,
  fc.all_secdef AS functions_security_definer,
  fc.all_pinned AS functions_search_path_pinned
FROM view_checks vc, func_checks fc;

-- Function: rpc_ai_brain_perf_sanity
CREATE OR REPLACE FUNCTION public.rpc_ai_brain_perf_sanity(p_project_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan1 jsonb;
  v_plan2 jsonb;
  v_snap_seq boolean := false;
  v_org_seq boolean := false;
  v_notes jsonb := '[]'::jsonb;
  v_node jsonb;
  v_table text;
  v_hot_tables text[] := ARRAY['time_entries','estimate_line_items','change_order_line_items'];
BEGIN
  -- Validate caller
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Plan 1: v_project_economic_snapshot
  BEGIN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT * FROM v_project_economic_snapshot WHERE project_id = %L',
      p_project_id
    ) INTO v_plan1;
  EXCEPTION WHEN OTHERS THEN
    v_notes := v_notes || to_jsonb('snapshot_plan_error: ' || SQLERRM);
    v_plan1 := NULL;
  END;

  -- Plan 2: v_org_margin_performance
  BEGIN
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT * FROM v_org_margin_performance WHERE org_id = %L',
      p_org_id
    ) INTO v_plan2;
  EXCEPTION WHEN OTHERS THEN
    v_notes := v_notes || to_jsonb('org_plan_error: ' || SQLERRM);
    v_plan2 := NULL;
  END;

  -- Scan plan1 for seq scans on hot tables
  IF v_plan1 IS NOT NULL THEN
    FOR v_node IN
      SELECT value FROM jsonb_path_query(v_plan1, 'strict $.**.Plan') AS value
      UNION ALL
      SELECT value FROM jsonb_path_query(v_plan1, 'strict $[*].Plan') AS value
      UNION ALL
      SELECT value FROM jsonb_path_query(v_plan1, 'strict $.**.Plans[*]') AS value
    LOOP
      IF v_node->>'Node Type' = 'Seq Scan' THEN
        v_table := v_node->>'Relation Name';
        IF v_table = ANY(v_hot_tables) THEN
          v_snap_seq := true;
          v_notes := v_notes || to_jsonb('snapshot: Seq Scan on ' || v_table);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Scan plan2 for seq scans on hot tables
  IF v_plan2 IS NOT NULL THEN
    FOR v_node IN
      SELECT value FROM jsonb_path_query(v_plan2, 'strict $.**.Plan') AS value
      UNION ALL
      SELECT value FROM jsonb_path_query(v_plan2, 'strict $[*].Plan') AS value
      UNION ALL
      SELECT value FROM jsonb_path_query(v_plan2, 'strict $.**.Plans[*]') AS value
    LOOP
      IF v_node->>'Node Type' = 'Seq Scan' THEN
        v_table := v_node->>'Relation Name';
        IF v_table = ANY(v_hot_tables) THEN
          v_org_seq := true;
          v_notes := v_notes || to_jsonb('org: Seq Scan on ' || v_table);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'snapshot_plan_has_seq_scan', v_snap_seq,
    'org_plan_has_seq_scan', v_org_seq,
    'notes', v_notes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ai_brain_perf_sanity(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ai_brain_perf_sanity(uuid, uuid) TO authenticated;
