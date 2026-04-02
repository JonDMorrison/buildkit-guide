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
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    const { org_id } = await req.json();
    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get all project IDs for this org
    const { data: orgProjects } = await admin
      .from("projects")
      .select("id, job_type, status")
      .eq("organization_id", org_id);

    const projectIds = (orgProjects ?? []).map((p: any) => p.id);

    if (projectIds.length === 0) {
      return new Response(JSON.stringify({
        generated_at: new Date().toISOString(),
        org_health: { total_projects: 0, active_projects: 0, avg_margin: 0, task_completion_rate: 0, blocker_resolution_rate: 0 },
        trade_performance: [],
        job_type_risks: [],
        deficiency_patterns: [],
        top_insights: [],
        data_quality_note: "No projects found for this organization.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Run all queries in parallel
    const [tasksResult, timeResult, defResult, blockersResult, snapshotsResult] = await Promise.all([
      // All tasks with estimates
      admin
        .from("tasks")
        .select("id, project_id, title, status, estimated_hours, baseline_role_type, due_date, updated_at")
        .in("project_id", projectIds)
        .eq("is_deleted", false),

      // All time entries
      admin
        .from("time_entries")
        .select("task_id, hours, project_id")
        .in("project_id", projectIds),

      // All deficiencies
      admin
        .from("deficiencies")
        .select("id, project_id, assigned_trade_id, trades(name), priority, status, created_at, resolved_at")
        .in("project_id", projectIds),

      // All blockers
      admin
        .from("blockers")
        .select("id, project_id, is_resolved, created_at, resolved_at")
        .in("project_id", projectIds),

      // Financial snapshots (latest per project)
      admin
        .from("project_financial_snapshots")
        .select("project_id, margin_pct, labor_burn_ratio, actual_cost, planned_cost")
        .in("project_id", projectIds)
        .order("snapshot_date", { ascending: false }),
    ]);

    const tasks = tasksResult.data ?? [];
    const timeEntries = timeResult.data ?? [];
    const deficiencies = defResult.data ?? [];
    const blockers = blockersResult.data ?? [];
    const snapshots = snapshotsResult.data ?? [];

    // Build actual hours per task
    const actualByTask: Record<string, number> = {};
    for (const te of timeEntries) {
      if (te.task_id) actualByTask[te.task_id] = (actualByTask[te.task_id] || 0) + Number(te.hours || 0);
    }

    // Latest snapshot per project
    const latestSnap: Record<string, any> = {};
    for (const s of snapshots) {
      if (!latestSnap[s.project_id]) latestSnap[s.project_id] = s;
    }

    // === TRADE PERFORMANCE ===
    const tradeStats: Record<string, { estimated: number; actual: number; tasks: number; overruns: number; projects: Set<string> }> = {};
    for (const t of tasks) {
      if (!t.baseline_role_type || !t.estimated_hours || t.estimated_hours <= 0 || t.status !== "done") continue;
      const trade = t.baseline_role_type;
      if (!tradeStats[trade]) tradeStats[trade] = { estimated: 0, actual: 0, tasks: 0, overruns: 0, projects: new Set() };
      const actual = actualByTask[t.id] || 0;
      tradeStats[trade].estimated += Number(t.estimated_hours);
      tradeStats[trade].actual += actual;
      tradeStats[trade].tasks += 1;
      tradeStats[trade].projects.add(t.project_id);
      if (actual > Number(t.estimated_hours) * 1.2) tradeStats[trade].overruns += 1;
    }

    const tradePerformanceData = Object.entries(tradeStats)
      .filter(([_, s]) => s.tasks >= 3)
      .map(([trade, s]) => ({
        trade,
        projects_worked: s.projects.size,
        total_estimated: Math.round(s.estimated * 10) / 10,
        total_actual: Math.round(s.actual * 10) / 10,
        variance_pct: s.estimated > 0 ? Math.round(((s.actual / s.estimated) - 1) * 1000) / 10 : 0,
        overrun_count: s.overruns,
        total_tasks: s.tasks,
      }))
      .sort((a, b) => b.variance_pct - a.variance_pct);

    // === JOB TYPE RISK ===
    const jobTypeStats: Record<string, { projects: Set<string>; deficiencies: number; blockers: number; margins: number[] }> = {};
    for (const p of orgProjects ?? []) {
      if (!p.job_type) continue;
      if (!jobTypeStats[p.job_type]) jobTypeStats[p.job_type] = { projects: new Set(), deficiencies: 0, blockers: 0, margins: [] };
      jobTypeStats[p.job_type].projects.add(p.id);
      const snap = latestSnap[p.id];
      if (snap?.margin_pct != null) jobTypeStats[p.job_type].margins.push(Number(snap.margin_pct));
    }
    for (const d of deficiencies) {
      const proj = (orgProjects ?? []).find((p: any) => p.id === d.project_id);
      if (proj?.job_type && jobTypeStats[proj.job_type]) jobTypeStats[proj.job_type].deficiencies += 1;
    }
    for (const b of blockers) {
      const proj = (orgProjects ?? []).find((p: any) => p.id === b.project_id);
      if (proj?.job_type && jobTypeStats[proj.job_type]) jobTypeStats[proj.job_type].blockers += 1;
    }

    const jobTypeRiskData = Object.entries(jobTypeStats)
      .filter(([_, s]) => s.projects.size >= 2)
      .map(([job_type, s]) => ({
        job_type,
        project_count: s.projects.size,
        avg_margin: s.margins.length > 0 ? Math.round((s.margins.reduce((a, b) => a + b, 0) / s.margins.length) * 10) / 10 : null,
        total_deficiencies: s.deficiencies,
        total_blockers: s.blockers,
        deficiencies_per_project: Math.round((s.deficiencies / s.projects.size) * 10) / 10,
      }))
      .sort((a, b) => (a.avg_margin ?? 999) - (b.avg_margin ?? 999));

    // === DEFICIENCY PATTERNS ===
    const defByTrade: Record<string, { count: number; projects: Set<string>; highPriority: number; resolutionHours: number[] }> = {};
    for (const d of deficiencies) {
      const tradeName = (Array.isArray(d.trades) && d.trades[0] ? (d.trades[0] as any).name : (d.trades as any)?.name) || null;
      if (!tradeName) continue;
      if (!defByTrade[tradeName]) defByTrade[tradeName] = { count: 0, projects: new Set(), highPriority: 0, resolutionHours: [] };
      defByTrade[tradeName].count += 1;
      defByTrade[tradeName].projects.add(d.project_id);
      if (d.priority === 1 || d.priority === 2) defByTrade[tradeName].highPriority += 1;
      if (d.resolved_at && d.created_at) {
        const hrs = (new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime()) / 3600000;
        if (hrs > 0) defByTrade[tradeName].resolutionHours.push(hrs);
      }
    }

    const deficiencyPatternData = Object.entries(defByTrade)
      .filter(([_, s]) => s.count >= 3)
      .map(([trade, s]) => ({
        trade,
        total_deficiencies: s.count,
        projects_affected: s.projects.size,
        high_priority_count: s.highPriority,
        avg_resolution_hours: s.resolutionHours.length > 0
          ? Math.round(s.resolutionHours.reduce((a, b) => a + b, 0) / s.resolutionHours.length)
          : null,
      }))
      .sort((a, b) => b.total_deficiencies - a.total_deficiencies)
      .slice(0, 10);

    // === ORG HEALTH ===
    const totalProjects = (orgProjects ?? []).length;
    const activeProjects = (orgProjects ?? []).filter((p: any) => p.status === "active").length;
    const completedTasks = tasks.filter(t => t.status === "done").length;
    const totalTaskCount = tasks.length;
    const resolvedBlockers = blockers.filter(b => b.is_resolved).length;
    const totalBlockerCount = blockers.length;
    const allMargins = Object.values(latestSnap).map((s: any) => Number(s.margin_pct)).filter(n => !isNaN(n));
    const avgMargin = allMargins.length > 0 ? Math.round((allMargins.reduce((a, b) => a + b, 0) / allMargins.length) * 10) / 10 : 0;

    const orgHealthData = {
      total_projects: totalProjects,
      active_projects: activeProjects,
      avg_margin: avgMargin,
      task_completion_rate: totalTaskCount > 0 ? Math.round((completedTasks / totalTaskCount) * 1000) / 10 : 0,
      blocker_resolution_rate: totalBlockerCount > 0 ? Math.round((resolvedBlockers / totalBlockerCount) * 1000) / 10 : 0,
    };

    // === AI ANALYSIS ===
    const systemPrompt = `You are a construction business intelligence analyst. Analyze cross-project performance data and identify actionable patterns. Be specific with numbers. Focus on insights that would help a contractor run better jobs.

CRITICAL RULES:
1. NEVER invent or hallucinate numbers. Only cite numbers from the provided data.
2. Every number you cite must come directly from the data below.
3. Be concise and actionable. No fluff.
4. Focus on patterns that repeat across multiple projects.

Return ONLY valid JSON matching this schema:
{
  "trade_performance": [
    {
      "trade": "string",
      "projects_worked": number,
      "variance_pct": number,
      "reliability_score": 0-100,
      "signal": "over_budget" | "on_track" | "under_budget",
      "insight": "one sentence"
    }
  ],
  "job_type_risks": [
    {
      "job_type": "string",
      "project_count": number,
      "avg_margin": number or null,
      "risk_level": "low" | "medium" | "high",
      "deficiencies_per_project": number,
      "insight": "one sentence"
    }
  ],
  "deficiency_patterns": [
    {
      "trade": "string",
      "total_deficiencies": number,
      "projects_affected": number,
      "avg_resolution_hours": number or null,
      "insight": "one sentence"
    }
  ],
  "top_insights": [
    {
      "title": "string",
      "description": "2-3 sentences with specific numbers, actionable",
      "category": "trade" | "job_type" | "deficiency" | "financial",
      "priority": "high" | "medium" | "low"
    }
  ],
  "data_quality_note": "string about data completeness"
}

reliability_score: 100 = perfect (0% variance), subtract points for variance and overrun frequency.
signal: over_budget if variance > 10%, under_budget if < -10%, else on_track.
risk_level: high if avg_margin < 10% or deficiencies_per_project > 5, medium if margin < 20%, else low.
top_insights: 3-5 most important cross-project findings.`;

    const userPrompt = `Analyze this organization's cross-project data:

## Org Health
${JSON.stringify(orgHealthData, null, 2)}

## Trade Performance (${tradePerformanceData.length} trades with 3+ tasks)
${JSON.stringify(tradePerformanceData, null, 2)}

## Job Type Data (${jobTypeRiskData.length} types with 2+ projects)
${JSON.stringify(jobTypeRiskData, null, 2)}

## Deficiency Patterns (${deficiencyPatternData.length} trades with 3+ deficiencies)
${JSON.stringify(deficiencyPatternData, null, 2)}

Generate the intelligence analysis.`;

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
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let analysis: any;
    try {
      analysis = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "AI returned invalid format" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === EVIDENCE VALIDATION (hallucination guard) ===
    // Build set of all valid numbers from our source data
    const validNumbers = new Set<number>();
    const addNum = (n: number | null | undefined) => {
      if (n == null || isNaN(n)) return;
      validNumbers.add(n);
      validNumbers.add(Math.round(n));
      validNumbers.add(Math.round(n * 10) / 10);
      validNumbers.add(Math.abs(n));
      validNumbers.add(Math.abs(Math.round(n)));
    };

    // Add all source data numbers
    addNum(orgHealthData.total_projects);
    addNum(orgHealthData.active_projects);
    addNum(orgHealthData.avg_margin);
    addNum(orgHealthData.task_completion_rate);
    addNum(orgHealthData.blocker_resolution_rate);
    for (const t of tradePerformanceData) {
      addNum(t.projects_worked);
      addNum(t.total_estimated);
      addNum(t.total_actual);
      addNum(t.variance_pct);
      addNum(t.overrun_count);
      addNum(t.total_tasks);
    }
    for (const j of jobTypeRiskData) {
      addNum(j.project_count);
      addNum(j.avg_margin);
      addNum(j.total_deficiencies);
      addNum(j.total_blockers);
      addNum(j.deficiencies_per_project);
    }
    for (const d of deficiencyPatternData) {
      addNum(d.total_deficiencies);
      addNum(d.projects_affected);
      addNum(d.high_priority_count);
      addNum(d.avg_resolution_hours);
    }

    // Extract numbers from top_insights descriptions
    const insightText = (analysis.top_insights || [])
      .map((i: any) => `${i.title} ${i.description}`)
      .join(" ");
    const citedNumbers = (insightText.match(/\$[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?%|(?<!\w)[\d,]+(?:\.\d+)?(?!\w)/g) || [])
      .map((s: string) => parseFloat(s.replace(/[$,%]/g, "").replace(/,/g, "")))
      .filter((n: number) => !isNaN(n) && n !== 0);

    const unmatchedCitations = citedNumbers.filter((n: number) => !validNumbers.has(n));

    // Log validation but don't reject — org intelligence is more complex than single-metric insights
    if (unmatchedCitations.length > 0) {
      console.warn("Org intelligence: some cited numbers not in source data:", unmatchedCitations);
    }

    const result = {
      generated_at: new Date().toISOString(),
      org_health: orgHealthData,
      trade_performance: analysis.trade_performance || [],
      job_type_risks: analysis.job_type_risks || [],
      deficiency_patterns: analysis.deficiency_patterns || [],
      top_insights: analysis.top_insights || [],
      data_quality_note: analysis.data_quality_note || `Analysis based on ${totalProjects} projects with ${totalTaskCount} tasks.`,
      validation: {
        unmatched_citations: unmatchedCitations.length,
        total_citations: citedNumbers.length,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("org-intelligence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
