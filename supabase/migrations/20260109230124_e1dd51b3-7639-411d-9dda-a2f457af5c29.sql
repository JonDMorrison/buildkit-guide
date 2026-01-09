-- =====================================================
-- Add organization_id to invitations table
-- This allows tracking which org the invite is for
-- =====================================================

-- Add organization_id column to invitations (nullable for backwards compatibility)
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- Add project_id column for project-specific invites (optional)
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);

-- Add role column to specify what role the user should get
ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'internal_worker';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- Update RLS to allow invitees to read their own invitation by token
DROP POLICY IF EXISTS "Invitees can view their invitation by token" ON invitations;

CREATE POLICY "Invitees can view their invitation by token"
  ON invitations FOR SELECT TO anon, authenticated
  USING (
    -- Anyone can read an invitation if they have the token (checked in app logic)
    -- This allows the accept-invite page to validate tokens
    true
  );