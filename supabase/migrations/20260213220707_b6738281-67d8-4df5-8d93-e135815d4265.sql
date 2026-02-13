
-- 1) Add soft-delete columns to project_scope_items
ALTER TABLE public.project_scope_items
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) Trigger to block hard DELETE when linked tasks exist
CREATE OR REPLACE FUNCTION public.trg_prevent_scope_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE scope_item_id = OLD.id
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'Cannot delete scope item "%" because it has linked tasks. Archive it instead.', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_scope_item_delete ON public.project_scope_items;
CREATE TRIGGER trg_prevent_scope_item_delete
  BEFORE DELETE ON public.project_scope_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_prevent_scope_item_delete();

-- 3) Update generate_tasks_from_scope to exclude archived
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

  IF NOT is_org_member(v_caller, v_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_role := org_role_for_user(v_org_id, v_caller);
  IF v_role NOT IN ('admin', 'pm') THEN
    IF NOT has_any_project_role(v_caller, p_project_id, ARRAY['project_manager']::app_role[]) AND NOT is_admin(v_caller) THEN
      RAISE EXCEPTION 'Insufficient permissions. Admin or PM role required.';
    END IF;
  END IF;

  IF p_mode = 'create_missing' THEN
    WITH to_insert AS (
      SELECT si.id as scope_id, si.name, si.description, si.planned_hours
      FROM project_scope_items si
      WHERE si.project_id = p_project_id
        AND si.item_type = 'task'
        AND si.is_archived = false
        AND NOT EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.project_id = p_project_id AND t.scope_item_id = si.id
        )
    ),
    inserted AS (
      INSERT INTO tasks (project_id, title, description, planned_hours, estimated_hours, location, is_generated, scope_item_id, created_by, status)
      SELECT p_project_id, ti.name, ti.description, ti.planned_hours, ti.planned_hours, v_location, true, ti.scope_id, v_caller, 'not_started'
      FROM to_insert ti
      ON CONFLICT (project_id, scope_item_id) WHERE scope_item_id IS NOT NULL DO NOTHING
      RETURNING id
    )
    SELECT count(*) INTO v_created FROM inserted;

    SELECT count(*) INTO v_skipped
    FROM project_scope_items si
    WHERE si.project_id = p_project_id
      AND si.item_type = 'task'
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
          estimated_hours = si.planned_hours,
          updated_at = now()
      FROM project_scope_items si
      WHERE t.project_id = p_project_id
        AND t.is_generated = true
        AND t.scope_item_id = si.id
        AND si.item_type = 'task'
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
      AND si.item_type = 'task'
      AND si.is_archived = false
      AND t.title IS NOT DISTINCT FROM si.name
      AND t.description IS NOT DISTINCT FROM si.description
      AND t.planned_hours IS NOT DISTINCT FROM si.planned_hours;
  END IF;

  RETURN jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
END;
$$;

-- 4) Update preview_tasks_from_scope to exclude archived
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
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  v_role := org_role_for_user(v_org_id, v_caller);
  IF v_role NOT IN ('admin', 'pm') THEN
    IF NOT has_any_project_role(v_caller, p_project_id, ARRAY['project_manager']::app_role[]) AND NOT is_admin(v_caller) THEN
      RAISE EXCEPTION 'Insufficient permissions';
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
    WHERE si.project_id = p_project_id AND si.item_type = 'task' AND si.is_archived = false
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
    WHERE si.project_id = p_project_id AND si.item_type = 'task' AND si.is_archived = false
    ORDER BY si.sort_order;
  END IF;
END;
$$;

-- Index for archive filtering
CREATE INDEX IF NOT EXISTS idx_scope_items_archived ON public.project_scope_items (project_id, is_archived);
