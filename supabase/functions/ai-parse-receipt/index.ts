import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedReceiptData {
  total_amount: number | null;
  tax_amount: number | null;
  currency: string;
  vendor_name: string | null;
  purchase_date: string | null;
  category: string;
  confidence: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { receipt_id } = await req.json();

    if (!receipt_id) {
      console.error('Missing receipt_id');
      return new Response(
        JSON.stringify({ error: 'receipt_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing receipt:', receipt_id);

    // Initialize Supabase client with service role for storage access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the receipt record
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receipt_id)
      .single();

    if (fetchError || !receipt) {
      console.error('Receipt not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Receipt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found receipt with file_path:', receipt.file_path);

    // Download the image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(receipt.file_path);

    if (downloadError || !imageData) {
      console.error('Failed to download image:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download receipt image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log('Image converted to base64, size:', base64Image.length);

    // Call Lovable AI Gateway with Gemini Vision
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert receipt parser. Analyze the receipt image and extract the following information in valid JSON format only:

{
  "total_amount": <number or null if not found>,
  "tax_amount": <number or null if not found>,
  "currency": "<CAD, USD, or Other based on symbols like $ or text>",
  "vendor_name": "<store/vendor name or null>",
  "purchase_date": "<ISO 8601 date string like 2024-01-15 or null>",
  "category": "<one of: fuel, materials, tools, meals, lodging, other>",
  "confidence": <number between 0 and 1 indicating parsing confidence>
}

Category guidelines:
- "fuel" for gas stations, fuel purchases
- "materials" for building supplies, hardware stores, lumber yards
- "tools" for tool purchases, equipment rentals
- "meals" for restaurants, fast food, coffee shops
- "lodging" for hotels, motels, accommodations
- "other" for anything that doesn't fit above

Return ONLY the JSON object, no additional text or markdown.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Parse this receipt image and extract the structured data.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI service credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI parsing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI raw response:', rawContent);

    // Parse the JSON response
    let parsedData: ParsedReceiptData;
    try {
      // Clean up any markdown code blocks if present
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError, 'Raw:', rawContent);
      return new Response(
        JSON.stringify({ error: 'Failed to parse receipt data', raw: rawContent }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed receipt data:', parsedData);

    // Validate and normalize category
    const validCategories = ['fuel', 'materials', 'tools', 'meals', 'lodging', 'other'];
    if (!validCategories.includes(parsedData.category)) {
      parsedData.category = 'other';
    }

    // Validate currency
    if (!['CAD', 'USD', 'Other'].includes(parsedData.currency)) {
      parsedData.currency = 'CAD'; // Default to CAD
    }

    // Store parsed data and update receipt if fields are null
    const updateData: Record<string, any> = {
      processed_data_json: parsedData,
    };

    // Only update null/empty fields
    if (!receipt.amount && parsedData.total_amount !== null) {
      updateData.amount = parsedData.total_amount;
    }
    if (!receipt.currency || receipt.currency === 'CAD') {
      updateData.currency = parsedData.currency;
    }
    if (!receipt.vendor && parsedData.vendor_name) {
      updateData.vendor = parsedData.vendor_name;
    }
    if (!receipt.category || receipt.category === 'other') {
      updateData.category = parsedData.category;
    }

    const { error: updateError } = await supabase
      .from('receipts')
      .update(updateData)
      .eq('id', receipt_id);

    if (updateError) {
      console.error('Failed to update receipt:', updateError);
      // Still return the parsed data even if update fails
    }

    console.log('Receipt updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsedData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-parse-receipt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
