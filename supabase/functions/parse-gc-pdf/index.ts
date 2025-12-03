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
    const { fileUrl, projectId, sourceName } = await req.json();

    if (!fileUrl || !projectId) {
      throw new Error('fileUrl and projectId are required');
    }

    console.log(`Processing PDF for project ${projectId}`);

    // Get auth
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

    // Download the PDF file
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from storage');
    }

    const fileBlob = await fileResponse.blob();
    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Get LOVABLE_API_KEY for Gemini Vision
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use Gemini to extract table data from the PDF
    const extractionPrompt = `You are analyzing a General Contractor's deficiency list document. This is a construction project deficiency/punch list from a GC.

Your task is to extract ALL deficiency items from this document into a structured format.

For each deficiency item found, extract:
- gc_id: The item number or ID from the GC's list (if present)
- description: The full description of the deficiency
- location: The location (room, floor, area) where the deficiency exists
- gc_trade: The trade or contractor responsible according to the GC
- status: The current status (open, closed, pending, etc.)
- due_date: Any due date mentioned

IMPORTANT:
- Extract EVERY row/item from the deficiency list
- If a field is not present or unclear, use null
- Return ONLY valid JSON - an array of objects
- Do not include any markdown formatting or code blocks
- If you cannot extract any rows (document is unreadable, not a deficiency list, etc.), return an empty array []

Return format:
[
  {
    "gc_id": "string or null",
    "description": "string or null", 
    "location": "string or null",
    "gc_trade": "string or null",
    "status": "string or null",
    "due_date": "string or null"
  }
]`;

    console.log('Calling Gemini Vision API for PDF extraction...');

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
            role: 'user',
            content: [
              {
                type: 'text',
                text: extractionPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error(`AI processing failed: ${response.status}`);
    }

    const aiResult = await response.json();
    let content = aiResult.choices?.[0]?.message?.content || '[]';
    
    // Clean JSON response
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let extractedRows: any[];
    try {
      extractedRows = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Could not parse PDF content. The document may not be a readable deficiency list.');
    }

    if (!Array.isArray(extractedRows)) {
      throw new Error('Invalid response format from AI');
    }

    console.log(`Extracted ${extractedRows.length} rows from PDF`);

    // Return the extracted rows for further processing
    return new Response(
      JSON.stringify({
        success: true,
        rows: extractedRows,
        rowCount: extractedRows.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PDF parsing error:', error);
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
