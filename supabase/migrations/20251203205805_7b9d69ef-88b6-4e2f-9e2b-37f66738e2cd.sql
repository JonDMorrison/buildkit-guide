-- Create indexes for faster receipt queries
CREATE INDEX IF NOT EXISTS idx_receipts_uploaded_at ON receipts(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_project_id ON receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);

-- Add RLS policy for accounting role to view all receipts
CREATE POLICY "Accounting can view all receipts" 
ON receipts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'accounting'
  )
);