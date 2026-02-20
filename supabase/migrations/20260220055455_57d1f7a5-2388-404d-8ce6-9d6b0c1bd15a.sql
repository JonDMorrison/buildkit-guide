
-- ═══════════════════════════════════════════════════════════════════════════
-- public.rpc_generate_executive_margin_report(p_org_id uuid) → jsonb
--
-- Deterministic, no-AI, read-only executive report built on top of
-- rpc_get_executive_risk_summary. All text is template-driven.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_generate_executive_margin_report(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_summary           jsonb;

  -- Unpacked from summary
  v_active_count      int;
  v_at_risk           int;
  v_volatile          int;
  v_stable            int;
  v_high_risk_pct     numeric;
  v_top3_pct          numeric;
  v_top_causes        jsonb;
  v_top_projects      jsonb;
  v_risk_trend        numeric;
  v_margin_trend      numeric;
  v_avg_margin        numeric;
  v_os_score_raw      jsonb;

  -- Derived
  v_exec_summary      text;
  v_health_score      numeric;
  v_actions           jsonb := '[]'::jsonb;

  -- Recommended-action accumulator (ordered by priority DESC then key ASC
  --   so output is deterministic regardless of evaluation order)
  v_action_priority   int;
  v_action_text       text;
BEGIN
  -- ── 1. Membership guard ─────────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.rpc_is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Pull executive risk summary (single source of truth) ─────────────
  v_summary := public.rpc_get_executive_risk_summary(p_org_id);

  v_active_count  := COALESCE((v_summary->>'projects_active_count')::int,   0);
  v_at_risk       := COALESCE((v_summary->>'at_risk_count')::int,            0);
  v_volatile      := COALESCE((v_summary->>'volatile_count')::int,           0);
  v_stable        := COALESCE((v_summary->>'stable_count')::int,             0);
  v_high_risk_pct := COALESCE((v_summary->>'revenue_exposed_high_risk_percent')::numeric, 0);
  v_top3_pct      := COALESCE((v_summary->>'top_3_risky_revenue_percent')::numeric,       0);
  v_avg_margin    := COALESCE((v_summary->>'avg_projected_margin_at_completion_percent')::numeric, 0);
  v_risk_trend    := COALESCE((v_summary->>'risk_trend_last_30_days')::numeric,            0);
  v_margin_trend  := COALESCE((v_summary->>'margin_trend_last_30_days')::numeric,          0);
  v_top_causes    := COALESCE(v_summary->'top_causes',     '[]'::jsonb);
  v_top_projects  := COALESCE(v_summary->'top_risk_projects', '[]'::jsonb);
  v_os_score_raw  := v_summary->'os_score';

  -- ── 3. Deterministic executive summary ──────────────────────────────────
  --   Priority (highest wins):
  --     a) > 30% revenue at high risk → elevated
  --     b) 0 at-risk projects           → strong
  --     c) at_risk > 0, risk rising     → worsening
  --     d) volatile present only        → moderate
  --     e) fallback                     → acceptable
  IF v_high_risk_pct > 30 THEN
    v_exec_summary := 'Portfolio exposure is elevated.';
  ELSIF v_at_risk = 0 AND v_high_risk_pct = 0 THEN
    v_exec_summary := 'Portfolio margin stability is strong.';
  ELSIF v_at_risk > 0 AND v_risk_trend > 0 THEN
    v_exec_summary := 'Portfolio risk is rising. Immediate review of at-risk projects is required.';
  ELSIF v_volatile > 0 THEN
    v_exec_summary := 'Portfolio has moderate risk indicators. Volatile projects require active monitoring.';
  ELSE
    v_exec_summary := 'Portfolio margin is within acceptable range. Continue standard monitoring cadence.';
  END IF;

  -- ── 4. Portfolio health score ────────────────────────────────────────────
  --   Formula (deterministic, no external state):
  --     Start at 100
  --     −10 per at-risk project (max −40)
  --     −5  per volatile project (max −20)
  --     −15 if high_risk_pct > 50
  --     −10 if high_risk_pct > 30 (and ≤ 50)
  --     −5  if risk trend is rising (risk_trend > 0)
  --     −5  if margin trend is falling (margin_trend < 0)
  --     Clamped to [0, 100], rounded to 2 dp
  v_health_score := 100
    - LEAST(v_at_risk  * 10, 40)
    - LEAST(v_volatile * 5,  20)
    - CASE WHEN v_high_risk_pct > 50 THEN 15
           WHEN v_high_risk_pct > 30 THEN 10
           ELSE 0 END
    - CASE WHEN v_risk_trend   > 0 THEN 5 ELSE 0 END
    - CASE WHEN v_margin_trend < 0 THEN 5 ELSE 0 END;

  v_health_score := ROUND(GREATEST(LEAST(v_health_score, 100), 0)::numeric, 2);

  -- ── 5. Deterministic recommended actions ─────────────────────────────────
  --   Each condition is evaluated independently.
  --   Actions are collected into a temp set and sorted by (priority DESC, label ASC)
  --   to guarantee a stable order regardless of IF-branch execution sequence.
  CREATE TEMP TABLE IF NOT EXISTS _exec_report_actions (
    priority int,
    label    text
  ) ON COMMIT DROP;
  TRUNCATE _exec_report_actions;

  -- P1: Critical revenue exposure
  IF v_high_risk_pct > 30 THEN
    INSERT INTO _exec_report_actions VALUES (
      10,
      'Conduct immediate financial review of all at-risk projects contributing to high revenue exposure (' ||
        v_high_risk_pct::text || '% of portfolio revenue at risk).'
    );
  END IF;

  -- P1: Rising risk trend
  IF v_risk_trend > 5 THEN
    INSERT INTO _exec_report_actions VALUES (
      10,
      'Risk scores are trending upward across the portfolio (+' || v_risk_trend::text ||
        ' pts over 30 days). Investigate root causes before the next billing cycle.'
    );
  END IF;

  -- P2: At-risk projects present
  IF v_at_risk > 0 THEN
    INSERT INTO _exec_report_actions VALUES (
      7,
      v_at_risk::text || ' project(s) are classified At-Risk. ' ||
        'Assign executive sponsor and require weekly financial checkpoint.'
    );
  END IF;

  -- P2: Margin declining
  IF v_margin_trend < 0 THEN
    INSERT INTO _exec_report_actions VALUES (
      7,
      'Average projected margin declined ' || ABS(v_margin_trend)::text ||
        ' pts over the last 30 days. Review labor allocation and change order pipeline.'
    );
  END IF;

  -- P3: Volatile projects present
  IF v_volatile > 0 THEN
    INSERT INTO _exec_report_actions VALUES (
      4,
      v_volatile::text || ' project(s) are Volatile. ' ||
        'Escalate to PM for corrective action plan within 5 business days.'
    );
  END IF;

  -- P3: Top-3 projects hold large revenue share
  IF v_top3_pct > 50 THEN
    INSERT INTO _exec_report_actions VALUES (
      4,
      'Top 3 highest-risk projects represent ' || v_top3_pct::text ||
        '% of portfolio revenue. Diversify risk monitoring focus.'
    );
  END IF;

  -- P4: Low average margin
  IF v_avg_margin < 10 THEN
    INSERT INTO _exec_report_actions VALUES (
      2,
      'Average projected margin at completion is below 10% (' || v_avg_margin::text ||
        '%). Review estimating assumptions and cost benchmarks organization-wide.'
    );
  END IF;

  -- P0: Nothing to act on
  IF v_at_risk = 0 AND v_volatile = 0 AND v_high_risk_pct <= 30 THEN
    INSERT INTO _exec_report_actions VALUES (
      1,
      'No immediate actions required. Maintain current monitoring cadence and capture weekly snapshots.'
    );
  END IF;

  -- Materialize actions as deterministic jsonb array
  SELECT COALESCE(jsonb_agg(label ORDER BY priority DESC, label ASC), '[]'::jsonb)
    INTO v_actions
    FROM _exec_report_actions;

  -- ── 6. Return ────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'org_id',               p_org_id,
    'executive_summary',    v_exec_summary,
    'portfolio_health_score', v_health_score,
    'risk_distribution',    jsonb_build_object(
                              'at_risk',  v_at_risk,
                              'stable',   v_stable,
                              'volatile', v_volatile
                            ),
    'revenue_exposure',     jsonb_build_object(
                              'high_risk_percent', v_high_risk_pct,
                              'top_3_percent',     v_top3_pct
                            ),
    'top_causes',           v_top_causes,
    'top_projects',         v_top_projects,
    'recommended_actions',  v_actions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_generate_executive_margin_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_generate_executive_margin_report(uuid) TO authenticated;
