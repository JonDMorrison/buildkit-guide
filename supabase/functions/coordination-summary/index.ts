import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, startDate, endDate } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch lookahead data
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        *,
        trades(name, trade_type, company_name),
        projects(name)
      `)
      .eq('project_id', projectId)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .eq('is_deleted', false)
      .order('due_date');

    if (tasksError) throw tasksError;

    // Fetch blockers
    const taskIds = tasks?.map(t => t.id) || [];
    const { data: blockers } = await supabase
      .from('blockers')
      .select('*, trades(name, trade_type), task:tasks(title)')
      .in('task_id', taskIds)
      .eq('is_resolved', false);

    // Fetch dependencies
    const { data: dependencies } = await supabase
      .from('task_dependencies')
      .select(`
        *,
        task:tasks!task_dependencies_task_id_fkey(id, title, status),
        depends_on:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)
      `)
      .in('task_id', taskIds);

    // Prepare context for AI
    const context = {
      totalTasks: tasks?.length || 0,
      blockedTasks: tasks?.filter(t => t.status === 'blocked').length || 0,
      completedTasks: tasks?.filter(t => t.status === 'done').length || 0,
      inProgressTasks: tasks?.filter(t => t.status === 'in_progress').length || 0,
      tasksByTrade: tasks?.reduce((acc: any, task) => {
        const trade = task.trades?.name || 'Unassigned';
        if (!acc[trade]) acc[trade] = [];
        acc[trade].push({
          title: task.title,
          status: task.status,
          dueDate: task.due_date,
          priority: task.priority,
        });
        return acc;
      }, {}),
      blockers: blockers?.map(b => ({
        task: b.task?.title,
        reason: b.reason,
        blockingTrade: b.trades?.name,
      })),
      dependencies: dependencies?.filter(d => d.depends_on?.status !== 'done').map(d => ({
        task: d.task?.title,
        dependsOn: d.depends_on?.title,
        status: d.depends_on?.status,
      })),
    };

    // Call Lovable AI with tool calling for structured output
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a construction coordination AI assistant. Analyze the 2-week lookahead data and generate a structured coordination summary.

Your analysis must be data-driven, actionable, and field-friendly. Focus on clear communication for construction teams.`
          },
          {
            role: 'user',
            content: `Generate a comprehensive coordination summary for this 2-week lookahead:\n\n${JSON.stringify(context, null, 2)}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_coordination_summary',
              description: 'Generate a structured coordination summary with blocked tasks, dependencies, risks, and recommendations',
              parameters: {
                type: 'object',
                properties: {
                  overview: {
                    type: 'string',
                    description: 'Brief overview paragraph with key stats'
                  },
                  blocked_by_trade: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        trade: { type: 'string' },
                        tasks: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              task_title: { type: 'string' },
                              reason: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  },
                  what_horizon_is_waiting_on: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of items/actions Horizon needs from external trades'
                  },
                  upcoming_risks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        risk: { type: 'string' },
                        impact: { type: 'string' }
                      }
                    }
                  },
                  schedule_impacts: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  recommended_actions: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  next_7_days_priorities: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['overview', 'blocked_by_trade', 'what_horizon_is_waiting_on', 'upcoming_risks', 'recommended_actions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'generate_coordination_summary' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract structured summary from tool call
    const toolCall = aiResponse.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const structuredSummary = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ 
        summary: structuredSummary,
        context,
        tasks: tasks?.map(t => ({ id: t.id, title: t.title })) || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Coordination summary error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});