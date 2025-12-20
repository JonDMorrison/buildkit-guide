-- Add approved_record_hash column to track hash after amendment approval
ALTER TABLE public.safety_form_amendments 
ADD COLUMN IF NOT EXISTS approved_record_hash text;

-- Add previous_record_hash column to track hash before amendment
ALTER TABLE public.safety_form_amendments 
ADD COLUMN IF NOT EXISTS previous_record_hash text;

COMMENT ON COLUMN public.safety_form_amendments.approved_record_hash IS 'Record hash after amendment was approved and applied';
COMMENT ON COLUMN public.safety_form_amendments.previous_record_hash IS 'Record hash before amendment was applied';