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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authenticate user
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    // Fetch all data in parallel
    const [
      tasksResult,
      blockersResult,
      crewResult,
      deficienciesResult,
      dailyLogResult,
      safetyResult,
    ] = await Promise.all([
      // 1. Tasks due today or overdue
      adminClient
        .from("tasks")
        .select("title, status, baseline_role_type, due_date")
        .eq("project_id", project_id)
        .eq("is_deleted", false)
        .lte("due_date", today)
        .not("status", "in", '("done","cancelled")')
        .order("due_date", { ascending: true })
        .limit(10),

      // 2. Unresolved blockers
      adminClient
        .from("blockers")
        .select("reason, created_at, tasks(title)")
        .eq("project_id", project_id)
        .eq("is_resolved", false)
        .order("created_at", { ascending: true })
        .limit(5),

      // 3. Expected crew today
      adminClient
        .from("manpower_requests")
        .select("requested_count, reason, trades(name)")
        .eq("project_id", project_id)
        .eq("required_date", today)
        .neq("status", "cancelled")
        .limit(10),

      // 4. High priority open deficiencies
      adminClient
        .from("deficiencies")
        .select("title, location, trades(name)")
        .eq("project_id", project_id)
        .not("status", "in", '("resolved","closed")')
        .eq("priority", 1)
        .limit(5),

      // 5. Yesterday's daily log
      adminClient
        .from("daily_logs")
        .select(
          "work_performed, issues, safety_notes, next_day_plan, weather, crew_count"
        )
        .eq("project_id", project_id)
        .eq("log_date", yesterday)
        .limit(1),

      // 6. Safety forms due or overdue
      adminClient
        .from("safety_forms")
        .select("form_type, scheduled_date")
        .eq("project_id", project_id)
        .lte("scheduled_date", today)
        .neq("status", "completed")
        .limit(3),
    ]);

    const tasks = tasksResult.data ?? [];
    const blockers = blockersResult.data ?? [];
    const crew = crewResult.data ?? [];
    const deficiencies = deficienciesResult.data ?? [];
    const dailyLog = dailyLogResult.data?.[0] ?? null;
    const safetyForms = safetyResult.data ?? [];

    // Build context for the AI
    const contextParts: string[] = [];

    if (tasks.length > 0) {
      contextParts.push(
        `## Tasks Due Today or Overdue (${tasks.length}):\n` +
          tasks
            .map(
              (t: any) =>
                `- ${t.title} | Status: ${t.status} | Trade: ${t.baseline_role_type || "Unassigned"} | Due: ${t.due_date}`
            )
            .join("\n")
      );
    }

    if (blockers.length > 0) {
      contextParts.push(
        `## Unresolved Blockers (${blockers.length}):\n` +
          blockers
            .map((b: any) => {
              const taskTitle =
                Array.isArray(b.tasks) && b.tasks[0]
                  ? b.tasks[0].title
                  : b.tasks?.title || "Unknown task";
              return `- ${b.reason} (blocking: ${taskTitle}, since ${b.created_at})`;
            })
            .join("\n")
      );
    }

    if (crew.length > 0) {
      contextParts.push(
        `## Expected Crew Today:\n` +
          crew
            .map((c: any) => {
              const tradeName =
                Array.isArray(c.trades) && c.trades[0]
                  ? c.trades[0].name
                  : c.trades?.name || "General";
              return `- ${tradeName}: ${c.requested_count} workers${c.reason ? ` (${c.reason})` : ""}`;
            })
            .join("\n")
      );
    }

    if (deficiencies.length > 0) {
      contextParts.push(
        `## High Priority Deficiencies (${deficiencies.length}):\n` +
          deficiencies
            .map((d: any) => {
              const tradeName =
                Array.isArray(d.trades) && d.trades[0]
                  ? d.trades[0].name
                  : d.trades?.name || "Unassigned";
              return `- ${d.title} | Location: ${d.location || "Not specified"} | Trade: ${tradeName}`;
            })
            .join("\n")
      );
    }

    if (dailyLog) {
      const parts = [`## Yesterday's Daily Log:`];
      if (dailyLog.weather)
        parts.push(`- Weather: ${dailyLog.weather}`);
      if (dailyLog.crew_count)
        parts.push(`- Crew count: ${dailyLog.crew_count}`);
      if (dailyLog.work_performed)
        parts.push(`- Work completed: ${dailyLog.work_performed}`);
      if (dailyLog.issues) parts.push(`- Issues: ${dailyLog.issues}`);
      if (dailyLog.safety_notes)
        parts.push(`- Safety notes: ${dailyLog.safety_notes}`);
      if (dailyLog.next_day_plan)
        parts.push(`- Plan for today: ${dailyLog.next_day_plan}`);
      contextParts.push(parts.join("\n"));
    }

    if (safetyForms.length > 0) {
      contextParts.push(
        `## Safety Forms Due or Overdue (${safetyForms.length}):\n` +
          safetyForms
            .map(
              (f: any) =>
                `- ${f.form_type} | Due: ${f.scheduled_date}`
            )
            .join("\n")
      );
    }

    // If no data at all, return a simple response
    if (contextParts.length === 0) {
      return new Response(
        JSON.stringify({
          generated_at: new Date().toISOString(),
          headline: "No urgent items for today. Steady as she goes.",
          sections: [],
          watch_out_for: "Nothing flagged — good day to get ahead.",
          crew_summary: "No crew requests logged for today.",
          safety_note: "Standard PPE and site protocols apply.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a seasoned construction site superintendent. Generate a concise morning briefing for the project team. Be direct and practical — foremen don't want fluff. Lead with what's urgent. Flag anything that could derail the day. Use plain language a field crew understands.

Return ONLY valid JSON with this exact structure:
{
  "headline": "One sentence summary of the day's priority",
  "sections": [
    {
      "title": "string",
      "priority": "critical" | "high" | "normal",
      "items": ["string array of actionable points"]
    }
  ],
  "watch_out_for": "The single biggest risk today",
  "crew_summary": "Who's expected on site today",
  "safety_note": "Key safety focus for today"
}

Only include sections where data exists. Mark blockers and high-priority deficiencies as "critical". Tasks due today are "high". Everything else is "normal".`;

    const userPrompt = `Generate a morning briefing based on this project data:\n\n${contextParts.join("\n\n")}`;

    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
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
          temperature: 0.4,
          max_tokens: 1500,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "AI rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let briefing: any;
    try {
      briefing = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({ error: "AI returned invalid format" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    briefing.generated_at = new Date().toISOString();

    return new Response(JSON.stringify(briefing), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("morning-briefing error:", e);
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
