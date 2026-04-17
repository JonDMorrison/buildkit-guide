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

// Styled invite email template — shared by both existing-user and new-user paths.
function buildInviteEmailHtml(params: {
  recipientName: string;
  inviterName: string;
  orgName: string;
  ctaUrl: string;
  ctaText: string;
}): string {
  const { recipientName, inviterName, orgName, ctaUrl, ctaText } = params;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:#0a1628;border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">
              <img src="https://projectpath.app/email-logo.png" alt="Project Path" width="180" style="display:block;margin:0 auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="font-size:20px;font-weight:700;color:#0a1628;margin:0 0 4px;">You've been invited.</p>
              <p style="font-size:24px;font-weight:700;color:#0a1628;margin:0 0 16px;">${inviterName} added you to ${orgName}.</p>
              <p style="font-size:15px;color:#71717a;margin:0 0 32px;line-height:1.6;">Project Path is how your team coordinates job sites, tracks daily progress, and keeps everyone on the same page -- without the group texts.</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="${ctaUrl}" style="display:inline-block;background-color:#4a8fd4;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">${ctaText}</a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:#f8fafc;border-radius:8px;padding:20px 24px;border:1px solid #e4e4e7;">
                    <div style="font-size:13px;font-weight:600;color:#0a1628;margin-bottom:12px;">What you'll be able to do</div>
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="padding-bottom:8px;vertical-align:top;"><span style="font-size:13px;color:#71717a;line-height:1.6;">&#10003;&nbsp;&nbsp;Log daily site updates from your phone</span></td></tr>
                      <tr><td style="padding-bottom:8px;vertical-align:top;"><span style="font-size:13px;color:#71717a;line-height:1.6;">&#10003;&nbsp;&nbsp;Submit safety forms and flag issues</span></td></tr>
                      <tr><td style="vertical-align:top;"><span style="font-size:13px;color:#71717a;line-height:1.6;">&#10003;&nbsp;&nbsp;See your tasks and project updates in one place</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#f8fafc;border-radius:8px;padding:20px 24px;border:1px solid #e4e4e7;">
                    <div style="font-size:13px;font-weight:600;color:#0a1628;margin-bottom:8px;">Signing in after you accept</div>
                    <div style="font-size:13px;color:#71717a;line-height:1.7;">
                      Go to <a href="https://projectpath.app/auth" style="color:#4a8fd4;text-decoration:none;">projectpath.app/auth</a> and sign in with this email address.<br>
                      If you forget your password, click <em>Forgot password</em> on the login screen.<br>
                      Having trouble? Reply to this email.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f4f5;border-radius:0 0 12px 12px;border:1px solid #e4e4e7;border-top:none;padding:24px 40px;text-align:center;">
              <p style="font-size:12px;color:#a1a1aa;margin:0;">You received this because ${inviterName} added you to their Project Path account. If this was a mistake, you can ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Your session has expired. Please refresh the page and try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      log('warn', 'Auth token invalid or expired', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: "Your session has expired. Please refresh the page and try again." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Get inviter's organization membership + org name (needed for both paths)
    const { data: inviterMembership } = await supabase
      .from("organization_memberships")
      .select("organization_id, organizations(name)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    const organizationId = inviterMembership?.organization_id || null;
    const orgName = (inviterMembership?.organizations as any)?.name || 'their team';

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingProfile) {
      // User exists — still create the invitation so process-pending-invites
      // can add them to this org/project when they next sign in
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

      if (inviteError) throw inviteError;

      // Send a "sign in to accept" email instead of a signup link.
      // Wrapped in a 15s timeout so a slow Resend response doesn't hang the UI —
      // the user is already in the system regardless of whether this email lands.
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);
        const recipientName = fullName || email.split('@')[0];
        try {
          const sendTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Existing-user email timeout after 15s')), 15000)
          );
          await Promise.race([resend.emails.send({
            from: "Project Path <noreply@projectpath.app>",
            to: [email],
            subject: `You've been added to ${orgName} on Project Path`,
            html: buildInviteEmailHtml({ recipientName, inviterName, orgName, ctaUrl: 'https://projectpath.app/auth', ctaText: 'Sign in to get started &rarr;' }),
          }), sendTimeout]);
        } catch (err: any) {
          log('warn', 'Existing-user invite email failed or timed out', { error: err.message });
        }
      }

      log('info', 'Existing user invited — invitation created for process-pending-invites', {
        invitationId: invitation.id,
        hasProject: !!projectId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          emailSent: !!resendApiKey,
          message: `${email} already has an account — they've been notified to sign in to access the new project.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          subject: `You've been invited to join ${orgName} on Project Path`,
          html: buildInviteEmailHtml({ recipientName, inviterName, orgName, ctaUrl: inviteLink, ctaText: 'Accept your invitation &rarr;' }),
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
    log('error', 'Unhandled error in send-invite', { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred. Please try again." }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
