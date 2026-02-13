import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface PortfolioRow {
  project_id: string;
  project_name: string;
  has_budget: boolean;
  planned_total_cost: number;
  actual_total_cost: number;
  total_cost_delta: number;
  planned_margin_percent: number;
  actual_margin_percent: number;
  labor_hours_missing_cost_rate: number;
  actual_unclassified_cost: number;
  billed_percentage: number;
  contract_value: number;
}

interface Recommendation {
  severity: string;
  title: string;
  message: string;
  evidence: string;
  projectName?: string;
}

function getPortfolioRecommendations(rows: PortfolioRow[]): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const r of rows) {
    if (!r.has_budget) {
      recs.push({
        severity: "critical",
        title: "Missing Budget",
        message: `"${r.project_name}" has no budget.`,
        evidence: "No budget defined",
        projectName: r.project_name,
      });
    }

    if (
      r.has_budget &&
      r.planned_total_cost > 0 &&
      r.total_cost_delta < 0 &&
      Math.abs(r.total_cost_delta) / r.planned_total_cost > 0.2
    ) {
      recs.push({
        severity: "critical",
        title: "Significant Cost Overrun",
        message: `"${r.project_name}" is ${(
          (Math.abs(r.total_cost_delta) / r.planned_total_cost) *
          100
        ).toFixed(0)}% over budget.`,
        evidence: `$${Math.abs(r.total_cost_delta).toFixed(0)} over planned`,
        projectName: r.project_name,
      });
    }

    if (r.actual_unclassified_cost > 500) {
      recs.push({
        severity: "warn",
        title: "Unclassified Receipts",
        message: `"${r.project_name}" has $${r.actual_unclassified_cost.toFixed(0)} in unclassified receipts.`,
        evidence: `$${r.actual_unclassified_cost.toFixed(0)} without category`,
        projectName: r.project_name,
      });
    }

    if (r.labor_hours_missing_cost_rate > 5) {
      recs.push({
        severity: "warn",
        title: "Missing Cost Rates",
        message: `"${r.project_name}" has ${r.labor_hours_missing_cost_rate.toFixed(0)} labor hours with $0 rate.`,
        evidence: `${r.labor_hours_missing_cost_rate.toFixed(0)} hours understated`,
        projectName: r.project_name,
      });
    }

    if (r.has_budget && r.contract_value > 0) {
      const margin =
        ((r.contract_value - r.actual_total_cost) / r.contract_value) * 100;
      if (margin < 0) {
        recs.push({
          severity: "critical",
          title: "Negative Margin",
          message: `"${r.project_name}" is at ${margin.toFixed(1)}% margin.`,
          evidence: `Margin: ${margin.toFixed(1)}%`,
          projectName: r.project_name,
        });
      }
    }
  }

  return recs
    .sort((a, b) => {
      const order = { critical: 3, warn: 2, info: 1 };
      return (
        (order[b.severity as keyof typeof order] || 0) -
        (order[a.severity as keyof typeof order] || 0)
      );
    })
    .slice(0, 5);
}

function getVarianceChanges(rows: PortfolioRow[]): PortfolioRow[] {
  return rows
    .filter((r) => r.has_budget && r.planned_total_cost > 0)
    .sort(
      (a, b) =>
        Math.abs(b.total_cost_delta / (b.planned_total_cost || 1)) -
        Math.abs(a.total_cost_delta / (a.planned_total_cost || 1))
    )
    .slice(0, 5);
}

function buildEmailHtml(
  orgName: string,
  recs: Recommendation[],
  topVariance: PortfolioRow[],
  appUrl: string
): string {
  const severityColor: Record<string, string> = {
    critical: "#dc2626",
    warn: "#f59e0b",
    info: "#3b82f6",
  };

  const recsHtml = recs.length
    ? recs
        .map(
          (r) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${severityColor[r.severity] || "#6b7280"}">${r.severity.toUpperCase()}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
          <strong>${r.title}</strong><br/>
          <span style="font-size:13px;color:#6b7280">${r.message}</span>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td style="padding:12px;color:#6b7280">No critical recommendations this week. 🎉</td></tr>`;

  const varianceHtml = topVariance.length
    ? topVariance
        .map((v) => {
          const pct =
            v.planned_total_cost > 0
              ? ((v.total_cost_delta / v.planned_total_cost) * 100).toFixed(1)
              : "N/A";
          const color =
            v.total_cost_delta < 0 ? "#dc2626" : "#16a34a";
          return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${v.project_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${color};font-weight:600">${pct}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${color}">$${Math.abs(v.total_cost_delta).toFixed(0)}</td>
      </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" style="padding:12px;color:#6b7280">No variance data available.</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f3f4f6">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <h1 style="margin:0 0 4px;font-size:22px;color:#111827">Weekly Operations Digest</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280">${orgName} &bull; Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

      <h2 style="font-size:16px;color:#111827;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">🔔 Top Recommendations</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        ${recsHtml}
      </table>

      <h2 style="font-size:16px;color:#111827;margin:0 0 12px;border-bottom:2px solid #e5e7eb;padding-bottom:8px">📊 Biggest Variance Changes</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Project</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Variance %</th>
          <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Delta</th>
        </tr>
        ${varianceHtml}
      </table>

      <div style="text-align:center;margin-top:24px">
        <a href="${appUrl}/insights" style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Full Dashboard →</a>
      </div>

      <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center">
        You're receiving this because you opted in to weekly digests.
        <a href="${appUrl}/notification-settings" style="color:#6b7280">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://projectpath.app";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate cron secret
    const cronSecret = req.headers.get("x-cron-secret");
    const { data: secretRow } = await supabase
      .from("cron_secrets")
      .select("secret")
      .eq("name", "weekly_digest_secret")
      .single();

    if (!secretRow || cronSecret !== secretRow.secret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get all orgs
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name");

    if (!orgs || orgs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No organizations", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const org of orgs) {
      // Get users who opted in to weekly digest AND are admin/pm
      const { data: optedInUsers } = await supabase
        .from("notification_preferences")
        .select("user_id")
        .eq("weekly_digest", true);

      if (!optedInUsers || optedInUsers.length === 0) continue;

      // Filter to admin/pm users in this org
      const { data: orgMembers } = await supabase
        .from("organization_memberships")
        .select("user_id, role")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .in("role", ["admin", "pm"]);

      if (!orgMembers || orgMembers.length === 0) continue;

      const eligibleUserIds = new Set(orgMembers.map((m) => m.user_id));
      const recipients = optedInUsers.filter((u) =>
        eligibleUserIds.has(u.user_id)
      );

      if (recipients.length === 0) continue;

      // Get portfolio data for this org
      const { data: portfolioData } = await supabase.rpc(
        "project_portfolio_report" as any,
        { p_org_id: org.id }
      );

      // Get budget existence
      const { data: budgets } = await supabase
        .from("project_budgets")
        .select("project_id")
        .eq("organization_id", org.id);

      const budgetIds = new Set((budgets || []).map((b: any) => b.project_id));

      const rows: PortfolioRow[] = ((portfolioData as any[]) || []).map(
        (r: any) => ({
          project_id: r.project_id,
          project_name: r.project_name,
          has_budget: budgetIds.has(r.project_id),
          planned_total_cost: Number(r.planned_total_cost) || 0,
          actual_total_cost: Number(r.actual_total_cost) || 0,
          total_cost_delta: Number(r.total_cost_delta) || 0,
          planned_margin_percent: Number(r.planned_margin_percent) || 0,
          actual_margin_percent: Number(r.actual_margin_percent) || 0,
          labor_hours_missing_cost_rate:
            Number(r.labor_hours_missing_cost_rate) || 0,
          actual_unclassified_cost: Number(r.actual_unclassified_cost) || 0,
          billed_percentage: Number(r.billed_percentage) || 0,
          contract_value: Number(r.contract_value) || 0,
        })
      );

      const recs = getPortfolioRecommendations(rows);
      const topVariance = getVarianceChanges(rows);
      const emailHtml = buildEmailHtml(org.name, recs, topVariance, appUrl);

      // Get emails for recipients
      for (const recipient of recipients) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", recipient.user_id)
          .single();

        if (!profile?.email) continue;

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Project Path <noreply@projectpathapp.com>",
              to: [profile.email],
              subject: `Weekly Ops Digest — ${org.name}`,
              html: emailHtml,
            }),
          });

          if (res.ok) {
            totalSent++;
          } else {
            const errBody = await res.text();
            console.error(
              `Failed to send digest to ${profile.email}:`,
              errBody
            );
          }
        } catch (emailErr) {
          console.error(`Email send error for ${profile.email}:`, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Weekly digest error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
