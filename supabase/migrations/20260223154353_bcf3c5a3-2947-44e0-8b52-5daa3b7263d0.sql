
-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH A+B: rpc_capture_org_economic_snapshots
--   A) Early-exit with p_force param; already_captured_today + skipped keys
--   B) Use public.is_project_active(is_deleted, status) scalar predicate
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rpc_capture_org_economic_snapshots(
  p_org_id uuid,
  p_force  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project          record;
  v_result           jsonb;
  v_results          jsonb := '[]'::jsonb;
  v_snap_date        date  := CURRENT_DATE;
  v_inserted         int   := 0;
  v_updated          int   := 0;
  v_total            int   := 0;
  v_any_fail         boolean := false;
  v_sqlstate          text;
  v_msg              text;
  v_existing_today   int   := 0;
  v_already_captured boolean := false;
BEGIN
  -- 1) Membership guard
  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of organization %', p_org_id
      USING ERRCODE = '42501';
  END IF;

  -- 2) Check if snapshots already exist today for this org
  SELECT COUNT(*)
    INTO v_existing_today
    FROM public.project_economic_snapshots s
   WHERE s.org_id = p_org_id
     AND s.snapshot_date = v_snap_date;

  v_already_captured := (v_existing_today > 0);

  -- 3) Early-exit if already captured and not forced
  IF v_already_captured AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success',               true,
      'org_id',                p_org_id,
      'snapshot_date',         v_snap_date,
      'project_count',         0,
      'inserted_count',        0,
      'updated_count',         0,
      'selection_mode',        'active',
      'skipped',               true,
      'already_captured_today', true,
      'results',               '[]'::jsonb
    );
  END IF;

  -- 4) Iterate active projects deterministically using scalar predicate
  FOR v_project IN
    SELECT p.id AS project_id
      FROM public.projects p
     WHERE p.organization_id = p_org_id
       AND public.is_project_active(p.is_deleted, p.status)
     ORDER BY p.id ASC
  LOOP
    v_total := v_total + 1;

    BEGIN
      v_result := public.rpc_capture_project_economic_snapshot(v_project.project_id);

      IF (v_result->>'inserted')::boolean THEN
        v_inserted := v_inserted + 1;
      END IF;
      IF (v_result->>'updated')::boolean THEN
        v_updated := v_updated + 1;
      END IF;

      v_results := v_results || jsonb_build_object(
        'project_id',  v_project.project_id,
        'success',     true,
        'inserted',    (v_result->>'inserted')::boolean,
        'updated',     (v_result->>'updated')::boolean,
        'flags_hash',  v_result->>'flags_hash'
      );

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_sqlstate = RETURNED_SQLSTATE,
        v_msg      = MESSAGE_TEXT;

      v_any_fail := true;

      v_results := v_results || jsonb_build_object(
        'project_id',   v_project.project_id,
        'success',      false,
        'sqlstate',     v_sqlstate,
        'message_text', v_msg
      );
    END;
  END LOOP;

  -- 5) Return
  RETURN jsonb_build_object(
    'success',                NOT v_any_fail,
    'org_id',                 p_org_id,
    'snapshot_date',          v_snap_date,
    'project_count',          v_total,
    'inserted_count',         v_inserted,
    'updated_count',          v_updated,
    'selection_mode',         'active',
    'skipped',                false,
    'already_captured_today', v_already_captured,
    'results',                v_results
  );
END;
$$;
