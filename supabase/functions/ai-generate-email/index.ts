import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateEmailRequest {
  type: 'blocker_escalation' | 'eod_report';
  project_id: string;
  blocker_id?: string;
  task_id?: string;
  recipient_type?: 'gc' | 'trade' | 'owner';
}

interface GenerateEmailResponse {
  subject: string;
  body: string;
  recipient_suggestion: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: GenerateEmailRequest = await req.json();
    const { type, project_id, blocker_id, task_id, recipient_type = 'gc' } = body;

    if (!project_id || !type) {
      throw new Error('project_id and type are required');
    }

    console.log('AI Generate Email request:', { type, project_id, blocker_id });

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Project Manager';

    // Create service client for data fetching
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get project info
    const { data: project } = await serviceClient
      .from('projects')
      .select('name, job_number, location')
      .eq('id', project_id)
      .single();

    if (!project) {
      throw new Error('Project not found');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    let contextString = '';
    let promptInstructions = '';

    if (type === 'blocker_escalation' && blocker_id) {
      // Get blocker details
      const { data: blocker } = await serviceClient
        .from('blockers')
        .select(`
          id, reason, description, created_at,
          tasks(id, title, status, due_date, trades(name, company_name, contact_email))
        `)
        .eq('id', blocker_id)
        .single();

      if (!blocker) {
        throw new Error('Blocker not found');
      }

      const task = blocker.tasks as any;
      const trade = task?.trades;
      const daysBlocked = Math.floor((Date.now() - new Date(blocker.created_at).getTime()) / (1000 * 60 * 60 * 24));

      contextString = `
Project: ${project.name}${project.job_number ? ` (${project.job_number})` : ''}
Location: ${project.location || 'N/A'}

Blocked Task: ${task?.title || 'Unknown'}
Blocker Reason: ${blocker.reason}
${blocker.description ? `Details: ${blocker.description}` : ''}
Days Blocked: ${daysBlocked}
Trade Responsible: ${trade?.name || 'Unknown'} (${trade?.company_name || ''})
Task Due Date: ${task?.due_date || 'Not set'}
`;

      promptInstructions = `Generate a professional escalation email regarding a blocked construction task.
The email should:
1. Be direct and professional
2. Clearly state the issue and its impact
3. Specify how long work has been blocked
4. Request specific action with a timeline
5. Maintain a collaborative tone while expressing urgency

The recipient is: ${recipient_type === 'gc' ? 'General Contractor' : recipient_type === 'owner' ? 'Project Owner' : 'Trade Contractor'}`;

    } else if (type === 'eod_report') {
      // Get today's data
      const today = new Date().toISOString().split('T')[0];
      
      const { data: tasks } = await serviceClient
        .from('tasks')
        .select('id, title, status, trades(name)')
        .eq('project_id', project_id)
        .eq('is_deleted', false);

      const { data: blockers } = await serviceClient
        .from('blockers')
        .select('id, reason, tasks(title, trades(name))')
        .eq('is_resolved', false);

      const { data: todayLog } = await serviceClient
        .from('daily_logs')
        .select('*')
        .eq('project_id', project_id)
        .eq('log_date', today)
        .single();

      const tasksByStatus = {
        done: tasks?.filter(t => t.status === 'done').length || 0,
        in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
        blocked: tasks?.filter(t => t.status === 'blocked').length || 0,
        not_started: tasks?.filter(t => t.status === 'not_started').length || 0,
      };

      contextString = `
Project: ${project.name}${project.job_number ? ` (${project.job_number})` : ''}
Location: ${project.location || 'N/A'}
Date: ${today}

Daily Log:
${todayLog ? `
- Weather: ${todayLog.weather || 'Not recorded'}
- Temperature: ${todayLog.temperature || 'Not recorded'}
- Crew Count: ${todayLog.crew_count || 0}
- Work Performed: ${todayLog.work_performed || 'Not recorded'}
- Issues: ${todayLog.issues || 'None reported'}
- Next Day Plan: ${todayLog.next_day_plan || 'Not specified'}
` : 'No daily log recorded for today'}

Task Summary:
- Completed: ${tasksByStatus.done}
- In Progress: ${tasksByStatus.in_progress}
- Blocked: ${tasksByStatus.blocked}
- Not Started: ${tasksByStatus.not_started}

Active Blockers (${blockers?.length || 0}):
${blockers?.slice(0, 5).map((b: any) => `- ${b.reason} (${b.tasks?.title})`).join('\n') || 'None'}
`;

      promptInstructions = `Generate a professional end-of-day construction project report email.
The email should:
1. Be concise and scannable
2. Highlight key accomplishments
3. Note any issues or blockers
4. Include crew/weather info
5. Preview tomorrow's priorities
6. Be suitable for sending to the GC, owner, or stakeholders`;
    }

    const systemPrompt = `You are an AI assistant helping construction project managers draft professional emails.
Write clear, professional emails that are appropriate for construction industry communication.

Respond in JSON format:
{
  "subject": "Email subject line",
  "body": "Full email body with proper formatting",
  "recipient_suggestion": "Suggested recipient (e.g., 'General Contractor', 'Trade Foreman', etc.)"
}

Use proper email formatting with:
- Clear greeting
- Well-organized body with bullet points where appropriate
- Professional closing
- Sender name placeholder

Do not use placeholder brackets like [Name] - use the actual names provided or generic titles.`;

    console.log('Calling OpenAI for email generation...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${promptInstructions}\n\nContext:\n${contextString}\n\nSender: ${userName}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`AI error: ${errorText}`);
    }

    const result = await response.json();
    const rawAnswer = result.choices?.[0]?.message?.content || '';

    console.log('Raw AI response:', rawAnswer.substring(0, 300));

    // Parse the response
    let emailResult: GenerateEmailResponse = {
      subject: type === 'blocker_escalation' ? 'Action Required: Blocked Work Item' : 'Daily Field Report',
      body: 'Email generation failed. Please draft manually.',
      recipient_suggestion: recipient_type === 'gc' ? 'General Contractor' : 'Project Stakeholder',
    };

    try {
      const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        emailResult = {
          subject: parsed.subject || emailResult.subject,
          body: parsed.body || emailResult.body,
          recipient_suggestion: parsed.recipient_suggestion || emailResult.recipient_suggestion,
        };
      }
    } catch (e) {
      console.log('Could not parse JSON, using raw text as body');
      emailResult.body = rawAnswer;
    }

    console.log('Email generated:', emailResult.subject);

    return new Response(
      JSON.stringify(emailResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Generate Email error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
