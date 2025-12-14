-- ============================================
-- Fix Time Tracking Schema Issues
-- ============================================

-- 1. Fix time_events foreign keys to auth.users with proper delete behavior
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_user_id_fkey;
ALTER TABLE public.time_events DROP CONSTRAINT IF EXISTS time_events_actor_id_fkey;

ALTER TABLE public.time_events 
ADD CONSTRAINT time_events_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.time_events 
ADD CONSTRAINT time_events_actor_id_fkey 
FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 2. Fix time_entries foreign keys to auth.users
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_closed_by_fkey;

ALTER TABLE public.time_entries 
ADD CONSTRAINT time_entries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.time_entries 
ADD CONSTRAINT time_entries_closed_by_fkey 
FOREIGN KEY (closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Fix time_entry_adjustments.adjusted_by - ensure NOT NULL with RESTRICT
ALTER TABLE public.time_entry_adjustments DROP CONSTRAINT IF EXISTS time_entry_adjustments_adjusted_by_fkey;

-- Ensure column is NOT NULL (should already be, but confirm)
ALTER TABLE public.time_entry_adjustments ALTER COLUMN adjusted_by SET NOT NULL;

ALTER TABLE public.time_entry_adjustments 
ADD CONSTRAINT time_entry_adjustments_adjusted_by_fkey 
FOREIGN KEY (adjusted_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 4. Fix payroll_exports.generated_by to auth.users with RESTRICT
ALTER TABLE public.payroll_exports DROP CONSTRAINT IF EXISTS payroll_exports_generated_by_fkey;

ALTER TABLE public.payroll_exports 
ADD CONSTRAINT payroll_exports_generated_by_fkey 
FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- 5. Fix the unique index for one open entry per user per org
DROP INDEX IF EXISTS public.idx_time_entries_one_open_per_user;

CREATE UNIQUE INDEX idx_time_entries_one_open_per_user 
ON public.time_entries (organization_id, user_id) 
WHERE check_out_at IS NULL;

-- 6. Create immutability triggers for time_events (defense in depth)
CREATE OR REPLACE FUNCTION public.prevent_time_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'time_events table is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS prevent_time_events_update ON public.time_events;
DROP TRIGGER IF EXISTS prevent_time_events_delete ON public.time_events;

-- Create triggers to prevent UPDATE and DELETE
CREATE TRIGGER prevent_time_events_update
BEFORE UPDATE ON public.time_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_time_events_modification();

CREATE TRIGGER prevent_time_events_delete
BEFORE DELETE ON public.time_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_time_events_modification();