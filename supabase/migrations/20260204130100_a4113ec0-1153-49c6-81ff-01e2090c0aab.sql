
-- Update the handle_new_organization function to also add the creator as admin
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Create organization settings
  INSERT INTO public.organization_settings (organization_id, time_tracking_enabled)
  VALUES (NEW.id, false)
  ON CONFLICT (organization_id) DO NOTHING;
  
  -- Add the creator (current user) as admin of the organization
  INSERT INTO public.organization_memberships (user_id, organization_id, role, is_active)
  VALUES (auth.uid(), NEW.id, 'admin', true)
  ON CONFLICT (user_id, organization_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
