import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, projectId, trades } = await req.json();
    
    if (!text) {
      throw new Error('No text provided');
    }

    console.log('Extracting task from text:', text);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Build trade context for the AI
    const tradeContext = trades && trades.length > 0
      ? `Available trades: ${trades.map((t: any) => `${t.name} (${t.trade_type})`).join(', ')}`
      : '';

    const systemPrompt = `You are a construction field assistant. Extract structured task information from voice descriptions.

${tradeContext}

Extract:
- Title: Clear, concise task name
- Description: Detailed notes about the work
- Priority: 1 (low), 2 (medium), or 3 (high) - infer from urgency words
- Due date: Extract if mentioned (format: YYYY-MM-DD), otherwise null
- Assigned trade: Match to available trades if mentioned, otherwise null
- Estimated hours: Extract if mentioned, otherwise null
- Location: Extract if mentioned, otherwise null
- Blocker: Detect if task is blocked/waiting (true/false)
- Blocker reason: If blocked, extract reason, otherwise null

Be smart about inferring urgency, trades, and blockers from context.`;

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "create_task",
            description: "Extract structured task data from voice description",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Task title" },
                description: { type: "string", description: "Detailed task description" },
                priority: { type: "number", enum: [1, 2, 3], description: "Priority level" },
                due_date: { type: "string", description: "Due date in YYYY-MM-DD format, or null" },
                assigned_trade_name: { type: "string", description: "Trade name from available trades, or null" },
                estimated_hours: { type: "number", description: "Estimated hours, or null" },
                location: { type: "string", description: "Location/area, or null" },
                is_blocked: { type: "boolean", description: "Whether task is blocked" },
                blocker_reason: { type: "string", description: "Reason for blocker if blocked, or null" }
              },
              required: ["title", "description", "priority", "is_blocked"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "create_task" } }
    };

    console.log('Calling OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI error: ${errorText}`);
    }

    const result = await response.json();
    console.log('AI response:', JSON.stringify(result));

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const taskData = JSON.parse(toolCall.function.arguments);
    
    // Match trade name to trade ID if provided
    let assignedTradeId = null;
    if (taskData.assigned_trade_name && trades && trades.length > 0) {
      const matchedTrade = trades.find((t: any) => 
        t.name.toLowerCase().includes(taskData.assigned_trade_name.toLowerCase()) ||
        taskData.assigned_trade_name.toLowerCase().includes(t.name.toLowerCase())
      );
      if (matchedTrade) {
        assignedTradeId = matchedTrade.id;
      }
    }

    console.log('Extracted task:', taskData);

    return new Response(
      JSON.stringify({
        task: {
          ...taskData,
          assigned_trade_id: assignedTradeId,
          project_id: projectId
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Extract task error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
