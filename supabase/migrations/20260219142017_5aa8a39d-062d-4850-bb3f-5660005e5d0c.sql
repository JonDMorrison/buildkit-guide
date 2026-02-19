
-- Add job_type to projects table so we can filter historical projects by type
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS job_type text;

-- Backfill from playbook job_type where available
UPDATE public.projects p
SET job_type = pb.job_type
FROM public.playbooks pb
WHERE p.applied_playbook_id = pb.id
  AND pb.job_type IS NOT NULL
  AND p.job_type IS NULL;
