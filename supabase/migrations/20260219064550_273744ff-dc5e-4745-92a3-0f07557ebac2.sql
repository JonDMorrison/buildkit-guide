
-- Add score_snapshot column to operational profile
ALTER TABLE public.organization_operational_profile
  ADD COLUMN IF NOT EXISTS score_snapshot jsonb DEFAULT NULL;

-- Scoring engine RPC
CREATE OR REPLACE FUNCTION public.rpc_calculate_operational_profile_score(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile record;
  v_maturity int := 0;
  v_risk int := 0;
  v_automation int := 0;
  v_profit_vis int := 0;
  v_control int := 0;
  v_result jsonb;
BEGIN
  -- Auth check
  IF NOT has_org_membership(p_organization_id) THEN
    RAISE EXCEPTION 'Forbidden: not a member of this organization' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile
  FROM organization_operational_profile
  WHERE organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'maturity_score', 0,
      'risk_score', 100,
      'automation_readiness', 0,
      'profit_visibility_score', 0,
      'control_index', 0,
      'computed_at', now(),
      'profile_exists', false
    );
  END IF;

  -- ========== MATURITY SCORE (0-100) ==========
  -- Wizard completion: 0-30 pts
  v_maturity := v_maturity + LEAST(v_profile.wizard_phase_completed * 10, 30);

  -- Time audit frequency: 0-15 pts
  v_maturity := v_maturity + CASE v_profile.time_audit_frequency
    WHEN 'daily' THEN 15
    WHEN 'weekly' THEN 12
    WHEN 'monthly' THEN 7
    WHEN 'never' THEN 0
    ELSE 0
  END;

  -- Variance tracking: 0-15 pts
  IF v_profile.track_variance_per_trade = true THEN
    v_maturity := v_maturity + 15;
  END IF;

  -- Safety requirement: 0-10 pts
  IF v_profile.require_safety_before_work = true THEN
    v_maturity := v_maturity + 10;
  END IF;

  -- Quote standardization: 0-10 pts
  v_maturity := v_maturity + CASE v_profile.quote_standardization
    WHEN 'standardized' THEN 10
    WHEN 'semi_custom' THEN 6
    WHEN 'fully_custom' THEN 2
    ELSE 0
  END;

  -- Per-trade or per-worker labor model: 0-10 pts
  v_maturity := v_maturity + CASE v_profile.labor_cost_model
    WHEN 'per_worker' THEN 10
    WHEN 'per_trade' THEN 7
    WHEN 'blended' THEN 3
    ELSE 0
  END;

  -- Workflow mode: 0-10 pts
  IF v_profile.workflow_mode_default = 'ai_optimized' THEN
    v_maturity := v_maturity + 10;
  ELSE
    v_maturity := v_maturity + 4;
  END IF;

  v_maturity := LEAST(v_maturity, 100);

  -- ========== RISK SCORE (0-100, higher = more risk) ==========
  v_risk := 50; -- baseline

  -- No time audits → +25 risk
  IF v_profile.time_audit_frequency IS NULL OR v_profile.time_audit_frequency = 'never' THEN
    v_risk := v_risk + 25;
  ELSIF v_profile.time_audit_frequency = 'monthly' THEN
    v_risk := v_risk + 10;
  ELSIF v_profile.time_audit_frequency = 'weekly' THEN
    v_risk := v_risk - 10;
  ELSIF v_profile.time_audit_frequency = 'daily' THEN
    v_risk := v_risk - 20;
  END IF;

  -- Absorb loss → +20 risk
  IF v_profile.over_estimate_action = 'absorb_loss' THEN
    v_risk := v_risk + 20;
  ELSIF v_profile.over_estimate_action = 'not_tracked' THEN
    v_risk := v_risk + 15;
  ELSIF v_profile.over_estimate_action = 'change_order' THEN
    v_risk := v_risk - 15;
  ELSIF v_profile.over_estimate_action = 'adjust_future' THEN
    v_risk := v_risk - 5;
  END IF;

  -- Tasks before quote → +10 risk
  IF v_profile.tasks_before_quote = true THEN
    v_risk := v_risk + 10;
  ELSE
    v_risk := v_risk - 10;
  END IF;

  -- No variance tracking → +10 risk
  IF v_profile.track_variance_per_trade IS NULL OR v_profile.track_variance_per_trade = false THEN
    v_risk := v_risk + 10;
  ELSE
    v_risk := v_risk - 10;
  END IF;

  v_risk := GREATEST(LEAST(v_risk, 100), 0);

  -- ========== AUTOMATION READINESS (0-100) ==========
  v_automation := 0;

  -- AI risk mode
  v_automation := v_automation + CASE v_profile.ai_risk_mode
    WHEN 'strict' THEN 30
    WHEN 'balanced' THEN 20
    WHEN 'advisory' THEN 10
    ELSE 10
  END;

  -- AI feature toggles: 15 pts each
  IF v_profile.ai_auto_change_orders = true THEN
    v_automation := v_automation + 15;
  END IF;
  IF v_profile.ai_flag_profit_risk = true THEN
    v_automation := v_automation + 15;
  END IF;
  IF v_profile.ai_recommend_pricing = true THEN
    v_automation := v_automation + 15;
  END IF;

  -- Workflow mode
  IF v_profile.workflow_mode_default = 'ai_optimized' THEN
    v_automation := v_automation + 25;
  ELSE
    v_automation := v_automation + 5;
  END IF;

  v_automation := LEAST(v_automation, 100);

  -- ========== PROFIT VISIBILITY (0-100) ==========
  v_profit_vis := 0;

  -- Variance tracking: +25
  IF v_profile.track_variance_per_trade = true THEN
    v_profit_vis := v_profit_vis + 25;
  END IF;

  -- Profit leakage awareness: +20
  v_profit_vis := v_profit_vis + CASE v_profile.profit_leakage_source
    WHEN 'labor' THEN 20
    WHEN 'material' THEN 20
    WHEN 'scope_creep' THEN 20
    WHEN 'unknown' THEN 0
    ELSE 0
  END;

  -- Labor cost model granularity: +20
  v_profit_vis := v_profit_vis + CASE v_profile.labor_cost_model
    WHEN 'per_worker' THEN 20
    WHEN 'per_trade' THEN 15
    WHEN 'blended' THEN 5
    ELSE 0
  END;

  -- Time audit frequency: +15
  v_profit_vis := v_profit_vis + CASE v_profile.time_audit_frequency
    WHEN 'daily' THEN 15
    WHEN 'weekly' THEN 12
    WHEN 'monthly' THEN 7
    WHEN 'never' THEN 0
    ELSE 0
  END;

  -- AI profit flagging: +10
  IF v_profile.ai_flag_profit_risk = true THEN
    v_profit_vis := v_profit_vis + 10;
  END IF;

  -- Over-estimate action awareness: +10
  IF v_profile.over_estimate_action IS NOT NULL AND v_profile.over_estimate_action != 'not_tracked' THEN
    v_profit_vis := v_profit_vis + 10;
  END IF;

  v_profit_vis := LEAST(v_profit_vis, 100);

  -- ========== CONTROL INDEX (0-100) ==========
  v_control := 0;

  -- Invoice permission model: +25
  v_control := v_control + CASE v_profile.invoice_permission_model
    WHEN 'strict' THEN 25
    WHEN 'admin_only' THEN 20
    WHEN 'pm_and_admin' THEN 12
    WHEN 'anyone' THEN 0
    ELSE 5
  END;

  -- Invoice approver defined: +15
  IF v_profile.invoice_approver IS NOT NULL AND v_profile.invoice_approver != 'anyone' THEN
    v_control := v_control + 15;
  END IF;

  -- Quote before tasks: +20
  IF v_profile.tasks_before_quote = false THEN
    v_control := v_control + 20;
  END IF;

  -- Safety before work: +15
  IF v_profile.require_safety_before_work = true THEN
    v_control := v_control + 15;
  END IF;

  -- Standardized quotes: +10
  IF v_profile.quote_standardization = 'standardized' THEN
    v_control := v_control + 10;
  ELSIF v_profile.quote_standardization = 'semi_custom' THEN
    v_control := v_control + 5;
  END IF;

  -- AI strict mode: +15
  IF v_profile.ai_risk_mode = 'strict' THEN
    v_control := v_control + 15;
  ELSIF v_profile.ai_risk_mode = 'balanced' THEN
    v_control := v_control + 8;
  END IF;

  v_control := LEAST(v_control, 100);

  -- Build result
  v_result := jsonb_build_object(
    'maturity_score', v_maturity,
    'risk_score', v_risk,
    'automation_readiness', v_automation,
    'profit_visibility_score', v_profit_vis,
    'control_index', v_control,
    'computed_at', now(),
    'profile_exists', true
  );

  -- Persist snapshot
  UPDATE organization_operational_profile
  SET score_snapshot = v_result,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_calculate_operational_profile_score(uuid) TO authenticated;
