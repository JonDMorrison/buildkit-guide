import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actorId = user.id;
    const body = await req.json();
    const { period_id, attestation_text } = body;

    if (!period_id) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'period_id required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Call RPC
    const { data, error } = await adminClient.rpc('rpc_submit_timesheet_period', {
      p_period_id: period_id,
      p_actor_id: actorId,
      p_attestation_text: attestation_text || null
    });

    if (error) {
      console.error('RPC error:', error);
      const message = error.message || 'Failed to submit period';
      let code = 'DB_ERROR';
      let status = 500;

      if (message.includes('not found')) {
        code = 'NOT_FOUND';
        status = 404;
      } else if (message.includes('Only the owner')) {
        code = 'FORBIDDEN';
        status = 403;
      } else if (message.includes('must be open')) {
        code = 'INVALID_STATE';
        status = 400;
      }

      return new Response(
        JSON.stringify({ ok: false, error: { code, message } }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Period submitted:', period_id);
    return new Response(
      JSON.stringify({ ok: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
