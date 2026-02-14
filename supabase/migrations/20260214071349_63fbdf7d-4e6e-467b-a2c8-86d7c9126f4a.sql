
-- ============================================================
-- P0: Remove global is_admin() bypass from ALL RLS policies
-- Fixed: app_role casts on has_any_project_role / has_project_role
-- ============================================================

-- 1. FORCE RLS on ALL affected tables
ALTER TABLE public.attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.blockers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deficiencies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gc_column_mappings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gc_deficiency_imports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gc_deficiency_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gc_import_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.manpower_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.safety_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.safety_form_acknowledgments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.safety_form_amendments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.safety_form_attendees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scope_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════
-- ATTACHMENTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Project members can upload attachments" ON public.attachments;
CREATE POLICY "attachments_insert_org_scoped" ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND is_org_scoped_project_member(auth.uid(), project_id)
  );

DROP POLICY IF EXISTS "Users view attachments they have access to" ON public.attachments;
CREATE POLICY "attachments_select_org_scoped" ON public.attachments
  FOR SELECT TO authenticated
  USING (
    has_project_access(project_id)
    AND (
      has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      OR (task_id IS NOT NULL AND (
        is_assigned_to_task(auth.uid(), task_id)
        OR EXISTS (
          SELECT 1 FROM tasks t
          WHERE t.id = attachments.task_id
            AND t.assigned_trade_id IN (
              SELECT trade_id FROM project_members WHERE user_id = auth.uid() AND project_id = t.project_id
            )
        )
      ))
      OR (deficiency_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM deficiencies d
        WHERE d.id = attachments.deficiency_id
          AND (
            has_any_project_role(auth.uid(), d.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
            OR d.assigned_trade_id IN (
              SELECT trade_id FROM project_members WHERE user_id = auth.uid() AND project_id = d.project_id
            )
          )
      ))
      OR (safety_form_id IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
      OR (document_type IS NOT NULL AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
    )
  );

-- ═══════════════════════════════════════════
-- AUDIT_LOG
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
CREATE POLICY "audit_log_select_org_scoped" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    project_id IS NOT NULL
    AND has_project_access(project_id)
    AND has_project_access(project_id, ARRAY['admin','pm'])
  );

-- ═══════════════════════════════════════════
-- BLOCKERS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can create blockers" ON public.blockers;
CREATE POLICY "blockers_insert_org_scoped" ON public.blockers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = blockers.task_id
      AND has_project_access(t.project_id)
      AND has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
  ));

DROP POLICY IF EXISTS "Users can view blockers they have access to" ON public.blockers;
CREATE POLICY "blockers_select_org_scoped" ON public.blockers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = blockers.task_id
      AND has_project_access(t.project_id)
      AND is_org_scoped_project_member(auth.uid(), t.project_id)
  ));

DROP POLICY IF EXISTS "PM can clear blockers" ON public.blockers;
CREATE POLICY "blockers_update_org_scoped" ON public.blockers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = blockers.task_id
      AND has_project_access(t.project_id)
      AND (has_project_access(t.project_id, ARRAY['admin','pm'])
        OR has_project_role(auth.uid(), t.project_id, 'project_manager'::app_role))
  ));

-- ═══════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view comments on accessible tasks" ON public.comments;
CREATE POLICY "comments_select_org_scoped" ON public.comments
  FOR SELECT TO authenticated
  USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = comments.task_id
        AND has_project_access(t.project_id)
        AND is_org_scoped_project_member(auth.uid(), t.project_id)
    ))
    OR
    (deficiency_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM deficiencies d WHERE d.id = comments.deficiency_id
        AND has_project_access(d.project_id)
        AND is_org_scoped_project_member(auth.uid(), d.project_id)
    ))
  );

-- ═══════════════════════════════════════════
-- DAILY_LOGS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM and Foreman can create daily logs" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_org_scoped" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "PM and Foreman can view daily logs" ON public.daily_logs;
CREATE POLICY "daily_logs_select_org_scoped" ON public.daily_logs
  FOR SELECT TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "PM and Foreman can update daily logs" ON public.daily_logs;
CREATE POLICY "daily_logs_update_org_scoped" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING (
    has_project_access(project_id)
    AND ((created_by = auth.uid() AND has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
      OR has_project_access(project_id, ARRAY['admin','pm']))
  );

-- ═══════════════════════════════════════════
-- DEFICIENCIES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM, Foreman can create deficiencies" ON public.deficiencies;
CREATE POLICY "deficiencies_insert_org_scoped" ON public.deficiencies
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "Users view deficiencies in scope" ON public.deficiencies;
CREATE POLICY "deficiencies_select_org_scoped" ON public.deficiencies
  FOR SELECT TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role])
      OR (has_project_role(auth.uid(), project_id, 'external_trade'::app_role)
        AND assigned_trade_id IN (
          SELECT trade_id FROM project_members WHERE user_id = auth.uid() AND project_id = deficiencies.project_id
        )))
  );

DROP POLICY IF EXISTS "PM can update deficiencies" ON public.deficiencies;
CREATE POLICY "deficiencies_update_org_scoped" ON public.deficiencies
  FOR UPDATE TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  );

-- ═══════════════════════════════════════════
-- GC_COLUMN_MAPPINGS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM can manage mappings" ON public.gc_column_mappings;
CREATE POLICY "gc_mappings_manage_org_scoped" ON public.gc_column_mappings
  FOR ALL TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  )
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  );

DROP POLICY IF EXISTS "Users can view mappings for their projects" ON public.gc_column_mappings;
CREATE POLICY "gc_mappings_select_org_scoped" ON public.gc_column_mappings
  FOR SELECT TO authenticated
  USING (has_project_access(project_id) AND is_org_scoped_project_member(auth.uid(), project_id));

-- ═══════════════════════════════════════════
-- GC_DEFICIENCY_IMPORTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM and Foreman can create imports" ON public.gc_deficiency_imports;
CREATE POLICY "gc_imports_insert_org_scoped" ON public.gc_deficiency_imports
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "Users can view imports for their projects" ON public.gc_deficiency_imports;
CREATE POLICY "gc_imports_select_org_scoped" ON public.gc_deficiency_imports
  FOR SELECT TO authenticated
  USING (has_project_access(project_id) AND is_org_scoped_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "PM can update imports" ON public.gc_deficiency_imports;
CREATE POLICY "gc_imports_update_org_scoped" ON public.gc_deficiency_imports
  FOR UPDATE TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  );

-- ═══════════════════════════════════════════
-- GC_DEFICIENCY_ITEMS (through import_id)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM can insert items" ON public.gc_deficiency_items;
CREATE POLICY "gc_items_insert_org_scoped" ON public.gc_deficiency_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM gc_deficiency_imports i WHERE i.id = gc_deficiency_items.import_id
      AND has_project_access(i.project_id)
      AND (has_project_access(i.project_id, ARRAY['admin','pm'])
        OR has_project_role(auth.uid(), i.project_id, 'project_manager'::app_role))
  ));

DROP POLICY IF EXISTS "Users can view items for their project imports" ON public.gc_deficiency_items;
CREATE POLICY "gc_items_select_org_scoped" ON public.gc_deficiency_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM gc_deficiency_imports i WHERE i.id = gc_deficiency_items.import_id
      AND has_project_access(i.project_id) AND is_org_scoped_project_member(auth.uid(), i.project_id)
  ));

DROP POLICY IF EXISTS "PM can update items" ON public.gc_deficiency_items;
CREATE POLICY "gc_items_update_org_scoped" ON public.gc_deficiency_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM gc_deficiency_imports i WHERE i.id = gc_deficiency_items.import_id
      AND has_project_access(i.project_id)
      AND (has_project_access(i.project_id, ARRAY['admin','pm'])
        OR has_project_role(auth.uid(), i.project_id, 'project_manager'::app_role))
  ));

-- ═══════════════════════════════════════════
-- GC_IMPORT_LOGS (through import_id)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Users can insert logs for their imports" ON public.gc_import_logs;
CREATE POLICY "gc_logs_insert_org_scoped" ON public.gc_import_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM gc_deficiency_imports gdi WHERE gdi.id = gc_import_logs.import_id
      AND has_project_access(gdi.project_id)
      AND (gdi.uploaded_by = auth.uid()
        OR has_project_access(gdi.project_id, ARRAY['admin','pm'])
        OR has_project_role(auth.uid(), gdi.project_id, 'project_manager'::app_role))
  ));

DROP POLICY IF EXISTS "Users can view logs for their project imports" ON public.gc_import_logs;
CREATE POLICY "gc_logs_select_org_scoped" ON public.gc_import_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM gc_deficiency_imports i WHERE i.id = gc_import_logs.import_id
      AND has_project_access(i.project_id) AND is_org_scoped_project_member(auth.uid(), i.project_id)
  ));

-- ═══════════════════════════════════════════
-- INVITATIONS (has organization_id)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
CREATE POLICY "invitations_manage_org_scoped" ON public.invitations
  FOR ALL TO authenticated
  USING (has_org_membership(organization_id) AND org_role(organization_id) IN ('admin', 'pm'))
  WITH CHECK (has_org_membership(organization_id) AND org_role(organization_id) IN ('admin', 'pm'));

-- ═══════════════════════════════════════════
-- MANPOWER_REQUESTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can create manpower requests" ON public.manpower_requests;
CREATE POLICY "manpower_insert_org_scoped" ON public.manpower_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "PM, Foreman view manpower requests" ON public.manpower_requests;
CREATE POLICY "manpower_select_org_scoped" ON public.manpower_requests
  FOR SELECT TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_any_project_role(auth.uid(), project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  );

DROP POLICY IF EXISTS "PM can approve/deny manpower requests" ON public.manpower_requests;
CREATE POLICY "manpower_update_org_scoped" ON public.manpower_requests
  FOR UPDATE TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  );

-- ═══════════════════════════════════════════
-- SAFETY_ENTRIES (through safety_form_id)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can manage safety entries" ON public.safety_entries;
CREATE POLICY "safety_entries_manage_org_scoped" ON public.safety_entries
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_entries.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_entries.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

-- ═══════════════════════════════════════════
-- SAFETY_FORM_ACKNOWLEDGMENTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can insert acknowledgments on behalf" ON public.safety_form_acknowledgments;
CREATE POLICY "safety_acks_insert_org_scoped" ON public.safety_form_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_acknowledgments.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

DROP POLICY IF EXISTS "Project members can view acknowledgments" ON public.safety_form_acknowledgments;
CREATE POLICY "safety_acks_select_org_scoped" ON public.safety_form_acknowledgments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_acknowledgments.safety_form_id
      AND has_project_access(sf.project_id) AND is_org_scoped_project_member(auth.uid(), sf.project_id)
  ));

-- ═══════════════════════════════════════════
-- SAFETY_FORM_AMENDMENTS
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can create amendments" ON public.safety_form_amendments;
CREATE POLICY "safety_amend_insert_org_scoped" ON public.safety_form_amendments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_amendments.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

DROP POLICY IF EXISTS "Project members can view amendments" ON public.safety_form_amendments;
CREATE POLICY "safety_amend_select_org_scoped" ON public.safety_form_amendments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_amendments.safety_form_id
      AND has_project_access(sf.project_id) AND is_org_scoped_project_member(auth.uid(), sf.project_id)
  ));

DROP POLICY IF EXISTS "PM/Admin can review amendments" ON public.safety_form_amendments;
CREATE POLICY "safety_amend_update_org_scoped" ON public.safety_form_amendments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_amendments.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_project_role(auth.uid(), sf.project_id, 'project_manager'::app_role))
  ));

-- ═══════════════════════════════════════════
-- SAFETY_FORM_ATTENDEES
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Foreman+ can insert attendees" ON public.safety_form_attendees;
CREATE POLICY "safety_att_insert_org_scoped" ON public.safety_form_attendees
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_attendees.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

DROP POLICY IF EXISTS "Project members can view attendees" ON public.safety_form_attendees;
CREATE POLICY "safety_att_select_org_scoped" ON public.safety_form_attendees
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_attendees.safety_form_id
      AND has_project_access(sf.project_id) AND is_org_scoped_project_member(auth.uid(), sf.project_id)
  ));

DROP POLICY IF EXISTS "Foreman+ can update attendees" ON public.safety_form_attendees;
CREATE POLICY "safety_att_update_org_scoped" ON public.safety_form_attendees
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM safety_forms sf WHERE sf.id = safety_form_attendees.safety_form_id
      AND has_project_access(sf.project_id)
      AND (has_project_access(sf.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), sf.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

-- ═══════════════════════════════════════════
-- SCOPE_ITEMS (has project_id — note: table may be named project_scope_items)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Project managers can manage scope items" ON public.scope_items;
CREATE POLICY "scope_items_manage_org_scoped" ON public.scope_items
  FOR ALL TO authenticated
  USING (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  )
  WITH CHECK (
    has_project_access(project_id)
    AND (has_project_access(project_id, ARRAY['admin','pm'])
      OR has_project_role(auth.uid(), project_id, 'project_manager'::app_role))
  );

DROP POLICY IF EXISTS "Users can view scope items in their projects" ON public.scope_items;
CREATE POLICY "scope_items_select_org_scoped" ON public.scope_items
  FOR SELECT TO authenticated
  USING (has_project_access(project_id) AND is_org_scoped_project_member(auth.uid(), project_id));

-- ═══════════════════════════════════════════
-- TASK_ASSIGNMENTS (through task_id)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM, Foreman can create task assignments" ON public.task_assignments;
CREATE POLICY "task_assign_insert_org_scoped" ON public.task_assignments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_assignments.task_id
      AND has_project_access(t.project_id)
      AND (has_project_access(t.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

-- ═══════════════════════════════════════════
-- TASK_DEPENDENCIES (through task_id) — also fixes global has_role()
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM, Foreman can manage task dependencies" ON public.task_dependencies;
CREATE POLICY "task_deps_manage_org_scoped" ON public.task_dependencies
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_dependencies.task_id
      AND has_project_access(t.project_id)
      AND (has_project_access(t.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = task_dependencies.task_id
      AND has_project_access(t.project_id)
      AND (has_project_access(t.project_id, ARRAY['admin','pm'])
        OR has_any_project_role(auth.uid(), t.project_id, ARRAY['project_manager'::app_role, 'foreman'::app_role]))
  ));

-- ═══════════════════════════════════════════
-- TRADES (has organization_id) — also fixes global has_role()
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "PM and Admin can insert trades" ON public.trades;
CREATE POLICY "trades_insert_org_scoped" ON public.trades
  FOR INSERT TO authenticated
  WITH CHECK (has_org_membership(organization_id) AND org_role(organization_id) IN ('admin', 'pm'));

DROP POLICY IF EXISTS "Users can view trades in same organization" ON public.trades;
CREATE POLICY "trades_select_org_scoped" ON public.trades
  FOR SELECT TO authenticated
  USING (has_org_membership(organization_id));

DROP POLICY IF EXISTS "PM and Admin can update trades" ON public.trades;
CREATE POLICY "trades_update_org_scoped" ON public.trades
  FOR UPDATE TO authenticated
  USING (has_org_membership(organization_id) AND org_role(organization_id) IN ('admin', 'pm'));

-- ═══════════════════════════════════════════
-- USER_ROLES (global — lock writes to service_role only)
-- ═══════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "user_roles_deny_insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "user_roles_deny_update" ON public.user_roles
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "user_roles_deny_delete" ON public.user_roles
  FOR DELETE TO authenticated USING (false);

-- ═══════════════════════════════════════════
-- NOTE: storage.objects also uses is_admin() in 8 policies
-- (receipts + task-photos buckets). Storage is a reserved
-- schema — flag for manual review in Cloud storage settings.
-- ═══════════════════════════════════════════
