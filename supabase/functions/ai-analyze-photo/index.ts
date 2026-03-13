import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzePhotoRequest {
  image_base64: string;
  project_id: string;
  context?: string;
}

interface AnalyzePhotoResponse {
  suggested_title: string;
  suggested_description: string;
  suggested_priority: string;
  suggested_location: string | null;
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: AnalyzePhotoRequest = await req.json();
    const { image_base64, project_id, context } = body;

    if (!image_base64 || !project_id) {
      throw new Error('image_base64 and project_id are required');
    }

    console.log('AI Analyze Photo request for project:', project_id);

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

    // Verify user has access to project
    const { data: membership } = await supabaseClient
      .from('project_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('project_id', project_id)
      .single();

    const { data: globalAdmin } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!membership && !globalAdmin) {
      throw new Error('No access to this project');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are an AI assistant for a construction project coordination app. 
You analyze photos of construction deficiencies, issues, or problems on job sites.

Your task is to analyze the provided image and generate:
1. A clear, concise title (max 80 characters) that describes the issue
2. A detailed description of what you see, including:
   - What the deficiency/issue is
   - Where it appears to be located (if visible)
   - Any safety concerns
   - Recommended corrective actions
3. A priority assessment (1=Critical, 2=High, 3=Medium, 4=Low) based on:
   - Safety impact
   - Impact on other work
   - Urgency of correction
4. A location hint if visible (e.g., "near electrical panel", "exterior wall", "ceiling area")

Respond in JSON format:
{
  "suggested_title": "Brief description of the issue",
  "suggested_description": "Detailed description including what's wrong and recommended fix",
  "suggested_priority": "1" | "2" | "3" | "4",
  "suggested_location": "Location hint or null",
  "confidence": 0.0 to 1.0
}

Be specific and technical. Use construction terminology. Focus on actionable descriptions.`;

    const userContent = [
      {
        type: "text",
        text: context 
          ? `Analyze this construction deficiency photo. Context: ${context}`
          : "Analyze this construction deficiency photo and describe the issue you see."
      },
      {
        type: "image_url",
        image_url: {
          url: image_base64.startsWith('data:') 
            ? image_base64 
            : `data:image/jpeg;base64,${image_base64}`
        }
      }
    ];

    console.log('Calling OpenAI with vision...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
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
    let analysisResult: AnalyzePhotoResponse = {
      suggested_title: 'Construction deficiency',
      suggested_description: 'Unable to analyze image. Please describe the issue manually.',
      suggested_priority: '3',
      suggested_location: null,
      confidence: 0,
    };

    try {
      const jsonMatch = rawAnswer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysisResult = {
          suggested_title: parsed.suggested_title || analysisResult.suggested_title,
          suggested_description: parsed.suggested_description || analysisResult.suggested_description,
          suggested_priority: String(parsed.suggested_priority || '3'),
          suggested_location: parsed.suggested_location || null,
          confidence: Number(parsed.confidence) || 0.8,
        };
      }
    } catch (e) {
      console.log('Could not parse JSON, using raw text as description');
      analysisResult.suggested_description = rawAnswer.slice(0, 500);
      analysisResult.confidence = 0.5;
    }

    console.log('Photo analysis complete:', analysisResult.suggested_title);

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Analyze Photo error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
