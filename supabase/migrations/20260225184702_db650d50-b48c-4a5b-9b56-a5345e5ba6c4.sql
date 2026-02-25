
-- ═══════════════════════════════════════════════════════════════════════
-- executive_decision_notes — org-scoped decision capture for Admin/PM
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE public.executive_decision_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  as_of timestamptz NOT NULL,
  template_type text NOT NULL CHECK (template_type IN ('weekly', 'project', 'risk')),
  top3_projects text[] NOT NULL DEFAULT '{}',
  body text NOT NULL,
  source text NOT NULL DEFAULT 'ui',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL
);

-- Performance index for org-scoped listing
CREATE INDEX idx_executive_decision_notes_org_created
  ON public.executive_decision_notes (organization_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.executive_decision_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_decision_notes FORCE ROW LEVEL SECURITY;

-- SELECT: any org member can read notes
CREATE POLICY "edn_select_org_member"
  ON public.executive_decision_notes FOR SELECT TO authenticated
  USING (public.has_org_membership(organization_id));

-- INSERT: admin or PM only
CREATE POLICY "edn_insert_admin_pm"
  ON public.executive_decision_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_membership(organization_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = executive_decision_notes.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('admin', 'pm')
    )
  );

-- DELETE: only the creator, and only if admin/PM
CREATE POLICY "edn_delete_creator_admin_pm"
  ON public.executive_decision_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_org_membership(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = executive_decision_notes.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role IN ('admin', 'pm')
    )
  );

-- No UPDATE policy for v1 — notes are immutable once saved
