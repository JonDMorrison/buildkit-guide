import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Alert {
  id: string;
  type: string;
  severity: "critical" | "high" | "normal";
  title: string;
  message: string;
  action_label: string | null;
  action_url: string | null;
  detected_at: string;
}

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

    // Authenticate user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id } = await req.json();
    if (!project_id) {
      return new Response(
        JSON.stringify({ error: "project_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400 * 1000).toISOString();
    const sixDaysAgo = new Date(now.getTime() - 6 * 86400 * 1000).toISOString();
    const currentHour = now.getUTCHours(); // Will adjust with timezone context if needed

    const alerts: Alert[] = [];
    const detectedAt = now.toISOString();

    // Run all checks in parallel
    const [
      staleBlockersResult,
      tradeOverrunResult,
      defRecentResult,
      defPreviousResult,
      defTopTradeResult,
      taskNoTimeResult,
      overdueStaleResult,
      dailyLogResult,
    ] = await Promise.all([
      // CHECK 1: Stale blockers (>48h unresolved)
      adminClient
        .from("blockers")
        .select("id, reason, created_at, description")
        .eq("project_id", project_id)
        .eq("is_resolved", false)
        .lt("created_at", twoDaysAgo)
        .order("created_at", { ascending: true })
        .limit(5),

      // CHECK 2: Trade overrun — use RPC or manual aggregation
      // We'll query completed time entries grouped by trade
      adminClient.rpc("rpc_detect_trade_overruns" as any, {
        p_project_id: project_id,
      }).then((res: any) => res).catch(() => ({ data: null, error: "rpc_not_found" })),

      // CHECK 3a: Deficiencies last 3 days
      adminClient
        .from("deficiencies")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .gte("created_at", threeDaysAgo),

      // CHECK 3b: Deficiencies previous 3 days
      adminClient
        .from("deficiencies")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .gte("created_at", sixDaysAgo)
        .lt("created_at", threeDaysAgo),

      // CHECK 3c: Top trade for recent deficiencies
      adminClient
        .from("deficiencies")
        .select("assigned_trade_id, trades(name)")
        .eq("project_id", project_id)
        .gte("created_at", threeDaysAgo)
        .not("assigned_trade_id", "is", null)
        .limit(50),

      // CHECK 4: Tasks due today with no time logged
      adminClient
        .from("tasks")
        .select("id, title, baseline_role_type")
        .eq("project_id", project_id)
        .eq("due_date", today)
        .not("status", "in", '("done","cancelled")')
        .eq("is_deleted", false)
        .limit(10),

      // CHECK 5: Overdue + stale tasks
      adminClient
        .from("tasks")
        .select("id, title, baseline_role_type, due_date, updated_at")
        .eq("project_id", project_id)
        .lt("due_date", today)
        .not("status", "in", '("done","cancelled")')
        .eq("is_deleted", false)
        .lt("updated_at", twoDaysAgo)
        .order("due_date", { ascending: true })
        .limit(5),

      // CHECK 6: Missing daily log
      adminClient
        .from("daily_logs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project_id)
        .eq("log_date", today),
    ]);

    // Process CHECK 1: Stale Blockers
    for (const blocker of staleBlockersResult.data ?? []) {
      const daysOld = Math.floor(
        (now.getTime() - new Date(blocker.created_at).getTime()) /
          (86400 * 1000)
      );
      alerts.push({
        id: `stale_blocker_${blocker.id}`,
        type: "stale_blocker",
        severity: "critical",
        title: `Blocker Unresolved: ${(blocker.reason || "Unknown").substring(0, 60)}`,
        message: `This blocker has been open for ${daysOld} days. It may be delaying dependent tasks.`,
        action_label: "View Blockers",
        action_url: `/projects/${project_id}/blockers`,
        detected_at: detectedAt,
      });
    }

    // Process CHECK 2: Trade Overruns (fallback if RPC doesn't exist)
    if (tradeOverrunResult.data && !tradeOverrunResult.error) {
      for (const row of tradeOverrunResult.data as any[]) {
        const pctOver = Math.round(
          ((row.actual_hours - row.estimated_hours) / row.estimated_hours) * 100
        );
        if (pctOver >= 30) {
          alerts.push({
            id: `trade_overrun_${row.trade || "unknown"}`,
            type: "trade_overrun",
            severity: "high",
            title: `${row.trade || "Unknown Trade"} Running Over Budget`,
            message: `${row.trade || "This trade"} is ${pctOver}% over their estimated hours. Review task scope or adjust estimates.`,
            action_label: "View Tasks",
            action_url: `/tasks?trade=${encodeURIComponent(row.trade || "")}`,
            detected_at: detectedAt,
          });
        }
      }
    }

    // Process CHECK 3: Deficiency Spike
    const recentCount = defRecentResult.count ?? 0;
    const previousCount = defPreviousResult.count ?? 0;
    if (
      recentCount >= 3 &&
      (previousCount === 0 || recentCount > previousCount * 1.5)
    ) {
      const pctIncrease =
        previousCount > 0
          ? Math.round(((recentCount - previousCount) / previousCount) * 100)
          : 100;

      // Find top trade
      const tradeCounts: Record<string, number> = {};
      for (const d of defTopTradeResult.data ?? []) {
        const name =
          (Array.isArray(d.trades) && d.trades[0]
            ? (d.trades[0] as any).name
            : (d.trades as any)?.name) || "Unknown";
        tradeCounts[name] = (tradeCounts[name] || 0) + 1;
      }
      const topTrade = Object.entries(tradeCounts).sort(
        (a, b) => b[1] - a[1]
      )[0]?.[0];

      alerts.push({
        id: "deficiency_spike",
        type: "deficiency_spike",
        severity: "high",
        title: "Deficiency Spike Detected",
        message: `Deficiencies have increased ${pctIncrease}% in the last 3 days vs the prior period (${recentCount} vs ${previousCount}).${topTrade ? ` ${topTrade} is the most affected area.` : ""}`,
        action_label: "View Deficiencies",
        action_url: `/deficiencies`,
        detected_at: detectedAt,
      });
    }

    // Process CHECK 4: Tasks due today, no time logged
    // For each task, check if any time was logged today
    const dueTodayTasks = taskNoTimeResult.data ?? [];
    if (dueTodayTasks.length > 0) {
      const taskIds = dueTodayTasks.map((t: any) => t.id);
      const { data: todayTime } = await adminClient
        .from("time_entries")
        .select("task_id")
        .in("task_id", taskIds)
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`);

      const loggedTaskIds = new Set(
        (todayTime ?? []).map((t: any) => t.task_id)
      );

      for (const task of dueTodayTasks) {
        if (!loggedTaskIds.has(task.id)) {
          alerts.push({
            id: `task_no_time_${task.id}`,
            type: "task_no_time",
            severity: "high",
            title: `No Time Logged: ${(task.title || "Unknown").substring(0, 50)}`,
            message: `This task is due today but no time has been logged. Confirm the crew is on it.`,
            action_label: "View Task",
            action_url: `/tasks?taskId=${task.id}`,
            detected_at: detectedAt,
          });
        }
      }
    }

    // Process CHECK 5: Overdue + Stale
    for (const task of overdueStaleResult.data ?? []) {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(task.due_date).getTime()) / (86400 * 1000)
      );
      const hoursStale = Math.floor(
        (now.getTime() - new Date(task.updated_at).getTime()) / (3600 * 1000)
      );
      alerts.push({
        id: `overdue_stale_${task.id}`,
        type: "overdue_stale",
        severity: "critical",
        title: `Overdue and Stale: ${(task.title || "Unknown").substring(0, 50)}`,
        message: `This task is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue and hasn't been updated in ${hoursStale} hours. It may have been forgotten.`,
        action_label: "View Task",
        action_url: `/tasks?taskId=${task.id}`,
        detected_at: detectedAt,
      });
    }

    // Process CHECK 6: Missing Daily Log (only after 10am)
    const logCount = dailyLogResult.count ?? 0;
    if (logCount === 0 && currentHour >= 16) {
      // 16 UTC ≈ 10am MT (Chantel in Kelowna is MT)
      alerts.push({
        id: "missing_log",
        type: "missing_log",
        severity: "normal",
        title: "No Daily Log Submitted",
        message:
          "Today's site log hasn't been submitted yet. Make sure the foreman logs today's work.",
        action_label: "Log Today",
        action_url: `/daily-logs`,
        detected_at: detectedAt,
      });
    }

    // Sort: critical first, then high, then normal
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      normal: 2,
    };
    alerts.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    );

    return new Response(
      JSON.stringify({
        generated_at: detectedAt,
        alert_count: alerts.length,
        alerts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("detect-alerts error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
