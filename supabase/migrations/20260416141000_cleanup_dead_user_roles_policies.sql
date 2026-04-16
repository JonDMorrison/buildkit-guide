-- Clean up three dead policies on public.user_roles.
-- user_roles_deny_delete, user_roles_deny_insert, user_roles_deny_update
-- were declared PERMISSIVE with expression `false`. In RLS, permissive
-- policies OR together; a permissive-false policy simply never grants
-- access, it never blocks. The authors almost certainly meant
-- RESTRICTIVE (which AND together and would actually deny), but as
-- written they are no-ops with misleading names. Drop them so the
-- actual policies (is_admin-based, retained by request) are unambiguous.
--
-- Only three exist (delete/insert/update). There is no
-- user_roles_deny_select — user_roles_select_own is a real working
-- SELECT policy and is kept.

DROP POLICY IF EXISTS "user_roles_deny_delete" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_deny_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_deny_update" ON public.user_roles;
