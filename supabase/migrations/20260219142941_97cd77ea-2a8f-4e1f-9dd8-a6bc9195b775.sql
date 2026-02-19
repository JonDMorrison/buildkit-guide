
-- Revoke direct write grants from change order tables
REVOKE INSERT, UPDATE, DELETE ON public.change_orders FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.change_order_line_items FROM authenticated, anon, public;
