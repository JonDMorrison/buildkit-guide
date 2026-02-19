
-- A) Drop permissive "deny" write policies on estimates tables and recreate as RESTRICTIVE
DROP POLICY IF EXISTS "deny_insert_estimates" ON public.estimates;
DROP POLICY IF EXISTS "deny_update_estimates" ON public.estimates;
DROP POLICY IF EXISTS "deny_delete_estimates" ON public.estimates;
DROP POLICY IF EXISTS "deny_insert_eli" ON public.estimate_line_items;
DROP POLICY IF EXISTS "deny_update_eli" ON public.estimate_line_items;
DROP POLICY IF EXISTS "deny_delete_eli" ON public.estimate_line_items;

-- Recreate as RESTRICTIVE deny policies
CREATE POLICY "deny_insert_estimates" ON public.estimates AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny_update_estimates" ON public.estimates AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "deny_delete_estimates" ON public.estimates AS RESTRICTIVE FOR DELETE TO authenticated USING (false);
CREATE POLICY "deny_insert_eli" ON public.estimate_line_items AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny_update_eli" ON public.estimate_line_items AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "deny_delete_eli" ON public.estimate_line_items AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- B) Revoke offending write grants from all 5 tables for both roles
REVOKE INSERT, UPDATE, DELETE ON TABLE public.estimates FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.estimates FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.estimate_line_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.estimate_line_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_workflow_steps FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_workflow_steps FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_workflows FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_workflows FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.time_entries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.time_entries FROM anon;
