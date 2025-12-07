-- Create enum for receipt review status
CREATE TYPE public.receipt_review_status AS ENUM ('pending', 'reviewed', 'processed');

-- Add review tracking columns to receipts
ALTER TABLE public.receipts 
ADD COLUMN review_status public.receipt_review_status NOT NULL DEFAULT 'pending',
ADD COLUMN reviewed_by UUID REFERENCES public.profiles(id),
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create index for filtering by review status
CREATE INDEX idx_receipts_review_status ON public.receipts(review_status);