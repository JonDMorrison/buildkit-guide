-- Fix: new users could not read their own organization_memberships because the
-- existing policy uses is_org_member(), which itself queries organization_memberships
-- and returns nothing for brand-new users (chicken-and-egg).
--
-- Solution: add a second SELECT policy that allows a user to always read rows
-- where they are the subject (user_id = auth.uid()). Postgres ORs multiple
-- permissive policies on the same table/operation, so existing org-member reads
-- are unaffected.

CREATE POLICY "Users can view their own memberships"
ON public.organization_memberships
FOR SELECT
USING (user_id = auth.uid());
