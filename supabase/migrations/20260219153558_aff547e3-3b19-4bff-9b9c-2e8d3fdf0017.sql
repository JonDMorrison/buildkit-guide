-- Force PostgREST schema cache reload so RPCs become visible
-- This is safe and non-destructive
NOTIFY pgrst, 'reload schema';