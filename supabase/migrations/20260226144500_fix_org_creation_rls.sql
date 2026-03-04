-- Migration to allow authenticated users to create organizations and memberships during onboarding

-- 1. Allow authenticated users to create organizations
CREATE POLICY "Enable insert for authenticated users" 
ON public.organizations 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. Allow authenticated users to create their first membership as admin
-- We update the existing insert policy to also allow insertion if the user is inserting themselves
-- or we add a new one. Adding a new one is cleaner.
CREATE POLICY "Enable insert for own initial membership"
ON public.organization_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Either the user is an admin (existing policy handles this)
    -- Or the organization is brand new (has no members yet)
    NOT EXISTS (
      SELECT 1 FROM public.organization_memberships 
      WHERE organization_id = organization_memberships.organization_id
    )
  )
);
