-- Add task_id column to manpower_requests table
ALTER TABLE public.manpower_requests 
ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_manpower_requests_task_id ON public.manpower_requests(task_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.manpower_requests.task_id IS 'Optional link to specific task requiring manpower';