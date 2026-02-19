
-- ============================================================
-- PLAYBOOK INSTANTIATION ENGINE
-- Baseline fields, project metadata, enhanced apply RPC
-- ============================================================

-- 1. Add baseline fields to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_playbook_id uuid REFERENCES public.playbooks(id),
  ADD COLUMN IF NOT EXISTS source_playbook_version integer,
  ADD COLUMN IF NOT EXISTS baseline_low_hours numeric,
  ADD COLUMN IF NOT EXISTS baseline_high_hours numeric,
  ADD COLUMN IF NOT EXISTS baseline_role_type text,
  ADD COLUMN IF NOT EXISTS baseline_density_weight integer,
  ADD COLUMN IF NOT EXISTS playbook_required boolean,
  ADD COLUMN IF NOT EXISTS playbook_collapsed boolean NOT NULL DEFAULT false;

-- 2. Add playbook metadata to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS applied_playbook_id uuid REFERENCES public.playbooks(id),
  ADD COLUMN IF NOT EXISTS applied_playbook_version integer,
  ADD COLUMN IF NOT EXISTS total_expected_hours_low numeric,
  ADD COLUMN IF NOT EXISTS total_expected_hours_high numeric,
  ADD COLUMN IF NOT EXISTS playbook_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS playbook_applied_by uuid;

-- 3. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_tasks_source_playbook ON public.tasks(source_playbook_id)
  WHERE source_playbook_id IS NOT NULL;

-- 4. Replace rpc_apply_playbook_to_project with full instantiation engine
CREATE OR REPLACE FUNCTION public.rpc_apply_playbook_to_project(
  p_playbook_id uuid,
  p_project_id uuid,
  p_force_reapply boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_proj_org uuid;
  v_pb record;
  v_phase record;
  v_task record;
  v_new_task_id uuid;
  v_tasks_created integer := 0;
  v_tasks_collapsed integer := 0;
  v_total_low numeric := 0;
  v_total_high numeric := 0;
  v_total_task_count integer := 0;
  v_density_exceeded boolean := false;
  v_existing_playbook uuid;
BEGIN
  -- Validate playbook
  SELECT * INTO v_pb FROM playbooks WHERE id = p_playbook_id AND is_archived = false;
  IF v_pb.id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found or archived' USING ERRCODE = '42501';
  END IF;
  v_org_id := v_pb.organization_id;

  -- Validate project in same org
  SELECT organization_id, applied_playbook_id
  INTO v_proj_org, v_existing_playbook
  FROM projects WHERE id = p_project_id;

  IF v_proj_org IS NULL OR v_proj_org != v_org_id THEN
    RAISE EXCEPTION 'Project not in same organization' USING ERRCODE = '42501';
  END IF;

  -- Permission check
  IF NOT has_org_role(v_org_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Idempotency: block duplicate unless force flag
  IF v_existing_playbook IS NOT NULL AND NOT p_force_reapply THEN
    RAISE EXCEPTION 'Playbook already applied to this project. Use force_reapply=true to reapply.'
      USING ERRCODE = 'P0001';
  END IF;

  -- If force reapply, remove previously playbook-generated tasks
  IF v_existing_playbook IS NOT NULL AND p_force_reapply THEN
    UPDATE tasks
    SET is_deleted = true
    WHERE project_id = p_project_id
      AND source_playbook_id IS NOT NULL
      AND is_deleted = false;
  END IF;

  -- Pre-count total tasks to determine density governor
  SELECT COUNT(*) INTO v_total_task_count
  FROM playbook_tasks pt
  JOIN playbook_phases pp ON pp.id = pt.playbook_phase_id
  WHERE pp.playbook_id = p_playbook_id;

  v_density_exceeded := v_total_task_count > 40;

  -- Generate tasks from playbook
  FOR v_phase IN
    SELECT * FROM playbook_phases
    WHERE playbook_id = p_playbook_id
    ORDER BY sequence_order
  LOOP
    FOR v_task IN
      SELECT * FROM playbook_tasks
      WHERE playbook_phase_id = v_phase.id
      ORDER BY sequence_order
    LOOP
      -- Accumulate hour baselines
      v_total_low := v_total_low + v_task.expected_hours_low;
      v_total_high := v_total_high + v_task.expected_hours_high;

      -- Density governor: collapse optional tasks when > 40 total
      DECLARE
        v_is_collapsed boolean := false;
      BEGIN
        IF v_density_exceeded AND NOT v_task.required_flag THEN
          v_is_collapsed := true;
          v_tasks_collapsed := v_tasks_collapsed + 1;
        END IF;

        INSERT INTO tasks (
          project_id, title, description, status, priority,
          created_by, estimated_hours,
          source_playbook_id, source_playbook_version,
          baseline_low_hours, baseline_high_hours,
          baseline_role_type, baseline_density_weight,
          playbook_required, playbook_collapsed
        ) VALUES (
          p_project_id,
          v_task.title,
          format('Phase: %s | %s | Est: %s–%sh | Role: %s',
            v_phase.name,
            NULLIF(v_task.description, ''),
            v_task.expected_hours_low,
            v_task.expected_hours_high,
            v_task.role_type
          ),
          CASE WHEN v_is_collapsed THEN 'not_started'::task_status ELSE 'not_started'::task_status END,
          CASE
            WHEN v_task.required_flag AND v_task.density_weight >= 3 THEN 1
            WHEN v_task.required_flag THEN 2
            ELSE 3
          END,
          v_uid,
          v_task.expected_hours_high,
          p_playbook_id,
          v_pb.version,
          v_task.expected_hours_low,
          v_task.expected_hours_high,
          v_task.role_type,
          v_task.density_weight,
          v_task.required_flag,
          v_is_collapsed
        );

        v_tasks_created := v_tasks_created + 1;
      END;
    END LOOP;
  END LOOP;

  -- Update project metadata
  UPDATE projects SET
    applied_playbook_id = p_playbook_id,
    applied_playbook_version = v_pb.version,
    total_expected_hours_low = v_total_low,
    total_expected_hours_high = v_total_high,
    playbook_applied_at = now(),
    playbook_applied_by = v_uid
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'applied', true,
    'playbook_id', p_playbook_id,
    'playbook_version', v_pb.version,
    'project_id', p_project_id,
    'tasks_created', v_tasks_created,
    'tasks_collapsed', v_tasks_collapsed,
    'density_governor_active', v_density_exceeded,
    'total_expected_hours_low', v_total_low,
    'total_expected_hours_high', v_total_high
  );
END;
$$;
