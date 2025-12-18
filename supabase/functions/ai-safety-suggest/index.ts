import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HazardSuggestion {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: 'weather' | 'task' | 'trade' | 'history' | 'general';
}

interface SafetySuggestRequest {
  project_id: string;
  weather_conditions?: string;
  date?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SafetySuggestRequest = await req.json();
    const { project_id, weather_conditions, date } = body;

    if (!project_id) {
      throw new Error('project_id is required');
    }

    console.log('AI Safety Suggest request:', { project_id, weather_conditions, date });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client with user context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Create service client for data fetching
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get LOVABLE_API_KEY
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const today = date || new Date().toISOString().split('T')[0];
    const weekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch context data
    // 1. Active tasks for today
    const { data: tasks } = await serviceClient
      .from('tasks')
      .select(`
        id, title, description, status, location,
        trades(name)
      `)
      .eq('project_id', project_id)
      .eq('is_deleted', false)
      .in('status', ['not_started', 'in_progress'])
      .or(`start_date.lte.${today},due_date.gte.${today}`)
      .limit(30);

    // 2. Active trades on site (from time entries today)
    const { data: timeEntries } = await serviceClient
      .from('time_entries')
      .select(`
        user_id,
        project_members!inner(trade_id, trades(name))
      `)
      .eq('project_id', project_id)
      .gte('check_in_at', `${today}T00:00:00`)
      .is('check_out_at', null);

    // 3. Recent incidents and safety forms
    const { data: recentSafety } = await serviceClient
      .from('safety_forms')
      .select(`
        id, form_type, title, inspection_date,
        safety_entries(field_name, field_value)
      `)
      .eq('project_id', project_id)
      .eq('is_deleted', false)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Recent deficiencies
    const { data: deficiencies } = await serviceClient
      .from('deficiencies')
      .select('id, title, description, status, priority')
      .eq('project_id', project_id)
      .eq('is_deleted', false)
      .in('status', ['open', 'in_progress'])
      .limit(20);

    // Extract unique trades on site
    const tradesOnSite = new Set<string>();
    timeEntries?.forEach(entry => {
      const tradeName = (entry.project_members as any)?.trades?.name;
      if (tradeName) tradesOnSite.add(tradeName);
    });
    tasks?.forEach(task => {
      const tradeName = (task.trades as any)?.name;
      if (tradeName) tradesOnSite.add(tradeName);
    });

    // Build context for AI
    let contextString = `## Project Context for Safety Log\n\n`;
    contextString += `### Date: ${today}\n`;
    
    if (weather_conditions) {
      contextString += `### Current Weather: ${weather_conditions}\n\n`;
    }

    contextString += `### Active Tasks Today:\n`;
    tasks?.slice(0, 15).forEach(task => {
      const tradeName = (task.trades as any)?.name || 'Unassigned';
      contextString += `- ${task.title} (${tradeName})${task.location ? ` at ${task.location}` : ''}\n`;
    });

    contextString += `\n### Trades Active On Site:\n`;
    Array.from(tradesOnSite).forEach(trade => {
      contextString += `- ${trade}\n`;
    });

    // Extract past incidents and hazards
    const pastHazards: string[] = [];
    const pastIncidents: string[] = [];
    recentSafety?.forEach(form => {
      if (form.form_type === 'incident_report') {
        const description = form.safety_entries?.find((e: any) => e.field_name === 'description');
        if (description?.field_value) {
          pastIncidents.push(description.field_value);
        }
      }
      if (form.form_type === 'daily_safety_log') {
        const hazards = form.safety_entries?.find((e: any) => e.field_name === 'hazards_identified');
        if (hazards?.field_value) {
          pastHazards.push(hazards.field_value);
        }
      }
    });

    if (pastIncidents.length > 0) {
      contextString += `\n### Recent Incidents (last 7 days):\n`;
      pastIncidents.slice(0, 5).forEach(inc => {
        contextString += `- ${inc.substring(0, 200)}\n`;
      });
    }

    if (pastHazards.length > 0) {
      contextString += `\n### Previously Identified Hazards:\n`;
      pastHazards.slice(0, 5).forEach(haz => {
        contextString += `- ${haz.substring(0, 200)}\n`;
      });
    }

    if (deficiencies && deficiencies.length > 0) {
      contextString += `\n### Open Deficiencies:\n`;
      deficiencies.slice(0, 10).forEach(def => {
        contextString += `- [${def.priority === 1 ? 'HIGH' : def.priority === 2 ? 'MED' : 'LOW'}] ${def.title}\n`;
      });
    }

    console.log('Context built, calling AI...');

    // Call Lovable AI
    const systemPrompt = `You are a construction safety expert assistant. Based on the project context provided, suggest specific hazards that should be documented in today's Daily Safety Log.

Return your response as a JSON array of hazard suggestions. Each suggestion should be:
- Specific and actionable
- Based on the actual tasks, trades, weather, or history provided
- Prioritized by likelihood and severity

Format your response as valid JSON only (no markdown):
{
  "suggestions": [
    {
      "id": "unique-id",
      "category": "fall_protection|electrical|excavation|heavy_equipment|weather|housekeeping|ppe|confined_space|chemical|fire|other",
      "title": "Short hazard title (5-10 words)",
      "description": "Detailed description of the hazard and recommended control measures (2-3 sentences)",
      "severity": "low|medium|high|critical",
      "source": "weather|task|trade|history|general"
    }
  ]
}

Categories explained:
- fall_protection: Working at heights, scaffolding, ladders
- electrical: Live wires, temporary power, wet conditions
- excavation: Trenching, shoring, underground utilities
- heavy_equipment: Cranes, forklifts, excavators
- weather: Heat, cold, rain, wind, lightning
- housekeeping: Clutter, debris, walkways
- ppe: Missing or inadequate PPE
- confined_space: Tanks, manholes, enclosed areas
- chemical: Paints, solvents, fuels
- fire: Hot work, flammables
- other: Any other hazard type

Provide 3-6 suggestions based on the context. If weather is extreme, prioritize weather-related hazards. Match hazards to the actual trades and tasks on site.`;

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
          { role: 'user', content: contextString }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse AI response
    let suggestions: HazardSuggestion[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions || [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return default suggestions if parsing fails
      suggestions = getDefaultSuggestions(weather_conditions, Array.from(tradesOnSite));
    }

    // Ensure IDs are unique
    suggestions = suggestions.map((s, i) => ({
      ...s,
      id: s.id || `hazard-${i}-${Date.now()}`
    }));

    return new Response(JSON.stringify({ 
      suggestions,
      context: {
        trades_on_site: Array.from(tradesOnSite),
        active_tasks: tasks?.length || 0,
        recent_incidents: pastIncidents.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-safety-suggest:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      suggestions: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Default suggestions when AI fails
function getDefaultSuggestions(weather?: string, trades?: string[]): HazardSuggestion[] {
  const suggestions: HazardSuggestion[] = [
    {
      id: 'default-housekeeping',
      category: 'housekeeping',
      title: 'General site housekeeping',
      description: 'Ensure walkways are clear, materials properly stored, and debris removed from work areas.',
      severity: 'medium',
      source: 'general'
    },
    {
      id: 'default-ppe',
      category: 'ppe',
      title: 'PPE compliance check',
      description: 'Verify all workers have required PPE: hard hats, safety glasses, high-vis vests, and appropriate footwear.',
      severity: 'high',
      source: 'general'
    }
  ];

  // Add weather-related if applicable
  if (weather) {
    const lowerWeather = weather.toLowerCase();
    if (lowerWeather.includes('rain') || lowerWeather.includes('wet')) {
      suggestions.push({
        id: 'weather-slip',
        category: 'weather',
        title: 'Wet/slippery conditions',
        description: 'Rain creating slip hazards. Use caution on walkways, delay elevated work if needed, protect electrical equipment.',
        severity: 'high',
        source: 'weather'
      });
    }
    if (lowerWeather.includes('wind') || lowerWeather.includes('storm')) {
      suggestions.push({
        id: 'weather-wind',
        category: 'weather',
        title: 'High wind conditions',
        description: 'Wind affecting crane operations and overhead work. Secure loose materials, consider suspending elevated work.',
        severity: 'high',
        source: 'weather'
      });
    }
  }

  // Add trade-specific
  if (trades?.includes('Electrical')) {
    suggestions.push({
      id: 'trade-electrical',
      category: 'electrical',
      title: 'Electrical work hazards',
      description: 'Live electrical work today. Maintain safe distances, use LOTO procedures, ensure qualified workers only.',
      severity: 'critical',
      source: 'trade'
    });
  }

  return suggestions;
}
