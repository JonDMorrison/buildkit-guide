import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_EMAILS = [
  "jon@getclear.ca",
  "pughejordan@gmail.com",
];

interface TrialSignupRequest {
  fullName: string;
  email: string;
  company?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fullName, email, company }: TrialSignupRequest = await req.json();

    if (!fullName || !email) {
      throw new Error("Missing required fields: fullName and email");
    }

    const emailHtml = `
      <h1>New Trial Signup</h1>
      <p>A new user has started a trial on Project Path:</p>
      <table style="border-collapse: collapse; margin-top: 20px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Company</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${company || "Not provided"}</td>
        </tr>
      </table>
      <p style="margin-top: 20px; color: #666;">This is an automated notification from Project Path.</p>
    `;

    const emailResponse = await resend.emails.send({
      from: "Project Path <noreply@projectpathapp.com>",
      to: NOTIFY_EMAILS,
      subject: `New Trial Signup: ${fullName}`,
      html: emailHtml,
    });

    console.log("Trial signup notification sent:", emailResponse);

    // Send a plain, friendly welcome email to the user who just signed up.
    // Wrapped in its own try/catch so a delivery failure here does not
    // invalidate the successful internal notification above.
    let userWelcomeResponse: unknown = null;
    try {
      const welcomeHtml = `
<!DOCTYPE html>
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

          <!-- Header -->
          <tr>
            <td style="background-color:#0a1628;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Project Path</div>
              <div style="font-size:13px;color:#4a8fd4;margin-top:4px;">Built for the field</div>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #e4e4e7;border-right:1px solid #e4e4e7;">
              <p style="font-size:24px;font-weight:700;color:#0a1628;margin:0 0 8px;">You're in, ${fullName}.</p>
              <p style="font-size:15px;color:#71717a;margin:0 0 32px;line-height:1.6;">Your Project Path account is set up and ready. Here's how to get your first job running in the next 15 minutes.</p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background-color:#0a1628;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:14px;font-weight:700;color:#ffffff;">1</span>
                        </td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <div style="font-size:15px;font-weight:600;color:#0a1628;">Add your first job site</div>
                          <div style="font-size:13px;color:#71717a;margin-top:2px;">Takes about 2 minutes. Give it a name and address.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background-color:#0a1628;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:14px;font-weight:700;color:#ffffff;">2</span>
                        </td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <div style="font-size:15px;font-weight:600;color:#0a1628;">Invite your foreman or site lead</div>
                          <div style="font-size:13px;color:#71717a;margin-top:2px;">They'll get an email invite and can log updates from their phone.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 32px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background-color:#0a1628;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:14px;font-weight:700;color:#ffffff;">3</span>
                        </td>
                        <td style="padding-left:14px;vertical-align:middle;">
                          <div style="font-size:15px;font-weight:600;color:#0a1628;">Check your morning briefing tomorrow</div>
                          <div style="font-size:13px;color:#71717a;margin-top:2px;">The AI surfaces what needs your attention before the crew shows up.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <a href="https://projectpath.app/dashboard" style="display:inline-block;background-color:#4a8fd4;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Go to your dashboard &rarr;</a>
                  </td>
                </tr>
              </table>

              <!-- Login help -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f4f4f5;padding-top:24px;">
                <tr>
                  <td style="background-color:#f8fafc;border-radius:8px;padding:20px 24px;">
                    <div style="font-size:13px;font-weight:600;color:#0a1628;margin-bottom:8px;">Signing in</div>
                    <div style="font-size:13px;color:#71717a;line-height:1.7;">
                      Go to <a href="https://projectpath.app/auth" style="color:#4a8fd4;text-decoration:none;">projectpath.app/auth</a> and sign in with <strong style="color:#3f3f46;">${email}</strong>.<br>
                      If you forget your password, click <em>Forgot password</em> on the login screen and we'll send you a reset link.<br>
                      Having trouble? Reply to this email and we'll sort it out.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f4f4f5;border-radius:0 0 12px 12px;border:1px solid #e4e4e7;border-top:none;padding:24px 40px;text-align:center;">
              <p style="font-size:13px;color:#71717a;margin:0 0 4px;">Jon Morrison, Project Path</p>
              <p style="font-size:12px;color:#a1a1aa;margin:0;">P.S. Jordan will be in touch to help you run your first project through it. He's good at this.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

      userWelcomeResponse = await resend.emails.send({
        from: "Project Path <noreply@projectpath.app>",
        to: [email],
        subject: "You're in \u2014 here's how to get started with Project Path",
        html: welcomeHtml,
      });
      console.log("User welcome email sent:", userWelcomeResponse);
    } catch (welcomeErr) {
      console.error("User welcome email failed:", welcomeErr);
    }

    return new Response(
      JSON.stringify({ success: true, emailResponse, userWelcomeResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending trial signup notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
