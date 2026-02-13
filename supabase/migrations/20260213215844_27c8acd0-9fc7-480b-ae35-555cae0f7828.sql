
-- 1. Prevent negative values on project_budgets
CREATE OR REPLACE FUNCTION public.validate_project_budget_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.contract_value < 0 THEN
    RAISE EXCEPTION 'contract_value cannot be negative';
  END IF;
  IF NEW.planned_labor_hours < 0 THEN
    RAISE EXCEPTION 'planned_labor_hours cannot be negative';
  END IF;
  IF NEW.planned_labor_cost < 0 THEN
    RAISE EXCEPTION 'planned_labor_cost cannot be negative';
  END IF;
  IF NEW.planned_material_cost < 0 THEN
    RAISE EXCEPTION 'planned_material_cost cannot be negative';
  END IF;
  IF NEW.planned_machine_cost < 0 THEN
    RAISE EXCEPTION 'planned_machine_cost cannot be negative';
  END IF;
  IF NEW.planned_other_cost < 0 THEN
    RAISE EXCEPTION 'planned_other_cost cannot be negative';
  END IF;
  IF NEW.planned_billable_amount < 0 THEN
    RAISE EXCEPTION 'planned_billable_amount cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_project_budget
BEFORE INSERT OR UPDATE ON public.project_budgets
FOR EACH ROW EXECUTE FUNCTION public.validate_project_budget_values();

-- 2. Prevent negative values on project_scope_items
CREATE OR REPLACE FUNCTION public.validate_scope_item_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.planned_hours < 0 THEN
    RAISE EXCEPTION 'planned_hours cannot be negative';
  END IF;
  IF NEW.planned_total < 0 THEN
    RAISE EXCEPTION 'planned_total cannot be negative';
  END IF;
  IF NEW.quantity < 0 THEN
    RAISE EXCEPTION 'quantity cannot be negative';
  END IF;
  IF NEW.planned_unit_rate < 0 THEN
    RAISE EXCEPTION 'planned_unit_rate cannot be negative';
  END IF;
  IF NEW.planned_material_cost < 0 THEN
    RAISE EXCEPTION 'planned_material_cost cannot be negative';
  END IF;
  IF NEW.planned_machine_cost < 0 THEN
    RAISE EXCEPTION 'planned_machine_cost cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scope_item
BEFORE INSERT OR UPDATE ON public.project_scope_items
FOR EACH ROW EXECUTE FUNCTION public.validate_scope_item_values();

-- 3. Prevent negative zones and validate clients
CREATE OR REPLACE FUNCTION public.validate_client_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.zones < 0 THEN
    RAISE EXCEPTION 'zones cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_client
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.validate_client_values();

-- 4. Prevent parent_client_id cycles (A->B->A or deeper)
CREATE OR REPLACE FUNCTION public.prevent_client_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_id uuid;
  depth int := 0;
BEGIN
  IF NEW.parent_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Cannot be own parent
  IF NEW.parent_client_id = NEW.id THEN
    RAISE EXCEPTION 'A client cannot be its own parent';
  END IF;

  -- Walk up the chain from the proposed parent to detect cycles
  current_id := NEW.parent_client_id;
  WHILE current_id IS NOT NULL AND depth < 10 LOOP
    SELECT parent_client_id INTO current_id
    FROM public.clients
    WHERE id = current_id;

    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular parent-child relationship detected';
    END IF;
    depth := depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_client_cycle
BEFORE INSERT OR UPDATE OF parent_client_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.prevent_client_cycle();
