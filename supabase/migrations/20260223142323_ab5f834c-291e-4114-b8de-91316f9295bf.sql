
-- =============================================================
-- Table: project_economic_snapshots
-- =============================================================
CREATE TABLE public.project_economic_snapshots (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL,
  project_id    uuid        NOT NULL,
  snapshot_date  date        NOT NULL,
  risk_score     numeric     NOT NULL,
  economic_position text     NOT NULL,
  projected_margin  numeric  NOT NULL,
  realized_margin   numeric  NOT NULL,
  labor_burn_ratio  numeric  NOT NULL,
  contract_value    numeric  NULL,
  projected_revenue numeric  NULL,
  flags          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  flags_hash     text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_econ_snap_org_project_date UNIQUE (org_id, project_id, snapshot_date)
);

-- RLS
ALTER TABLE public.project_economic_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_economic_snapshots FORCE ROW LEVEL SECURITY;

-- SELECT: authenticated members of org_id
CREATE POLICY "Members can view economic snapshots"
  ON public.project_economic_snapshots
  FOR SELECT
  TO authenticated
  USING ( public.rpc_is_org_member(org_id) );

-- Deny direct writes for authenticated role
CREATE POLICY "Deny direct insert"
  ON public.project_economic_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK ( false );

CREATE POLICY "Deny direct update"
  ON public.project_economic_snapshots
  FOR UPDATE
  TO authenticated
  USING ( false );

CREATE POLICY "Deny direct delete"
  ON public.project_economic_snapshots
  FOR DELETE
  TO authenticated
  USING ( false );

-- =============================================================
-- RPC: rpc_capture_project_economic_snapshot
-- =============================================================
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
  -- 1) Resolve org_id
  SELECT p.organization_id INTO STRICT v_org_id
    FROM projects p
   WHERE p.id = p_project_id
     AND p.is_deleted = false;

  -- 2) Call margin control engine
  v_mc := public.rpc_generate_project_margin_control(p_project_id);

  -- 3) Extract fields
  v_risk_score      := COALESCE((v_mc->>'risk_score')::numeric, 0);
  v_economic_pos    := COALESCE(v_mc->>'economic_position', 'unknown');
  v_projected_margin := COALESCE((v_mc->>'projected_margin')::numeric, 0);
  v_realized_margin  := COALESCE((v_mc->>'realized_margin')::numeric, 0);
  v_labor_burn      := COALESCE((v_mc->>'labor_burn_ratio')::numeric, 0);
  v_contract_value  := (v_mc->>'contract_value')::numeric;
  v_projected_rev   := (v_mc->>'projected_revenue')::numeric;
  v_flags_raw       := COALESCE(v_mc->'intervention_flags', '[]'::jsonb);

  -- 4) Validate flags
  IF jsonb_typeof(v_flags_raw) <> 'array' THEN
    RAISE EXCEPTION 'intervention_flags is not a jsonb array'
      USING ERRCODE = '22023';
  END IF;

  -- Dedupe + sort lexicographically
  SELECT COALESCE(jsonb_agg(val ORDER BY val::text ASC), '[]'::jsonb)
    INTO v_flags
    FROM (SELECT DISTINCT val FROM jsonb_array_elements(v_flags_raw) AS val) sub;

  v_flags_hash := md5(v_flags::text);

  -- 5) Check existence for today (to determine inserted vs updated)
  SELECT EXISTS(
    SELECT 1 FROM project_economic_snapshots
     WHERE org_id = v_org_id
       AND project_id = p_project_id
       AND snapshot_date = v_snap_date
  ) INTO v_existed;

  -- Upsert
  INSERT INTO project_economic_snapshots (
    org_id, project_id, snapshot_date,
    risk_score, economic_position, projected_margin, realized_margin,
    labor_burn_ratio, contract_value, projected_revenue,
    flags, flags_hash
  ) VALUES (
    v_org_id, p_project_id, v_snap_date,
    v_risk_score, v_economic_pos, v_projected_margin, v_realized_margin,
    v_labor_burn, v_contract_value, v_projected_rev,
    v_flags, v_flags_hash
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
    flags_hash        = EXCLUDED.flags_hash
  WHERE
    project_economic_snapshots.flags_hash        IS DISTINCT FROM EXCLUDED.flags_hash
    OR project_economic_snapshots.risk_score     IS DISTINCT FROM EXCLUDED.risk_score
    OR project_economic_snapshots.projected_margin IS DISTINCT FROM EXCLUDED.projected_margin
    OR project_economic_snapshots.realized_margin  IS DISTINCT FROM EXCLUDED.realized_margin
    OR project_economic_snapshots.labor_burn_ratio IS DISTINCT FROM EXCLUDED.labor_burn_ratio
    OR project_economic_snapshots.economic_position IS DISTINCT FROM EXCLUDED.economic_position;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  -- 6) Return
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
