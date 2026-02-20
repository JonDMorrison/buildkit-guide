
-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.economic_flag_dictionary (
  key               text        PRIMARY KEY,
  label             text        NOT NULL,
  severity          text        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  description       text        NOT NULL,
  default_action_key text       NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (read-only; no user writes)
ALTER TABLE public.economic_flag_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_flag_dictionary FORCE ROW LEVEL SECURITY;

-- Authenticated users may read
CREATE POLICY "authenticated_read_flag_dictionary"
  ON public.economic_flag_dictionary
  FOR SELECT
  TO authenticated
  USING (true);

-- Block all direct writes for authenticated/anon/public
REVOKE INSERT, UPDATE, DELETE ON public.economic_flag_dictionary FROM authenticated, anon, public;

-- ── Seed (deterministic, idempotent) ────────────────────────────────────────
INSERT INTO public.economic_flag_dictionary (key, label, severity, description, default_action_key)
VALUES
  (
    'low_historical_data',
    'Low Historical Data',
    'low',
    'Insufficient historical entries exist to produce statistically reliable cost projections. Without a benchmark the risk model cannot accurately flag burn-rate anomalies until they become severe. Projection uncertainty is high — margin outcomes may deviate ±10–20% from estimates until sufficient time entries and cost actuals are recorded.',
    'increase_data_capture'
  ),
  (
    'margin_declining',
    'Margin Declining',
    'high',
    'Week-over-week realized margin is trending downward. Left unaddressed, a declining trajectory compounds — each additional week of overrun directly reduces net profit at closeout. Typically −2% to −8% at completion per sustained week of decline, depending on project size and remaining duration.',
    'review_cost_controls'
  ),
  (
    'labor_burn_high',
    'Labor Burn Exceeding Benchmark',
    'high',
    'Labor costs are burning at a rate faster than the planned benchmark. Since labor is the largest controllable cost on most projects, high burn rates rapidly erode margin before materials or change orders can be adjusted. Every 10% excess labor burn translates to approximately 2–4% margin compression on a typical labour-heavy project.',
    'audit_labor_allocation'
  ),
  (
    'below_low_band',
    'Below Historical Low Band',
    'critical',
    'Realized margin has dropped below the organization''s historical low-band threshold — the worst recorded performance across comparable projects. This is a systemic signal, not a one-week anomaly. Projects below the low band have historically closed out 5–15% below initial planned margin. Immediate corrective action is required.',
    'escalate_to_executive'
  )
ON CONFLICT (key) DO UPDATE SET
  label              = EXCLUDED.label,
  severity           = EXCLUDED.severity,
  description        = EXCLUDED.description,
  default_action_key = EXCLUDED.default_action_key;

-- ── RPC ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rpc_get_economic_flag_dictionary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_flags jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'key',                f.key,
      'label',              f.label,
      'severity',           f.severity,
      'description',        f.description,
      'default_action_key', f.default_action_key
    )
    ORDER BY
      CASE f.severity
        WHEN 'critical' THEN 1
        WHEN 'high'     THEN 2
        WHEN 'medium'   THEN 3
        WHEN 'low'      THEN 4
        ELSE                 5
      END ASC,
      f.key ASC
  )
  INTO v_flags
  FROM public.economic_flag_dictionary f;

  RETURN jsonb_build_object(
    'flags', COALESCE(v_flags, '[]'::jsonb)
  );
END;
$$;

-- Security: revoke from all, grant only to authenticated
REVOKE ALL ON FUNCTION public.rpc_get_economic_flag_dictionary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_economic_flag_dictionary() TO authenticated;
