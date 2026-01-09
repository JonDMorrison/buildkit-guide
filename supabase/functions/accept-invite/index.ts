import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInviteRequest {
  token: string;
  password: string;
  fullName: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password, fullName }: AcceptInviteRequest = await req.json();

    if (!token || !password) {
      throw new Error("Token and password are required");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Get the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status === "accepted") {
      throw new Error("Invitation has already been used");
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error("Invitation has expired");
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

    // Wait a moment for the profile trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile with full name
    await supabase
      .from("profiles")
      .update({ 
        full_name: fullName || invitation.full_name,
        has_onboarded: false,
      })
      .eq("id", newUserId);

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

    // Mark invitation as accepted
    await supabase
      .from("invitations")
      .update({ 
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    console.log(`User ${invitation.email} successfully created and added to org`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account created successfully",
        userId: newUserId,
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
