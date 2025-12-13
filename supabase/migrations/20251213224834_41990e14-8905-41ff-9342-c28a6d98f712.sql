-- ============================================
-- TIME TRACKING SCHEMA (Organization-Scoped)
-- ============================================

-- A. JOB_SITES TABLE
-- ------------------------------------------
CREATE TABLE public.job_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NULL,
  normalized_address text NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  geofence_radius_meters integer NOT NULL DEFAULT 150,
  is_active boolean NOT NULL DEFAULT true,
  timezone_override text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT job_sites_geofence_radius_check 
    CHECK (geofence_radius_meters >= 50 AND geofence_radius_meters <= 2000)
);

-- Indexes for job_sites
CREATE INDEX idx_job_sites_org_project ON public.job_sites(organization_id, project_id);
CREATE INDEX idx_job_sites_project_active ON public.job_sites(project_id, is_active);
CREATE INDEX idx_job_sites_org_active ON public.job_sites(organization_id, is_active);

-- B. TIME_EVENTS TABLE (Immutable Event Log)
-- ------------------------------------------
CREATE TABLE public.time_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_site_id uuid NULL REFERENCES public.job_sites(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  latitude double precision NULL,
  longitude double precision NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT time_events_event_type_check 
    CHECK (event_type IN ('check_in', 'check_out', 'force_check_out', 'auto_close', 'adjustment')),
  CONSTRAINT time_events_source_check 
    CHECK (source IN ('user', 'foreman', 'admin', 'system'))
);

-- Indexes for time_events
CREATE INDEX idx_time_events_org_project_occurred ON public.time_events(organization_id, project_id, occurred_at DESC);
CREATE INDEX idx_time_events_org_user_occurred ON public.time_events(organization_id, user_id, occurred_at DESC);
CREATE INDEX idx_time_events_org_created ON public.time_events(organization_id, created_at DESC);

-- C. TIME_ENTRIES TABLE (Derived Summary)
-- ------------------------------------------
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_site_id uuid NULL REFERENCES public.job_sites(id) ON DELETE SET NULL,
  project_timezone text NOT NULL,
  check_in_at timestamptz NOT NULL,
  check_in_latitude double precision NULL,
  check_in_longitude double precision NULL,
  check_out_at timestamptz NULL,
  check_out_latitude double precision NULL,
  check_out_longitude double precision NULL,
  duration_minutes integer NULL,
  duration_hours numeric(10,2) NULL,
  status text NOT NULL DEFAULT 'open',
  closed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_method text NOT NULL DEFAULT 'self',
  is_flagged boolean NOT NULL DEFAULT false,
  flag_reason text NULL,
  source text NOT NULL DEFAULT 'app',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT time_entries_status_check 
    CHECK (status IN ('open', 'closed', 'force_closed', 'auto_closed', 'adjusted')),
  CONSTRAINT time_entries_closed_method_check 
    CHECK (closed_method IN ('self', 'force', 'system_auto_close')),
  CONSTRAINT time_entries_source_check 
    CHECK (source IN ('app', 'manual_adjustment')),
  CONSTRAINT time_entries_checkout_after_checkin 
    CHECK (check_out_at IS NULL OR check_out_at >= check_in_at),
  CONSTRAINT time_entries_duration_positive 
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);

-- Indexes for time_entries
CREATE INDEX idx_time_entries_org_project_checkin ON public.time_entries(organization_id, project_id, check_in_at DESC);
CREATE INDEX idx_time_entries_org_user_checkin ON public.time_entries(organization_id, user_id, check_in_at DESC);
CREATE INDEX idx_time_entries_org_jobsite_checkin ON public.time_entries(organization_id, job_site_id, check_in_at DESC);
CREATE INDEX idx_time_entries_org_status ON public.time_entries(organization_id, status);
CREATE INDEX idx_time_entries_project_checkin ON public.time_entries(project_id, check_in_at DESC);

-- Partial unique index: Only one open entry per user per organization
CREATE UNIQUE INDEX idx_time_entries_one_open_per_user 
ON public.time_entries(organization_id, user_id) 
WHERE status = 'open';

-- D. TIME_ENTRY_ADJUSTMENTS TABLE (Audit Trail)
-- ------------------------------------------
CREATE TABLE public.time_entry_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  adjusted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL,
  previous_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  reason text NOT NULL,
  affects_pay boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT time_entry_adjustments_type_check 
    CHECK (adjustment_type IN ('time_change', 'job_site_change', 'system_close', 'note_change'))
);

-- Indexes for time_entry_adjustments
CREATE INDEX idx_time_entry_adjustments_org_entry_created 
ON public.time_entry_adjustments(organization_id, time_entry_id, created_at DESC);
CREATE INDEX idx_time_entry_adjustments_org_created 
ON public.time_entry_adjustments(organization_id, created_at DESC);

-- E. PAYROLL_EXPORTS TABLE (Frozen Snapshots)
-- ------------------------------------------
CREATE TABLE public.payroll_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  generated_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_bucket text NOT NULL DEFAULT 'exports',
  file_path text NULL,
  file_url text NULL,
  entry_count integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT payroll_exports_type_check 
    CHECK (export_type IN ('generic', 'quickbooks', 'adp', 'raken'))
);

-- Indexes for payroll_exports
CREATE INDEX idx_payroll_exports_org_created ON public.payroll_exports(organization_id, created_at DESC);
CREATE INDEX idx_payroll_exports_org_type_dates ON public.payroll_exports(organization_id, export_type, date_from, date_to);

-- F. TRIGGER FUNCTION: Validate project belongs to same organization
-- ------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_project_org_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_org_id uuid;
BEGIN
  -- Look up the project's organization_id
  SELECT organization_id INTO project_org_id
  FROM public.projects
  WHERE id = NEW.project_id;
  
  -- Raise exception if org doesn't match
  IF project_org_id IS NULL THEN
    RAISE EXCEPTION 'Project % does not exist', NEW.project_id;
  END IF;
  
  IF project_org_id != NEW.organization_id THEN
    RAISE EXCEPTION 'Project % belongs to organization %, not %', 
      NEW.project_id, project_org_id, NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to job_sites
CREATE TRIGGER trg_job_sites_validate_org
BEFORE INSERT OR UPDATE ON public.job_sites
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_org_match();

-- Apply trigger to time_events
CREATE TRIGGER trg_time_events_validate_org
BEFORE INSERT OR UPDATE ON public.time_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_org_match();

-- Apply trigger to time_entries
CREATE TRIGGER trg_time_entries_validate_org
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_org_match();

-- G. HELPER VIEW: Enriched Time Entries
-- ------------------------------------------
CREATE OR REPLACE VIEW public.v_time_entries_enriched AS
SELECT
  te.id,
  te.organization_id,
  te.user_id,
  te.project_id,
  te.job_site_id,
  te.project_timezone,
  te.check_in_at,
  te.check_in_latitude,
  te.check_in_longitude,
  te.check_out_at,
  te.check_out_latitude,
  te.check_out_longitude,
  te.duration_minutes,
  te.duration_hours,
  te.status,
  te.closed_by,
  te.closed_method,
  te.is_flagged,
  te.flag_reason,
  te.source,
  te.notes,
  te.created_at,
  -- Enriched fields
  p.name AS project_name,
  p.job_number AS project_job_number,
  js.name AS job_site_name,
  js.address AS job_site_address,
  pr.full_name AS user_display_name,
  pr.email AS user_email,
  closed_pr.full_name AS closed_by_display_name
FROM public.time_entries te
LEFT JOIN public.projects p ON p.id = te.project_id
LEFT JOIN public.job_sites js ON js.id = te.job_site_id
LEFT JOIN public.profiles pr ON pr.id = te.user_id
LEFT JOIN public.profiles closed_pr ON closed_pr.id = te.closed_by;

-- H. ENABLE RLS ON ALL NEW TABLES (policies will be added in next prompt)
-- ------------------------------------------
ALTER TABLE public.job_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_exports ENABLE ROW LEVEL SECURITY;