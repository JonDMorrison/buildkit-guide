
CREATE OR REPLACE FUNCTION public.rpc_generate_org_operational_summary(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_scores jsonb;
  v_strengths jsonb := '[]'::jsonb;
  v_weaknesses jsonb := '[]'::jsonb;
  v_risk_flags jsonb := '[]'::jsonb;
  v_automation_opps jsonb := '[]'::jsonb;
  v_profit_risks jsonb := '[]'::jsonb;
  v_maturity int;
  v_risk int;
  v_automation int;
  v_control int;
  v_profit_vis int;
  v_caller_id uuid := auth.uid();
BEGIN
  -- Auth check: caller must be member of org
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = p_organization_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Load profile
  SELECT * INTO v_profile
  FROM organization_operational_profile
  WHERE organization_id = p_organization_id;

  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'strengths', '[]'::jsonb,
      'weaknesses', '[]'::jsonb,
      'risk_flags', '[]'::jsonb,
      'automation_opportunities', '[]'::jsonb,
      'profit_leakage_risks', '[]'::jsonb,
      'generated_at', now(),
      'has_profile', false
    );
  END IF;

  v_scores := COALESCE(v_profile.score_snapshot, '{}'::jsonb);
  v_maturity := COALESCE((v_scores->>'maturity_score')::int, 0);
  v_risk := COALESCE((v_scores->>'risk_score')::int, 50);
  v_automation := COALESCE((v_scores->>'automation_readiness')::int, 0);
  v_control := COALESCE((v_scores->>'control_index')::int, 50);
  v_profit_vis := COALESCE((v_scores->>'profit_visibility_score')::int, 50);

  -- ===================== STRENGTHS =====================
  IF v_control >= 70 THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'high_control', 'label', 'Strong financial controls',
      'detail', 'Invoice approval and quote gates are well-configured.',
      'score', v_control);
  END IF;

  IF v_maturity >= 70 THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'high_maturity', 'label', 'Mature operational processes',
      'detail', 'Wizard completed with auditing and variance tracking enabled.',
      'score', v_maturity);
  END IF;

  IF v_profit_vis >= 70 THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'high_visibility', 'label', 'Strong profit visibility',
      'detail', 'Leakage sources identified and per-trade variance tracking active.',
      'score', v_profit_vis);
  END IF;

  IF v_risk <= 30 THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'low_risk', 'label', 'Low operational risk',
      'detail', 'Proactive change order handling and regular time audits.',
      'score', v_risk);
  END IF;

  IF v_profile.require_safety_before_work = true THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'safety_first', 'label', 'Safety-first culture',
      'detail', 'Safety/compliance forms required before work begins.',
      'score', null);
  END IF;

  IF v_profile.invoice_permission_model = 'admin_only' THEN
    v_strengths := v_strengths || jsonb_build_object(
      'key', 'strict_invoicing', 'label', 'Strict invoice permissions',
      'detail', 'Only admins can create invoices, reducing unauthorized billing.',
      'score', null);
  END IF;

  -- ===================== WEAKNESSES =====================
  IF v_control < 40 THEN
    v_weaknesses := v_weaknesses || jsonb_build_object(
      'key', 'low_control', 'label', 'Weak financial controls',
      'detail', 'Invoice approval or quote gates not enforced. Consider tightening permissions.',
      'score', v_control);
  END IF;

  IF v_maturity < 40 THEN
    v_weaknesses := v_weaknesses || jsonb_build_object(
      'key', 'low_maturity', 'label', 'Incomplete operational setup',
      'detail', 'Onboarding wizard not fully completed or key diagnostics unanswered.',
      'score', v_maturity);
  END IF;

  IF v_profit_vis < 40 THEN
    v_weaknesses := v_weaknesses || jsonb_build_object(
      'key', 'low_visibility', 'label', 'Poor profit visibility',
      'detail', 'Leakage source unknown or per-trade variance tracking disabled.',
      'score', v_profit_vis);
  END IF;

  IF v_profile.time_audit_frequency IS NULL OR v_profile.time_audit_frequency = 'never' THEN
    v_weaknesses := v_weaknesses || jsonb_build_object(
      'key', 'no_time_audit', 'label', 'No time entry auditing',
      'detail', 'Time entries are never audited, increasing risk of billing errors.',
      'score', null);
  END IF;

  IF v_profile.tasks_before_quote = true THEN
    v_weaknesses := v_weaknesses || jsonb_build_object(
      'key', 'tasks_before_quote', 'label', 'Work starts before quote approval',
      'detail', 'Tasks can begin before a quote is approved, risking scope creep.',
      'score', null);
  END IF;

  -- ===================== RISK FLAGS =====================
  IF v_risk > 70 THEN
    v_risk_flags := v_risk_flags || jsonb_build_object(
      'key', 'high_risk', 'severity', 'critical',
      'label', 'High operational risk score',
      'detail', 'Combination of loss absorption, no auditing, or missing controls detected.',
      'score', v_risk);
  ELSIF v_risk > 50 THEN
    v_risk_flags := v_risk_flags || jsonb_build_object(
      'key', 'elevated_risk', 'severity', 'warn',
      'label', 'Elevated operational risk',
      'detail', 'Some risk factors present. Review over-estimate handling and audit frequency.',
      'score', v_risk);
  END IF;

  IF v_profile.over_estimate_action = 'absorb' THEN
    v_risk_flags := v_risk_flags || jsonb_build_object(
      'key', 'absorb_loss', 'severity', 'critical',
      'label', 'Loss absorption policy',
      'detail', 'Organization absorbs losses on overruns instead of issuing change orders.',
      'score', null);
  END IF;

  IF v_profile.profit_leakage_source = 'unknown' THEN
    v_risk_flags := v_risk_flags || jsonb_build_object(
      'key', 'unknown_leakage', 'severity', 'warn',
      'label', 'Profit leakage source unknown',
      'detail', 'Organization has not identified primary source of profit leakage.',
      'score', null);
  END IF;

  IF v_profile.quote_standardization = 'custom' THEN
    v_risk_flags := v_risk_flags || jsonb_build_object(
      'key', 'custom_quotes', 'severity', 'info',
      'label', 'Non-standardized quoting',
      'detail', 'Every quote is custom, which may lead to inconsistent pricing.',
      'score', null);
  END IF;

  -- ===================== AUTOMATION OPPORTUNITIES =====================
  IF v_automation >= 60 THEN
    v_automation_opps := v_automation_opps || jsonb_build_object(
      'key', 'ready_for_ai', 'label', 'Organization is automation-ready',
      'detail', 'AI features like auto-task generation and invoice timing suggestions are recommended.',
      'score', v_automation);
  END IF;

  IF v_profile.ai_auto_change_orders = false AND v_profile.over_estimate_action = 'change_order' THEN
    v_automation_opps := v_automation_opps || jsonb_build_object(
      'key', 'auto_change_orders', 'label', 'Enable AI change order suggestions',
      'detail', 'Organization issues change orders manually but AI auto-generation is disabled.',
      'score', null);
  END IF;

  IF v_profile.ai_recommend_pricing = false AND v_profile.quote_standardization = 'standardized' THEN
    v_automation_opps := v_automation_opps || jsonb_build_object(
      'key', 'auto_pricing', 'label', 'Enable AI pricing recommendations',
      'detail', 'Standardized quotes could benefit from AI-driven pricing suggestions.',
      'score', null);
  END IF;

  IF v_profile.ai_flag_profit_risk = false THEN
    v_automation_opps := v_automation_opps || jsonb_build_object(
      'key', 'enable_profit_flags', 'label', 'Enable AI profit risk flagging',
      'detail', 'Early warnings for margin erosion are currently disabled.',
      'score', null);
  END IF;

  IF v_profile.rate_source = 'manual' THEN
    v_automation_opps := v_automation_opps || jsonb_build_object(
      'key', 'auto_rates', 'label', 'Automate labor rate sourcing',
      'detail', 'Rates are manually entered. Consider union or per-worker rate imports.',
      'score', null);
  END IF;

  -- ===================== PROFIT LEAKAGE RISKS =====================
  IF v_profile.labor_cost_model = 'blended' THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'blended_rates', 'severity', 'warn',
      'label', 'Blended labor rates hide cost variance',
      'detail', 'Per-worker or per-trade rates would reveal where labor costs exceed estimates.',
      'score', null);
  END IF;

  IF v_profile.track_variance_per_trade IS NOT TRUE THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'no_trade_variance', 'severity', 'warn',
      'label', 'Per-trade variance tracking disabled',
      'detail', 'Cannot identify which trades consistently over-run estimates.',
      'score', null);
  END IF;

  IF v_profile.profit_leakage_source = 'labor' THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'labor_leakage', 'severity', 'critical',
      'label', 'Labor identified as primary leakage source',
      'detail', 'Focus on time auditing, per-worker rate accuracy, and overtime tracking.',
      'score', null);
  ELSIF v_profile.profit_leakage_source = 'material' THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'material_leakage', 'severity', 'critical',
      'label', 'Material identified as primary leakage source',
      'detail', 'Focus on receipt classification, vendor pricing reviews, and waste tracking.',
      'score', null);
  ELSIF v_profile.profit_leakage_source = 'scope_creep' THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'scope_creep_leakage', 'severity', 'critical',
      'label', 'Scope creep identified as primary leakage source',
      'detail', 'Enforce quote approval gates, change order documentation, and scope-to-task traceability.',
      'score', null);
  END IF;

  IF v_profile.invoice_approver = 'anyone' THEN
    v_profit_risks := v_profit_risks || jsonb_build_object(
      'key', 'open_invoicing', 'severity', 'warn',
      'label', 'Unrestricted invoice approval',
      'detail', 'Anyone can approve invoices, increasing risk of unauthorized or premature billing.',
      'score', null);
  END IF;

  RETURN jsonb_build_object(
    'strengths', v_strengths,
    'weaknesses', v_weaknesses,
    'risk_flags', v_risk_flags,
    'automation_opportunities', v_automation_opps,
    'profit_leakage_risks', v_profit_risks,
    'generated_at', now(),
    'has_profile', true,
    'scores', v_scores
  );
END;
$function$;
