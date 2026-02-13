import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface InsightRequest {
  organization_id: string;
  project_id?: string | null;
  insight_type?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub;

    const body: InsightRequest = await req.json();
    const { organization_id, project_id, insight_type = 'weekly_summary' } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: 'organization_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service client for reading data
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user is org member
    const { data: membership } = await adminClient
      .from('organization_memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only admin/pm roles can generate
    if (!['admin', 'pm', 'foreman'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let snapshots: any[] = [];
    let recommendations: any[] = [];
    let contextLabel = '';

    if (project_id) {
      // Project-level: get last 8 project snapshots
      const { data } = await adminClient
        .from('project_financial_snapshots')
        .select('*')
        .eq('project_id', project_id)
        .eq('snapshot_period', 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(8);
      snapshots = (data || []).reverse();

      const { data: projData } = await adminClient
        .from('projects')
        .select('name, job_number')
        .eq('id', project_id)
        .maybeSingle();

      contextLabel = projData ? `${projData.job_number ? projData.job_number + ' – ' : ''}${projData.name}` : 'Project';
    } else {
      // Org-level: get last 8 org snapshots
      const { data } = await adminClient
        .from('org_financial_snapshots')
        .select('*')
        .eq('organization_id', organization_id)
        .eq('snapshot_period', 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(8);
      snapshots = (data || []).reverse();
      contextLabel = 'Portfolio';
    }

    if (snapshots.length === 0) {
      return new Response(JSON.stringify({
        content: null,
        message: 'No snapshots available to generate insights.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a compact metrics summary for the prompt
    const metricsForPrompt = snapshots.map((s: any) => {
      if (project_id) {
        return {
          date: s.snapshot_date,
          actual_cost: s.actual_total_cost,
          planned_cost: s.planned_total_cost,
          margin_pct: s.actual_margin_pct,
          labor_hours_actual: s.actual_labor_hours,
          labor_hours_planned: s.planned_labor_hours,
          material_cost: s.actual_material_cost,
          has_budget: s.has_budget,
          contract_value: s.contract_value,
        };
      }
      return {
        date: s.snapshot_date,
        actual_cost: s.total_actual_cost,
        planned_cost: s.total_planned_cost,
        margin_pct: s.weighted_margin_pct_actual,
        projects_count: s.projects_count,
        over_budget_count: s.projects_over_budget_count,
        missing_budget_count: s.projects_missing_budget_count,
        contract_value: s.total_contract_value,
      };
    });

    // Create input hash for idempotency
    const inputStr = JSON.stringify({ snapshots: metricsForPrompt, project_id, insight_type });
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(inputStr));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

    // Check for existing insight with same hash (idempotency)
    const snapshotDate = snapshots[snapshots.length - 1]?.snapshot_date || new Date().toISOString().slice(0, 10);

    const { data: existing } = await adminClient
      .from('ai_insights')
      .select('content, created_at')
      .eq('organization_id', organization_id)
      .eq('insight_type', insight_type)
      .eq('input_hash', inputHash)
      .eq('snapshot_date', snapshotDate)
      .maybeSingle();

    // Check if project_id matches too
    if (existing && !body.project_id) {
      // Return cached
      return new Response(JSON.stringify({
        content: existing.content,
        cached: true,
        created_at: existing.created_at,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const latest = metricsForPrompt[metricsForPrompt.length - 1];
    const previous = metricsForPrompt.length > 1 ? metricsForPrompt[metricsForPrompt.length - 2] : null;

    const systemPrompt = `You are a senior construction operations analyst writing a concise executive insight for "${contextLabel}".

RULES (strictly follow):
1. NEVER invent or hallucinate numbers. Only cite numbers from the provided metrics.
2. Write exactly 3 short sections: "What changed", "What it means", "What to do next".
3. Each section: 1-2 sentences max. Use specific numbers from the data.
4. Tone: direct, professional, like an experienced operations lead briefing a PM. Not a chatbot.
5. If data is insufficient (only 1 snapshot), say so briefly and suggest waiting for more data.
6. Use currency formatting for dollar amounts and percentage for margins.
7. Do NOT use bullet points or markdown headers. Write flowing prose paragraphs.
8. Total response must be under 200 words.

Respond in valid JSON format:
{
  "what_changed": "...",
  "what_it_means": "...",
  "what_to_do": "..."
}`;

    const userPrompt = `Here are the last ${metricsForPrompt.length} weekly snapshots for ${contextLabel}:

${JSON.stringify(metricsForPrompt, null, 2)}

Latest snapshot date: ${snapshotDate}
${previous ? `Previous snapshot date: ${previous.date}` : 'Only one snapshot available.'}

Generate the executive insight.`;

    console.log('Calling Lovable AI for insight generation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      return new Response(JSON.stringify({ error: `AI generation failed: ${response.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content || '';

    console.log('AI raw response:', rawContent.substring(0, 300));

    // Parse JSON from response
    let content: { what_changed: string; what_it_means: string; what_to_do: string };
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = JSON.parse(jsonMatch[0]);
      } else {
        content = {
          what_changed: rawContent.slice(0, 200),
          what_it_means: '',
          what_to_do: '',
        };
      }
    } catch {
      content = {
        what_changed: rawContent.slice(0, 200),
        what_it_means: '',
        what_to_do: '',
      };
    }

    // Store in ai_insights (upsert based on unique constraint)
    const { error: insertErr } = await adminClient
      .from('ai_insights')
      .upsert({
        organization_id,
        project_id: project_id || null,
        snapshot_date: snapshotDate,
        insight_type,
        input_hash: inputHash,
        content,
      }, {
        onConflict: 'organization_id,project_id,snapshot_date,insight_type,input_hash',
        ignoreDuplicates: false,
      });

    if (insertErr) {
      console.error('Insert error:', insertErr);
      // Don't fail the response, just log
    }

    return new Response(JSON.stringify({
      content,
      cached: false,
      snapshot_date: snapshotDate,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
