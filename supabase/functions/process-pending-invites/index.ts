import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Structured logging helper
const log = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    function: 'process-pending-invites',
    ...data
  }));
};

// Map project roles to organization roles
const mapToOrgRole = (projectRole: string): string => {
  const roleMap: Record<string, string> = {
    'admin': 'admin',
    'project_manager': 'pm',
    'foreman': 'foreman',
    'internal_worker': 'internal_worker',
    'external_trade': 'external_trade',
    'hr': 'hr',
    'pm': 'pm',
  };
  return roleMap[projectRole] || 'internal_worker';
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      log('warn', 'Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode the JWT to get user info (service role can validate)
    const token = authHeader.replace('Bearer ', '');
    
    // Use service role client to get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      log('warn', 'Failed to validate token', { error: userError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    const userEmail = user.email;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'No email found for user' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log('info', 'Processing pending invites for user', { userId, email: userEmail });

    // Find all pending invitations for this email
    const { data: pendingInvites, error: invitesError } = await supabase
      .from("invitations")
      .select("*")
      .eq("email", userEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    if (invitesError) {
      log('error', 'Error fetching invitations', { error: invitesError.message });
      throw invitesError;
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      log('info', 'No pending invitations found', { email: userEmail });
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending invitations to process",
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log('info', 'Found pending invitations', { count: pendingInvites.length });

    let processed = 0;
    const processedRoles: string[] = [];
    const processedOrgs: string[] = [];
    const processedProjects: string[] = [];

    for (const invitation of pendingInvites) {
      const projectRole = invitation.role || "internal_worker";
      const orgRole = mapToOrgRole(projectRole);

      try {
        // Add to organization if specified
        if (invitation.organization_id) {
          const { error: orgError } = await supabase
            .from("organization_memberships")
            .upsert({
              user_id: userId,
              organization_id: invitation.organization_id,
              role: orgRole,
              is_active: true,
            }, {
              onConflict: "user_id,organization_id",
            });

          if (orgError) {
            log('warn', 'Error adding to organization', { error: orgError.message, orgId: invitation.organization_id });
          } else {
            processedOrgs.push(invitation.organization_id);
          }
        }

        // Add to project if specified
        if (invitation.project_id) {
          const { error: projectError } = await supabase
            .from("project_members")
            .upsert({
              user_id: userId,
              project_id: invitation.project_id,
              role: projectRole,
            }, {
              onConflict: "user_id,project_id",
            });

          if (projectError) {
            log('warn', 'Error adding to project', { error: projectError.message, projectId: invitation.project_id });
          } else {
            processedProjects.push(invitation.project_id);
          }
        }

        // Add to user_roles table for admin or project_manager roles (global permissions)
        if (invitation.role === 'admin' || invitation.role === 'project_manager') {
          const { error: roleError } = await supabase
            .from("user_roles")
            .upsert({
              user_id: userId,
              role: invitation.role,
            }, {
              onConflict: "user_id,role",
            });

          if (roleError) {
            log('warn', 'Error adding global role', { error: roleError.message, role: invitation.role });
          } else {
            processedRoles.push(invitation.role);
            log('info', 'Global role granted', { userId, role: invitation.role });
          }
        }

        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ 
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);

        processed++;
      } catch (err) {
        log('error', 'Error processing invitation', { invitationId: invitation.id, error: String(err) });
      }
    }

    log('info', 'Finished processing invitations', { 
      processed, 
      roles: processedRoles,
      orgs: processedOrgs.length,
      projects: processedProjects.length
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${processed} invitation(s)`,
        processed,
        roles: processedRoles,
        organizations: processedOrgs.length,
        projects: processedProjects.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    log('error', 'Error in process-pending-invites', { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});