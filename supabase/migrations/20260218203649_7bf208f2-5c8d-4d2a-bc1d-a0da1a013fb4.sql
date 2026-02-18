
-- ============================================================
-- quote_events table + rpc_log_quote_event
-- ============================================================

CREATE TABLE public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  actor_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events FORCE ROW LEVEL SECURITY;

-- SELECT: org-scoped via quote
CREATE POLICY "quote_events_select" ON public.quote_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_events.quote_id
        AND has_org_membership(q.organization_id)
    )
  );

-- No direct INSERT/UPDATE/DELETE for authenticated — writes go through RPC
CREATE POLICY "quote_events_deny_insert" ON public.quote_events
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "quote_events_deny_update" ON public.quote_events
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "quote_events_deny_delete" ON public.quote_events
  FOR DELETE TO authenticated
  USING (false);

-- Index for fast lookups
CREATE INDEX idx_quote_events_quote_id ON public.quote_events(quote_id, created_at DESC);

-- ============================================================
-- RPC: rpc_log_quote_event (SECURITY DEFINER to bypass deny-writes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_log_quote_event(
  p_quote_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org_id uuid;
  v_message text;
BEGIN
  -- Verify quote exists and caller has org membership
  SELECT q.organization_id INTO v_org_id
  FROM quotes q
  WHERE q.id = p_quote_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF NOT has_org_membership(v_org_id) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Build human-readable message
  v_message := CASE p_event_type
    WHEN 'created' THEN 'Quote created'
    WHEN 'updated' THEN 'Quote updated'
    WHEN 'sent' THEN 'Quote marked as sent'
    WHEN 'approved' THEN 'Quote approved'
    WHEN 'rejected' THEN 'Quote rejected' || COALESCE(': ' || (p_metadata->>'reason'), '')
    WHEN 'archived' THEN 'Quote archived'
    WHEN 'converted' THEN 'Quote converted to invoice'
    ELSE 'Quote event: ' || p_event_type
  END;

  INSERT INTO quote_events (quote_id, event_type, message, metadata, actor_user_id)
  VALUES (p_quote_id, p_event_type, v_message, p_metadata, v_caller);
END;
$$;
