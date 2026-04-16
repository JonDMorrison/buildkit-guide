-- Close PII cross-tenant leak on public.profiles.
-- "Users can view all profiles" has qual: true and, because RLS permissive
-- policies OR together, trumped the adjacent "Users can view profiles in
-- same organization" policy. Every authenticated user could read every
-- profile (name, email, phone) across every organization.
-- Drop the leaky policy. The existing same-organization policy already
-- covers: (a) self-view (id = auth.uid()), (b) shared-org via
-- organization_memberships join.

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
