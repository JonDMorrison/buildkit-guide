import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { invoiceId, recipientEmail, recipientName, subject, message } = await req.json();

    if (!invoiceId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing invoiceId or recipientEmail" }), { status: 400, headers: corsHeaders });
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, clients(name, email), projects(name)")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: corsHeaders });
    }

    const { data: settings } = await supabase
      .from("invoice_settings")
      .select("*")
      .eq("organization_id", invoice.organization_id)
      .single();

    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");

    const companyName = settings?.company_name || "Our Company";
    const items = lineItems || [];
    const cs = settings?.currency === "EUR" ? "€" : settings?.currency === "GBP" ? "£" : "$";

    const lineItemsHtml = items.map((li: any) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${li.description}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${li.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${cs}${Number(li.unit_price).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${cs}${Number(li.amount).toFixed(2)}</td>
      </tr>`
    ).join("");

    const logoHtml = settings?.logo_url
      ? `<img src="${settings.logo_url}" alt="${companyName}" style="max-height:60px;max-width:200px;margin-bottom:16px" /><br/>`
      : "";

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        ${logoHtml}
        <h2 style="color:#333">${companyName}</h2>
        ${settings?.company_address ? `<p style="color:#666;font-size:13px">${settings.company_address}</p>` : ""}
        <hr style="border:none;border-top:2px solid #333;margin:20px 0" />
        
        <h3>Invoice ${invoice.invoice_number}</h3>
        ${recipientName ? `<p>Dear ${recipientName},</p>` : ""}
        ${message ? `<p>${message}</p>` : `<p>Please find your invoice details below.</p>`}
        
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Description</th>
              <th style="padding:8px;text-align:right">Qty</th>
              <th style="padding:8px;text-align:right">Price</th>
              <th style="padding:8px;text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
        </table>
        
        <div style="text-align:right;margin-top:16px">
          <p>Subtotal: <strong>${cs}${Number(invoice.subtotal).toFixed(2)}</strong></p>
          ${Number(invoice.tax_amount) > 0 ? `<p>${settings?.tax_label || "Tax"}: <strong>${cs}${Number(invoice.tax_amount).toFixed(2)}</strong></p>` : ""}
          <p style="font-size:18px;font-weight:bold">Total: ${cs}${Number(invoice.total).toFixed(2)}</p>
          ${Number(invoice.amount_paid) > 0 ? `<p>Paid: ${cs}${Number(invoice.amount_paid).toFixed(2)}</p><p style="font-size:16px;font-weight:bold">Balance Due: ${cs}${(Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2)}</p>` : ""}
        </div>
        
        ${settings?.default_payment_terms ? `<p style="margin-top:20px"><strong>Payment Terms:</strong> ${settings.default_payment_terms}</p>` : ""}
        ${invoice.due_date ? `<p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
        ${settings?.payment_instructions ? `<div style="margin-top:20px;padding:12px;background:#f0f7ff;border-left:4px solid #0066cc;border-radius:4px"><strong>Payment Instructions:</strong><br/><pre style="font-family:Arial,sans-serif;white-space:pre-wrap;margin:8px 0 0 0;font-size:13px">${settings.payment_instructions}</pre></div>` : ""}
        ${invoice.notes ? `<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:4px"><strong>Notes:</strong><br/>${invoice.notes}</div>` : ""}
        
        <hr style="border:none;border-top:1px solid #ddd;margin:30px 0" />
        <p style="color:#999;font-size:12px">This invoice was sent from ${companyName}</p>
      </div>
    `;

    const emailSubject = subject || `Invoice ${invoice.invoice_number} from ${companyName}`;

    // Use configurable from_email if available (2D)
    const fromEmail = settings?.from_email
      ? `${companyName} <${settings.from_email}>`
      : `${companyName} <onboarding@resend.dev>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errBody }), { status: 500, headers: corsHeaders });
    }

    // Update invoice status to sent (only if draft)
    if (invoice.status === "draft") {
      await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoiceId);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
