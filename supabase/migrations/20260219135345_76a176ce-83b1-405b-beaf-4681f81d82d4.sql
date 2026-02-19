
-- ============================================================
-- PLAYBOOKS ENGINE: Tables, RLS, Versioning, RPCs
-- ============================================================

-- 1. TABLES
-- -----------------------------------------------------------

CREATE TABLE public.playbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  job_type text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.playbook_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  name text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE public.playbook_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_phase_id uuid NOT NULL REFERENCES public.playbook_phases(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  role_type text NOT NULL DEFAULT 'laborer',
  expected_hours_low numeric NOT NULL DEFAULT 0,
  expected_hours_high numeric NOT NULL DEFAULT 0,
  required_flag boolean NOT NULL DEFAULT true,
  allow_skip boolean NOT NULL DEFAULT false,
  density_weight integer NOT NULL DEFAULT 1,
  sequence_order integer NOT NULL DEFAULT 0
);

-- Versioning snapshot table
CREATE TABLE public.playbook_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id uuid NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_playbooks_org ON public.playbooks(organization_id);
CREATE INDEX idx_playbooks_org_archived ON public.playbooks(organization_id, is_archived);
CREATE INDEX idx_playbook_phases_playbook ON public.playbook_phases(playbook_id);
CREATE INDEX idx_playbook_tasks_phase ON public.playbook_tasks(playbook_phase_id);
CREATE INDEX idx_playbook_versions_playbook ON public.playbook_versions(playbook_id);

-- Updated_at trigger
CREATE TRIGGER update_playbooks_updated_at
  BEFORE UPDATE ON public.playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. RLS — FORCE + DENY ALL DIRECT WRITES
-- -----------------------------------------------------------

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbooks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.playbook_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_phases FORCE ROW LEVEL SECURITY;

ALTER TABLE public.playbook_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_tasks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.playbook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_versions FORCE ROW LEVEL SECURITY;

-- SELECT: org-scoped
CREATE POLICY "playbooks_select" ON public.playbooks
  FOR SELECT USING (public.has_org_membership(organization_id));

CREATE POLICY "playbook_phases_select" ON public.playbook_phases
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.has_org_membership(pb.organization_id))
  );

CREATE POLICY "playbook_tasks_select" ON public.playbook_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playbook_phases pp
      JOIN public.playbooks pb ON pb.id = pp.playbook_id
      WHERE pp.id = playbook_phase_id AND public.has_org_membership(pb.organization_id)
    )
  );

CREATE POLICY "playbook_versions_select" ON public.playbook_versions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.playbooks pb WHERE pb.id = playbook_id AND public.has_org_membership(pb.organization_id))
  );

-- DENY direct writes for authenticated/anon
CREATE POLICY "playbooks_deny_insert" ON public.playbooks FOR INSERT WITH CHECK (false);
CREATE POLICY "playbooks_deny_update" ON public.playbooks FOR UPDATE USING (false);
CREATE POLICY "playbooks_deny_delete" ON public.playbooks FOR DELETE USING (false);

CREATE POLICY "playbook_phases_deny_insert" ON public.playbook_phases FOR INSERT WITH CHECK (false);
CREATE POLICY "playbook_phases_deny_update" ON public.playbook_phases FOR UPDATE USING (false);
CREATE POLICY "playbook_phases_deny_delete" ON public.playbook_phases FOR DELETE USING (false);

CREATE POLICY "playbook_tasks_deny_insert" ON public.playbook_tasks FOR INSERT WITH CHECK (false);
CREATE POLICY "playbook_tasks_deny_update" ON public.playbook_tasks FOR UPDATE USING (false);
CREATE POLICY "playbook_tasks_deny_delete" ON public.playbook_tasks FOR DELETE USING (false);

CREATE POLICY "playbook_versions_deny_insert" ON public.playbook_versions FOR INSERT WITH CHECK (false);
CREATE POLICY "playbook_versions_deny_update" ON public.playbook_versions FOR UPDATE USING (false);
CREATE POLICY "playbook_versions_deny_delete" ON public.playbook_versions FOR DELETE USING (false);


-- 3. HELPER: Snapshot a playbook into JSON
-- -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public._playbook_snapshot(p_playbook_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_build_object(
    'playbook', row_to_json(pb.*),
    'phases', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'phase', row_to_json(pp.*),
          'tasks', COALESCE((
            SELECT jsonb_agg(row_to_json(pt.*) ORDER BY pt.sequence_order)
            FROM playbook_tasks pt WHERE pt.playbook_phase_id = pp.id
          ), '[]'::jsonb)
        ) ORDER BY pp.sequence_order
      )
      FROM playbook_phases pp WHERE pp.playbook_id = pb.id
    ), '[]'::jsonb)
  )
  FROM playbooks pb WHERE pb.id = p_playbook_id;
$$;


-- 4. RPCs — ALL SECURITY DEFINER, ORG-VALIDATED
-- -----------------------------------------------------------

-- rpc_create_playbook
CREATE OR REPLACE FUNCTION public.rpc_create_playbook(
  p_organization_id uuid,
  p_name text,
  p_job_type text DEFAULT '',
  p_description text DEFAULT '',
  p_is_default boolean DEFAULT false,
  p_phases jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pb_id uuid;
  v_phase record;
  v_task record;
  v_phase_id uuid;
BEGIN
  IF NOT has_org_role(p_organization_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO playbooks (organization_id, name, job_type, description, is_default, created_by)
  VALUES (p_organization_id, p_name, p_job_type, p_description, p_is_default, v_uid)
  RETURNING id INTO v_pb_id;

  -- Insert phases and tasks from JSON
  FOR v_phase IN SELECT * FROM jsonb_array_elements(p_phases) WITH ORDINALITY AS x(val, ord)
  LOOP
    INSERT INTO playbook_phases (playbook_id, name, sequence_order, description)
    VALUES (
      v_pb_id,
      v_phase.val->>'name',
      COALESCE((v_phase.val->>'sequence_order')::int, v_phase.ord::int),
      COALESCE(v_phase.val->>'description', '')
    )
    RETURNING id INTO v_phase_id;

    IF v_phase.val->'tasks' IS NOT NULL THEN
      FOR v_task IN SELECT * FROM jsonb_array_elements(v_phase.val->'tasks') WITH ORDINALITY AS t(val, ord)
      LOOP
        INSERT INTO playbook_tasks (
          playbook_phase_id, title, description, role_type,
          expected_hours_low, expected_hours_high,
          required_flag, allow_skip, density_weight, sequence_order
        ) VALUES (
          v_phase_id,
          v_task.val->>'title',
          COALESCE(v_task.val->>'description', ''),
          COALESCE(v_task.val->>'role_type', 'laborer'),
          COALESCE((v_task.val->>'expected_hours_low')::numeric, 0),
          COALESCE((v_task.val->>'expected_hours_high')::numeric, 0),
          COALESCE((v_task.val->>'required_flag')::boolean, true),
          COALESCE((v_task.val->>'allow_skip')::boolean, false),
          COALESCE((v_task.val->>'density_weight')::int, 1),
          COALESCE((v_task.val->>'sequence_order')::int, v_task.ord::int)
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Snapshot version 1
  INSERT INTO playbook_versions (playbook_id, version, snapshot, created_by)
  VALUES (v_pb_id, 1, _playbook_snapshot(v_pb_id), v_uid);

  RETURN _playbook_snapshot(v_pb_id);
END;
$$;


-- rpc_update_playbook (version-incrementing)
CREATE OR REPLACE FUNCTION public.rpc_update_playbook(
  p_playbook_id uuid,
  p_name text DEFAULT NULL,
  p_job_type text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_is_default boolean DEFAULT NULL,
  p_phases jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_old_version integer;
  v_phase record;
  v_task record;
  v_phase_id uuid;
BEGIN
  SELECT organization_id, version INTO v_org_id, v_old_version
  FROM playbooks WHERE id = p_playbook_id AND is_archived = false;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found or archived' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_org_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Snapshot current version before mutation
  INSERT INTO playbook_versions (playbook_id, version, snapshot, created_by)
  VALUES (p_playbook_id, v_old_version, _playbook_snapshot(p_playbook_id), v_uid);

  -- Update scalar fields
  UPDATE playbooks SET
    name = COALESCE(p_name, name),
    job_type = COALESCE(p_job_type, job_type),
    description = COALESCE(p_description, description),
    is_default = COALESCE(p_is_default, is_default),
    version = v_old_version + 1
  WHERE id = p_playbook_id;

  -- Replace phases/tasks if provided
  IF p_phases IS NOT NULL THEN
    DELETE FROM playbook_phases WHERE playbook_id = p_playbook_id;

    FOR v_phase IN SELECT * FROM jsonb_array_elements(p_phases) WITH ORDINALITY AS x(val, ord)
    LOOP
      INSERT INTO playbook_phases (playbook_id, name, sequence_order, description)
      VALUES (
        p_playbook_id,
        v_phase.val->>'name',
        COALESCE((v_phase.val->>'sequence_order')::int, v_phase.ord::int),
        COALESCE(v_phase.val->>'description', '')
      )
      RETURNING id INTO v_phase_id;

      IF v_phase.val->'tasks' IS NOT NULL THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(v_phase.val->'tasks') WITH ORDINALITY AS t(val, ord)
        LOOP
          INSERT INTO playbook_tasks (
            playbook_phase_id, title, description, role_type,
            expected_hours_low, expected_hours_high,
            required_flag, allow_skip, density_weight, sequence_order
          ) VALUES (
            v_phase_id,
            v_task.val->>'title',
            COALESCE(v_task.val->>'description', ''),
            COALESCE(v_task.val->>'role_type', 'laborer'),
            COALESCE((v_task.val->>'expected_hours_low')::numeric, 0),
            COALESCE((v_task.val->>'expected_hours_high')::numeric, 0),
            COALESCE((v_task.val->>'required_flag')::boolean, true),
            COALESCE((v_task.val->>'allow_skip')::boolean, false),
            COALESCE((v_task.val->>'density_weight')::int, 1),
            COALESCE((v_task.val->>'sequence_order')::int, v_task.ord::int)
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN _playbook_snapshot(p_playbook_id);
END;
$$;


-- rpc_duplicate_playbook
CREATE OR REPLACE FUNCTION public.rpc_duplicate_playbook(
  p_playbook_id uuid,
  p_new_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_snapshot jsonb;
  v_new_pb_id uuid;
  v_src record;
  v_phase record;
  v_task record;
  v_phase_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM playbooks WHERE id = p_playbook_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_org_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_src FROM playbooks WHERE id = p_playbook_id;

  INSERT INTO playbooks (organization_id, name, job_type, description, is_default, created_by)
  VALUES (v_org_id, COALESCE(p_new_name, v_src.name || ' (copy)'), v_src.job_type, v_src.description, false, v_uid)
  RETURNING id INTO v_new_pb_id;

  FOR v_phase IN SELECT * FROM playbook_phases WHERE playbook_id = p_playbook_id ORDER BY sequence_order
  LOOP
    INSERT INTO playbook_phases (playbook_id, name, sequence_order, description)
    VALUES (v_new_pb_id, v_phase.name, v_phase.sequence_order, v_phase.description)
    RETURNING id INTO v_phase_id;

    FOR v_task IN SELECT * FROM playbook_tasks WHERE playbook_phase_id = v_phase.id ORDER BY sequence_order
    LOOP
      INSERT INTO playbook_tasks (
        playbook_phase_id, title, description, role_type,
        expected_hours_low, expected_hours_high,
        required_flag, allow_skip, density_weight, sequence_order
      ) VALUES (
        v_phase_id, v_task.title, v_task.description, v_task.role_type,
        v_task.expected_hours_low, v_task.expected_hours_high,
        v_task.required_flag, v_task.allow_skip, v_task.density_weight, v_task.sequence_order
      );
    END LOOP;
  END LOOP;

  INSERT INTO playbook_versions (playbook_id, version, snapshot, created_by)
  VALUES (v_new_pb_id, 1, _playbook_snapshot(v_new_pb_id), v_uid);

  RETURN _playbook_snapshot(v_new_pb_id);
END;
$$;


-- rpc_archive_playbook
CREATE OR REPLACE FUNCTION public.rpc_archive_playbook(p_playbook_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organization_id INTO v_org_id FROM playbooks WHERE id = p_playbook_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_org_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE playbooks SET is_archived = true WHERE id = p_playbook_id;

  RETURN jsonb_build_object('archived', true, 'playbook_id', p_playbook_id);
END;
$$;


-- rpc_apply_playbook_to_project
CREATE OR REPLACE FUNCTION public.rpc_apply_playbook_to_project(
  p_playbook_id uuid,
  p_project_id uuid
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
  v_phase record;
  v_task record;
  v_new_task_id uuid;
  v_tasks_created integer := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM playbooks WHERE id = p_playbook_id AND is_archived = false;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Playbook not found or archived' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_proj_org FROM projects WHERE id = p_project_id;
  IF v_proj_org IS NULL OR v_proj_org != v_org_id THEN
    RAISE EXCEPTION 'Project not in same organization' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(v_org_id, ARRAY['admin','project_manager']) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_phase IN SELECT * FROM playbook_phases WHERE playbook_id = p_playbook_id ORDER BY sequence_order
  LOOP
    FOR v_task IN SELECT * FROM playbook_tasks WHERE playbook_phase_id = v_phase.id ORDER BY sequence_order
    LOOP
      INSERT INTO tasks (
        project_id, title, description, status, priority, created_by
      ) VALUES (
        p_project_id,
        v_task.title,
        format('Phase: %s | %s | Est: %s–%sh',
          v_phase.name,
          v_task.description,
          v_task.expected_hours_low,
          v_task.expected_hours_high
        ),
        'todo',
        CASE WHEN v_task.required_flag THEN 2 ELSE 3 END,
        v_uid
      );
      v_tasks_created := v_tasks_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'applied', true,
    'playbook_id', p_playbook_id,
    'project_id', p_project_id,
    'tasks_created', v_tasks_created
  );
END;
$$;


-- rpc_list_playbooks_by_org
CREATE OR REPLACE FUNCTION public.rpc_list_playbooks_by_org(
  p_organization_id uuid,
  p_include_archived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT has_org_membership(p_organization_id) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pb.id,
        'name', pb.name,
        'job_type', pb.job_type,
        'description', pb.description,
        'version', pb.version,
        'is_default', pb.is_default,
        'is_archived', pb.is_archived,
        'created_at', pb.created_at,
        'updated_at', pb.updated_at,
        'phase_count', (SELECT COUNT(*) FROM playbook_phases pp WHERE pp.playbook_id = pb.id),
        'task_count', (
          SELECT COUNT(*) FROM playbook_tasks pt
          JOIN playbook_phases pp2 ON pp2.id = pt.playbook_phase_id
          WHERE pp2.playbook_id = pb.id
        )
      ) ORDER BY pb.is_default DESC, pb.updated_at DESC
    )
    FROM playbooks pb
    WHERE pb.organization_id = p_organization_id
      AND (p_include_archived OR pb.is_archived = false)
  ), '[]'::jsonb);
END;
$$;
