import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate cron secret
    const cronSecret = req.headers.get("x-cron-secret");
    const { data: secretRow } = await supabase
      .from("cron_secrets")
      .select("secret")
      .eq("name", "invoice_reminder_secret")
      .single();

    if (!secretRow || cronSecret !== secretRow.secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    // Get all orgs with reminders enabled
    const { data: settingsRows } = await supabase
      .from("invoice_settings")
      .select("*")
      .eq("reminder_enabled", true);

    if (!settingsRows || settingsRows.length === 0) {
      return new Response(JSON.stringify({ message: "No orgs with reminders enabled", sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalSent = 0;
    const today = new Date();

    for (const settings of settingsRows) {
      const reminderDays: number[] = settings.reminder_days || [7, 14, 30];

      // Get overdue sent invoices for this org
      const { data: overdueInvoices } = await supabase
        .from("invoices")
        .select("*, clients(name, email, contact_name)")
        .eq("organization_id", settings.organization_id)
        .eq("status", "sent")
        .lt("due_date", today.toISOString().split("T")[0]);

      if (!overdueInvoices || overdueInvoices.length === 0) continue;

      for (const inv of overdueInvoices) {
        const dueDate = new Date(inv.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const client = (inv as any).clients;

        // Check if this matches a reminder milestone
        const shouldSend = reminderDays.some((d: number) => daysOverdue === d);
        if (!shouldSend || !client?.email) continue;

        // Don't send if already reminded today
        if (inv.last_reminder_sent_at) {
          const lastSent = new Date(inv.last_reminder_sent_at);
          if (lastSent.toDateString() === today.toDateString()) continue;
        }

        const companyName = settings.company_name || "Our Company";
        const cs = settings.currency === "EUR" ? "€" : settings.currency === "GBP" ? "£" : "$";
        const balance = Number(inv.total) - Number(inv.amount_paid || 0);

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            ${settings.logo_url ? `<img src="${settings.logo_url}" alt="${companyName}" style="max-height:50px;margin-bottom:16px" />` : ""}
            <h2 style="color:#333">Payment Reminder</h2>
            <p>Dear ${client.contact_name || client.name},</p>
            <p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> is now <strong>${daysOverdue} days past due</strong>.</p>
            <div style="background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:4px;margin:16px 0">
              <p style="margin:0"><strong>Outstanding Balance: ${cs}${balance.toFixed(2)}</strong></p>
              <p style="margin:4px 0 0 0;font-size:13px">Due Date: ${new Date(inv.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            ${settings.payment_instructions ? `<div style="margin-top:16px;padding:12px;background:#f0f7ff;border-left:4px solid #0066cc;border-radius:4px"><strong>Payment Instructions:</strong><br/><pre style="font-family:Arial;white-space:pre-wrap;margin:8px 0 0 0;font-size:13px">${settings.payment_instructions}</pre></div>` : ""}
            <p style="margin-top:20px">If you've already sent payment, please disregard this message.</p>
            <p>Thank you,<br/>${companyName}</p>
          </div>
        `;

        const fromEmail = settings.from_email
          ? `${companyName} <${settings.from_email}>`
          : `${companyName} <onboarding@resend.dev>`;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [client.email],
              subject: `Payment Reminder: Invoice ${inv.invoice_number} - ${daysOverdue} Days Overdue`,
              html: emailHtml,
            }),
          });

          if (res.ok) {
            await supabase
              .from("invoices")
              .update({
                last_reminder_sent_at: new Date().toISOString(),
                reminder_count: (inv.reminder_count || 0) + 1,
              })
              .eq("id", inv.id);

            // Log activity
            await supabase
              .from("invoice_activity_log")
              .insert({
                invoice_id: inv.id,
                user_id: "00000000-0000-0000-0000-000000000000",
                action: "reminder_sent",
                details: `${daysOverdue}-day payment reminder sent to ${client.email}`,
              });

            totalSent++;
          }
        } catch (emailErr) {
          console.error("Failed to send reminder for", inv.invoice_number, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
