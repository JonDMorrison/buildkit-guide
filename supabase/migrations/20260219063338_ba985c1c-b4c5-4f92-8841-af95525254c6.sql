-- 1. Create organization_intelligence_profile table
CREATE TABLE public.organization_intelligence_profile (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  base_currency text NOT NULL DEFAULT 'CAD',
  labor_cost_model text NOT NULL DEFAULT 'hourly' CHECK (labor_cost_model IN ('hourly','blended','per_task')),
  labor_rate_source text NOT NULL DEFAULT 'user_rate' CHECK (labor_rate_source IN ('user_rate','trade_rate','flat_cost')),
  invoice_permission_model text NOT NULL DEFAULT 'strict' CHECK (invoice_permission_model IN ('strict','project_admin','custom')),
  quote_required_before_tasks boolean NOT NULL DEFAULT false,
  require_quote_approved boolean NOT NULL DEFAULT false,
  workflow_mode_default text NOT NULL DEFAULT 'manual' CHECK (workflow_mode_default IN ('manual','ai_optimized')),
  allow_currency_mismatch boolean NOT NULL DEFAULT false,
  region text,
  tax_model text NOT NULL DEFAULT 'simple' CHECK (tax_model IN ('simple','multi_region')),
  ai_style text NOT NULL DEFAULT 'balanced' CHECK (ai_style IN ('conservative','balanced','aggressive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_intelligence_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_intelligence_profile FORCE ROW LEVEL SECURITY;

-- Read: org members only
CREATE POLICY "Members can view their org intelligence profile"
  ON public.organization_intelligence_profile FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

-- Block all direct writes
CREATE POLICY "No direct insert" ON public.organization_intelligence_profile FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No direct update" ON public.organization_intelligence_profile FOR UPDATE TO authenticated USING (false);
CREATE POLICY "No direct delete" ON public.organization_intelligence_profile FOR DELETE TO authenticated USING (false);

-- Updated_at trigger
CREATE TRIGGER update_org_intelligence_profile_updated_at
  BEFORE UPDATE ON public.organization_intelligence_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Write RPC (SECURITY DEFINER, admin-only)
CREATE OR REPLACE FUNCTION public.rpc_update_org_intelligence_profile(
  p_organization_id uuid,
  p_patch jsonb
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_allowed_keys text[] := ARRAY[
    'base_currency','labor_cost_model','labor_rate_source','invoice_permission_model',
    'quote_required_before_tasks','require_quote_approved','workflow_mode_default',
    'allow_currency_mismatch','region','tax_model','ai_style'
  ];
  v_key text;
  v_sql text;
  v_set_clauses text[] := '{}';
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT has_org_role(p_organization_id, ARRAY['admin']) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Validate keys
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'Invalid field: %', v_key;
    END IF;
  END LOOP;

  -- Upsert
  INSERT INTO organization_intelligence_profile (organization_id)
  VALUES (p_organization_id)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Dynamic safe update
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    CASE v_key
      WHEN 'base_currency' THEN UPDATE organization_intelligence_profile SET base_currency = (p_patch->>'base_currency') WHERE organization_id = p_organization_id;
      WHEN 'labor_cost_model' THEN UPDATE organization_intelligence_profile SET labor_cost_model = (p_patch->>'labor_cost_model') WHERE organization_id = p_organization_id;
      WHEN 'labor_rate_source' THEN UPDATE organization_intelligence_profile SET labor_rate_source = (p_patch->>'labor_rate_source') WHERE organization_id = p_organization_id;
      WHEN 'invoice_permission_model' THEN UPDATE organization_intelligence_profile SET invoice_permission_model = (p_patch->>'invoice_permission_model') WHERE organization_id = p_organization_id;
      WHEN 'quote_required_before_tasks' THEN UPDATE organization_intelligence_profile SET quote_required_before_tasks = (p_patch->>'quote_required_before_tasks')::boolean WHERE organization_id = p_organization_id;
      WHEN 'require_quote_approved' THEN UPDATE organization_intelligence_profile SET require_quote_approved = (p_patch->>'require_quote_approved')::boolean WHERE organization_id = p_organization_id;
      WHEN 'workflow_mode_default' THEN UPDATE organization_intelligence_profile SET workflow_mode_default = (p_patch->>'workflow_mode_default') WHERE organization_id = p_organization_id;
      WHEN 'allow_currency_mismatch' THEN UPDATE organization_intelligence_profile SET allow_currency_mismatch = (p_patch->>'allow_currency_mismatch')::boolean WHERE organization_id = p_organization_id;
      WHEN 'region' THEN UPDATE organization_intelligence_profile SET region = (p_patch->>'region') WHERE organization_id = p_organization_id;
      WHEN 'tax_model' THEN UPDATE organization_intelligence_profile SET tax_model = (p_patch->>'tax_model') WHERE organization_id = p_organization_id;
      WHEN 'ai_style' THEN UPDATE organization_intelligence_profile SET ai_style = (p_patch->>'ai_style') WHERE organization_id = p_organization_id;
    END CASE;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'organization_id', p_organization_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rpc_update_org_intelligence_profile(uuid, jsonb) TO authenticated;