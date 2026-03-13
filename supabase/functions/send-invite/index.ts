import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";
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
    function: 'send-invite',
    ...data
  }));
};

// Zod schema for input validation
const InviteRequestSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
  fullName: z.string().min(1).max(100).optional(),
  projectId: z.string().uuid().optional(),
  role: z.string().max(50).optional(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
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

    // Get inviter's name for the email
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const inviterName = inviterProfile?.full_name || user.email || "A team member";

    // Validate input with Zod
    const rawBody = await req.json();
    const parseResult = InviteRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => e.message).join(", ");
      log('warn', 'Validation failed', { errors: parseResult.error.errors });
      throw new Error(errorMessage);
    }
    
    const { email, fullName, projectId, role } = parseResult.data;
    log('info', 'Processing invitation', { email: email.substring(0, 3) + '***', role });

    // Security check: Only admins can invite other admins
    if (role === 'admin') {
      const { data: inviterAdminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!inviterAdminRole) {
        log('warn', 'Non-admin attempted to invite admin', { inviterId: user.id });
        throw new Error("Only administrators can invite other administrators");
      }
      log('info', 'Admin invite authorized', { inviterId: user.id });
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

    // Get inviter's organization membership
    const { data: inviterMembership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const organizationId = inviterMembership?.organization_id || null;

    // Create invitation record with organization and project context
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .insert({
        email: email.toLowerCase().trim(),
        full_name: fullName || null,
        invited_by: user.id,
        organization_id: organizationId,
        project_id: projectId || null,
        role: role || "internal_worker",
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // Build the invite link dynamically from request origin or env var
    const origin = req.headers.get("origin");
    const appUrl = Deno.env.get("APP_URL") || origin || "https://projectpath.app";
    const inviteLink = `${appUrl}/accept-invite?token=${invitation.token}`;

    log('info', 'Invitation created', { 
      invitationId: invitation.id,
      hasProject: !!projectId 
    });
    // SECURITY: Don't log the full invite link in production

    // Send email if Resend is configured
    let emailSent = false;
    let emailError: string | null = null;
    
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const recipientName = fullName || email.split("@")[0];
      
      try {
        const sendTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout after 15s')), 15000)
        );
        const emailResponse = await Promise.race([resend.emails.send({
          from: "Project Path <noreply@projectpath.app>",
          to: [email],
          subject: `${inviterName} invited you to join Project Path`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #E53935; margin: 0; font-size: 28px;">Project Path</h1>
                <p style="color: #666; margin-top: 5px;">Construction Project Management</p>
              </div>
              
              <div style="background: linear-gradient(135deg, #E53935 0%, #EF5350 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; font-size: 24px;">You're Invited! 🎉</h2>
                <p style="margin: 0; opacity: 0.9; font-size: 16px;">Join the team on Project Path</p>
              </div>
              
              <p style="font-size: 16px;">Hi ${recipientName},</p>
              
              <p style="font-size: 16px;"><strong>${inviterName}</strong> has invited you to join their team on Project Path - the construction project management platform that keeps every trade accountable and your schedule on track.</p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: #E53935; color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Accept Invitation</a>
              </div>
              
              <p style="font-size: 14px; color: #666;">This invitation will expire in 7 days. If you didn't expect this email, you can safely ignore it.</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center;">
                Project Path - Keep your job site moving<br>
                <a href="${appUrl}" style="color: #E53935;">projectpath.app</a>
              </p>
            </body>
            </html>
          `,
        }), sendTimeout]);

        // Check if Resend returned an error in the response
        if (emailResponse.error) {
          emailError = emailResponse.error.message || 'Failed to send email';
          log('error', 'Resend API error', { 
            error: emailResponse.error.message,
            name: emailResponse.error.name
          });
        } else {
          emailSent = true;
          log('info', 'Email sent successfully', { emailId: emailResponse.data?.id });
        }
      } catch (err: any) {
        emailError = err.message || 'Failed to send email';
        log('error', 'Email send exception', { error: err.message });
      }
    } else {
      log('warn', 'RESEND_API_KEY not configured, skipping email send');
      emailError = 'Email service not configured';
    }

    // Return response with email status
    const responseMessage = emailSent 
      ? "Invitation sent successfully" 
      : emailError?.includes('domain') 
        ? "Invitation created but email could not be sent. Please verify your domain at resend.com/domains to enable email sending."
        : emailError 
          ? `Invitation created but email failed: ${emailError}` 
          : "Invitation created (email service not configured)";

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        emailError,
        message: responseMessage,
        // Include invite link for manual sharing when email fails
        ...(emailError && { inviteLink }),
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
