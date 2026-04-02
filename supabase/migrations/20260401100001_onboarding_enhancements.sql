-- Onboarding Enhancements: Company Identity, AI Calibration, Playbook Generation
-- DO NOT RUN AUTOMATICALLY — apply via Supabase SQL editor

-- 1. Add company identity columns to organization_operational_profile
ALTER TABLE public.organization_operational_profile
ADD COLUMN IF NOT EXISTS business_type text,
ADD COLUMN IF NOT EXISTS years_in_business text,
ADD COLUMN IF NOT EXISTS typical_project_size text,
ADD COLUMN IF NOT EXISTS service_area text;

-- 2. Add AI calibration columns to organization_intelligence_profile
ALTER TABLE public.organization_intelligence_profile
ADD COLUMN IF NOT EXISTS margin_target text,
ADD COLUMN IF NOT EXISTS common_job_types text[],
ADD COLUMN IF NOT EXISTS biggest_pain_point text,
ADD COLUMN IF NOT EXISTS work_model text;

-- 3. Add new setup checklist progress columns
ALTER TABLE public.setup_checklist_progress
ADD COLUMN IF NOT EXISTS step_company_profile boolean,
ADD COLUMN IF NOT EXISTS step_ai_calibrated boolean,
ADD COLUMN IF NOT EXISTS step_playbook_generated boolean,
ADD COLUMN IF NOT EXISTS step_morning_briefing_reviewed boolean;
