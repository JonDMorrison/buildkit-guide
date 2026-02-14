
-- Drop legacy CHECK constraint that allows invalid values ('task','service','product')
-- The new chk_scope_item_type constraint already enforces the canonical set.
ALTER TABLE public.project_scope_items
  DROP CONSTRAINT IF EXISTS project_scope_items_item_type_check;
