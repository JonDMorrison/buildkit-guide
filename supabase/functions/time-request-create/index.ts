import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      request_type,
      project_id,
      time_entry_id,
      job_site_id,
      reason,
      proposed_check_in_at,
      proposed_check_out_at,
      proposed_job_site_id,
      proposed_notes,
    } = body;

    console.log('Creating time adjustment request:', { user_id: user.id, request_type, project_id });

    // Validate required fields
    if (!request_type) {
      return new Response(JSON.stringify({ error: 'request_type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!project_id) {
      return new Response(JSON.stringify({ error: 'project_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!reason || reason.trim() === '') {
      return new Response(JSON.stringify({ error: 'reason is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate request type
    const validTypes = ['missed_check_in', 'missed_check_out', 'change_times', 'change_job_site', 'add_note', 'add_manual_entry'];
    if (!validTypes.includes(request_type)) {
      return new Response(JSON.stringify({ error: `Invalid request_type. Must be one of: ${validTypes.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Type-specific validation
    if (request_type === 'missed_check_in') {
      if (!proposed_check_in_at) {
        return new Response(JSON.stringify({ error: 'proposed_check_in_at is required for missed_check_in' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request_type === 'missed_check_out') {
      if (!time_entry_id) {
        return new Response(JSON.stringify({ error: 'time_entry_id is required for missed_check_out' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!proposed_check_out_at) {
        return new Response(JSON.stringify({ error: 'proposed_check_out_at is required for missed_check_out' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request_type === 'change_times') {
      if (!time_entry_id) {
        return new Response(JSON.stringify({ error: 'time_entry_id is required for change_times' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!proposed_check_in_at && !proposed_check_out_at) {
        return new Response(JSON.stringify({ error: 'At least one of proposed_check_in_at or proposed_check_out_at is required for change_times' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request_type === 'change_job_site') {
      if (!time_entry_id) {
        return new Response(JSON.stringify({ error: 'time_entry_id is required for change_job_site' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!proposed_job_site_id) {
        return new Response(JSON.stringify({ error: 'proposed_job_site_id is required for change_job_site' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request_type === 'add_note') {
      if (!time_entry_id) {
        return new Response(JSON.stringify({ error: 'time_entry_id is required for add_note' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!proposed_notes || proposed_notes.trim() === '') {
        return new Response(JSON.stringify({ error: 'proposed_notes is required for add_note' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request_type === 'add_manual_entry') {
      if (!proposed_check_in_at || !proposed_check_out_at) {
        return new Response(JSON.stringify({ error: 'Both proposed_check_in_at and proposed_check_out_at are required for add_manual_entry' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get project to find organization_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      console.error('Project lookup error:', projectError);
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is a member of this organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', project.organization_id)
      .eq('is_active', true)
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'You are not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If time_entry_id is provided, verify it exists and belongs to the user
    if (time_entry_id) {
      const { data: entry, error: entryError } = await supabase
        .from('time_entries')
        .select('id, user_id')
        .eq('id', time_entry_id)
        .single();

      if (entryError || !entry) {
        return new Response(JSON.stringify({ error: 'Time entry not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (entry.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'You can only request adjustments for your own time entries' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create the adjustment request
    const { data: request, error: insertError } = await supabase
      .from('time_adjustment_requests')
      .insert({
        request_type,
        project_id,
        organization_id: project.organization_id,
        time_entry_id: time_entry_id || null,
        job_site_id: job_site_id || null,
        requester_user_id: user.id, // Always derived from auth user
        target_user_id: user.id, // Worker requesting for themselves
        reason: reason.trim(),
        proposed_check_in_at: proposed_check_in_at || null,
        proposed_check_out_at: proposed_check_out_at || null,
        proposed_job_site_id: proposed_job_site_id || null,
        proposed_notes: proposed_notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create adjustment request', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log time_event for request creation
    const { error: eventError } = await supabase
      .from('time_events')
      .insert({
        organization_id: project.organization_id,
        user_id: user.id,
        project_id,
        job_site_id: job_site_id || null,
        event_type: 'adjustment',
        occurred_at: new Date().toISOString(),
        actor_id: user.id,
        source: 'worker',
        metadata: {
          action: 'request_created',
          request_id: request.id,
          request_type,
        },
      });

    if (eventError) {
      console.warn('Failed to log time_event:', eventError);
      // Don't fail the request, just log warning
    }

    console.log('Created adjustment request:', request.id);

    return new Response(JSON.stringify({ success: true, request }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
