CREATE OR REPLACE FUNCTION public.rpc_run_org_onboarding_wizard(
  p_organization_id uuid,
  p_payload jsonb
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_labor_model text;
  v_rate_source text;
  v_invoice_perm text;
  v_workflow text;
  v_tax text;
  v_ai text;
  v_quote_required boolean;
  v_quote_approved boolean;
  v_region text;
  v_result jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(p_organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Extract and validate
  v_labor_model := COALESCE(p_payload->>'labor_model', 'hourly');
  IF v_labor_model NOT IN ('hourly','blended','per_task') THEN
    RAISE EXCEPTION 'Invalid labor_model: %', v_labor_model;
  END IF;

  v_rate_source := COALESCE(p_payload->>'rate_source', 'user_rate');
  IF v_rate_source NOT IN ('user_rate','trade_rate','flat_cost') THEN
    RAISE EXCEPTION 'Invalid rate_source: %', v_rate_source;
  END IF;

  v_invoice_perm := COALESCE(p_payload->>'invoice_permission_model', 'strict');
  IF v_invoice_perm NOT IN ('strict','project_admin','custom') THEN
    RAISE EXCEPTION 'Invalid invoice_permission_model: %', v_invoice_perm;
  END IF;

  v_workflow := COALESCE(p_payload->>'workflow_mode', 'manual');
  IF v_workflow NOT IN ('manual','ai_optimized') THEN
    RAISE EXCEPTION 'Invalid workflow_mode: %', v_workflow;
  END IF;

  v_tax := COALESCE(p_payload->>'tax_model', 'simple');
  IF v_tax NOT IN ('simple','multi_region') THEN
    RAISE EXCEPTION 'Invalid tax_model: %', v_tax;
  END IF;

  v_ai := COALESCE(p_payload->>'ai_style', 'balanced');
  IF v_ai NOT IN ('conservative','balanced','aggressive') THEN
    RAISE EXCEPTION 'Invalid ai_style: %', v_ai;
  END IF;

  v_quote_required := COALESCE((p_payload->>'quote_required_before_tasks')::boolean, false);
  v_quote_approved := COALESCE((p_payload->>'require_quote_approved')::boolean, false);
  v_region := p_payload->>'region';

  -- Idempotent upsert
  INSERT INTO organization_intelligence_profile (
    organization_id, labor_cost_model, labor_rate_source, invoice_permission_model,
    quote_required_before_tasks, require_quote_approved, workflow_mode_default,
    region, tax_model, ai_style
  ) VALUES (
    p_organization_id, v_labor_model, v_rate_source, v_invoice_perm,
    v_quote_required, v_quote_approved, v_workflow,
    v_region, v_tax, v_ai
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    labor_cost_model = EXCLUDED.labor_cost_model,
    labor_rate_source = EXCLUDED.labor_rate_source,
    invoice_permission_model = EXCLUDED.invoice_permission_model,
    quote_required_before_tasks = EXCLUDED.quote_required_before_tasks,
    require_quote_approved = EXCLUDED.require_quote_approved,
    workflow_mode_default = EXCLUDED.workflow_mode_default,
    region = EXCLUDED.region,
    tax_model = EXCLUDED.tax_model,
    ai_style = EXCLUDED.ai_style;

  -- Return full profile
  SELECT jsonb_build_object(
    'organization_id', oip.organization_id,
    'base_currency', oip.base_currency,
    'labor_cost_model', oip.labor_cost_model,
    'labor_rate_source', oip.labor_rate_source,
    'invoice_permission_model', oip.invoice_permission_model,
    'quote_required_before_tasks', oip.quote_required_before_tasks,
    'require_quote_approved', oip.require_quote_approved,
    'workflow_mode_default', oip.workflow_mode_default,
    'allow_currency_mismatch', oip.allow_currency_mismatch,
    'region', oip.region,
    'tax_model', oip.tax_model,
    'ai_style', oip.ai_style,
    'created_at', oip.created_at,
    'updated_at', oip.updated_at
  ) INTO v_result
  FROM organization_intelligence_profile oip
  WHERE oip.organization_id = p_organization_id;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_run_org_onboarding_wizard(uuid, jsonb) TO authenticated;