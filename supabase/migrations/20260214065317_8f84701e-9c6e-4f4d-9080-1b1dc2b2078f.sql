
-- ============================================================
-- P0 FIX: Secure time_entries writes (Option A: edge-function-only)
-- All mutations go through SECURITY DEFINER RPCs/edge functions.
-- Direct client INSERT/UPDATE/DELETE is blocked.
-- ============================================================

-- Force RLS even for table owner
ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;

-- ── Block all direct client writes ──

-- INSERT: deny all authenticated users (edge functions use service_role which bypasses RLS)
CREATE POLICY "time_entries_deny_insert"
ON public.time_entries FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: deny all authenticated users
CREATE POLICY "time_entries_deny_update"
ON public.time_entries FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- DELETE: deny all authenticated users
CREATE POLICY "time_entries_deny_delete"
ON public.time_entries FOR DELETE
TO authenticated
USING (false);
