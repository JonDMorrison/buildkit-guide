-- P1 FIX: Playbook tables — replace permissive deny policies with restrictive, revoke write grants

-- ============================================================
-- 1) Drop existing permissive deny policies
-- ============================================================
DROP POLICY IF EXISTS playbooks_deny_insert ON public.playbooks;
DROP POLICY IF EXISTS playbooks_deny_update ON public.playbooks;
DROP POLICY IF EXISTS playbooks_deny_delete ON public.playbooks;

DROP POLICY IF EXISTS playbook_phases_deny_insert ON public.playbook_phases;
DROP POLICY IF EXISTS playbook_phases_deny_update ON public.playbook_phases;
DROP POLICY IF EXISTS playbook_phases_deny_delete ON public.playbook_phases;

DROP POLICY IF EXISTS playbook_tasks_deny_insert ON public.playbook_tasks;
DROP POLICY IF EXISTS playbook_tasks_deny_update ON public.playbook_tasks;
DROP POLICY IF EXISTS playbook_tasks_deny_delete ON public.playbook_tasks;

-- ============================================================
-- 2) Create RESTRICTIVE deny-all write policies
-- ============================================================

-- playbooks
CREATE POLICY "playbooks_deny_insert" ON public.playbooks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "playbooks_deny_update" ON public.playbooks AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "playbooks_deny_delete" ON public.playbooks AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- playbook_phases
CREATE POLICY "playbook_phases_deny_insert" ON public.playbook_phases AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "playbook_phases_deny_update" ON public.playbook_phases AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "playbook_phases_deny_delete" ON public.playbook_phases AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- playbook_tasks
CREATE POLICY "playbook_tasks_deny_insert" ON public.playbook_tasks AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "playbook_tasks_deny_update" ON public.playbook_tasks AS RESTRICTIVE FOR UPDATE TO authenticated USING (false);
CREATE POLICY "playbook_tasks_deny_delete" ON public.playbook_tasks AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- ============================================================
-- 3) Revoke direct write grants
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON public.playbooks FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.playbook_phases FROM authenticated, anon, public;
REVOKE INSERT, UPDATE, DELETE ON public.playbook_tasks FROM authenticated, anon, public;