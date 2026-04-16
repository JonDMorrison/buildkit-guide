-- Close cross-tenant leak on public.trades.
-- "Users can view trades" has qual: true, letting every authenticated user
-- read trade contact_email, contact_phone across all organizations.
-- Drop it. The existing trades_select_org_scoped policy already covers
-- org-member reads via has_org_membership(organization_id).
DROP POLICY IF EXISTS "Users can view trades" ON public.trades;
