
-- Fix: Enable FORCE ROW LEVEL SECURITY on project_budgets and project_scope_items
ALTER TABLE public.project_budgets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_scope_items FORCE ROW LEVEL SECURITY;
