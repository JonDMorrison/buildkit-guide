
CREATE OR REPLACE FUNCTION public.rpc_verify_ai_brain_access_control(p_project_id uuid, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb := '{}'::jsonb;
  v_all_ok boolean := true;
  v_err text;
BEGIN
  -- Test rpc_generate_project_margin_control
  BEGIN
    PERFORM public.rpc_generate_project_margin_control(p_project_id);
    v_results := v_results || '{"project_margin_control": "ok"}'::jsonb;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      v_results := v_results || '{"project_margin_control": "denied_42501"}'::jsonb;
      v_all_ok := false;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object('project_margin_control', 'error: ' || v_err);
      v_all_ok := false;
  END;

  -- Test rpc_get_operating_system_score
  BEGIN
    PERFORM public.rpc_get_operating_system_score(p_org_id);
    v_results := v_results || '{"operating_system_score": "ok"}'::jsonb;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      v_results := v_results || '{"operating_system_score": "denied_42501"}'::jsonb;
      v_all_ok := false;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object('operating_system_score', 'error: ' || v_err);
      v_all_ok := false;
  END;

  -- Test rpc_get_executive_dashboard
  BEGIN
    PERFORM public.rpc_get_executive_dashboard(p_org_id);
    v_results := v_results || '{"executive_dashboard": "ok"}'::jsonb;
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      v_results := v_results || '{"executive_dashboard": "denied_42501"}'::jsonb;
      v_all_ok := false;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_object('executive_dashboard', 'error: ' || v_err);
      v_all_ok := false;
  END;

  IF v_all_ok THEN
    RETURN jsonb_build_object('authorized', true, 'details', v_results);
  ELSE
    RETURN jsonb_build_object('authorized', false, 'error', 'not_authorized', 'details', v_results);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_verify_ai_brain_access_control(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_verify_ai_brain_access_control(uuid, uuid) TO authenticated;
