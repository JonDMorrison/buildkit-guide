
-- Add captured_at to project_financial_snapshots
ALTER TABLE public.project_financial_snapshots
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

-- Add captured_at to org_financial_snapshots
ALTER TABLE public.org_financial_snapshots
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

-- Add started_at, finished_at to snapshots_run_log
ALTER TABLE public.snapshots_run_log
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- Update generate_project_financial_snapshot to set captured_at = now() on insert/upsert
-- We need to see the existing function first, so just add the columns for now.
-- The RPC will be updated to populate captured_at = now() at snapshot start.

COMMENT ON COLUMN public.project_financial_snapshots.captured_at IS 'Timestamp when this snapshot was captured. Data reflects state as-of this instant.';
COMMENT ON COLUMN public.org_financial_snapshots.captured_at IS 'Timestamp when this snapshot was captured. Data reflects state as-of this instant.';
COMMENT ON COLUMN public.snapshots_run_log.started_at IS 'When the snapshot run began (before iterating projects).';
COMMENT ON COLUMN public.snapshots_run_log.finished_at IS 'When the snapshot run completed (after all projects processed).';
