import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, report_type = "weekly", recipient_type = "owner" } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const today = now.toISOString().split("T")[0];

    // Fetch all data in parallel
    const [projectResult, taskResult, logsResult, defResolvedResult, defOpenResult, coResult, snapResult, blockerResult] = await Promise.all([
      // 1. Project info
      admin.from("projects").select("name, job_type, status, start_date, end_date").eq("id", project_id).single(),

      // 2. Task progress
      admin.from("tasks").select("id, status, due_date").eq("project_id", project_id).eq("is_deleted", false),

      // 3. Daily logs this week
      admin.from("daily_logs")
        .select("log_date, work_performed, crew_count, weather, next_day_plan")
        .eq("project_id", project_id)
        .gte("log_date", sevenDaysAgo.split("T")[0])
        .order("log_date", { ascending: false }),

      // 4. Deficiencies resolved this week
      admin.from("deficiencies")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .gte("resolved_at", sevenDaysAgo),

      // 5. Open high-priority deficiencies
      admin.from("deficiencies")
        .select("title, location, trades(name)")
        .eq("project_id", project_id)
        .not("status", "in", '("resolved","closed")')
        .in("priority", [1, 2])
        .limit(5),

      // 6. Change orders this week
      admin.from("change_orders")
        .select("id, amount")
        .eq("project_id", project_id)
        .gte("created_at", sevenDaysAgo),

      // 7. Latest financial snapshot
      admin.from("project_financial_snapshots")
        .select("margin_pct, labor_burn_ratio")
        .eq("project_id", project_id)
        .order("snapshot_date", { ascending: false })
        .limit(1),

      // 8. Blockers
      admin.from("blockers")
        .select("id, is_resolved, resolved_at")
        .eq("project_id", project_id),
    ]);

    const project = projectResult.data;
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tasks = taskResult.data ?? [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === "done").length;
    const inProgress = tasks.filter((t: any) => ["active", "in_progress", "not_started"].includes(t.status)).length;
    const overdue = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date < today).length;

    const logs = logsResult.data ?? [];
    const defResolved = defResolvedResult.count ?? 0;
    const defOpen = defOpenResult.data ?? [];
    const changeOrders = coResult.data ?? [];
    const coCount = changeOrders.length;
    const coTotal = changeOrders.reduce((s: number, co: any) => s + Number(co.amount || 0), 0);
    const snap = snapResult.data?.[0] ?? null;
    const allBlockers = blockerResult.data ?? [];
    const blockersResolvedThisWeek = allBlockers.filter((b: any) => b.resolved_at && b.resolved_at >= sevenDaysAgo).length;
    const blockersOpen = allBlockers.filter((b: any) => !b.is_resolved).length;

    // Report period
    const periodEnd = now;
    const periodStart = new Date(now.getTime() - 7 * 86400000);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const reportPeriod = `${fmt(periodStart)} – ${fmt(periodEnd)}, ${periodEnd.getFullYear()}`;

    // Build context
    const context = {
      project_name: project.name,
      job_type: project.job_type,
      project_status: project.status,
      report_period: reportPeriod,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      in_progress: inProgress,
      overdue_tasks: overdue,
      daily_logs: logs.map((l: any) => ({
        date: l.log_date,
        work: l.work_performed,
        crew: l.crew_count,
        weather: l.weather,
      })),
      deficiencies_resolved: defResolved,
      open_high_deficiencies: defOpen.map((d: any) => ({
        title: d.title,
        location: d.location,
        trade: Array.isArray(d.trades) && d.trades[0] ? (d.trades[0] as any).name : (d.trades as any)?.name || null,
      })),
      change_orders_this_week: coCount,
      change_order_total: coTotal,
      margin_pct: snap?.margin_pct ?? null,
      blockers_resolved: blockersResolvedThisWeek,
      blockers_open: blockersOpen,
    };

    // System prompts by recipient
    const systemPrompts: Record<string, string> = {
      owner: `You are writing a professional weekly progress report for a construction project owner. Write in clear, non-technical language. The owner is not a builder — avoid trade jargon. Focus on: what was accomplished, overall progress, any decisions needed from the owner, and what's planned next. Be positive but honest. 2-3 paragraphs maximum per section. Never mention internal metrics like "labor burn index" — translate to plain English.`,
      gc: `You are writing a professional weekly progress report for a General Contractor. Use industry-standard language. Be direct and factual. Include task completion rates, deficiency status, blocker resolution, and schedule adherence. GCs appreciate precision and accountability. Flag any coordination issues that need their attention.`,
    };

    const ownerSections = '"This Week\'s Progress", "Site Activity", "Looking Ahead", "Items Requiring Your Attention"';
    const gcSections = '"Progress Summary", "Task & Schedule Status", "Quality & Deficiencies", "Coordination Notes", "Next Week"';

    const sectionNames = recipient_type === "gc" ? gcSections : ownerSections;

    const jsonSchema = `{
  "sections": [
    { "title": "string", "content": "string (2-4 paragraphs of professional prose)" }
  ],
  "key_metrics": [
    { "label": "string", "value": "string" }
  ],
  "action_items": ["string array -- things needing client response/decision"],
  "next_week_preview": "string -- one paragraph on what's planned"
}

Sections to include: ${sectionNames}
key_metrics: 4-5 important numbers (tasks completed, completion %, deficiencies resolved, etc.)
action_items: only include if there are genuine decisions the recipient needs to make. Empty array if none.
Only cite numbers that exist in the provided data. Do not invent statistics.`;

    const systemPrompt = `${systemPrompts[recipient_type] || systemPrompts.owner}\n\nReturn ONLY valid JSON matching this schema:\n${jsonSchema}`;

    const userPrompt = `Generate a ${report_type} progress report for this project:\n\n${JSON.stringify(context, null, 2)}`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let report: any;
    try {
      report = JSON.parse(aiData.choices?.[0]?.message?.content || "");
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid format" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      generated_at: now.toISOString(),
      report_period: reportPeriod,
      project_name: project.name,
      recipient_type,
      sections: report.sections || [],
      key_metrics: report.key_metrics || [],
      action_items: report.action_items || [],
      next_week_preview: report.next_week_preview || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
