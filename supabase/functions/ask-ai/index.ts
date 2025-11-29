import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, projectId } = await req.json();
    
    if (!question || !projectId) {
      throw new Error('Question and projectId are required');
    }

    console.log('Processing AI question for project:', projectId);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get LOVABLE_API_KEY
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build search query from question
    const searchQuery = question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(' ')
      .filter((word: string) => word.length > 3)
      .join(' & ');

    console.log('Search query:', searchQuery);

    // Search document texts using full-text search
    const { data: documents, error: docError } = await supabaseClient
      .from('document_texts')
      .select('id, title, raw_text, created_at')
      .eq('project_id', projectId)
      .textSearch('search_vector', searchQuery, { type: 'websearch' })
      .limit(5);

    if (docError) {
      console.error('Document search error:', docError);
    }

    // Get recent tasks
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('id, title, description, status, priority, due_date, location, assigned_trade_id, trades(name)')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (tasksError) {
      console.error('Tasks fetch error:', tasksError);
    }

    // Get blockers
    const { data: blockers, error: blockersError } = await supabaseClient
      .from('blockers')
      .select('id, reason, description, is_resolved, task_id, tasks(title, trades(name))')
      .eq('is_resolved', false)
      .limit(10);

    if (blockersError) {
      console.error('Blockers fetch error:', blockersError);
    }

    // Get recent safety forms
    const { data: safetyForms, error: safetyError } = await supabaseClient
      .from('safety_forms')
      .select('id, title, form_type, status, inspection_date')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (safetyError) {
      console.error('Safety forms fetch error:', safetyError);
    }

    // Get deficiencies
    const { data: deficiencies, error: deficienciesError } = await supabaseClient
      .from('deficiencies')
      .select('id, title, description, status, priority, location, due_date, trades(name)')
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (deficienciesError) {
      console.error('Deficiencies fetch error:', deficienciesError);
    }

    // Build context for AI
    const context = {
      documents: documents || [],
      tasks: tasks || [],
      blockers: blockers || [],
      safetyForms: safetyForms || [],
      deficiencies: deficiencies || []
    };

    console.log('Context built:', {
      documents: context.documents.length,
      tasks: context.tasks.length,
      blockers: context.blockers.length,
      safetyForms: context.safetyForms.length,
      deficiencies: context.deficiencies.length
    });

    // Prepare context string for AI
    let contextString = 'Here is the relevant project information:\n\n';

    if (context.documents.length > 0) {
      contextString += '## Documents:\n';
      context.documents.forEach((doc: any) => {
        contextString += `- ${doc.title}: ${doc.raw_text.substring(0, 500)}...\n`;
      });
      contextString += '\n';
    }

    if (context.tasks.length > 0) {
      contextString += '## Tasks:\n';
      context.tasks.forEach((task: any) => {
        contextString += `- [${task.status}] ${task.title}: ${task.description || 'No description'} (Trade: ${task.trades?.name || 'Unassigned'})\n`;
      });
      contextString += '\n';
    }

    if (context.blockers.length > 0) {
      contextString += '## Active Blockers:\n';
      context.blockers.forEach((blocker: any) => {
        contextString += `- ${blocker.reason}: ${blocker.description || ''} (Task: ${blocker.tasks?.title}, Trade: ${blocker.tasks?.trades?.name || 'Unknown'})\n`;
      });
      contextString += '\n';
    }

    if (context.deficiencies.length > 0) {
      contextString += '## Deficiencies:\n';
      context.deficiencies.forEach((def: any) => {
        contextString += `- [${def.status}] ${def.title}: ${def.description} (Trade: ${def.trades?.name || 'Unassigned'})\n`;
      });
      contextString += '\n';
    }

    if (context.safetyForms.length > 0) {
      contextString += '## Recent Safety Forms:\n';
      context.safetyForms.forEach((form: any) => {
        contextString += `- ${form.title} (${form.form_type}, Status: ${form.status})\n`;
      });
      contextString += '\n';
    }

    // Call Lovable AI
    const systemPrompt = `You are a construction project AI assistant. Answer questions based ONLY on the provided project data. Be concise, clear, and field-friendly.

Rules:
- Only use information from the context provided
- If information is not available, say so clearly
- Provide specific details (task names, trade names, dates, locations)
- Keep answers short and actionable
- Format responses in plain language, not technical jargon`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context:\n${contextString}\n\nQuestion: ${question}` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${errorText}`);
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content || 'I could not generate an answer.';

    console.log('AI answer generated');

    // Save query to ai_queries table
    const { error: insertError } = await supabaseClient
      .from('ai_queries')
      .insert({
        user_id: req.headers.get('x-user-id'),
        project_id: projectId,
        query_text: question,
        response_text: answer,
        context_data: context
      });

    if (insertError) {
      console.error('Failed to save query:', insertError);
    }

    return new Response(
      JSON.stringify({
        answer,
        sources: {
          documents: context.documents.map((d: any) => ({ id: d.id, title: d.title })),
          tasks: context.tasks.slice(0, 5).map((t: any) => ({ id: t.id, title: t.title })),
          blockers: context.blockers.slice(0, 3).map((b: any) => ({ id: b.id, reason: b.reason })),
          deficiencies: context.deficiencies.slice(0, 3).map((d: any) => ({ id: d.id, title: d.title })),
          safetyForms: context.safetyForms.slice(0, 3).map((s: any) => ({ id: s.id, title: s.title }))
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ask AI error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
