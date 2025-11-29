import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { projectId, taskId } = await req.json();
    
    if (!projectId) {
      throw new Error('projectId is required');
    }

    console.log('Forecasting delay impact for project:', projectId, 'task:', taskId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all relevant data for the project
    const [tasksResult, dependenciesResult, blockersResult, manpowerResult] = await Promise.all([
      // Tasks with trade information
      supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          estimated_hours,
          location,
          assigned_trade_id,
          trades:assigned_trade_id (
            name,
            trade_type
          )
        `)
        .eq('project_id', projectId)
        .eq('is_deleted', false),
      
      // Task dependencies
      supabase
        .from('task_dependencies')
        .select(`
          task_id,
          depends_on_task_id,
          task:task_id (title),
          depends_on:depends_on_task_id (title, status, due_date)
        `),
      
      // Blockers
      supabase
        .from('blockers')
        .select(`
          id,
          task_id,
          reason,
          description,
          is_resolved,
          created_at,
          blocking_trade_id,
          task:task_id (title, due_date)
        `)
        .eq('is_resolved', false),
      
      // Manpower requests
      supabase
        .from('manpower_requests')
        .select(`
          id,
          trade_id,
          requested_count,
          required_date,
          status,
          reason,
          trades:trade_id (name)
        `)
        .eq('project_id', projectId)
        .eq('is_deleted', false)
    ]);

    if (tasksResult.error) throw tasksResult.error;
    if (dependenciesResult.error) throw dependenciesResult.error;
    if (blockersResult.error) throw blockersResult.error;
    if (manpowerResult.error) throw manpowerResult.error;

    const tasks = tasksResult.data || [];
    const dependencies = dependenciesResult.data || [];
    const blockers = blockersResult.data || [];
    const manpower = manpowerResult.data || [];

    // Calculate overdue tasks
    const today = new Date();
    const overdueTasks = tasks.filter(task => {
      if (!task.due_date) return false;
      const dueDate = new Date(task.due_date);
      return dueDate < today && task.status !== 'done';
    });

    // Build context for AI
    const contextData = {
      total_tasks: tasks.length,
      tasks_by_status: {
        not_started: tasks.filter(t => t.status === 'not_started').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        done: tasks.filter(t => t.status === 'done').length,
      },
      overdue_count: overdueTasks.length,
      active_blockers: blockers.length,
      dependencies_count: dependencies.length,
      pending_manpower_requests: manpower.filter(m => m.status === 'pending').length,
    };

    // Prepare detailed task information
    const taskDetails = tasks.map(task => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      estimated_hours: task.estimated_hours,
      trade: Array.isArray(task.trades) && task.trades[0] ? task.trades[0].name : 'Unassigned',
      location: task.location,
      is_overdue: task.due_date ? new Date(task.due_date) < today && task.status !== 'done' : false,
    }));

    // Prepare blocker information
    const blockerDetails = blockers.map(blocker => ({
      task_title: Array.isArray(blocker.task) && blocker.task[0] ? blocker.task[0].title : 'Unknown Task',
      reason: blocker.reason,
      description: blocker.description,
      days_blocked: Math.floor((today.getTime() - new Date(blocker.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));

    // Prepare dependency chain information
    const dependencyDetails = dependencies.map(dep => ({
      task: Array.isArray(dep.task) && dep.task[0] ? dep.task[0].title : 'Unknown',
      depends_on: Array.isArray(dep.depends_on) && dep.depends_on[0] ? dep.depends_on[0].title : 'Unknown',
      depends_on_status: Array.isArray(dep.depends_on) && dep.depends_on[0] ? dep.depends_on[0].status : null,
      depends_on_due_date: Array.isArray(dep.depends_on) && dep.depends_on[0] ? dep.depends_on[0].due_date : null,
    }));

    // Prepare manpower information
    const manpowerDetails = manpower.map(mp => ({
      trade: Array.isArray(mp.trades) && mp.trades[0] ? mp.trades[0].name : 'Unknown Trade',
      requested_count: mp.requested_count,
      required_date: mp.required_date,
      status: mp.status,
      reason: mp.reason,
    }));

    // Build AI prompt
    const systemPrompt = `You are a construction project scheduling AI assistant. Analyze the provided project data and forecast schedule delays and their impacts.

Your analysis should:
1. Identify which tasks are at risk of delay based on blockers, dependencies, and overdue items
2. Calculate potential schedule slip in days
3. Assess critical path impact
4. Provide actionable mitigation recommendations

Be realistic and data-driven. If there are no significant delays forecasted, say so clearly.`;

    const userPrompt = `Analyze this construction project and forecast schedule impact:

**Project Overview:**
${JSON.stringify(contextData, null, 2)}

**Task Details (${taskDetails.length} tasks):**
${JSON.stringify(taskDetails.slice(0, 50), null, 2)}
${taskDetails.length > 50 ? `\n... and ${taskDetails.length - 50} more tasks` : ''}

**Active Blockers (${blockerDetails.length}):**
${JSON.stringify(blockerDetails, null, 2)}

**Task Dependencies (${dependencyDetails.length}):**
${JSON.stringify(dependencyDetails.slice(0, 30), null, 2)}
${dependencyDetails.length > 30 ? `\n... and ${dependencyDetails.length - 30} more dependencies` : ''}

**Manpower Requests (${manpowerDetails.length}):**
${JSON.stringify(manpowerDetails, null, 2)}

${taskId ? `\n**Focus Task:** Analyze impact specifically for task ID: ${taskId}` : ''}

Provide a detailed forecast analysis.`;

    console.log('Calling Lovable AI for delay forecast...');

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'forecast_schedule_impact',
              description: 'Return structured schedule delay forecast with impacted tasks and mitigation options',
              parameters: {
                type: 'object',
                properties: {
                  delayed_tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        task_id: { type: 'string' },
                        task_title: { type: 'string' },
                        original_date: { type: 'string' },
                        new_estimated_date: { type: 'string' },
                        delay_days: { type: 'number' },
                        reason: { type: 'string' }
                      },
                      required: ['task_id', 'task_title', 'reason']
                    }
                  },
                  schedule_slip_days: { type: 'number' },
                  critical_path_impact: { type: 'string' },
                  mitigation_options: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  summary: { type: 'string' },
                  risk_level: { 
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical']
                  }
                },
                required: ['delayed_tasks', 'schedule_slip_days', 'critical_path_impact', 'mitigation_options', 'summary', 'risk_level']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'forecast_schedule_impact' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    console.log('AI response received');

    // Extract the structured forecast from tool call
    const toolCall = aiResult.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const forecast = JSON.parse(toolCall.function.arguments);

    console.log('Forecast generated:', forecast);

    return new Response(
      JSON.stringify({ 
        success: true,
        forecast,
        context: contextData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error forecasting delay:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
