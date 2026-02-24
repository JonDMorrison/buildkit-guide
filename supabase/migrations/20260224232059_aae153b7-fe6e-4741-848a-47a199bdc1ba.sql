
CREATE OR REPLACE FUNCTION public.rpc_backfill_project_snapshots(
  p_org_id uuid,
  p_days   int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_proj           record;
  v_snap_date      date;
  v_mc             jsonb;
  v_risk_score     numeric;
  v_economic_pos   text;
  v_proj_margin    numeric;
  v_real_margin    numeric;
  v_labor_burn     numeric;
  v_contract_val   numeric;
  v_proj_rev       numeric;
  v_flags_raw      jsonb;
  v_flags          jsonb;
  v_flags_hash     text;
  v_projects_count int := 0;
  v_snaps_created  int := 0;
  v_day_offset     int;
  v_already_exists boolean;
BEGIN
  -- Clamp p_days to [1, 365]
  IF p_days < 1 THEN p_days := 1; END IF;
  IF p_days > 365 THEN p_days := 365; END IF;

  -- Loop active projects in deterministic order
  FOR v_proj IN
    SELECT p.id AS project_id
      FROM projects p
     WHERE p.organization_id = p_org_id
       AND p.is_deleted = false
       AND p.status <> 'archived'
     ORDER BY p.id ASC
  LOOP
    v_projects_count := v_projects_count + 1;

    -- Compute margin control ONCE per project (current state)
    v_mc := public.rpc_generate_project_margin_control(v_proj.project_id);

    -- Extract fields once
    v_risk_score   := COALESCE((v_mc->>'risk_score')::numeric, 0);
    v_economic_pos := COALESCE(v_mc->>'economic_position', 'unknown');
    v_proj_margin  := COALESCE((v_mc->>'projected_margin')::numeric, 0);
    v_real_margin  := COALESCE((v_mc->>'realized_margin')::numeric, 0);
    v_labor_burn   := COALESCE((v_mc->>'labor_burn_ratio')::numeric, 0);
    v_contract_val := (v_mc->>'contract_value')::numeric;
    v_proj_rev     := (v_mc->>'projected_revenue')::numeric;
    v_flags_raw    := COALESCE(v_mc->'intervention_flags', '[]'::jsonb);

    -- Dedupe + sort flags lexicographically
    IF jsonb_typeof(v_flags_raw) = 'array' THEN
      SELECT COALESCE(jsonb_agg(val ORDER BY val::text ASC), '[]'::jsonb)
        INTO v_flags
        FROM (SELECT DISTINCT val FROM jsonb_array_elements(v_flags_raw) AS val) sub;
    ELSE
      v_flags := '[]'::jsonb;
    END IF;

    v_flags_hash := md5(v_flags::text);

    -- Loop days in deterministic order (oldest first)
    FOR v_day_offset IN REVERSE (p_days - 1)..0
    LOOP
      v_snap_date := CURRENT_DATE - v_day_offset;

      -- Skip if snapshot already exists (no overwrite)
      SELECT EXISTS(
        SELECT 1 FROM project_economic_snapshots
         WHERE org_id       = p_org_id
           AND project_id   = v_proj.project_id
           AND snapshot_date = v_snap_date
      ) INTO v_already_exists;

      IF v_already_exists THEN
        CONTINUE;
      END IF;

      INSERT INTO project_economic_snapshots (
        org_id, project_id, snapshot_date,
        risk_score, economic_position, projected_margin, realized_margin,
        labor_burn_ratio, contract_value, projected_revenue,
        flags, flags_hash
      ) VALUES (
        p_org_id, v_proj.project_id, v_snap_date,
        v_risk_score, v_economic_pos, v_proj_margin, v_real_margin,
        v_labor_burn, v_contract_val, v_proj_rev,
        v_flags, v_flags_hash
      );

      v_snaps_created := v_snaps_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'success',             true,
    'projects_processed',  v_projects_count,
    'snapshots_created',   v_snaps_created
  );
END;
$function$;
