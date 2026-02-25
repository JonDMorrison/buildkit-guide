
-- Stage 20B: Restrict DELETE to admin-only
DROP POLICY IF EXISTS "edn_delete_creator_admin_pm" ON public.executive_decision_notes;

CREATE POLICY "edn_delete_admin_only"
  ON public.executive_decision_notes FOR DELETE TO authenticated
  USING (
    public.has_org_membership(organization_id)
    AND EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = executive_decision_notes.organization_id
        AND om.user_id = auth.uid()
        AND om.is_active = true
        AND om.role = 'admin'
    )
  );
