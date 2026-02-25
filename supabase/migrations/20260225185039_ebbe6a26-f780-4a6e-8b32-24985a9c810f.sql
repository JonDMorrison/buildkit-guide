
-- ═══════════════════════════════════════════════════════════════════════
-- Stage 20: Decision Notes Hardening — RLS tightening + dedupe column
-- ═══════════════════════════════════════════════════════════════════════

-- PART A: Tighten SELECT to admin/PM only
DROP POLICY IF EXISTS "edn_select_org_member" ON public.executive_decision_notes;

CREATE POLICY "edn_select_admin_pm"
  ON public.executive_decision_notes FOR SELECT TO authenticated
  USING (
    public.has_org_membership(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = executive_decision_notes.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('admin', 'pm')
    )
  );

-- PART B: Add client_hash column for idempotent import
ALTER TABLE public.executive_decision_notes
  ADD COLUMN IF NOT EXISTS client_hash text;

-- Partial unique index: prevent duplicates when client_hash is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_edn_org_client_hash_unique
  ON public.executive_decision_notes (organization_id, client_hash)
  WHERE client_hash IS NOT NULL;
