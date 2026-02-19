-- P0 FIX: Revoke direct write grants on project_financial_snapshots
-- 6 privilege leaks: INSERT/UPDATE/DELETE for authenticated + anon + public

REVOKE INSERT, UPDATE, DELETE ON public.project_financial_snapshots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.project_financial_snapshots FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.project_financial_snapshots FROM public;