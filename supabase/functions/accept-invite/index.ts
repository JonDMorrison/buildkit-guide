import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
    function: 'accept-invite',
    ...data
  }));
};

// Zod schema for input validation
const AcceptInviteSchema = z.object({
  token: z.string().uuid("Invalid invitation token format"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password too long"),
  fullName: z.string().min(1).max(100).optional(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate input with Zod
    const rawBody = await req.json();
    const parseResult = AcceptInviteSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => e.message).join(", ");
      log('warn', 'Validation failed', { errors: parseResult.error.errors });
      throw new Error(errorMessage);
    }
    
    const { token, password, fullName } = parseResult.data;
    log('info', 'Processing invite acceptance', { tokenPrefix: token.substring(0, 8) });

    // Get the invitation with retry for race conditions
    let invitation = null;
    let inviteError = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase
        .from("invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .single();
      
      if (!result.error) {
        invitation = result.data;
        break;
      }
      inviteError = result.error;
      
      // Wait briefly before retry
      if (attempt < 2) await new Promise(r => setTimeout(r, 100));
    }

    if (inviteError || !invitation) {
      throw new Error("Invitation not found or already used");
    }

    // These checks are now handled by the query filter above
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Invitation has expired. Please request a new invite.");
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", invitation.email)
      .single();

    if (existingProfile) {
      // User exists, just add them to org/project
      const userId = existingProfile.id;

      // Add to organization if specified
      if (invitation.organization_id) {
        const { error: orgError } = await supabase
          .from("organization_memberships")
          .upsert({
            user_id: userId,
            organization_id: invitation.organization_id,
            role: invitation.role || "internal_worker",
            is_active: true,
          }, {
            onConflict: "user_id,organization_id",
          });

        if (orgError) {
          console.error("Error adding to organization:", orgError);
        }
      }

      // Add to project if specified
      if (invitation.project_id) {
        const { error: projectError } = await supabase
          .from("project_members")
          .upsert({
            user_id: userId,
            project_id: invitation.project_id,
            role: invitation.role || "internal_worker",
          }, {
            onConflict: "user_id,project_id",
          });

        if (projectError) {
          console.error("Error adding to project:", projectError);
        }
      }

      // Add admin role to user_roles table if invited as admin
      if (invitation.role === 'admin') {
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({
            user_id: userId,
            role: 'admin',
          }, {
            onConflict: "user_id,role",
          });

        if (roleError) {
          console.error("Error adding admin role:", roleError);
        } else {
          log('info', 'Admin role granted to existing user', { userId });
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

      return new Response(
        JSON.stringify({
          success: true,
          message: "You've been added to the team. Please sign in with your existing account.",
          existingUser: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create new user account
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true, // Auto-confirm since they have valid invite token
      user_metadata: {
        full_name: fullName || invitation.full_name,
      },
    });

    if (signUpError) {
      throw signUpError;
    }

    const newUserId = authData.user.id;

    // Poll for profile creation instead of fixed delay (race condition fix)
    let profileCreated = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", newUserId)
        .maybeSingle();
      
      if (profile) {
        profileCreated = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!profileCreated) {
      log('error', 'Profile creation timeout', { userId: newUserId });
      // Don't fail - profile trigger may still create it, but log the issue
    }

    // Update profile with full name
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ 
        full_name: fullName || invitation.full_name,
        has_onboarded: false,
      })
      .eq("id", newUserId);
    
    if (profileUpdateError) {
      log('warn', 'Failed to update profile', { error: profileUpdateError.message });
    }

    // Add to organization if specified
    if (invitation.organization_id) {
      const { error: orgError } = await supabase
        .from("organization_memberships")
        .insert({
          user_id: newUserId,
          organization_id: invitation.organization_id,
          role: invitation.role || "internal_worker",
          is_active: true,
        });

      if (orgError) {
        console.error("Error adding to organization:", orgError);
      }
    }

    // Add to project if specified  
    if (invitation.project_id) {
      const { error: projectError } = await supabase
        .from("project_members")
        .insert({
          user_id: newUserId,
          project_id: invitation.project_id,
          role: invitation.role || "internal_worker",
        });

      if (projectError) {
        console.error("Error adding to project:", projectError);
      }
    }

    // Add admin role to user_roles table if invited as admin
    if (invitation.role === 'admin') {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: newUserId,
          role: 'admin',
        });

      if (roleError) {
        console.error("Error adding admin role:", roleError);
      } else {
        log('info', 'Admin role granted to new user', { userId: newUserId });
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

    log('info', 'User successfully created and added to org', { 
      email: invitation.email,
      hasOrg: !!invitation.organization_id,
      hasProject: !!invitation.project_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created successfully",
        // Don't expose userId in response for security
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in accept-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
