-- Section 1: Fix data type mismatches and role access bugs in financials pipeline

-- 1. Fix estimate_line_items.item_type CHECK constraint
--    DB had ('task','service','product') but frontend always uses ('labor','material','machine','other')
--    First drop the old constraint (if any), then add the correct one.
--    Note: existing rows may have values that need updating first.

-- Update any stale values (future-proof: shouldn't exist but be safe)
UPDATE public.estimate_line_items
  SET item_type = 'labor'   WHERE item_type = 'task';
UPDATE public.estimate_line_items
  SET item_type = 'labor'   WHERE item_type = 'service';
UPDATE public.estimate_line_items
  SET item_type = 'material' WHERE item_type = 'product';

-- Drop old constraint if it exists
ALTER TABLE public.estimate_line_items
  DROP CONSTRAINT IF EXISTS estimate_line_items_item_type_check;

-- Add correct constraint
ALTER TABLE public.estimate_line_items
  ADD CONSTRAINT estimate_line_items_item_type_check
  CHECK (item_type IN ('labor', 'material', 'machine', 'other'));

-- 2. Consolidate rpc_log_quote_event — drop duplicates, keep one clean definition
DROP FUNCTION IF EXISTS public.rpc_log_quote_event(uuid, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_log_quote_event(p_quote_id uuid, p_actor_id uuid, p_event_type text, p_message text) CASCADE;

CREATE OR REPLACE FUNCTION public.rpc_log_quote_event(
  p_quote_id   uuid,
  p_actor_id   uuid,
  p_event_type text,
  p_message    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.quote_events (quote_id, actor_user_id, event_type, message)
  VALUES (p_quote_id, p_actor_id, p_event_type, p_message);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_log_quote_event(uuid, uuid, text, text) TO authenticated;
