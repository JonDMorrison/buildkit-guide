import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { project_id, action, ...payload } = await req.json();

    if (!project_id) {
      return new Response(
        JSON.stringify({ error: 'project_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the project's organization
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if time tracking is enabled for the organization
    const { data: settings, error: settingsError } = await supabase
      .from('organization_settings')
      .select('time_tracking_enabled')
      .eq('organization_id', project.organization_id)
      .single();

    if (settingsError) {
      console.error('Error fetching organization settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organization settings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce the time tracking flag
    if (!settings?.time_tracking_enabled) {
      return new Response(
        JSON.stringify({ 
          error: 'Time tracking is not enabled for this organization',
          code: 'TIME_TRACKING_DISABLED'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different actions
    switch (action) {
      case 'start_timer':
        // Placeholder for starting a timer
        return new Response(
          JSON.stringify({ success: true, message: 'Timer started (placeholder)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'stop_timer':
        // Placeholder for stopping a timer
        return new Response(
          JSON.stringify({ success: true, message: 'Timer stopped (placeholder)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'get_entries':
        // Placeholder for getting time entries
        return new Response(
          JSON.stringify({ success: true, entries: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Error in time-tracking function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
