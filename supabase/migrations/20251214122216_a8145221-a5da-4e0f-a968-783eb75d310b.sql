
-- Create tables and policies using the EXISTING helper function signatures
-- Existing functions use: has_org_membership(_org_id), org_role(_org_id), has_project_membership(_project_id)

-- 1) timesheet_periods
create table if not exists public.timesheet_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  submitted_at timestamptz null,
  submitted_by uuid null references auth.users(id) on delete set null,
  approved_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  locked_at timestamptz null,
  locked_by uuid null references auth.users(id) on delete set null,
  attestation_text text null,
  notes text null,
  created_at timestamptz not null default now(),
  constraint timesheet_periods_status_check check (status in ('open','submitted','approved','locked')),
  constraint timesheet_periods_date_check check (period_end >= period_start),
  constraint timesheet_periods_unique unique (organization_id, user_id, period_start, period_end)
);

create index if not exists idx_timesheet_periods_org_period
on public.timesheet_periods (organization_id, period_start desc);

create index if not exists idx_timesheet_periods_org_user_period
on public.timesheet_periods (organization_id, user_id, period_start desc);

create index if not exists idx_timesheet_periods_org_status_period
on public.timesheet_periods (organization_id, status, period_start desc);

alter table public.timesheet_periods enable row level security;

-- 2) time_adjustment_requests
create table if not exists public.time_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  job_site_id uuid null references public.job_sites(id) on delete set null,
  time_entry_id uuid null references public.time_entries(id) on delete set null,
  request_type text not null,
  proposed_check_in_at timestamptz null,
  proposed_check_out_at timestamptz null,
  proposed_job_site_id uuid null references public.job_sites(id) on delete set null,
  proposed_notes text null,
  reason text not null,
  status text not null default 'pending',
  reviewed_at timestamptz null,
  reviewed_by uuid null references auth.users(id) on delete set null,
  review_note text null,
  created_at timestamptz not null default now(),
  constraint time_adjustment_requests_status_check check (status in ('pending','approved','denied','cancelled')),
  constraint time_adjustment_requests_type_check check (request_type in ('missed_check_in','missed_check_out','add_manual_entry','change_times','change_job_site','add_note')),
  constraint time_adjustment_requests_time_check check (proposed_check_out_at is null or proposed_check_in_at is null or proposed_check_out_at >= proposed_check_in_at)
);

create index if not exists idx_time_adjustment_requests_org_status_created
on public.time_adjustment_requests (organization_id, status, created_at desc);

create index if not exists idx_time_adjustment_requests_org_target_created
on public.time_adjustment_requests (organization_id, target_user_id, created_at desc);

create index if not exists idx_time_adjustment_requests_org_project_created
on public.time_adjustment_requests (organization_id, project_id, created_at desc);

alter table public.time_adjustment_requests enable row level security;

-- Apply org/project match trigger to time_adjustment_requests
drop trigger if exists trg_time_adjustment_requests_validate_org on public.time_adjustment_requests;
create trigger trg_time_adjustment_requests_validate_org
before insert or update on public.time_adjustment_requests
for each row execute function public.validate_project_org_match();

-- 3) time_entry_flags
create table if not exists public.time_entry_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  flag_code text not null,
  severity text not null default 'warning',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_source text not null default 'system',
  resolved_at timestamptz null,
  resolved_by uuid null references auth.users(id) on delete set null,
  resolution_note text null,
  created_at timestamptz not null default now(),
  constraint time_entry_flags_code_check check (flag_code in ('missing_job_site','outside_geofence','long_shift','long_open_shift','auto_closed','manual_time_added','edited_after_submission','overlapping_entry_attempt')),
  constraint time_entry_flags_severity_check check (severity in ('info','warning','critical')),
  constraint time_entry_flags_source_check check (created_source in ('system','user','foreman','admin'))
);

-- Prevent duplicate active flags for same entry + code
create unique index if not exists uq_time_entry_flags_active
on public.time_entry_flags (time_entry_id, flag_code)
where resolved_at is null;

create index if not exists idx_time_entry_flags_org_resolved_created
on public.time_entry_flags (organization_id, resolved_at, created_at desc);

create index if not exists idx_time_entry_flags_org_project_created
on public.time_entry_flags (organization_id, project_id, created_at desc);

create index if not exists idx_time_entry_flags_org_user_created
on public.time_entry_flags (organization_id, user_id, created_at desc);

create index if not exists idx_time_entry_flags_org_code_created
on public.time_entry_flags (organization_id, flag_code, created_at desc);

alter table public.time_entry_flags enable row level security;

-- Apply org/project match trigger to time_entry_flags
drop trigger if exists trg_time_entry_flags_validate_org on public.time_entry_flags;
create trigger trg_time_entry_flags_validate_org
before insert or update on public.time_entry_flags
for each row execute function public.validate_project_org_match();

-- RLS POLICIES

-- timesheet_periods SELECT
drop policy if exists timesheet_periods_select on public.timesheet_periods;
create policy timesheet_periods_select
on public.timesheet_periods
for select
to authenticated
using (
  has_org_membership(organization_id)
  and (
    user_id = auth.uid()
    or org_role(organization_id) in ('admin','hr')
    or org_role(organization_id) in ('pm','foreman')
  )
);

-- No insert/update/delete policies for timesheet_periods (edge functions only)

-- time_adjustment_requests SELECT
drop policy if exists time_adjustment_requests_select on public.time_adjustment_requests;
create policy time_adjustment_requests_select
on public.time_adjustment_requests
for select
to authenticated
using (
  has_org_membership(organization_id)
  and (
    requester_user_id = auth.uid()
    or target_user_id = auth.uid()
    or org_role(organization_id) in ('admin','hr')
    or (
      org_role(organization_id) in ('pm','foreman')
      and has_project_membership(project_id)
    )
  )
);

-- time_adjustment_requests INSERT (worker submits own request)
drop policy if exists time_adjustment_requests_insert on public.time_adjustment_requests;
create policy time_adjustment_requests_insert
on public.time_adjustment_requests
for insert
to authenticated
with check (
  has_org_membership(organization_id)
  and requester_user_id = auth.uid()
  and target_user_id = auth.uid()
  and has_project_membership(project_id)
);

-- No update/delete policies (edge functions only)

-- time_entry_flags SELECT
drop policy if exists time_entry_flags_select on public.time_entry_flags;
create policy time_entry_flags_select
on public.time_entry_flags
for select
to authenticated
using (
  has_org_membership(organization_id)
  and (
    user_id = auth.uid()
    or org_role(organization_id) in ('admin','hr')
    or (
      org_role(organization_id) in ('pm','foreman')
      and has_project_membership(project_id)
    )
  )
);

-- No insert/update/delete policies for time_entry_flags (edge functions only)
