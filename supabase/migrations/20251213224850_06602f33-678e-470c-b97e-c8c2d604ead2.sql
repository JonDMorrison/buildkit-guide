-- Fix the view to use SECURITY INVOKER (inherits caller's RLS)
DROP VIEW IF EXISTS public.v_time_entries_enriched;

CREATE VIEW public.v_time_entries_enriched
WITH (security_invoker = true)
AS
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