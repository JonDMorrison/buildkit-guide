import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { email, fullName }: InviteRequest = await req.json();

    if (!email || !email.includes("@")) {
      throw new Error("Invalid email address");
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase().trim(),
        full_name: fullName || null,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // TODO: Send email with invitation link
    // For now, we'll just return success
    // In production, integrate with email service (Resend, SendGrid, etc.)
    const inviteLink = `${supabaseUrl.replace('https://', 'https://app.')}/accept-invite?token=${invitation.token}`;

    console.log(`Invitation created for ${email}`);
    console.log(`Invite link: ${inviteLink}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation created successfully",
        inviteLink, // Return for testing; remove in production
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});