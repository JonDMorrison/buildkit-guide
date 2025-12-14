-- Add duration validation constraint for manual entries (max 24 hours = 1440 minutes)
-- This prevents abuse of extremely long manual time entries

-- Update the RPC function to validate duration
CREATE OR REPLACE FUNCTION public.validate_manual_entry_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate on insert when source is manual_adjustment
  IF NEW.source = 'manual_adjustment' AND NEW.duration_minutes IS NOT NULL THEN
    IF NEW.duration_minutes > 1440 THEN
      RAISE EXCEPTION 'Manual entries cannot exceed 24 hours (1440 minutes). Duration: % minutes', NEW.duration_minutes;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS validate_manual_entry_duration_trigger ON time_entries;
CREATE TRIGGER validate_manual_entry_duration_trigger
  BEFORE INSERT ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_manual_entry_duration();