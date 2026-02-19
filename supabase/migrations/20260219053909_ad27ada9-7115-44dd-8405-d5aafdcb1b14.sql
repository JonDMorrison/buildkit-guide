-- Drop permissive write policies on estimates
DROP POLICY IF EXISTS "est_insert" ON public.estimates;
DROP POLICY IF EXISTS "est_update" ON public.estimates;
DROP POLICY IF EXISTS "est_delete" ON public.estimates;

-- Drop permissive write policies on estimate_line_items
DROP POLICY IF EXISTS "eli_insert" ON public.estimate_line_items;
DROP POLICY IF EXISTS "eli_update" ON public.estimate_line_items;
DROP POLICY IF EXISTS "eli_delete" ON public.estimate_line_items;

-- Confirm FORCE RLS remains
ALTER TABLE public.estimates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items FORCE ROW LEVEL SECURITY;