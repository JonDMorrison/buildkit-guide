-- Task 1: No schema change needed - will use safety_entries field_name = "ai_used"

-- Task 2: Add acknowledgment audit trail columns
ALTER TABLE public.safety_form_acknowledgments 
ADD COLUMN IF NOT EXISTS initiated_by_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS initiation_method text CHECK (initiation_method IN ('self', 'foreman_proxy'));

-- Set defaults for existing records (assume self-acknowledgment for historical data)
UPDATE public.safety_form_acknowledgments 
SET initiated_by_user_id = user_id, 
    initiation_method = 'self'
WHERE initiated_by_user_id IS NULL;

COMMENT ON COLUMN public.safety_form_acknowledgments.initiated_by_user_id IS 'The user who initiated this acknowledgment (worker or foreman)';
COMMENT ON COLUMN public.safety_form_acknowledgments.initiation_method IS 'How the acknowledgment was created: self (worker) or foreman_proxy';