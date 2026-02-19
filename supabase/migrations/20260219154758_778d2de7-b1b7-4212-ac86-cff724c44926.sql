
-- Drop existing PERMISSIVE deny policies on change_orders
DROP POLICY IF EXISTS co_deny_insert ON public.change_orders;
DROP POLICY IF EXISTS co_deny_update ON public.change_orders;
DROP POLICY IF EXISTS co_deny_delete ON public.change_orders;

-- Recreate as RESTRICTIVE
CREATE POLICY "co_deny_insert" ON public.change_orders
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "co_deny_update" ON public.change_orders
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "co_deny_delete" ON public.change_orders
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- Drop existing PERMISSIVE deny policies on change_order_line_items
DROP POLICY IF EXISTS co_li_deny_insert ON public.change_order_line_items;
DROP POLICY IF EXISTS co_li_deny_update ON public.change_order_line_items;
DROP POLICY IF EXISTS co_li_deny_delete ON public.change_order_line_items;

-- Recreate as RESTRICTIVE
CREATE POLICY "co_li_deny_insert" ON public.change_order_line_items
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "co_li_deny_update" ON public.change_order_line_items
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "co_li_deny_delete" ON public.change_order_line_items
  AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- Ensure no write grants remain
REVOKE INSERT, UPDATE, DELETE ON public.change_orders FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.change_order_line_items FROM authenticated, anon, public;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
