
-- 1) Add provenance column
ALTER TABLE public.project_economic_snapshots
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'capture';

-- Constrain allowed values via a check constraint
ALTER TABLE public.project_economic_snapshots
  ADD CONSTRAINT chk_snapshot_source CHECK (source IN ('capture', 'backfill'));

-- 2) Patch rpc_capture_project_economic_snapshot → source='capture'
CREATE OR REPLACE FUNCTION public.rpc_capture_project_economic_snapshot(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id          uuid;
  v_mc              jsonb;
  v_risk_score      numeric;
  v_economic_pos    text;
  v_projected_margin numeric;
  v_realized_margin  numeric;
  v_labor_burn      numeric;
  v_contract_value  numeric;
  v_projected_rev   numeric;
  v_flags_raw       jsonb;
  v_flags           jsonb;
  v_flags_hash      text;
  v_snap_date       date := CURRENT_DATE;
  v_existed         boolean;
  v_row_count       integer;
BEGIN
  SELECT p.organization_id INTO STRICT v_org_id
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  v_mc := public.rpc_generate_project_margin_control(p_project_id);

  v_risk_score      := COALESCE((v_mc->>'risk_score')::numeric, 0);
  v_economic_pos    := COALESCE(v_mc->>'economic_position', 'unknown');
  v_projected_margin := COALESCE((v_mc->>'projected_margin')::numeric, 0);
  v_realized_margin  := COALESCE((v_mc->>'realized_margin')::numeric, 0);
  v_labor_burn      := COALESCE((v_mc->>'labor_burn_ratio')::numeric, 0);
  v_contract_value  := (v_mc->>'contract_value')::numeric;
  v_projected_rev   := (v_mc->>'projected_revenue')::numeric;
  v_flags_raw       := COALESCE(v_mc->'intervention_flags', '[]'::jsonb);

  IF jsonb_typeof(v_flags_raw) <> 'array' THEN
    RAISE EXCEPTION 'intervention_flags is not a jsonb array'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(val ORDER BY val::text ASC), '[]'::jsonb)
    INTO v_flags
    FROM (SELECT DISTINCT val FROM jsonb_array_elements(v_flags_raw) AS val) sub;

  v_flags_hash := md5(v_flags::text);

  SELECT EXISTS(
    SELECT 1 FROM project_economic_snapshots
     WHERE org_id = v_org_id
       AND project_id = p_project_id
       AND snapshot_date = v_snap_date
  ) INTO v_existed;

  INSERT INTO project_economic_snapshots (
    org_id, project_id, snapshot_date,
    risk_score, economic_position, projected_margin, realized_margin,
    labor_burn_ratio, contract_value, projected_revenue,
    flags, flags_hash, source
  ) VALUES (
    v_org_id, p_project_id, v_snap_date,
    v_risk_score, v_economic_pos, v_projected_margin, v_realized_margin,
    v_labor_burn, v_contract_value, v_projected_rev,
    v_flags, v_flags_hash, 'capture'
  )
  ON CONFLICT (org_id, project_id, snapshot_date)
  DO UPDATE SET
    risk_score        = EXCLUDED.risk_score,
    economic_position = EXCLUDED.economic_position,
    projected_margin  = EXCLUDED.projected_margin,
    realized_margin   = EXCLUDED.realized_margin,
    labor_burn_ratio  = EXCLUDED.labor_burn_ratio,
    contract_value    = EXCLUDED.contract_value,
    projected_revenue = EXCLUDED.projected_revenue,
    flags             = EXCLUDED.flags,
    flags_hash        = EXCLUDED.flags_hash,
    source            = EXCLUDED.source
  WHERE
    project_economic_snapshots.flags_hash        IS DISTINCT FROM EXCLUDED.flags_hash
    OR project_economic_snapshots.risk_score     IS DISTINCT FROM EXCLUDED.risk_score
    OR project_economic_snapshots.projected_margin IS DISTINCT FROM EXCLUDED.projected_margin
    OR project_economic_snapshots.realized_margin  IS DISTINCT FROM EXCLUDED.realized_margin
    OR project_economic_snapshots.labor_burn_ratio IS DISTINCT FROM EXCLUDED.labor_burn_ratio
    OR project_economic_snapshots.economic_position IS DISTINCT FROM EXCLUDED.economic_position;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',       true,
    'org_id',        v_org_id,
    'project_id',    p_project_id,
    'snapshot_date',  v_snap_date,
    'inserted',      (NOT v_existed AND v_row_count > 0),
    'updated',       (v_existed AND v_row_count > 0),
    'flags_hash',    v_flags_hash
  );
END;
$$;

-- 3) Patch rpc_backfill_project_snapshots → source='backfill'
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
  IF p_days < 1 THEN p_days := 1; END IF;
  IF p_days > 365 THEN p_days := 365; END IF;

  FOR v_proj IN
    SELECT p.id AS project_id
      FROM projects p
     WHERE p.organization_id = p_org_id
       AND p.is_deleted = false
       AND p.status <> 'archived'
     ORDER BY p.id ASC
  LOOP
    v_projects_count := v_projects_count + 1;

    v_mc := public.rpc_generate_project_margin_control(v_proj.project_id);

    v_risk_score   := COALESCE((v_mc->>'risk_score')::numeric, 0);
    v_economic_pos := COALESCE(v_mc->>'economic_position', 'unknown');
    v_proj_margin  := COALESCE((v_mc->>'projected_margin')::numeric, 0);
    v_real_margin  := COALESCE((v_mc->>'realized_margin')::numeric, 0);
    v_labor_burn   := COALESCE((v_mc->>'labor_burn_ratio')::numeric, 0);
    v_contract_val := (v_mc->>'contract_value')::numeric;
    v_proj_rev     := (v_mc->>'projected_revenue')::numeric;
    v_flags_raw    := COALESCE(v_mc->'intervention_flags', '[]'::jsonb);

    IF jsonb_typeof(v_flags_raw) = 'array' THEN
      SELECT COALESCE(jsonb_agg(val ORDER BY val::text ASC), '[]'::jsonb)
        INTO v_flags
        FROM (SELECT DISTINCT val FROM jsonb_array_elements(v_flags_raw) AS val) sub;
    ELSE
      v_flags := '[]'::jsonb;
    END IF;

    v_flags_hash := md5(v_flags::text);

    FOR v_day_offset IN REVERSE (p_days - 1)..0
    LOOP
      v_snap_date := CURRENT_DATE - v_day_offset;

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
        flags, flags_hash, source
      ) VALUES (
        p_org_id, v_proj.project_id, v_snap_date,
        v_risk_score, v_economic_pos, v_proj_margin, v_real_margin,
        v_labor_burn, v_contract_val, v_proj_rev,
        v_flags, v_flags_hash, 'backfill'
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

-- 4) Patch rpc_get_project_volatility_index → filter by source, add p_include_backfill
CREATE OR REPLACE FUNCTION public.rpc_get_project_volatility_index(
  p_org_id uuid,
  p_days int DEFAULT 30,
  p_include_backfill boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of organization %', p_org_id
      USING ERRCODE = '42501';
  END IF;

  WITH windowed AS (
    SELECT
      s.project_id,
      s.snapshot_date,
      s.risk_score,
      s.projected_margin,
      s.realized_margin,
      s.flags_hash,
      LAG(s.flags_hash) OVER (
        PARTITION BY s.project_id ORDER BY s.snapshot_date ASC, s.id ASC
      ) AS prev_flags_hash
    FROM project_economic_snapshots s
    WHERE s.org_id = p_org_id
      AND s.snapshot_date >= (CURRENT_DATE - p_days)
      AND (p_include_backfill OR s.source = 'capture')
  ),
  agg AS (
    SELECT
      w.project_id,
      COUNT(*)::int                                     AS n_snapshots,
      MIN(w.risk_score)                                 AS risk_min,
      MAX(w.risk_score)                                 AS risk_max,
      MAX(w.risk_score) - MIN(w.risk_score)             AS risk_delta,
      MIN(w.projected_margin)                           AS proj_margin_min,
      MAX(w.projected_margin)                           AS proj_margin_max,
      MAX(w.projected_margin) - MIN(w.projected_margin) AS proj_margin_delta,
      MIN(w.realized_margin)                            AS real_margin_min,
      MAX(w.realized_margin)                            AS real_margin_max,
      MAX(w.realized_margin) - MIN(w.realized_margin)   AS real_margin_delta,
      COUNT(*) FILTER (
        WHERE w.prev_flags_hash IS NOT NULL
          AND w.flags_hash IS DISTINCT FROM w.prev_flags_hash
      )::int                                            AS flags_changes_count,
      MAX(w.snapshot_date)                              AS latest_snapshot_date
    FROM windowed w
    GROUP BY w.project_id
  ),
  latest AS (
    SELECT DISTINCT ON (w.project_id)
      w.project_id,
      w.risk_score        AS latest_risk_score,
      w.projected_margin  AS latest_projected_margin,
      w.realized_margin   AS latest_realized_margin
    FROM windowed w
    ORDER BY w.project_id ASC, w.snapshot_date DESC
  ),
  scored AS (
    SELECT
      a.project_id,
      a.n_snapshots,
      a.risk_delta,
      a.proj_margin_delta   AS projected_margin_delta,
      a.real_margin_delta   AS realized_margin_delta,
      a.flags_changes_count,
      a.latest_snapshot_date,
      l.latest_risk_score,
      l.latest_projected_margin,
      l.latest_realized_margin,
      CASE WHEN a.n_snapshots < 2 THEN 0
      ELSE ROUND(
        LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
        + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
        + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
        + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
      , 2) END AS volatility_score,
      CASE
        WHEN a.n_snapshots < 2 THEN 'insufficient_data'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 75 THEN 'critical'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 50 THEN 'volatile'
        WHEN ROUND(
          LEAST(1, GREATEST(0, a.risk_delta / 100.0)) * 40
          + LEAST(1, GREATEST(0, a.proj_margin_delta)) * 30
          + LEAST(1, GREATEST(0, a.real_margin_delta)) * 20
          + LEAST(1, GREATEST(0, a.flags_changes_count::numeric / GREATEST(a.n_snapshots - 1, 1))) * 10
        , 2) >= 20 THEN 'watch'
        ELSE 'stable'
      END AS volatility_label
    FROM agg a
    JOIN latest l ON l.project_id = a.project_id
  )
  SELECT jsonb_build_object(
    'success',       true,
    'org_id',        p_org_id,
    'window_days',   p_days,
    'include_backfill', p_include_backfill,
    'as_of',         CURRENT_DATE,
    'project_count', COALESCE((SELECT COUNT(*)::int FROM scored), 0),
    'projects',      COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'project_id',              sc.project_id,
          'n_snapshots',             sc.n_snapshots,
          'volatility_score',        sc.volatility_score,
          'volatility_label',        sc.volatility_label,
          'risk_delta',              sc.risk_delta,
          'projected_margin_delta',  sc.projected_margin_delta,
          'realized_margin_delta',   sc.realized_margin_delta,
          'flags_changes_count',     sc.flags_changes_count,
          'latest_snapshot_date',    sc.latest_snapshot_date,
          'latest_risk_score',       sc.latest_risk_score,
          'latest_projected_margin', sc.latest_projected_margin,
          'latest_realized_margin',  sc.latest_realized_margin
        )
        ORDER BY sc.volatility_score DESC, sc.latest_snapshot_date DESC, sc.project_id ASC
      ) FROM scored sc),
      '[]'::jsonb
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
