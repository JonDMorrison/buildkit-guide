
-- Add certification_tier and certification_updated_at to operational profile
ALTER TABLE public.organization_operational_profile
  ADD COLUMN IF NOT EXISTS certification_tier text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS certification_updated_at timestamptz;

-- Add CHECK constraint for valid tiers
ALTER TABLE public.organization_operational_profile
  ADD CONSTRAINT chk_certification_tier
  CHECK (certification_tier IN ('none', 'bronze', 'silver', 'gold', 'platinum'));

-- Create the certification tier calculation + summary RPC
CREATE OR REPLACE FUNCTION public.rpc_calculate_certification_tier(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_scores jsonb;
  v_maturity int;
  v_risk int;
  v_automation int;
  v_control int;
  v_profit_vis int;
  v_tier text := 'none';
  v_tier_reasons jsonb := '[]'::jsonb;
  v_audit_pass_count int := 0;
  v_audit_fail_count int := 0;
  v_audit_p0_blockers int := 0;
  v_has_recent_audit boolean := false;
  v_caller_id uuid := auth.uid();
BEGIN
  -- Auth: must be org member
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
      'tier', 'none',
      'previous_tier', 'none',
      'reasons', '[]'::jsonb,
      'has_profile', false
    );
  END IF;

  v_scores := COALESCE(v_profile.score_snapshot, '{}'::jsonb);
  v_maturity := COALESCE((v_scores->>'maturity_score')::int, 0);
  v_risk := COALESCE((v_scores->>'risk_score')::int, 50);
  v_automation := COALESCE((v_scores->>'automation_readiness')::int, 0);
  v_control := COALESCE((v_scores->>'control_index')::int, 50);
  v_profit_vis := COALESCE((v_scores->>'profit_visibility_score')::int, 50);

  -- Load latest audit run for this org
  SELECT pass_count, fail_count, p0_blockers
  INTO v_audit_pass_count, v_audit_fail_count, v_audit_p0_blockers
  FROM audit_run_history
  WHERE organization_id = p_organization_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_has_recent_audit := v_audit_pass_count IS NOT NULL;
  IF NOT v_has_recent_audit THEN
    v_audit_pass_count := 0;
    v_audit_fail_count := 0;
    v_audit_p0_blockers := 0;
  END IF;

  -- ===================== TIER CALCULATION =====================
  -- PLATINUM: maturity >= 80, control >= 70, automation >= 60, profit_vis >= 60,
  --           risk <= 40, zero P0 blockers, audit exists
  -- GOLD:     maturity >= 60, control >= 60, profit_vis >= 50, risk <= 60, zero P0
  -- SILVER:   maturity >= 40, control >= 40, risk <= 70, zero P0
  -- BRONZE:   wizard completed (maturity > 0 or phase >= 1)

  IF v_maturity >= 80 AND v_control >= 70 AND v_automation >= 60
     AND v_profit_vis >= 60 AND v_risk <= 40
     AND v_audit_p0_blockers = 0 AND v_has_recent_audit THEN
    v_tier := 'platinum';
    v_tier_reasons := v_tier_reasons || '"AI-optimized operations with automated risk controls"'::jsonb;
    v_tier_reasons := v_tier_reasons || '"Zero P0 audit blockers with passing audit"'::jsonb;
    v_tier_reasons := v_tier_reasons || '"High automation readiness and profit visibility"'::jsonb;

  ELSIF v_maturity >= 60 AND v_control >= 60 AND v_profit_vis >= 50
        AND v_risk <= 60 AND v_audit_p0_blockers = 0 THEN
    v_tier := 'gold';
    v_tier_reasons := v_tier_reasons || '"Strong variance discipline and profit tracking"'::jsonb;
    v_tier_reasons := v_tier_reasons || '"Zero P0 audit blockers"'::jsonb;
    IF v_automation < 60 THEN
      v_tier_reasons := v_tier_reasons || '"Enable AI features to reach Platinum"'::jsonb;
    END IF;

  ELSIF v_maturity >= 40 AND v_control >= 40 AND v_risk <= 70
        AND v_audit_p0_blockers = 0 THEN
    v_tier := 'silver';
    v_tier_reasons := v_tier_reasons || '"Approval discipline established"'::jsonb;
    IF v_profit_vis < 50 THEN
      v_tier_reasons := v_tier_reasons || '"Improve profit visibility to reach Gold"'::jsonb;
    END IF;

  ELSIF v_profile.wizard_phase_completed >= 1 THEN
    v_tier := 'bronze';
    v_tier_reasons := v_tier_reasons || '"Foundational controls configured"'::jsonb;
    IF v_audit_p0_blockers > 0 THEN
      v_tier_reasons := v_tier_reasons || ('"Resolve ' || v_audit_p0_blockers || ' P0 audit blockers to advance"')::jsonb;
    END IF;
    IF v_control < 40 THEN
      v_tier_reasons := v_tier_reasons || '"Strengthen approval controls to reach Silver"'::jsonb;
    END IF;

  ELSE
    v_tier_reasons := v_tier_reasons || '"Complete onboarding wizard to earn Bronze"'::jsonb;
  END IF;

  -- Persist tier
  UPDATE organization_operational_profile
  SET certification_tier = v_tier,
      certification_updated_at = now()
  WHERE organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'previous_tier', COALESCE(v_profile.certification_tier, 'none'),
    'reasons', v_tier_reasons,
    'has_profile', true,
    'scores', v_scores,
    'audit', jsonb_build_object(
      'has_recent', v_has_recent_audit,
      'pass_count', v_audit_pass_count,
      'fail_count', v_audit_fail_count,
      'p0_blockers', v_audit_p0_blockers
    ),
    'thresholds', jsonb_build_object(
      'platinum', 'maturity≥80 control≥70 automation≥60 visibility≥60 risk≤40 p0=0',
      'gold', 'maturity≥60 control≥60 visibility≥50 risk≤60 p0=0',
      'silver', 'maturity≥40 control≥40 risk≤70 p0=0',
      'bronze', 'wizard_phase≥1'
    ),
    'calculated_at', now()
  );
END;
$function$;
