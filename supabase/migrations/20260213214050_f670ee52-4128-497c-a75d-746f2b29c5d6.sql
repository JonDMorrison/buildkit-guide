
-- ============================================================
-- A) CLIENT HIERARCHY (parent/child) + new fields
-- ============================================================

-- Add parent_client_id and new contact/business fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS parent_client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gst_number text NULL,
  ADD COLUMN IF NOT EXISTS ap_contact_name text NULL,
  ADD COLUMN IF NOT EXISTS ap_email text NULL,
  ADD COLUMN IF NOT EXISTS ap_phone text NULL,
  ADD COLUMN IF NOT EXISTS pm_contact_name text NULL,
  ADD COLUMN IF NOT EXISTS pm_email text NULL,
  ADD COLUMN IF NOT EXISTS pm_phone text NULL,
  ADD COLUMN IF NOT EXISTS site_contact_name text NULL,
  ADD COLUMN IF NOT EXISTS site_contact_email text NULL,
  ADD COLUMN IF NOT EXISTS site_contact_phone text NULL,
  ADD COLUMN IF NOT EXISTS zones integer NOT NULL DEFAULT 0;

-- Indexes for client hierarchy
CREATE INDEX IF NOT EXISTS idx_clients_parent_client_id ON public.clients(parent_client_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_active ON public.clients(organization_id, is_active);

-- Trigger: enforce parent/child org match
CREATE OR REPLACE FUNCTION public.enforce_client_parent_org_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = NEW.parent_client_id AND organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Parent client must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_client_parent_org ON public.clients;
CREATE TRIGGER trg_enforce_client_parent_org
  BEFORE INSERT OR UPDATE OF parent_client_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_parent_org_match();


-- ============================================================
-- B) PROJECT BUDGETS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  planned_labor_hours numeric(10,2) NOT NULL DEFAULT 0,
  planned_labor_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_material_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_machine_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_other_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_billable_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_budgets_project UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_budgets_org ON public.project_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_budgets_client ON public.project_budgets(client_id);

-- updated_at trigger for project_budgets
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_project_budgets_updated_at ON public.project_budgets;
CREATE TRIGGER trg_project_budgets_updated_at
  BEFORE UPDATE ON public.project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- B) PROJECT SCOPE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_scope_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('estimate','manual','template')),
  source_id uuid NULL,
  sort_order integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'task' CHECK (item_type IN ('task','service','product')),
  name text NOT NULL,
  description text NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NULL,
  planned_hours numeric(10,2) NOT NULL DEFAULT 0,
  planned_unit_rate numeric(12,2) NOT NULL DEFAULT 0,
  planned_cost_rate numeric(12,2) NOT NULL DEFAULT 0,
  planned_material_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_machine_cost numeric(12,2) NOT NULL DEFAULT 0,
  planned_total numeric(12,2) NOT NULL DEFAULT 0,
  tax1_rate numeric(6,3) NOT NULL DEFAULT 0,
  tax2_rate numeric(6,3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scope_items_org ON public.project_scope_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_scope_items_project ON public.project_scope_items(project_id);
CREATE INDEX IF NOT EXISTS idx_scope_items_source ON public.project_scope_items(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_scope_items_sort ON public.project_scope_items(project_id, sort_order);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_scope_items_updated_at ON public.project_scope_items;
CREATE TRIGGER trg_scope_items_updated_at
  BEFORE UPDATE ON public.project_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: maintain planned_total = (quantity * planned_hours * planned_unit_rate) + planned_material_cost + planned_machine_cost
CREATE OR REPLACE FUNCTION public.compute_scope_item_planned_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.planned_total := (NEW.quantity * NEW.planned_hours * NEW.planned_unit_rate)
                       + NEW.planned_material_cost
                       + NEW.planned_machine_cost;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_scope_items_planned_total ON public.project_scope_items;
CREATE TRIGGER trg_scope_items_planned_total
  BEFORE INSERT OR UPDATE ON public.project_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.compute_scope_item_planned_total();


-- ============================================================
-- C) TASK AUTOMATION LINKAGE
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scope_item_id uuid NULL REFERENCES public.project_scope_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS planned_hours numeric(10,2) NULL DEFAULT 0;

-- Partial unique index: one generated task per scope item per project
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_scope_item
  ON public.tasks(project_id, scope_item_id)
  WHERE scope_item_id IS NOT NULL;


-- ============================================================
-- D) ACTUAL COST TRACKING
-- ============================================================

-- Add cost_rate to project_members
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS cost_rate numeric(12,2) NOT NULL DEFAULT 0;

-- Add cost_type to receipts for material/machine/other classification
ALTER TABLE public.receipts
  ADD COLUMN IF NOT EXISTS cost_type text NOT NULL DEFAULT 'material'
    CHECK (cost_type IN ('material','machine','other'));

-- Backfill cost_type from existing category enum
UPDATE public.receipts SET cost_type = CASE
  WHEN category::text IN ('materials','tools') THEN 'material'
  WHEN category::text = 'fuel' THEN 'machine'
  ELSE 'other'
END WHERE cost_type = 'material';

CREATE INDEX IF NOT EXISTS idx_receipts_cost_type ON public.receipts(cost_type);


-- ============================================================
-- E) PROJECT STATUS NORMALIZATION
-- ============================================================

-- Migrate existing statuses to new values
UPDATE public.projects SET status = 'not_started' WHERE status = 'planning';
UPDATE public.projects SET status = 'not_started' WHERE status NOT IN (
  'not_started','in_progress','completed','archived','deleted','potential','awarded','didnt_get'
);

-- Add check constraint for allowed status values
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_projects_status;
ALTER TABLE public.projects ADD CONSTRAINT chk_projects_status
  CHECK (status IN ('not_started','in_progress','completed','archived','deleted','potential','awarded','didnt_get'));

-- Trigger: sync is_deleted with status
CREATE OR REPLACE FUNCTION public.sync_project_status_is_deleted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'deleted' AND NEW.is_deleted = false THEN
    NEW.is_deleted := true;
  ELSIF NEW.status != 'deleted' AND NEW.is_deleted = true AND OLD.status = 'deleted' THEN
    NEW.is_deleted := false;
  ELSIF NEW.is_deleted = true AND NEW.status != 'deleted' AND OLD.is_deleted = false THEN
    NEW.status := 'deleted';
  ELSIF NEW.is_deleted = false AND OLD.is_deleted = true THEN
    IF NEW.status = 'deleted' THEN
      NEW.status := 'not_started';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_project_status ON public.projects;
CREATE TRIGGER trg_sync_project_status
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_status_is_deleted();


-- ============================================================
-- F) RLS POLICIES
-- ============================================================

-- project_budgets
ALTER TABLE public.project_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view project budgets"
  ON public.project_budgets FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create project budgets"
  ON public.project_budgets FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update project budgets"
  ON public.project_budgets FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete project budgets"
  ON public.project_budgets FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));

-- project_scope_items
ALTER TABLE public.project_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view scope items"
  ON public.project_scope_items FOR SELECT
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create scope items"
  ON public.project_scope_items FOR INSERT
  WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update scope items"
  ON public.project_scope_items FOR UPDATE
  USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete scope items"
  ON public.project_scope_items FOR DELETE
  USING (is_org_admin(auth.uid(), organization_id));
