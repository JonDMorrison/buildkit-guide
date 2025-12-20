-- Function to enforce safety form immutability
CREATE OR REPLACE FUNCTION public.enforce_safety_form_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow transitions from draft
  IF OLD.status = 'draft' THEN
    RETURN NEW;
  END IF;
  
  -- For submitted/reviewed forms, only allow specific changes
  IF OLD.status IN ('submitted', 'reviewed') THEN
    -- Block changes to immutable fields
    IF NEW.title IS DISTINCT FROM OLD.title OR
       NEW.form_type IS DISTINCT FROM OLD.form_type OR
       NEW.inspection_date IS DISTINCT FROM OLD.inspection_date OR
       NEW.project_id IS DISTINCT FROM OLD.project_id OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot modify core fields of submitted/reviewed safety forms. Use the amendment workflow.';
    END IF;
    
    -- Allow: submitted → reviewed transition
    IF OLD.status = 'submitted' AND NEW.status = 'reviewed' THEN
      RETURN NEW;
    END IF;
    
    -- Allow: adding record_hash to submitted form (within 60 seconds of creation)
    IF OLD.record_hash IS NULL AND NEW.record_hash IS NOT NULL 
       AND OLD.status = 'submitted' 
       AND (now() - OLD.created_at) < interval '60 seconds' THEN
      RETURN NEW;
    END IF;
    
    -- Allow: setting reviewed_by/reviewed_at when transitioning to reviewed
    IF NEW.reviewed_by IS NOT NULL AND OLD.reviewed_by IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Allow: updating updated_at timestamp only (for audit purposes)
    IF NEW.updated_at IS DISTINCT FROM OLD.updated_at AND
       NEW.title = OLD.title AND
       NEW.form_type = OLD.form_type AND
       NEW.inspection_date IS NOT DISTINCT FROM OLD.inspection_date AND
       NEW.project_id = OLD.project_id AND
       NEW.created_by = OLD.created_by AND
       NEW.created_at = OLD.created_at AND
       NEW.status = OLD.status AND
       NEW.record_hash IS NOT DISTINCT FROM OLD.record_hash AND
       NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by AND
       NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at THEN
      RETURN NEW;
    END IF;
    
    -- Block all other changes
    RAISE EXCEPTION 'Cannot modify submitted or reviewed safety forms. Use the amendment workflow.';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for safety_forms
DROP TRIGGER IF EXISTS tr_safety_forms_immutability ON public.safety_forms;
CREATE TRIGGER tr_safety_forms_immutability
  BEFORE UPDATE ON public.safety_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_safety_form_immutability();

-- Function to enforce safety entries immutability
CREATE OR REPLACE FUNCTION public.enforce_safety_entries_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_form_status public.safety_status;
  v_has_approved_amendment boolean;
BEGIN
  -- Get parent form status
  SELECT status INTO v_form_status
  FROM public.safety_forms
  WHERE id = COALESCE(OLD.safety_form_id, NEW.safety_form_id);
  
  -- Allow changes if form is still draft
  IF v_form_status = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- For submitted/reviewed forms, check if this is from an approved amendment (within 10 seconds)
  SELECT EXISTS (
    SELECT 1 FROM public.safety_form_amendments
    WHERE safety_form_id = COALESCE(OLD.safety_form_id, NEW.safety_form_id)
      AND status = 'approved'
      AND reviewed_at > (now() - interval '10 seconds')
  ) INTO v_has_approved_amendment;
  
  IF v_has_approved_amendment THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Block the change
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cannot delete entries from submitted/reviewed safety forms. Use the amendment workflow.';
  ELSE
    RAISE EXCEPTION 'Cannot modify entries of submitted/reviewed safety forms. Use the amendment workflow.';
  END IF;
END;
$function$;

-- Create trigger for safety_entries
DROP TRIGGER IF EXISTS tr_safety_entries_immutability ON public.safety_entries;
CREATE TRIGGER tr_safety_entries_immutability
  BEFORE UPDATE OR DELETE ON public.safety_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_safety_entries_immutability();