
-- =============================================================
-- HARDEN: Explicit SQLSTATE 42501 for access denials
-- Fail loudly with standard Postgres error codes, never silently.
-- =============================================================

-- 1) generate_tasks_from_scope — use SQLSTATE 42501 for auth failures
CREATE OR REPLACE FUNCTION public.generate_tasks_from_scope(p_project_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_location text;
  v_caller uuid := auth.uid();
  v_role text;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
BEGIN
  IF p_mode NOT IN ('create_missing', 'sync_existing') THEN
    RAISE EXCEPTION 'Invalid mode: %. Use create_missing or sync_existing', p_mode;
  END IF;

  SELECT organization_id, location INTO v_org_id, v_location
  FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  -- Cross-org protection: SQLSTATE 42501
  IF NOT is_org_member(v_caller, v_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  v_role := org_role_for_user(v_org_id, v_caller);
  IF v_role NOT IN ('admin', 'pm') THEN
    IF NOT has_any_project_role(v_caller, p_project_id, ARRAY['project_manager']::app_role[]) AND NOT is_admin(v_caller) THEN
      RAISE EXCEPTION 'forbidden: admin or PM role required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gen_tasks_' || p_project_id::text));

  IF p_mode = 'create_missing' THEN
    WITH to_insert AS (
      SELECT si.id as scope_id, si.name, si.description, si.planned_hours
      FROM project_scope_items si
      WHERE si.project_id = p_project_id
        AND si.item_type = 'labor'
        AND si.is_archived = false
        AND NOT EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.project_id = p_project_id AND t.scope_item_id = si.id
        )
    ),
    inserted AS (
      INSERT INTO tasks (project_id, title, description, planned_hours, location, is_generated, scope_item_id, created_by, status)
      SELECT p_project_id, ti.name, ti.description, ti.planned_hours, v_location, true, ti.scope_id, v_caller, 'not_started'
      FROM to_insert ti
      ON CONFLICT (project_id, scope_item_id) WHERE scope_item_id IS NOT NULL DO NOTHING
      RETURNING id
    )
    SELECT count(*) INTO v_created FROM inserted;

    SELECT count(*) INTO v_skipped
    FROM project_scope_items si
    WHERE si.project_id = p_project_id
      AND si.item_type = 'labor'
      AND si.is_archived = false
      AND EXISTS (
        SELECT 1 FROM tasks t WHERE t.project_id = p_project_id AND t.scope_item_id = si.id
      );

  ELSIF p_mode = 'sync_existing' THEN
    WITH synced AS (
      UPDATE tasks t
      SET title = si.name,
          description = si.description,
          planned_hours = si.planned_hours,
          updated_at = now()
      FROM project_scope_items si
      WHERE t.project_id = p_project_id
        AND t.is_generated = true
        AND t.scope_item_id = si.id
        AND si.item_type = 'labor'
        AND si.is_archived = false
        AND (t.title IS DISTINCT FROM si.name
          OR t.description IS DISTINCT FROM si.description
          OR t.planned_hours IS DISTINCT FROM si.planned_hours)
      RETURNING t.id
    )
    SELECT count(*) INTO v_updated FROM synced;

    SELECT count(*) INTO v_skipped
    FROM tasks t
    JOIN project_scope_items si ON si.id = t.scope_item_id
    WHERE t.project_id = p_project_id
      AND t.is_generated = true
      AND si.item_type = 'labor'
      AND si.is_archived = false
      AND t.title IS NOT DISTINCT FROM si.name
      AND t.description IS NOT DISTINCT FROM si.description
      AND t.planned_hours IS NOT DISTINCT FROM si.planned_hours;
  END IF;

  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
END;
$$;

COMMENT ON FUNCTION public.generate_tasks_from_scope(uuid, text) IS
  'Generates tasks from labor scope items. Raises SQLSTATE 42501 for cross-org access.';

-- 2) preview_tasks_from_scope — use SQLSTATE 42501
CREATE OR REPLACE FUNCTION public.preview_tasks_from_scope(p_project_id uuid, p_mode text)
RETURNS TABLE(scope_item_id uuid, scope_item_name text, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_caller uuid := auth.uid();
  v_role text;
BEGIN
  IF p_mode NOT IN ('create_missing', 'sync_existing') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;

  SELECT organization_id INTO v_org_id FROM projects WHERE id = p_project_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Project not found'; END IF;

  IF NOT is_org_member(v_caller, v_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  v_role := org_role_for_user(v_org_id, v_caller);
  IF v_role NOT IN ('admin', 'pm') THEN
    IF NOT has_any_project_role(v_caller, p_project_id, ARRAY['project_manager']::app_role[]) AND NOT is_admin(v_caller) THEN
      RAISE EXCEPTION 'forbidden: admin or PM role required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_mode = 'create_missing' THEN
    RETURN QUERY
    SELECT si.id, si.name,
      CASE
        WHEN EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p_project_id AND t.scope_item_id = si.id)
        THEN 'skip'::text
        ELSE 'create'::text
      END
    FROM project_scope_items si
    WHERE si.project_id = p_project_id AND si.item_type = 'labor' AND si.is_archived = false
    ORDER BY si.sort_order;

  ELSIF p_mode = 'sync_existing' THEN
    RETURN QUERY
    SELECT si.id, si.name,
      CASE
        WHEN t.id IS NULL THEN 'skip'::text
        WHEN t.title IS DISTINCT FROM si.name
          OR t.description IS DISTINCT FROM si.description
          OR t.planned_hours IS DISTINCT FROM si.planned_hours THEN 'update'::text
        ELSE 'skip'::text
      END
    FROM project_scope_items si
    LEFT JOIN tasks t ON t.scope_item_id = si.id AND t.project_id = p_project_id AND t.is_generated = true
    WHERE si.project_id = p_project_id AND si.item_type = 'labor' AND si.is_archived = false
    ORDER BY si.sort_order;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.preview_tasks_from_scope(uuid, text) IS
  'Dry-run preview. Raises SQLSTATE 42501 for cross-org access.';

-- 3) assign_time_entry_task — use SQLSTATE 42501 and explicit cross-project error
CREATE OR REPLACE FUNCTION public.assign_time_entry_task(p_time_entry_id uuid, p_task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_project_id uuid;
  v_entry_org_id uuid;
  v_task_project_id uuid;
  v_caller_role text;
BEGIN
  SELECT te.project_id, p.organization_id
  INTO v_entry_project_id, v_entry_org_id
  FROM public.time_entries te
  JOIN public.projects p ON p.id = te.project_id
  WHERE te.id = p_time_entry_id;

  IF v_entry_project_id IS NULL THEN
    RAISE EXCEPTION 'Time entry not found: %', p_time_entry_id;
  END IF;

  IF NOT public.has_org_membership(v_entry_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  v_caller_role := public.org_role(v_entry_org_id);
  IF v_caller_role NOT IN ('admin', 'owner') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = v_entry_project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('admin', 'project_manager')
    ) THEN
      RAISE EXCEPTION 'forbidden: admin or project manager role required'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT t.project_id INTO v_task_project_id
  FROM public.tasks t WHERE t.id = p_task_id;

  IF v_task_project_id IS NULL THEN
    RAISE EXCEPTION 'Task not found: %', p_task_id;
  END IF;

  -- Cross-project protection: fail loudly
  IF v_task_project_id != v_entry_project_id THEN
    RAISE EXCEPTION 'forbidden: task project_id (%) does not match time entry project_id (%)', v_task_project_id, v_entry_project_id
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.time_entries
  SET task_id = p_task_id
  WHERE id = p_time_entry_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.assign_time_entry_task(uuid, uuid) IS
  'Assigns task to time entry. Raises SQLSTATE 42501 for cross-org or cross-project violations.';

-- 4) Harden project_actual_costs — already has org check, add SQLSTATE
CREATE OR REPLACE FUNCTION public.project_actual_costs(p_project_id uuid)
RETURNS TABLE (
  actual_labor_hours numeric,
  actual_labor_cost numeric,
  actual_material_cost numeric,
  actual_machine_cost numeric,
  actual_other_cost numeric,
  actual_total_cost numeric,
  labor_hours_missing_cost_rate numeric,
  labor_hours_missing_membership numeric,
  labor_entry_count_missing_cost_rate int,
  labor_entry_count_missing_membership int,
  actual_unclassified_cost numeric,
  unclassified_receipt_count int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
  v_labor_hours numeric := 0;
  v_labor_cost numeric := 0;
  v_material numeric := 0;
  v_machine numeric := 0;
  v_other numeric := 0;
  v_hrs_no_rate numeric := 0;
  v_hrs_no_member numeric := 0;
  v_cnt_no_rate int := 0;
  v_cnt_no_member int := 0;
  v_unclassified numeric := 0;
  v_unclassified_cnt int := 0;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  -- Time Entry Inclusion Contract
  SELECT
    COALESCE(SUM(te.duration_hours), 0),
    COALESCE(SUM(te.duration_hours * COALESCE(pm.cost_rate, 0)), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NOT NULL AND COALESCE(pm.cost_rate, 0) = 0 THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL THEN te.duration_hours ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pm.user_id IS NOT NULL AND COALESCE(pm.cost_rate, 0) = 0 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN pm.user_id IS NULL THEN 1 ELSE 0 END), 0)::int
  INTO v_labor_hours, v_labor_cost, v_hrs_no_rate, v_hrs_no_member, v_cnt_no_rate, v_cnt_no_member
  FROM public.time_entries te
  LEFT JOIN public.project_members pm ON pm.project_id = te.project_id AND pm.user_id = te.user_id
  WHERE te.project_id = p_project_id
    AND te.status = 'closed'
    AND te.check_out_at IS NOT NULL
    AND te.duration_hours IS NOT NULL
    AND te.duration_hours > 0;

  SELECT
    COALESCE(SUM(CASE WHEN r.cost_type = 'material' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'machine' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type = 'other' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.cost_type NOT IN ('material','machine','other') OR r.cost_type IS NULL THEN 1 ELSE 0 END), 0)::int
  INTO v_material, v_machine, v_other, v_unclassified, v_unclassified_cnt
  FROM public.receipts r
  WHERE r.project_id = p_project_id
    AND r.review_status IN ('reviewed', 'processed');

  RETURN QUERY SELECT
    round(v_labor_hours, 2), round(v_labor_cost, 2),
    round(v_material, 2), round(v_machine, 2), round(v_other, 2),
    round(v_labor_cost + v_material + v_machine + v_other + v_unclassified, 2),
    round(v_hrs_no_rate, 2), round(v_hrs_no_member, 2),
    v_cnt_no_rate, v_cnt_no_member,
    round(v_unclassified, 2), v_unclassified_cnt;
END;
$$;

COMMENT ON FUNCTION public.project_actual_costs(uuid) IS
  'Actual costs with full Inclusion Contract + review_status filter. SQLSTATE 42501 for cross-org.';

-- 5) Harden project_task_actual_hours — add SQLSTATE
CREATE OR REPLACE FUNCTION public.project_task_actual_hours(p_project_id uuid)
RETURNS TABLE(task_id uuid, actual_hours numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT p.organization_id INTO v_org_id
  FROM public.projects p WHERE p.id = p_project_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found: %', p_project_id;
  END IF;
  IF NOT public.has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this organization'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT te.task_id, round(COALESCE(SUM(te.duration_hours), 0), 2)
    FROM public.time_entries te
    WHERE te.project_id = p_project_id
      AND te.status = 'closed'
      AND te.check_out_at IS NOT NULL
      AND te.duration_hours IS NOT NULL
      AND te.duration_hours > 0
      AND te.task_id IS NOT NULL
    GROUP BY te.task_id;
END;
$$;

COMMENT ON FUNCTION public.project_task_actual_hours(uuid) IS
  'Task hours with Inclusion Contract. SQLSTATE 42501 for cross-org.';
