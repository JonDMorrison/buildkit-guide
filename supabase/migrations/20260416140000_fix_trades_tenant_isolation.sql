-- Close tenant leak on public.trades INSERT/UPDATE.
-- trades has an organization_id column (all 36 existing rows are scoped;
-- it is logically per-org, not a shared lookup table). The old policies
-- "PM and Admin can insert trades" and "PM and Admin can update trades"
-- use is_admin(auth.uid()) OR has_role('project_manager') with no
-- organization filter, so any global admin or any user with the global
-- project_manager role could write trades into any tenant.
--
-- The org-scoped replacements (trades_insert_org_scoped,
-- trades_update_org_scoped) already exist with the correct
-- has_org_membership + org_role('admin'|'pm') checks. Just drop the
-- leaky duplicates.
--
-- Note: the SELECT-side leak ("Users can view trades" with qual: true)
-- is not addressed here — it is a separate fix that exposes trade
-- contact PII cross-tenant and should be handled in its own migration.

DROP POLICY IF EXISTS "PM and Admin can insert trades" ON public.trades;
DROP POLICY IF EXISTS "PM and Admin can update trades" ON public.trades;
