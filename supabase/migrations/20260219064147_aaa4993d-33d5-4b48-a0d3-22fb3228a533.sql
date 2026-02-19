
-- Organization operational profile for diagnostic onboarding engine
CREATE TABLE public.organization_operational_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Phase 1: Structural Configuration
  base_currency text NOT NULL DEFAULT 'CAD',
  tax_model text NOT NULL DEFAULT 'gst_only',
  labor_cost_model text NOT NULL DEFAULT 'blended',
  rate_source text NOT NULL DEFAULT 'manual',
  invoice_permission_model text NOT NULL DEFAULT 'admin_only',
  workflow_mode_default text NOT NULL DEFAULT 'standard',
  
  -- Phase 2: Operational Diagnostics
  over_estimate_action text,
  invoice_approver text,
  tasks_before_quote boolean,
  time_audit_frequency text,
  track_variance_per_trade boolean,
  profit_leakage_source text,
  quote_standardization text,
  require_safety_before_work boolean,
  
  -- Phase 3: AI Calibration
  ai_risk_mode text DEFAULT 'balanced',
  ai_auto_change_orders boolean DEFAULT false,
  ai_flag_profit_risk boolean DEFAULT true,
  ai_recommend_pricing boolean DEFAULT false,
  
  -- Wizard state
  wizard_phase_completed int NOT NULL DEFAULT 0,
  wizard_completed_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_operational_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_operational_profile FORCE ROW LEVEL SECURITY;

-- Read: org members
CREATE POLICY "Members can view their org profile"
  ON public.organization_operational_profile FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

-- No direct writes
CREATE POLICY "No direct insert" ON public.organization_operational_profile FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update" ON public.organization_operational_profile FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete" ON public.organization_operational_profile FOR DELETE TO authenticated USING (false);

CREATE INDEX idx_org_op_profile_org ON public.organization_operational_profile (organization_id);

-- SECURITY DEFINER upsert RPC
CREATE OR REPLACE FUNCTION public.rpc_upsert_operational_profile(
  p_organization_id uuid,
  p_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  -- Verify caller is admin of the org
  IF NOT has_org_role(p_organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Forbidden: must be org admin' USING ERRCODE = '42501';
  END IF;

  INSERT INTO organization_operational_profile (
    organization_id,
    base_currency,
    tax_model,
    labor_cost_model,
    rate_source,
    invoice_permission_model,
    workflow_mode_default,
    over_estimate_action,
    invoice_approver,
    tasks_before_quote,
    time_audit_frequency,
    track_variance_per_trade,
    profit_leakage_source,
    quote_standardization,
    require_safety_before_work,
    ai_risk_mode,
    ai_auto_change_orders,
    ai_flag_profit_risk,
    ai_recommend_pricing,
    wizard_phase_completed,
    wizard_completed_at,
    updated_at
  ) VALUES (
    p_organization_id,
    COALESCE(p_data->>'base_currency', 'CAD'),
    COALESCE(p_data->>'tax_model', 'gst_only'),
    COALESCE(p_data->>'labor_cost_model', 'blended'),
    COALESCE(p_data->>'rate_source', 'manual'),
    COALESCE(p_data->>'invoice_permission_model', 'admin_only'),
    COALESCE(p_data->>'workflow_mode_default', 'standard'),
    p_data->>'over_estimate_action',
    p_data->>'invoice_approver',
    (p_data->>'tasks_before_quote')::boolean,
    p_data->>'time_audit_frequency',
    (p_data->>'track_variance_per_trade')::boolean,
    p_data->>'profit_leakage_source',
    p_data->>'quote_standardization',
    (p_data->>'require_safety_before_work')::boolean,
    COALESCE(p_data->>'ai_risk_mode', 'balanced'),
    COALESCE((p_data->>'ai_auto_change_orders')::boolean, false),
    COALESCE((p_data->>'ai_flag_profit_risk')::boolean, true),
    COALESCE((p_data->>'ai_recommend_pricing')::boolean, false),
    COALESCE((p_data->>'wizard_phase_completed')::int, 0),
    CASE WHEN (p_data->>'wizard_phase_completed')::int >= 3 THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    base_currency = COALESCE(NULLIF(p_data->>'base_currency', ''), organization_operational_profile.base_currency),
    tax_model = COALESCE(NULLIF(p_data->>'tax_model', ''), organization_operational_profile.tax_model),
    labor_cost_model = COALESCE(NULLIF(p_data->>'labor_cost_model', ''), organization_operational_profile.labor_cost_model),
    rate_source = COALESCE(NULLIF(p_data->>'rate_source', ''), organization_operational_profile.rate_source),
    invoice_permission_model = COALESCE(NULLIF(p_data->>'invoice_permission_model', ''), organization_operational_profile.invoice_permission_model),
    workflow_mode_default = COALESCE(NULLIF(p_data->>'workflow_mode_default', ''), organization_operational_profile.workflow_mode_default),
    over_estimate_action = COALESCE(p_data->>'over_estimate_action', organization_operational_profile.over_estimate_action),
    invoice_approver = COALESCE(p_data->>'invoice_approver', organization_operational_profile.invoice_approver),
    tasks_before_quote = COALESCE((p_data->>'tasks_before_quote')::boolean, organization_operational_profile.tasks_before_quote),
    time_audit_frequency = COALESCE(p_data->>'time_audit_frequency', organization_operational_profile.time_audit_frequency),
    track_variance_per_trade = COALESCE((p_data->>'track_variance_per_trade')::boolean, organization_operational_profile.track_variance_per_trade),
    profit_leakage_source = COALESCE(p_data->>'profit_leakage_source', organization_operational_profile.profit_leakage_source),
    quote_standardization = COALESCE(p_data->>'quote_standardization', organization_operational_profile.quote_standardization),
    require_safety_before_work = COALESCE((p_data->>'require_safety_before_work')::boolean, organization_operational_profile.require_safety_before_work),
    ai_risk_mode = COALESCE(NULLIF(p_data->>'ai_risk_mode', ''), organization_operational_profile.ai_risk_mode),
    ai_auto_change_orders = COALESCE((p_data->>'ai_auto_change_orders')::boolean, organization_operational_profile.ai_auto_change_orders),
    ai_flag_profit_risk = COALESCE((p_data->>'ai_flag_profit_risk')::boolean, organization_operational_profile.ai_flag_profit_risk),
    ai_recommend_pricing = COALESCE((p_data->>'ai_recommend_pricing')::boolean, organization_operational_profile.ai_recommend_pricing),
    wizard_phase_completed = GREATEST(
      organization_operational_profile.wizard_phase_completed,
      COALESCE((p_data->>'wizard_phase_completed')::int, organization_operational_profile.wizard_phase_completed)
    ),
    wizard_completed_at = CASE
      WHEN COALESCE((p_data->>'wizard_phase_completed')::int, 0) >= 3 AND organization_operational_profile.wizard_completed_at IS NULL
      THEN now()
      ELSE organization_operational_profile.wizard_completed_at
    END,
    updated_at = now();

  SELECT jsonb_build_object(
    'success', true,
    'organization_id', p_organization_id,
    'wizard_phase_completed', op.wizard_phase_completed,
    'wizard_completed_at', op.wizard_completed_at
  ) INTO v_result
  FROM organization_operational_profile op
  WHERE op.organization_id = p_organization_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_upsert_operational_profile(uuid, jsonb) TO authenticated;
