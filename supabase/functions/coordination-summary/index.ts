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

    // Call Lovable AI
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
            content: `You are a construction coordination AI assistant. Analyze the 2-week lookahead data and generate a concise coordination summary.

Format your response as a structured summary with these sections:
1. **Overview** - Quick stats
2. **Blocked Tasks** - Tasks requiring immediate attention
3. **Trade-by-Trade Summary** - What each trade owes/needs
4. **Dependencies at Risk** - Tasks blocked by incomplete dependencies
5. **Schedule Risks** - Potential delays and bottlenecks
6. **Recommended Actions** - Top 3-5 action items

Keep it field-friendly: short sentences, clear hierarchy, actionable items.`
          },
          {
            role: 'user',
            content: `Generate a coordination summary for this 2-week lookahead:\n\n${JSON.stringify(context, null, 2)}`
          }
        ],
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
    const summary = aiResponse.choices[0]?.message?.content;

    return new Response(
      JSON.stringify({ summary, context }),
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