
-- Harden organization_guardrails: revoke write grants
REVOKE INSERT, UPDATE, DELETE ON public.organization_guardrails FROM authenticated, anon, public;
