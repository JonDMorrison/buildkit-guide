-- Add audience field to playbooks
ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'office'
  CHECK (audience IN ('office', 'foreman', 'field'));

-- Add trade_id to playbooks (do both in one migration for efficiency)
ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS trade_id uuid
  REFERENCES public.trades(id) ON DELETE SET NULL;

-- Update rpc_create_playbook to accept audience and trade_id
CREATE OR REPLACE FUNCTION public.rpc_create_playbook(
  p_organization_id uuid,
  p_name text,
  p_job_type text DEFAULT '',
  p_description text DEFAULT '',
  p_is_default boolean DEFAULT false,
  p_phases jsonb DEFAULT '[]'::jsonb,
  p_audience text DEFAULT 'office',
  p_trade_id uuid DEFAULT NULL
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

  INSERT INTO playbooks (organization_id, name, job_type, description, is_default, created_by, audience, trade_id)
  VALUES (p_organization_id, p_name, p_job_type, p_description, p_is_default, v_uid,
          COALESCE(p_audience, 'office'), p_trade_id)
  RETURNING id INTO v_pb_id;

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

  INSERT INTO playbook_versions (playbook_id, version, snapshot, created_by)
  VALUES (v_pb_id, 1, _playbook_snapshot(v_pb_id), v_uid);

  RETURN _playbook_snapshot(v_pb_id);
END;
$$;

-- Update rpc_list_playbooks_by_org to return audience and trade info
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
        'audience', pb.audience,
        'trade_id', pb.trade_id,
        'trade_name', t.name,
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
    LEFT JOIN trades t ON t.id = pb.trade_id
    WHERE pb.organization_id = p_organization_id
      AND (p_include_archived OR pb.is_archived = false)
  ), '[]'::jsonb);
END;
$$;
