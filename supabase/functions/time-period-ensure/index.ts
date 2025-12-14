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

    // Create client with user token to get user info
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
    const { project_id, period_start, period_end } = body;

    if (!project_id || !period_start || !period_end) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'project_id, period_start, period_end required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for writes
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get org_id from project and verify membership
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, organization_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      console.error('Project lookup error:', projectError);
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orgId = project.organization_id;

    // Verify actor is org member
    const { data: orgMembership, error: orgError } = await adminClient
      .from('organization_memberships')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', actorId)
      .eq('is_active', true)
      .single();

    if (orgError || !orgMembership) {
      console.error('Org membership check failed:', orgError);
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'Not a member of this organization' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify actor is project member
    const { data: projectMembership, error: pmError } = await adminClient
      .from('project_members')
      .select('id')
      .eq('project_id', project_id)
      .eq('user_id', actorId)
      .single();

    if (pmError || !projectMembership) {
      console.error('Project membership check failed:', pmError);
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'Not a member of this project' } }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert timesheet period
    const { data: period, error: upsertError } = await adminClient
      .from('timesheet_periods')
      .upsert(
        {
          organization_id: orgId,
          user_id: actorId,
          period_start,
          period_end,
          status: 'open'
        },
        { onConflict: 'organization_id,user_id,period_start,period_end', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      // If it already exists, just fetch it
      const { data: existing, error: fetchError } = await adminClient
        .from('timesheet_periods')
        .select('*')
        .eq('organization_id', orgId)
        .eq('user_id', actorId)
        .eq('period_start', period_start)
        .eq('period_end', period_end)
        .single();

      if (fetchError || !existing) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: 'DB_ERROR', message: upsertError.message } }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Period ensured (existing):', existing.id);
      return new Response(
        JSON.stringify({ ok: true, data: existing }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Period ensured:', period.id);
    return new Response(
      JSON.stringify({ ok: true, data: period }),
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
