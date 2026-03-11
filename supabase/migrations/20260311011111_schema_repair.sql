-- SCHEMA REPAIR SCRIPT 2026-03-11
-- This script fixes missing columns and relationships reported in UI errors.

-- 1. Ensure sort_order exists on tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 2. Repair relationships (Foreign Keys)
-- tasks -> trades
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trades') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assigned_trade_id_fkey') THEN
            ALTER TABLE public.tasks 
            ADD CONSTRAINT tasks_assigned_trade_id_fkey 
            FOREIGN KEY (assigned_trade_id) REFERENCES public.trades(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- attachments -> profiles
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attachments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attachments_uploaded_by_fkey') THEN
            ALTER TABLE public.attachments 
            ADD CONSTRAINT attachments_uploaded_by_fkey 
            FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- manpower_requests -> trades
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'manpower_requests') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manpower_requests_trade_id_fkey') THEN
            ALTER TABLE public.manpower_requests 
            ADD CONSTRAINT manpower_requests_trade_id_fkey 
            FOREIGN KEY (trade_id) REFERENCES public.trades(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- project_members -> projects (for Lookahead issues)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_members') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_fkey') THEN
            ALTER TABLE public.project_members 
            ADD CONSTRAINT project_members_project_id_fkey 
            FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;
