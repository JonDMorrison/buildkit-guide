
CREATE OR REPLACE FUNCTION public.rpc_debug_seed_time_entries(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_id uuid;
  v_count bigint;
  v_sqlstate text;
  v_message text;
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  -- Resolve org and creator from the project
  SELECT p.organization_id, p.created_by
    INTO v_org_id, v_user_id
    FROM public.projects p
   WHERE p.id = p_project_id;

  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'attempted_insert', false,
      'after_insert_count', 0,
      'insert_row_id', null,
      'sqlstate', 'P0002',
      'message_text', format('Project %s not found', p_project_id)
    );
  END IF;

  BEGIN
    INSERT INTO public.time_entries (
      project_id,
      organization_id,
      user_id,
      check_in_at,
      check_out_at,
      duration_hours,
      duration_minutes,
      status,
      notes,
      source
    ) VALUES (
      p_project_id,
      v_org_id,
      v_user_id,
      now() - interval '2 hours',
      now(),
      2,
      120,
      'closed',
      'rpc_debug_seed_time_entries diagnostic row',
      'manual'
    )
    RETURNING id INTO v_row_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_sqlstate    = RETURNED_SQLSTATE,
      v_message     = MESSAGE_TEXT;

    SELECT count(*)
      INTO v_count
      FROM public.time_entries
     WHERE project_id = p_project_id;

    RETURN jsonb_build_object(
      'attempted_insert', true,
      'after_insert_count', v_count,
      'insert_row_id', null,
      'sqlstate', v_sqlstate,
      'message_text', v_message
    );
  END;

  SELECT count(*)
    INTO v_count
    FROM public.time_entries
   WHERE project_id = p_project_id;

  RETURN jsonb_build_object(
    'attempted_insert', true,
    'after_insert_count', v_count,
    'insert_row_id', v_row_id,
    'sqlstate', null,
    'message_text', null
  );
END;
$$;
