
-- =============================================================
-- organization_guardrails table + RLS + RPCs + seed trigger
-- =============================================================

-- 1. Table
CREATE TABLE public.organization_guardrails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  mode text NOT NULL DEFAULT 'off',
  threshold_numeric numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

-- Validation trigger for mode (instead of CHECK for flexibility)
CREATE OR REPLACE FUNCTION public.trg_validate_guardrail_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.mode NOT IN ('off', 'warn', 'block') THEN
    RAISE EXCEPTION 'Invalid guardrail mode: %. Must be off, warn, or block.', NEW.mode;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_guardrail_mode
  BEFORE INSERT OR UPDATE ON public.organization_guardrails
  FOR EACH ROW EXECUTE FUNCTION public.trg_validate_guardrail_mode();

-- 2. RLS: org-scoped SELECT, deny all direct writes
ALTER TABLE public.organization_guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_guardrails FORCE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read guardrails"
  ON public.organization_guardrails
  FOR SELECT
  USING (has_org_membership(organization_id));

CREATE POLICY "Deny direct insert"
  ON public.organization_guardrails
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny direct update"
  ON public.organization_guardrails
  FOR UPDATE
  USING (false);

CREATE POLICY "Deny direct delete"
  ON public.organization_guardrails
  FOR DELETE
  USING (false);

-- 3. RPC: rpc_get_guardrails — returns all guardrails for user's org
CREATE OR REPLACE FUNCTION public.rpc_get_guardrails()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT organization_id INTO v_org_id
    FROM organization_memberships
   WHERE user_id = auth.uid() AND is_active = true
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No org membership' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', g.id,
    'key', g.key,
    'mode', g.mode,
    'threshold_numeric', g.threshold_numeric,
    'updated_at', g.updated_at
  ) ORDER BY g.key)
  INTO v_result
  FROM organization_guardrails g
  WHERE g.organization_id = v_org_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_guardrails() TO authenticated;

-- 4. RPC: rpc_set_guardrail — upsert a guardrail (admin/pm only)
CREATE OR REPLACE FUNCTION public.rpc_set_guardrail(
  p_key text,
  p_mode text,
  p_threshold numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_role text;
  v_row record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT om.organization_id, om.role INTO v_org_id, v_role
    FROM organization_memberships om
   WHERE om.user_id = auth.uid() AND om.is_active = true
   LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No org membership' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('admin', 'pm') THEN
    RAISE EXCEPTION 'Insufficient role: only admin/pm can modify guardrails' USING ERRCODE = '42501';
  END IF;

  IF p_mode NOT IN ('off', 'warn', 'block') THEN
    RAISE EXCEPTION 'Invalid mode: %. Must be off, warn, or block.', p_mode;
  END IF;

  INSERT INTO organization_guardrails (organization_id, key, mode, threshold_numeric)
  VALUES (v_org_id, p_key, p_mode, p_threshold)
  ON CONFLICT (organization_id, key)
  DO UPDATE SET mode = EXCLUDED.mode, threshold_numeric = EXCLUDED.threshold_numeric
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'key', v_row.key,
    'mode', v_row.mode,
    'threshold_numeric', v_row.threshold_numeric,
    'updated_at', v_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_set_guardrail(text, text, numeric) TO authenticated;

-- 5. Seed defaults trigger: auto-create guardrails when org is created
CREATE OR REPLACE FUNCTION public.trg_seed_org_guardrails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_guardrails (organization_id, key, mode, threshold_numeric) VALUES
    (NEW.id, 'block_time_before_estimate', 'warn', NULL),
    (NEW.id, 'warn_unrated_labor', 'warn', NULL),
    (NEW.id, 'overage_risk_threshold', 'warn', 0.10),
    (NEW.id, 'block_invoice_send_without_approval', 'block', NULL)
  ON CONFLICT (organization_id, key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_org_guardrails
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_seed_org_guardrails();

-- 6. Backfill existing orgs with defaults
INSERT INTO organization_guardrails (organization_id, key, mode, threshold_numeric)
SELECT o.id, v.key, v.mode, v.threshold
FROM organizations o
CROSS JOIN (VALUES
  ('block_time_before_estimate', 'warn', NULL::numeric),
  ('warn_unrated_labor', 'warn', NULL::numeric),
  ('overage_risk_threshold', 'warn', 0.10::numeric),
  ('block_invoice_send_without_approval', 'block', NULL::numeric)
) AS v(key, mode, threshold)
ON CONFLICT (organization_id, key) DO NOTHING;
