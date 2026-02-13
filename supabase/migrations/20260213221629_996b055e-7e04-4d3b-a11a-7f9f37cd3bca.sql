-- Add composite index for task-level time queries
CREATE INDEX IF NOT EXISTS idx_time_entries_project_task
  ON public.time_entries (project_id, task_id)
  WHERE task_id IS NOT NULL;

-- Add comment documenting task_id usage
COMMENT ON COLUMN public.time_entries.task_id IS 'Optional link to a specific task. Used for scope-item-level variance tracking. Set during check-in by worker choice.';
