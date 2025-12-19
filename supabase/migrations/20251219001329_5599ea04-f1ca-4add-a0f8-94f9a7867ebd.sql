-- Silence linter: keep notification_dedupe inaccessible from clients (RLS enabled but previously had no policies)
CREATE POLICY "No client access to notification_dedupe"
ON public.notification_dedupe
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);