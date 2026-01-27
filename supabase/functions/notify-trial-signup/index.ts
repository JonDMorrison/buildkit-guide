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

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
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
