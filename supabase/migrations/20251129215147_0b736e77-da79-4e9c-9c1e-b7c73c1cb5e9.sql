-- Add start_date and end_date to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add check constraint to ensure end_date is after start_date
ALTER TABLE public.tasks 
ADD CONSTRAINT tasks_date_order_check 
CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- Create index for date queries
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_tasks_end_date ON public.tasks(end_date) WHERE is_deleted = false;