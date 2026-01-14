-- Allow anonymous users to view invitations by token for the accept-invite flow
CREATE POLICY "Anyone can view invitations by token"
  ON invitations FOR SELECT TO anon
  USING (true);