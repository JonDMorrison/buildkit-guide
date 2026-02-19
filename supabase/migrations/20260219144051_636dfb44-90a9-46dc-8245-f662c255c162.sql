
-- Fix security definer view warning  
ALTER VIEW public.v_rpc_metadata SET (security_invoker = on);
