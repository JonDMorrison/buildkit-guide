-- Fix the self-referencing subquery bug in
-- "Enable insert for own initial membership" on
-- public.organization_memberships.
--
-- Original with_check:
--   (auth.uid() = user_id) AND NOT EXISTS (
--     SELECT 1 FROM organization_memberships organization_memberships_1
--     WHERE organization_memberships_1.organization_id
--         = organization_memberships_1.organization_id  -- tautology!
--   )
-- The WHERE clause compares the aliased table to itself, which is
-- always true whenever any row exists. NOT EXISTS therefore collapses
-- to false as soon as the table is non-empty, making the policy a
-- permanent no-op.
--
-- Intended behavior (per the name "own initial membership"): let a
-- brand-new user insert their own first membership during new-org
-- bootstrap, when no "Org admins can insert memberships" actor exists
-- yet for that org. Replace with:
--   - auth.uid() = user_id (self-insert only)
--   - NOT EXISTS any prior row for this user (so it truly is their
--     initial membership; blocks abusing this policy to escalate
--     into additional orgs later)
--
-- DROP then CREATE is required because CREATE POLICY does not support
-- a "REPLACE" form.

DROP POLICY IF EXISTS "Enable insert for own initial membership"
  ON public.organization_memberships;

CREATE POLICY "Enable insert for own initial membership"
  ON public.organization_memberships
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_memberships om
      WHERE om.user_id = auth.uid()
    )
  );
