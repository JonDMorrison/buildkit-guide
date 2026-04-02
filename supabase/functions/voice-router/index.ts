import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const tools = [
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description:
        "Create a new task from voice input. Use when the speaker wants work done.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title" },
          description: {
            type: "string",
            description: "Detailed task description",
          },
          baseline_role_type: {
            type: "string",
            description:
              "Trade or role (e.g. Electrician, Plumber, Framing, Drywall)",
            nullable: true,
          },
          priority: {
            type: "number",
            enum: [1, 2, 3],
            description: "1=low, 2=medium, 3=high",
          },
          location: {
            type: "string",
            description: "Where on site",
            nullable: true,
          },
          due_date: {
            type: "string",
            description: "YYYY-MM-DD or null",
            nullable: true,
          },
        },
        required: ["title", "description", "priority"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_deficiency",
      description:
        "Log a construction deficiency or quality issue found on site.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short deficiency title" },
          description: {
            type: "string",
            description: "What the issue is and where",
          },
          location: {
            type: "string",
            description: "Specific location on site",
            nullable: true,
          },
          priority: {
            type: "number",
            enum: [1, 2, 3, 4],
            description: "1=critical, 2=high, 3=medium, 4=low",
          },
          trade_name: {
            type: "string",
            description: "Responsible trade",
            nullable: true,
          },
        },
        required: ["title", "description", "priority"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_blocker",
      description:
        "Record something blocking progress on the project.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "What is blocking work",
          },
          description: {
            type: "string",
            description: "Additional context about the blocker",
          },
          impact: {
            type: "string",
            description: "What work is affected",
            nullable: true,
          },
        },
        required: ["reason"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_manpower",
      description:
        "Request additional workers or crew for the project.",
      parameters: {
        type: "object",
        properties: {
          trade_name: {
            type: "string",
            description: "Trade needed (e.g. Framing, Electrical)",
          },
          worker_count: { type: "number", description: "How many workers" },
          required_date: {
            type: "string",
            description: "YYYY-MM-DD when needed",
            nullable: true,
          },
          notes: {
            type: "string",
            description: "Additional context",
            nullable: true,
          },
        },
        required: ["trade_name", "worker_count"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_daily",
      description:
        "Log daily work activity, issues, or end-of-day summary.",
      parameters: {
        type: "object",
        properties: {
          work_performed: {
            type: "string",
            description: "What work was done today",
          },
          issues: {
            type: "string",
            description: "Any issues encountered",
            nullable: true,
          },
          crew_count: {
            type: "number",
            description: "Number of crew on site",
            nullable: true,
          },
          next_day_plan: {
            type: "string",
            description: "Plan for tomorrow",
            nullable: true,
          },
        },
        required: ["work_performed"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "general_query",
      description:
        "A general question or request that doesn't fit the other categories.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The user's question" },
        },
        required: ["query"],
      },
    },
  },
];

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

    // Authenticate
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

    const { transcript, project_id, context } = await req.json();
    if (!transcript || !project_id) {
      return new Response(
        JSON.stringify({ error: "transcript and project_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch project trades for context
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: projectTrades } = await adminClient
      .from("trades")
      .select("id, name")
      .eq("organization_id", (
        await adminClient
          .from("projects")
          .select("organization_id")
          .eq("id", project_id)
          .single()
      ).data?.organization_id || "")
      .eq("is_active", true);

    const tradeList = (projectTrades ?? []).map((t: any) => t.name).join(", ");

    const systemPrompt = `You are a construction site voice assistant. Extract structured data from field voice input. Construction workers speak casually — interpret trade names, locations, and urgency correctly.

Common nicknames: "Sparky" or "sparks" = Electrician, "pipe guys" or "plumbers" = Plumbing, "mud guys" or "tapers" = Drywall, "tin knockers" = HVAC/Sheet Metal, "iron workers" = Structural Steel, "rod busters" = Rebar.

Infer priority from urgency language:
- "ASAP", "right now", "emergency", "safety issue" → high priority (3) or critical (1 for deficiencies)
- "soon", "this week", "when you can" → medium (2)
- No urgency → low (1 for tasks) or medium (3 for deficiencies)

Infer dates: "tomorrow" = next calendar day, "Monday" = next Monday, "end of week" = Friday.

Available trades on this project: ${tradeList || "not specified"}

${context ? `Additional context: ${context}` : ""}

Choose the SINGLE most appropriate tool for this voice input. If the input could be multiple things, pick the most specific one.`;

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
            {
              role: "user",
              content: `Voice input from construction site: "${transcript}"`,
            },
          ],
          tools,
          tool_choice: "required",
          temperature: 0.3,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit. Try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({
          intent: "general_query",
          confidence: 50,
          extracted: { query: transcript },
          confirmation_message: `I wasn't sure what to do with that. Passing to AI assistant: "${transcript}"`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const intent = toolCall.function.name;
    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      extracted = { query: transcript };
    }

    // Match trade names to IDs
    if (extracted.trade_name && projectTrades) {
      const match = projectTrades.find(
        (t: any) =>
          t.name.toLowerCase() === extracted.trade_name.toLowerCase() ||
          t.name.toLowerCase().includes(extracted.trade_name.toLowerCase()) ||
          extracted.trade_name.toLowerCase().includes(t.name.toLowerCase())
      );
      if (match) extracted.matched_trade_id = match.id;
    }
    if (extracted.baseline_role_type && projectTrades) {
      const match = projectTrades.find(
        (t: any) =>
          t.name.toLowerCase() === extracted.baseline_role_type.toLowerCase() ||
          t.name.toLowerCase().includes(extracted.baseline_role_type.toLowerCase()) ||
          extracted.baseline_role_type.toLowerCase().includes(t.name.toLowerCase())
      );
      if (match) extracted.matched_trade_id = match.id;
    }

    // Generate human-readable confirmation
    const confirmationMessages: Record<string, (d: any) => string> = {
      create_task: (d) =>
        `Create ${d.priority === 3 ? "high" : d.priority === 2 ? "medium" : "low"} priority task: "${d.title}"${d.baseline_role_type ? ` for ${d.baseline_role_type}` : ""}${d.location ? ` at ${d.location}` : ""}`,
      log_deficiency: (d) =>
        `Log deficiency: "${d.title}"${d.location ? ` at ${d.location}` : ""}${d.trade_name ? ` (${d.trade_name})` : ""}`,
      create_blocker: (d) =>
        `Report blocker: "${d.reason}"${d.impact ? ` — affecting ${d.impact}` : ""}`,
      request_manpower: (d) =>
        `Request ${d.worker_count} ${d.trade_name}${d.required_date ? ` for ${d.required_date}` : ""}`,
      log_daily: (d) =>
        `Log daily activity: "${(d.work_performed || "").substring(0, 80)}${(d.work_performed || "").length > 80 ? "..." : ""}"`,
      general_query: (d) => `Ask AI: "${d.query}"`,
    };

    const confirmFn = confirmationMessages[intent] || confirmationMessages.general_query;

    return new Response(
      JSON.stringify({
        intent,
        confidence: 85,
        extracted,
        confirmation_message: confirmFn(extracted),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("voice-router error:", e);
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
