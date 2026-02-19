
-- ================================================================
-- rpc_get_margin_flag_dictionary
-- Canonical single source of truth for margin intervention flag
-- labels and severities. SECURITY DEFINER, deterministic, no writes.
-- ================================================================

CREATE OR REPLACE FUNCTION public.rpc_get_margin_flag_dictionary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'low_historical_data', jsonb_build_object(
      'label',    'Low Historical Data',
      'severity', 'medium'
    ),
    'margin_declining', jsonb_build_object(
      'label',    'Margin Declining',
      'severity', 'high'
    ),
    'labor_burn_exceeding_benchmark', jsonb_build_object(
      'label',    'Labor Burn Exceeding Benchmark',
      'severity', 'high'
    ),
    'quote_approval_misses', jsonb_build_object(
      'label',    'Quote Approval Misses',
      'severity', 'high'
    )
  );
$$;

-- ── Grants ────────────────────────────────────────────────────────
REVOKE ALL  ON FUNCTION public.rpc_get_margin_flag_dictionary() FROM PUBLIC;
REVOKE ALL  ON FUNCTION public.rpc_get_margin_flag_dictionary() FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_margin_flag_dictionary() TO authenticated;

COMMENT ON FUNCTION public.rpc_get_margin_flag_dictionary() IS
  'Canonical margin flag dictionary: maps intervention_flag keys to '
  'human labels and severity. SECURITY DEFINER, deterministic, no writes. '
  'flag-dictionary:v1';
