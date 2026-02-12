import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate cron secret
    const cronSecret = req.headers.get("x-cron-secret");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: secretRow } = await supabaseAdmin
      .from("cron_secrets")
      .select("secret")
      .eq("name", "recurring_invoice_secret")
      .single();

    if (!secretRow || cronSecret !== secretRow.secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all active templates whose next_issue_date <= today
    const today = new Date().toISOString().split("T")[0];
    const { data: templates, error: tErr } = await supabaseAdmin
      .from("recurring_invoice_templates")
      .select("*")
      .eq("is_active", true)
      .lte("next_issue_date", today);

    if (tErr) throw tErr;
    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, message: "No templates due" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { templateId: string; invoiceId?: string; error?: string }[] = [];

    for (const tmpl of templates) {
      try {
        // Get org invoice settings for prefix + number
        const { data: invNum } = await supabaseAdmin.rpc(
          "get_next_invoice_number",
          { org_id: tmpl.organization_id }
        );

        // Calculate line item totals
        const lineItems = (tmpl.line_items as any[]) || [];
        const subtotal = lineItems.reduce(
          (s: number, li: any) =>
            s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
          0
        );

        // Get tax rate from settings
        const { data: settings } = await supabaseAdmin
          .from("invoice_settings")
          .select("tax_rate, default_payment_terms")
          .eq("organization_id", tmpl.organization_id)
          .single();

        const taxRate = Number(settings?.tax_rate || 0);
        const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        const total = Math.round((subtotal + taxAmount) * 100) / 100;

        // Calculate due date from payment terms
        const paymentTerms = settings?.default_payment_terms || "Net 30";
        const termDays = parseInt(paymentTerms.replace(/\D/g, "")) || 30;
        const issueDate = new Date(tmpl.next_issue_date);
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + termDays);

        // Create the invoice
        const { data: invoice, error: invErr } = await supabaseAdmin
          .from("invoices")
          .insert({
            organization_id: tmpl.organization_id,
            client_id: tmpl.client_id,
            project_id: tmpl.project_id,
            invoice_number: invNum || "INV-0001",
            status: "draft",
            issue_date: tmpl.next_issue_date,
            due_date: dueDate.toISOString().split("T")[0],
            subtotal,
            tax_amount: taxAmount,
            total,
            notes: tmpl.notes,
            created_by: tmpl.created_by,
          })
          .select("id")
          .single();

        if (invErr) throw invErr;

        // Insert line items
        if (lineItems.length > 0 && invoice) {
          const rows = lineItems.map((li: any, i: number) => ({
            invoice_id: invoice.id,
            description: li.description || "",
            quantity: Number(li.quantity) || 1,
            unit_price: Number(li.unit_price) || 0,
            amount:
              (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
            sort_order: i,
            category: li.category || "other",
          }));
          await supabaseAdmin.from("invoice_line_items").insert(rows);
        }

        // Advance next_issue_date based on frequency
        const nextDate = new Date(tmpl.next_issue_date);
        switch (tmpl.frequency) {
          case "weekly":
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case "biweekly":
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case "quarterly":
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          default:
            nextDate.setMonth(nextDate.getMonth() + 1);
        }

        await supabaseAdmin
          .from("recurring_invoice_templates")
          .update({
            next_issue_date: nextDate.toISOString().split("T")[0],
            updated_at: new Date().toISOString(),
          })
          .eq("id", tmpl.id);

        results.push({ templateId: tmpl.id, invoiceId: invoice?.id });
      } catch (err: any) {
        results.push({ templateId: tmpl.id, error: err.message });
      }
    }

    return new Response(JSON.stringify({ generated: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
