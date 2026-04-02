import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HistoricalProject {
  id: string;
  name: string;
  job_type: string | null;
  status: string;
  task_count: number;
  phases: PhaseGroup[];
  total_estimated_hours: number;
}

interface PhaseGroup {
  phase_name: string;
  tasks: { title: string; estimated_hours: number; role_type: string | null }[];
  total_hours: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate user
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

    const body = await req.json();
    const { job_type, audience, trade_name } = body;
    if (!job_type || typeof job_type !== "string" || job_type.trim().length < 2) {
      return new Response(JSON.stringify({ error: "job_type is required (min 2 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's org
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: membership } = await adminClient
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = membership.organization_id;

    // Fetch last 20 similar projects (by job_type fuzzy match or playbook job_type)
    const { data: projects } = await adminClient
      .from("projects")
      .select("id, name, job_type, status, applied_playbook_id, start_date, end_date")
      .eq("organization_id", orgId)
      .or(`job_type.ilike.%${job_type}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    // If no direct match, try via playbook job_type
    let projectList = projects ?? [];
    if (projectList.length < 5) {
      const { data: pbMatches } = await adminClient
        .from("playbooks")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("job_type", `%${job_type}%`);

      if (pbMatches && pbMatches.length > 0) {
        const pbIds = pbMatches.map((p: any) => p.id);
        const { data: extraProjects } = await adminClient
          .from("projects")
          .select("id, name, job_type, status, applied_playbook_id, start_date, end_date")
          .eq("organization_id", orgId)
          .in("applied_playbook_id", pbIds)
          .order("created_at", { ascending: false })
          .limit(20);

        const existingIds = new Set(projectList.map(p => p.id));
        for (const ep of (extraProjects ?? [])) {
          if (!existingIds.has(ep.id)) projectList.push(ep);
        }
        projectList = projectList.slice(0, 20);
      }
    }

    // Fallback: no historical projects — generate from best practices
    if (projectList.length === 0) {
      const fallbackSystemPrompt = `You are a senior construction project manager with 20+ years of experience. Base your estimates on industry standards (RSMeans cost data, standard construction sequences). Do not guess or hallucinate. If you are uncertain about an estimate, provide a wider range rather than a specific number. Every hour estimate should reflect realistic field conditions, not ideal conditions. Output ONLY valid JSON matching the schema.`;

      const fallbackUserPrompt = `Generate a best-practice playbook for: job_type="${job_type}"${audience ? `, audience="${audience}"` : ""}${trade_name ? `, trade="${trade_name}"` : ""}

This should represent typical phases, tasks, and hour ranges for this type of construction work based on industry standards.

OUTPUT SCHEMA:
{
  "name": "string - suggested playbook name",
  "job_type": "string - the job type this is for",
  "description": "string - brief description",
  "confidence_score": 0,
  "data_quality_note": "No historical projects found — generated using best-practice construction templates.",
  "phases": [
    {
      "name": "string - phase name",
      "description": "string - what this phase covers",
      "sequence_order": "number",
      "tasks": [
        {
          "title": "string - task title",
          "description": "string - brief task description",
          "role_type": "string|null - suggested crew role",
          "expected_hours_low": "number",
          "expected_hours_high": "number",
          "required": "boolean - whether this is a standard task",
          "frequency_percent": 100
        }
      ]
    }
  ],
  "total_hours_band": { "low": "number", "high": "number" },
  "variance_band_percent": { "low": 0, "high": 0 },
  "projects_analyzed": 0
}`;

      const fallbackAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: fallbackSystemPrompt },
            { role: "user", content: fallbackUserPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        }),
      });

      if (!fallbackAiResponse.ok) {
        if (fallbackAiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "AI analysis failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fallbackAiData = await fallbackAiResponse.json();
      const fallbackRawContent = fallbackAiData.choices?.[0]?.message?.content || "";

      let fallbackSuggestion: any;
      try {
        const cleaned = fallbackRawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        fallbackSuggestion = JSON.parse(cleaned);
      } catch (e) {
        return new Response(JSON.stringify({ error: "AI returned invalid format", raw: fallbackRawContent }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ensure fallback fields are set
      fallbackSuggestion.confidence_score = 0;
      fallbackSuggestion.projects_analyzed = 0;
      fallbackSuggestion.data_quality_note = "No historical projects found — generated using best-practice construction templates.";
      fallbackSuggestion.generated_at = new Date().toISOString();
      fallbackSuggestion.generated_by = user.id;
      fallbackSuggestion.organization_id = orgId;
      fallbackSuggestion.source_project_ids = [];

      return new Response(JSON.stringify(fallbackSuggestion), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch tasks for all matched projects
    const projectIds = projectList.map(p => p.id);
    const { data: allTasks } = await adminClient
      .from("tasks")
      .select("project_id, title, estimated_hours, baseline_role_type, status, is_deleted, location")
      .in("project_id", projectIds)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true });

    // Also fetch time entries to get actual hours
    const { data: timeEntries } = await adminClient
      .from("time_entries")
      .select("project_id, task_id, hours")
      .in("project_id", projectIds);

    // Build per-task actual hours map
    const taskActualHours: Record<string, number> = {};
    for (const te of (timeEntries ?? [])) {
      if (te.task_id) {
        taskActualHours[te.task_id] = (taskActualHours[te.task_id] || 0) + Number(te.hours || 0);
      }
    }

    // Group tasks by project, then by location (as proxy for "phase")
    const tasksByProject: Record<string, any[]> = {};
    for (const t of (allTasks ?? [])) {
      if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
      tasksByProject[t.project_id].push(t);
    }

    // Build historical summary for AI
    const historicalSummary = projectList.map(p => {
      const tasks = tasksByProject[p.id] || [];
      // Group by location as phase proxy
      const phaseMap: Record<string, any[]> = {};
      for (const t of tasks) {
        const phase = t.location || "General";
        if (!phaseMap[phase]) phaseMap[phase] = [];
        phaseMap[phase].push({
          title: t.title,
          estimated_hours: Number(t.estimated_hours || 0),
          role_type: t.baseline_role_type || null,
          status: t.status,
        });
      }

      return {
        name: p.name,
        job_type: p.job_type,
        status: p.status,
        task_count: tasks.length,
        total_estimated_hours: tasks.reduce((s: number, t: any) => s + Number(t.estimated_hours || 0), 0),
        phases: Object.entries(phaseMap).map(([name, phaseTasks]) => ({
          phase_name: name,
          task_count: phaseTasks.length,
          total_hours: phaseTasks.reduce((s: number, t: any) => s + t.estimated_hours, 0),
          common_roles: [...new Set(phaseTasks.map((t: any) => t.role_type).filter(Boolean))],
          sample_tasks: phaseTasks.slice(0, 8).map((t: any) => t.title),
        })),
      };
    });

    // Build system prompt with audience context
    const audienceContext = audience ? ` Generate a ${audience} playbook${trade_name ? ` for ${trade_name} crews` : ""} doing ${job_type} work.` : "";
    const systemPrompt = `You are a construction project analyst. Analyze historical project data and generate a suggested playbook structure.${audienceContext}

RULES:
- Output ONLY valid JSON matching the schema below. No markdown, no explanation.
- Analyze patterns across the provided projects to identify common phases and tasks.
- Calculate realistic hour bands based on historical data.
- Group tasks logically into phases.
- Include variance bands based on observed spreads.

OUTPUT SCHEMA:
{
  "name": "string - suggested playbook name",
  "job_type": "string - the job type this is for",
  "description": "string - brief description",
  "confidence_score": "number 0-100 - how confident based on data quality",
  "data_quality_note": "string - note about data sufficiency",
  "phases": [
    {
      "name": "string - phase name",
      "description": "string - what this phase covers",
      "sequence_order": "number",
      "tasks": [
        {
          "title": "string - task title",
          "description": "string - brief task description",
          "role_type": "string|null - suggested crew role",
          "expected_hours_low": "number",
          "expected_hours_high": "number",
          "required": "boolean - whether this task appears in most projects",
          "frequency_percent": "number 0-100 - how often this task appears across projects"
        }
      ]
    }
  ],
  "total_hours_band": { "low": "number", "high": "number" },
  "variance_band_percent": { "low": "number", "high": "number" },
  "projects_analyzed": "number"
}`;

    const userPrompt = `Analyze these ${historicalSummary.length} historical "${job_type}" projects and generate a suggested playbook:

${JSON.stringify(historicalSummary, null, 2)}

Generate a comprehensive playbook based on the patterns you observe. Focus on:
1. Most common task groupings (phases)
2. Tasks that appear across multiple projects (high frequency)
3. Realistic hour bands with variance
4. Logical sequencing`;

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
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (strip markdown fences if present)
    let suggestion: any;
    try {
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      suggestion = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "AI returned invalid format", raw: rawContent }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enrich with metadata
    suggestion.generated_at = new Date().toISOString();
    suggestion.generated_by = user.id;
    suggestion.organization_id = orgId;
    suggestion.source_project_ids = projectIds;

    return new Response(JSON.stringify(suggestion), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-playbook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
