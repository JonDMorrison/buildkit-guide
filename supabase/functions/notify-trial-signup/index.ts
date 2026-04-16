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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #222; max-width: 560px;">
          <p>Hi ${fullName},</p>
          <p>Welcome to Project Path.</p>
          <p>You're set up and ready to go. Here's what to do first:</p>
          <ol style="padding-left: 20px;">
            <li>Add your first job site &mdash; it takes about 2 minutes</li>
            <li>Invite your foreman or project manager</li>
            <li>Check your morning briefing tomorrow morning</li>
          </ol>
          <p>If you have any questions, just reply to this email.</p>
          <p>&mdash; Jon Morrison, Project Path</p>
          <p style="color: #666; font-size: 14px;">P.S. If Jordan already connected with you, he'll be in touch to help you run your first project through it.</p>
        </div>
      `;

      userWelcomeResponse = await resend.emails.send({
        from: "Project Path <noreply@projectpath.app>",
        to: [email],
        subject: "Your Project Path account is ready",
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
