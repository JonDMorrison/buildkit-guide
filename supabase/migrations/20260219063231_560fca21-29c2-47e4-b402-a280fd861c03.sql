-- Harden rpc_generate_tasks_from_estimate to use ON CONFLICT for true idempotency
CREATE OR REPLACE FUNCTION public.rpc_generate_tasks_from_estimate(p_estimate_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_est record;
  v_created_scope int := 0;
  v_skipped int := 0;
  v_task_result jsonb;
BEGIN
  SELECT * INTO v_est FROM estimates WHERE id = p_estimate_id;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Estimate not found' USING ERRCODE = '42501'; END IF;
  IF NOT has_project_access(v_est.project_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Advisory lock per project to serialize concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('est_tasks_' || p_estimate_id::text));

  -- Idempotent scope item creation using ON CONFLICT on the unique partial index
  WITH to_insert AS (
    SELECT li.id as li_id, li.name, li.description, li.quantity, li.amount
    FROM estimate_line_items li
    WHERE li.estimate_id = p_estimate_id
      AND li.item_type = 'labor'
      AND TRIM(li.name) != ''
    ORDER BY li.sort_order
  ),
  inserted AS (
    INSERT INTO project_scope_items (
      project_id, organization_id, item_type, name, description,
      estimated_hours, estimated_cost, estimate_line_item_id, source_type
    )
    SELECT
      v_est.project_id, v_est.organization_id, 'labor', ti.name, ti.description,
      ti.quantity, ti.amount, ti.li_id, 'estimate'
    FROM to_insert ti
    ON CONFLICT (estimate_line_item_id) WHERE estimate_line_item_id IS NOT NULL DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_created_scope FROM inserted;

  -- Count skipped (already existed)
  SELECT count(*) INTO v_skipped
  FROM estimate_line_items li
  WHERE li.estimate_id = p_estimate_id
    AND li.item_type = 'labor'
    AND TRIM(li.name) != ''
    AND EXISTS (
      SELECT 1 FROM project_scope_items psi
      WHERE psi.estimate_line_item_id = li.id
    )
    AND NOT EXISTS (
      -- exclude newly created ones
      SELECT 1 FROM project_scope_items psi2
      WHERE psi2.estimate_line_item_id = li.id
        AND psi2.created_at > now() - interval '5 seconds'
    );

  -- Generate tasks from scope (also idempotent via ON CONFLICT)
  BEGIN
    v_task_result := generate_tasks_from_scope(
      p_project_id := v_est.project_id,
      p_mode := 'create_missing'
    );
  EXCEPTION WHEN OTHERS THEN
    v_task_result := '{}'::jsonb;
  END;

  RETURN json_build_object(
    'created_scope_items', v_created_scope,
    'skipped_existing', v_skipped,
    'tasks_created', COALESCE((v_task_result->>'created')::int, 0),
    'tasks_skipped', COALESCE((v_task_result->>'skipped')::int, 0),
    'estimate_id', p_estimate_id,
    'project_id', v_est.project_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_generate_tasks_from_estimate(uuid) TO authenticated;