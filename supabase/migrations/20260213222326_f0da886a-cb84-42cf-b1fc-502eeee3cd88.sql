
-- 1) Prevent self-parenting
ALTER TABLE public.clients
  ADD CONSTRAINT clients_no_self_parent
  CHECK (parent_client_id IS NULL OR parent_client_id <> id);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_clients_org_parent
  ON public.clients (organization_id, parent_client_id);

CREATE INDEX IF NOT EXISTS idx_clients_active_org
  ON public.clients (is_active, organization_id);

-- 3) Cycle-prevention trigger (replaces the old org-match-only trigger)
CREATE OR REPLACE FUNCTION public.enforce_client_hierarchy()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_current_id uuid;
  v_depth int := 0;
  v_max_depth int := 20;
BEGIN
  -- Nothing to validate when no parent
  IF NEW.parent_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Org match: parent must belong to the same organization
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = NEW.parent_client_id
      AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Parent client must belong to the same organization';
  END IF;

  -- Walk up the chain to detect cycles
  v_current_id := NEW.parent_client_id;
  WHILE v_current_id IS NOT NULL AND v_depth < v_max_depth LOOP
    IF v_current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular parent reference detected for client %', NEW.id;
    END IF;

    SELECT parent_client_id INTO v_current_id
    FROM public.clients
    WHERE id = v_current_id;

    v_depth := v_depth + 1;
  END LOOP;

  IF v_depth >= v_max_depth THEN
    RAISE EXCEPTION 'Client hierarchy exceeds maximum depth of %', v_max_depth;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger + function, attach new one
DROP TRIGGER IF EXISTS enforce_client_parent_org ON public.clients;
DROP TRIGGER IF EXISTS enforce_client_hierarchy_trigger ON public.clients;

CREATE TRIGGER enforce_client_hierarchy_trigger
  BEFORE INSERT OR UPDATE OF parent_client_id, organization_id
  ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_hierarchy();
