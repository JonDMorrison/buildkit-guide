-- Add missing FK from tasks.assigned_trade_id to trades.id
-- Without this FK, PostgREST cannot resolve joins like assigned_trade:trades(name)
-- causing 400 errors on the Dashboard tasks queries.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_trade_id_fkey
  FOREIGN KEY (assigned_trade_id)
  REFERENCES public.trades(id)
  ON DELETE SET NULL;

-- Reload PostgREST schema cache so the new FK is immediately visible
NOTIFY pgrst, 'reload schema';
