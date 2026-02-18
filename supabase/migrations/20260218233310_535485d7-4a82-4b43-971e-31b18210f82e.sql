
-- 1. Add new checklist columns
ALTER TABLE public.setup_checklist_progress
  ADD COLUMN IF NOT EXISTS step_labor_rates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_invoice_permissions boolean NOT NULL DEFAULT false;

-- 2. Create RPC for labor costing setup status
CREATE OR REPLACE FUNCTION public.rpc_get_org_costing_setup_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_currency text;
  v_missing_users jsonb := '[]'::jsonb;
  v_missing_count int := 0;
  v_has_mismatch boolean := false;
  r record;
BEGIN
  -- Validate caller is org member
  IF NOT public.has_org_membership(p_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization' USING ERRCODE = '42501';
  END IF;

  -- Get base currency
  SELECT COALESCE(o.base_currency, 'CAD') INTO v_base_currency
  FROM organizations o WHERE o.id = p_org_id;

  -- Find members with missing/invalid rates or currency mismatch
  FOR r IN
    SELECT
      om.user_id,
      COALESCE(p.full_name, p.email, 'Unknown') AS name,
      CASE
        WHEN om.hourly_cost_rate IS NULL THEN 'missing_rate'
        WHEN om.hourly_cost_rate <= 0 THEN 'invalid_rate'
        WHEN om.rates_currency IS DISTINCT FROM v_base_currency THEN 'currency_mismatch'
      END AS reason
    FROM organization_memberships om
    JOIN profiles p ON p.id = om.user_id
    WHERE om.organization_id = p_org_id
      AND om.is_active = true
      AND om.role IN ('foreman', 'internal_worker', 'external_trade')
      AND (
        om.hourly_cost_rate IS NULL
        OR om.hourly_cost_rate <= 0
        OR om.rates_currency IS DISTINCT FROM v_base_currency
      )
  LOOP
    v_missing_users := v_missing_users || jsonb_build_object(
      'id', r.user_id,
      'name', r.name,
      'reason', r.reason
    );
    IF r.reason = 'currency_mismatch' THEN
      v_has_mismatch := true;
    ELSE
      v_missing_count := v_missing_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'missing_labor_rates_count', v_missing_count,
    'missing_labor_rates_users', v_missing_users,
    'has_currency_mismatch', v_has_mismatch
  );
END;
$$;
