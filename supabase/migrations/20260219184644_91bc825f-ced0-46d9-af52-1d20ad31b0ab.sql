
-- Write inventory result to a probe table readable by service role
CREATE TABLE IF NOT EXISTS public._inv_probe_v101 (
  id serial PRIMARY KEY,
  result jsonb,
  ran_at timestamptz DEFAULT now()
);

INSERT INTO public._inv_probe_v101 (result)
SELECT public.rpc_get_os_system_inventory();
