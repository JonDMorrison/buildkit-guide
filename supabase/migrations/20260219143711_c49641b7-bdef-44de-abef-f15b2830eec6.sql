
-- ================================================================
-- Org Onboarding Wizard: Drop + Recreate RPCs to fix PostgREST visibility
-- Also adds profile jsonb column and full scoring engine
-- ================================================================

-- 1. Add profile jsonb column if missing
ALTER TABLE public.organization_intelligence_profile
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Drop existing functions to force PostgREST schema cache refresh
DROP FUNCTION IF EXISTS public.rpc_run_org_onboarding_wizard(uuid, jsonb);
DROP FUNCTION IF EXISTS public.rpc_update_org_intelligence_profile(uuid, jsonb);

-- 3. Recreate rpc_run_org_onboarding_wizard with full scoring engine
CREATE OR REPLACE FUNCTION public.rpc_run_org_onboarding_wizard(
  p_organization_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  -- Parsed answers
  v_company_size text;
  v_project_value text;
  v_trade_structure text;
  v_labor_billing text;
  v_estimating_style text;
  v_pain_points jsonb;
  v_safety text;
  v_multi_company text;
  v_job_types jsonb;
  v_approval_rigidity text;
  v_reporting_prefs jsonb;
  -- Scoring
  v_maturity_score int := 0;
  v_risk_flags jsonb := '[]'::jsonb;
  v_workflow_mode text;
  v_requirements jsonb := '[]'::jsonb;
  v_guardrails jsonb;
  v_templates jsonb := '[]'::jsonb;
  v_playbooks jsonb := '[]'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  -- Profile output
  v_profile jsonb;
  v_result jsonb;
  -- Helpers
  v_pain text;
  v_jt text;
BEGIN
  -- ========== AUTH ==========
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT has_org_role(p_organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- ========== PARSE + VALIDATE ANSWERS ==========
  v_company_size       := p_answers->>'company_size';
  v_project_value      := p_answers->>'typical_project_value_range';
  v_trade_structure    := p_answers->>'trade_structure';
  v_labor_billing      := p_answers->>'labor_billing_model';
  v_estimating_style   := p_answers->>'estimating_style';
  v_pain_points        := COALESCE(p_answers->'cost_control_pain_points', '[]'::jsonb);
  v_safety             := p_answers->>'safety_compliance_needs';
  v_multi_company      := p_answers->>'multi_company_structure';
  v_job_types          := COALESCE(p_answers->'common_repeatable_job_types', '[]'::jsonb);
  v_approval_rigidity  := p_answers->>'approval_rigidity';
  v_reporting_prefs    := COALESCE(p_answers->'reporting_preferences', '[]'::jsonb);

  -- Validate required fields
  IF v_company_size IS NULL THEN v_missing := v_missing || '"company_size"'::jsonb; END IF;
  IF v_trade_structure IS NULL THEN v_missing := v_missing || '"trade_structure"'::jsonb; END IF;
  IF v_labor_billing IS NULL THEN v_missing := v_missing || '"labor_billing_model"'::jsonb; END IF;
  IF v_estimating_style IS NULL THEN v_missing := v_missing || '"estimating_style"'::jsonb; END IF;
  IF v_safety IS NULL THEN v_missing := v_missing || '"safety_compliance_needs"'::jsonb; END IF;
  IF v_approval_rigidity IS NULL THEN v_missing := v_missing || '"approval_rigidity"'::jsonb; END IF;

  -- Validate enums
  IF v_company_size IS NOT NULL AND v_company_size NOT IN ('1-5','6-15','16-50','50+') THEN
    v_warnings := v_warnings || to_jsonb('Invalid company_size: ' || v_company_size);
  END IF;
  IF v_trade_structure IS NOT NULL AND v_trade_structure NOT IN ('in_house','subcontract','hybrid') THEN
    v_warnings := v_warnings || to_jsonb('Invalid trade_structure: ' || v_trade_structure);
  END IF;
  IF v_labor_billing IS NOT NULL AND v_labor_billing NOT IN ('time_material','fixed_price','hybrid') THEN
    v_warnings := v_warnings || to_jsonb('Invalid labor_billing_model: ' || v_labor_billing);
  END IF;
  IF v_estimating_style IS NOT NULL AND v_estimating_style NOT IN ('template_based','line_item','rough_order','hybrid') THEN
    v_warnings := v_warnings || to_jsonb('Invalid estimating_style: ' || v_estimating_style);
  END IF;
  IF v_safety IS NOT NULL AND v_safety NOT IN ('low','medium','high') THEN
    v_warnings := v_warnings || to_jsonb('Invalid safety_compliance_needs: ' || v_safety);
  END IF;
  IF v_approval_rigidity IS NOT NULL AND v_approval_rigidity NOT IN ('low','medium','high') THEN
    v_warnings := v_warnings || to_jsonb('Invalid approval_rigidity: ' || v_approval_rigidity);
  END IF;

  -- ========== DETERMINISTIC SCORING ==========
  
  -- Company size score (0-15)
  v_maturity_score := v_maturity_score + CASE v_company_size
    WHEN '1-5' THEN 5
    WHEN '6-15' THEN 10
    WHEN '16-50' THEN 13
    WHEN '50+' THEN 15
    ELSE 5
  END;

  -- Trade structure score (0-15)
  v_maturity_score := v_maturity_score + CASE v_trade_structure
    WHEN 'in_house' THEN 8
    WHEN 'subcontract' THEN 10
    WHEN 'hybrid' THEN 15
    ELSE 8
  END;

  -- Estimating sophistication (0-20)
  v_maturity_score := v_maturity_score + CASE v_estimating_style
    WHEN 'rough_order' THEN 5
    WHEN 'template_based' THEN 12
    WHEN 'line_item' THEN 18
    WHEN 'hybrid' THEN 20
    ELSE 5
  END;

  -- Approval rigidity (0-15)
  v_maturity_score := v_maturity_score + CASE v_approval_rigidity
    WHEN 'low' THEN 5
    WHEN 'medium' THEN 10
    WHEN 'high' THEN 15
    ELSE 5
  END;

  -- Safety compliance (0-10)
  v_maturity_score := v_maturity_score + CASE v_safety
    WHEN 'low' THEN 3
    WHEN 'medium' THEN 7
    WHEN 'high' THEN 10
    ELSE 3
  END;

  -- Multi-company sophistication (0-10)
  v_maturity_score := v_maturity_score + CASE v_multi_company
    WHEN 'single' THEN 3
    WHEN 'multi_division' THEN 7
    WHEN 'franchise' THEN 10
    ELSE 3
  END;

  -- Pain points bonus (0-15, 3 pts per relevant pain)
  IF v_pain_points IS NOT NULL AND jsonb_typeof(v_pain_points) = 'array' THEN
    FOR v_pain IN SELECT jsonb_array_elements_text(v_pain_points) LOOP
      v_maturity_score := v_maturity_score + LEAST(3, 3); -- 3 per pain, signals awareness
    END LOOP;
    v_maturity_score := LEAST(v_maturity_score, 100); -- Cap at 100
  END IF;

  -- ========== RISK FLAGS ==========
  IF v_company_size IN ('16-50', '50+') AND v_estimating_style = 'rough_order' THEN
    v_risk_flags := v_risk_flags || '"large_team_rough_estimates"'::jsonb;
  END IF;
  IF v_trade_structure = 'subcontract' AND v_approval_rigidity = 'low' THEN
    v_risk_flags := v_risk_flags || '"subcontract_low_approval"'::jsonb;
  END IF;
  IF v_safety = 'high' AND v_company_size = '1-5' THEN
    v_risk_flags := v_risk_flags || '"high_safety_small_team"'::jsonb;
  END IF;
  IF v_labor_billing = 'time_material' AND v_approval_rigidity = 'low' THEN
    v_risk_flags := v_risk_flags || '"tm_no_controls"'::jsonb;
  END IF;
  IF v_multi_company IN ('multi_division', 'franchise') AND v_approval_rigidity = 'low' THEN
    v_risk_flags := v_risk_flags || '"multi_entity_low_controls"'::jsonb;
  END IF;
  IF v_pain_points IS NOT NULL AND v_pain_points @> '"budget_overruns"'::jsonb THEN
    v_risk_flags := v_risk_flags || '"self_reported_overruns"'::jsonb;
  END IF;

  -- ========== WORKFLOW MODE ==========
  v_workflow_mode := CASE
    WHEN v_maturity_score >= 60 AND v_approval_rigidity IN ('medium','high') THEN 'ai_optimized'
    ELSE 'standard'
  END;

  -- ========== SUGGESTED REQUIREMENTS ==========
  -- Estimate required before tasks
  v_requirements := v_requirements || jsonb_build_object(
    'key', 'estimate_before_tasks',
    'required', v_maturity_score >= 40 OR v_approval_rigidity IN ('medium','high'),
    'rationale', CASE
      WHEN v_approval_rigidity = 'high' THEN 'High approval rigidity demands estimate-first workflow'
      WHEN v_maturity_score >= 40 THEN 'Operational maturity supports structured estimating'
      ELSE 'Low complexity; optional but recommended'
    END
  );
  -- Safety forms
  v_requirements := v_requirements || jsonb_build_object(
    'key', 'safety_forms',
    'required', v_safety IN ('medium','high'),
    'rationale', CASE v_safety
      WHEN 'high' THEN 'High compliance needs require mandatory safety documentation'
      WHEN 'medium' THEN 'Moderate compliance; safety forms recommended'
      ELSE 'Low compliance needs; optional'
    END
  );
  -- Time tracking
  v_requirements := v_requirements || jsonb_build_object(
    'key', 'time_tracking',
    'required', v_labor_billing IN ('time_material','hybrid'),
    'rationale', CASE
      WHEN v_labor_billing = 'time_material' THEN 'T&M billing requires accurate time capture'
      WHEN v_labor_billing = 'hybrid' THEN 'Mixed billing model benefits from time tracking'
      ELSE 'Fixed price; time tracking optional for cost analysis'
    END
  );
  -- Receipt capture
  v_requirements := v_requirements || jsonb_build_object(
    'key', 'receipt_capture',
    'required', v_maturity_score >= 30,
    'rationale', 'Material cost tracking improves job costing accuracy'
  );
  -- Change orders
  v_requirements := v_requirements || jsonb_build_object(
    'key', 'change_orders',
    'required', v_approval_rigidity IN ('medium','high') OR v_trade_structure IN ('subcontract','hybrid'),
    'rationale', CASE
      WHEN v_trade_structure = 'subcontract' THEN 'Subcontract work requires formal change order tracking'
      WHEN v_approval_rigidity = 'high' THEN 'High approval rigidity demands change order workflow'
      ELSE 'Recommended for scope change documentation'
    END
  );

  -- ========== SUGGESTED GUARDRAILS ==========
  v_guardrails := jsonb_build_object(
    'block_time_before_estimate', jsonb_build_object(
      'recommended_mode', CASE WHEN v_approval_rigidity = 'high' THEN 'block' WHEN v_approval_rigidity = 'medium' THEN 'warn' ELSE 'off' END,
      'rationale', 'Controls time logging relative to estimate approval'
    ),
    'budget_overage_threshold', jsonb_build_object(
      'warn_percent', CASE WHEN v_maturity_score >= 60 THEN 10 ELSE 20 END,
      'block_percent', CASE WHEN v_approval_rigidity = 'high' THEN 15 ELSE 30 END,
      'rationale', 'Budget overage alerting threshold'
    ),
    'require_job_site_for_checkin', jsonb_build_object(
      'recommended', v_safety IN ('medium','high') OR v_company_size IN ('16-50','50+'),
      'rationale', 'Location verification for field accountability'
    )
  );

  -- ========== SUGGESTED ESTIMATE TEMPLATES ==========
  IF v_estimating_style IN ('template_based','hybrid') THEN
    v_templates := v_templates || jsonb_build_object(
      'name', 'Standard Labor + Material',
      'line_items', jsonb_build_array(
        jsonb_build_object('item_type','labor','name','Project Labor','unit','hours'),
        jsonb_build_object('item_type','material','name','Materials','unit','lot'),
        jsonb_build_object('item_type','other','name','Permits & Fees','unit','each')
      )
    );
  END IF;
  IF v_trade_structure IN ('subcontract','hybrid') THEN
    v_templates := v_templates || jsonb_build_object(
      'name', 'Subcontract Bundle',
      'line_items', jsonb_build_array(
        jsonb_build_object('item_type','labor','name','Subcontractor Labor','unit','hours'),
        jsonb_build_object('item_type','material','name','Subcontractor Materials','unit','lot'),
        jsonb_build_object('item_type','other','name','Subcontractor Markup','unit','percent')
      )
    );
  END IF;
  IF v_estimating_style = 'line_item' THEN
    v_templates := v_templates || jsonb_build_object(
      'name', 'Detailed Line Item',
      'line_items', jsonb_build_array(
        jsonb_build_object('item_type','labor','name','Skilled Labor','unit','hours'),
        jsonb_build_object('item_type','labor','name','Helper Labor','unit','hours'),
        jsonb_build_object('item_type','material','name','Primary Materials','unit','each'),
        jsonb_build_object('item_type','material','name','Consumables','unit','lot'),
        jsonb_build_object('item_type','machine','name','Equipment Rental','unit','days'),
        jsonb_build_object('item_type','other','name','Contingency','unit','percent')
      )
    );
  END IF;

  -- ========== SUGGESTED PLAYBOOKS ==========
  IF v_job_types IS NOT NULL AND jsonb_typeof(v_job_types) = 'array' AND jsonb_array_length(v_job_types) > 0 THEN
    FOR v_jt IN SELECT jsonb_array_elements_text(v_job_types) LOOP
      v_playbooks := v_playbooks || jsonb_build_object(
        'job_type', v_jt,
        'suggested_phases', jsonb_build_array('Mobilization','Execution','Closeout'),
        'typical_task_count', CASE v_company_size
          WHEN '1-5' THEN 5
          WHEN '6-15' THEN 10
          WHEN '16-50' THEN 15
          ELSE 20
        END,
        'note', 'Auto-suggested from onboarding; refine in Playbook Builder'
      );
    END LOOP;
  END IF;

  -- ========== BUILD PROFILE ==========
  v_profile := jsonb_build_object(
    'version', 1,
    'captured_at', now(),
    'answers', p_answers,
    'derived', jsonb_build_object(
      'operational_maturity_score', LEAST(v_maturity_score, 100),
      'risk_flags', v_risk_flags,
      'recommended_workflow_mode', v_workflow_mode,
      'suggested_requirements', v_requirements,
      'suggested_guardrails', v_guardrails,
      'suggested_estimate_templates', v_templates,
      'suggested_playbooks', v_playbooks
    ),
    'validation', jsonb_build_object(
      'missing_fields', v_missing,
      'warnings', v_warnings
    )
  );

  -- ========== STORE (idempotent upsert) ==========
  UPDATE organization_intelligence_profile
  SET profile = v_profile, updated_at = now()
  WHERE organization_id = p_organization_id;

  IF NOT FOUND THEN
    INSERT INTO organization_intelligence_profile (organization_id, profile)
    VALUES (p_organization_id, v_profile)
    ON CONFLICT (organization_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now();
  END IF;

  RETURN v_profile;
END;
$$;

-- 4. Recreate rpc_update_org_intelligence_profile
CREATE OR REPLACE FUNCTION public.rpc_update_org_intelligence_profile(
  p_organization_id uuid,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_base_currency text;
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

  -- Validate currency if provided
  v_base_currency := p_patch->>'base_currency';
  IF v_base_currency IS NOT NULL AND v_base_currency NOT IN ('CAD','USD') THEN
    RAISE EXCEPTION 'Invalid currency: %. Only CAD/USD allowed', v_base_currency USING ERRCODE = 'P0001';
  END IF;

  v_labor_model := COALESCE(p_patch->>'labor_model', p_patch->>'labor_cost_model');
  IF v_labor_model IS NOT NULL AND v_labor_model NOT IN ('hourly','blended','per_task') THEN
    RAISE EXCEPTION 'Invalid labor_model: %', v_labor_model;
  END IF;

  v_rate_source := COALESCE(p_patch->>'rate_source', p_patch->>'labor_rate_source');
  IF v_rate_source IS NOT NULL AND v_rate_source NOT IN ('user_rate','trade_rate','flat_cost') THEN
    RAISE EXCEPTION 'Invalid rate_source: %', v_rate_source;
  END IF;

  v_invoice_perm := p_patch->>'invoice_permission_model';
  IF v_invoice_perm IS NOT NULL AND v_invoice_perm NOT IN ('strict','project_admin','custom') THEN
    RAISE EXCEPTION 'Invalid invoice_permission_model: %', v_invoice_perm;
  END IF;

  v_workflow := COALESCE(p_patch->>'workflow_mode', p_patch->>'workflow_mode_default');
  IF v_workflow IS NOT NULL AND v_workflow NOT IN ('manual','ai_optimized') THEN
    RAISE EXCEPTION 'Invalid workflow_mode: %', v_workflow;
  END IF;

  v_tax := p_patch->>'tax_model';
  IF v_tax IS NOT NULL AND v_tax NOT IN ('simple','multi_region') THEN
    RAISE EXCEPTION 'Invalid tax_model: %', v_tax;
  END IF;

  v_ai := p_patch->>'ai_style';
  IF v_ai IS NOT NULL AND v_ai NOT IN ('conservative','balanced','aggressive') THEN
    RAISE EXCEPTION 'Invalid ai_style: %', v_ai;
  END IF;

  v_quote_required := (p_patch->>'quote_required_before_tasks')::boolean;
  v_quote_approved := (p_patch->>'require_quote_approved')::boolean;
  v_region := p_patch->>'region';

  -- Upsert the profile columns
  INSERT INTO organization_intelligence_profile (
    organization_id,
    base_currency,
    labor_cost_model,
    labor_rate_source,
    invoice_permission_model,
    quote_required_before_tasks,
    require_quote_approved,
    workflow_mode_default,
    region,
    tax_model,
    ai_style
  ) VALUES (
    p_organization_id,
    COALESCE(v_base_currency, 'CAD'),
    COALESCE(v_labor_model, 'hourly'),
    COALESCE(v_rate_source, 'user_rate'),
    COALESCE(v_invoice_perm, 'strict'),
    COALESCE(v_quote_required, false),
    COALESCE(v_quote_approved, false),
    COALESCE(v_workflow, 'manual'),
    v_region,
    COALESCE(v_tax, 'simple'),
    COALESCE(v_ai, 'balanced')
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    base_currency = COALESCE(v_base_currency, organization_intelligence_profile.base_currency),
    labor_cost_model = COALESCE(v_labor_model, organization_intelligence_profile.labor_cost_model),
    labor_rate_source = COALESCE(v_rate_source, organization_intelligence_profile.labor_rate_source),
    invoice_permission_model = COALESCE(v_invoice_perm, organization_intelligence_profile.invoice_permission_model),
    quote_required_before_tasks = COALESCE(v_quote_required, organization_intelligence_profile.quote_required_before_tasks),
    require_quote_approved = COALESCE(v_quote_approved, organization_intelligence_profile.require_quote_approved),
    workflow_mode_default = COALESCE(v_workflow, organization_intelligence_profile.workflow_mode_default),
    region = COALESCE(v_region, organization_intelligence_profile.region),
    tax_model = COALESCE(v_tax, organization_intelligence_profile.tax_model),
    ai_style = COALESCE(v_ai, organization_intelligence_profile.ai_style),
    updated_at = now();

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
    'ai_style', oip.ai_style
  ) INTO v_result
  FROM organization_intelligence_profile oip
  WHERE oip.organization_id = p_organization_id;

  RETURN v_result;
END;
$$;

-- 5. Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
