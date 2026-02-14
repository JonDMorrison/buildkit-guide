
-- ============================================================
-- P0 FIX: Lock down snapshot tables — no client writes
-- Tables: project_financial_snapshots, org_financial_snapshots, snapshots_run_log
-- Writes only via service_role (edge functions) which bypasses RLS.
-- ============================================================

-- ── Force RLS on all 3 tables (closes table-owner bypass) ──
ALTER TABLE public.project_financial_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_financial_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots_run_log FORCE ROW LEVEL SECURITY;

-- ── Drop permissive write policies on snapshots_run_log ──
DROP POLICY IF EXISTS "Service role only can write snapshot run logs" ON public.snapshots_run_log;
DROP POLICY IF EXISTS "Service role only can update snapshot run logs" ON public.snapshots_run_log;
DROP POLICY IF EXISTS "Service role only can delete snapshot run logs" ON public.snapshots_run_log;

-- ── Explicit deny policies for all 3 tables ──
-- (No write policy = denied by default, but explicit denies
--  make intent clear and prevent accidental future grants)

-- project_financial_snapshots
CREATE POLICY "pfs_deny_insert" ON public.project_financial_snapshots
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "pfs_deny_update" ON public.project_financial_snapshots
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "pfs_deny_delete" ON public.project_financial_snapshots
  FOR DELETE TO authenticated USING (false);

-- org_financial_snapshots
CREATE POLICY "ofs_deny_insert" ON public.org_financial_snapshots
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "ofs_deny_update" ON public.org_financial_snapshots
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "ofs_deny_delete" ON public.org_financial_snapshots
  FOR DELETE TO authenticated USING (false);

-- snapshots_run_log
CREATE POLICY "srl_deny_insert" ON public.snapshots_run_log
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "srl_deny_update" ON public.snapshots_run_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "srl_deny_delete" ON public.snapshots_run_log
  FOR DELETE TO authenticated USING (false);
