import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ROWS = 500;
const BATCH_SIZE = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { importId, rows, projectInfo, columnMapping } = await req.json();

    if (!importId || !rows || !Array.isArray(rows)) {
      throw new Error('importId and rows array are required');
    }

    console.log(`Processing import ${importId} with ${rows.length} rows`);

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

    // Verify import exists and user has access
    const { data: importData, error: importError } = await supabaseClient
      .from('gc_deficiency_imports')
      .select('id, project_id, status')
      .eq('id', importId)
      .single();

    if (importError || !importData) {
      throw new Error('Import not found or no access');
    }

    // Service client for writing
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update status to parsing
    await serviceClient
      .from('gc_deficiency_imports')
      .update({ status: 'parsing', total_rows: rows.length })
      .eq('id', importId);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Limit rows
    const limitedRows = rows.slice(0, MAX_ROWS);
    
    // Normalize rows based on column mapping
    const normalizedRows = limitedRows.map((row: any, index: number) => {
      const normalized: any = {
        row_index: index,
        gc_id: columnMapping?.gc_id ? row[columnMapping.gc_id] : null,
        description: columnMapping?.description ? row[columnMapping.description] : null,
        location: columnMapping?.location ? row[columnMapping.location] : null,
        gc_trade: columnMapping?.gc_trade ? row[columnMapping.gc_trade] : null,
        status: columnMapping?.status ? row[columnMapping.status] : null,
        due_date_raw: columnMapping?.due_date ? row[columnMapping.due_date] : null,
      };
      return normalized;
    });

    // Process in batches
    const results: any[] = [];
    let horizonCount = 0;
    const batches = [];
    
    for (let i = 0; i < normalizedRows.length; i += BATCH_SIZE) {
      batches.push(normalizedRows.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches`);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      try {
        const systemPrompt = `You are analyzing a General Contractor's deficiency list to identify items that belong to Horizon Contracting Group.

Horizon's role: ${projectInfo?.horizonScope || 'General contractor support and coordination'}
Known aliases for Horizon: "Horizon Contracting Group", "Horizon", "Horizon CG", "HCG"

For each deficiency item, determine:
1. Does this belong to Horizon? Look for trade assignments, responsible party columns, or descriptions mentioning Horizon.
2. Extract and clean the key fields.
3. Suggest an internal scope category if possible.

Respond with ONLY valid JSON - an array of objects matching the input row order.`;

        const userPrompt = `Analyze these deficiency items from a GC list:

Project: ${projectInfo?.name || 'Unknown Project'}
Horizon Scope: ${projectInfo?.horizonScope || 'Not specified'}

Items to analyze:
${JSON.stringify(batch, null, 2)}

Return JSON array with one object per item:
{
  "row_index": number,
  "belongs_to_horizon": boolean,
  "belongs_confidence": number (0-1),
  "parsed_description": string | null,
  "parsed_location": string | null,
  "parsed_priority": "low" | "normal" | "high" | null,
  "parsed_due_date": string | null,
  "parsed_gc_trade": string | null,
  "suggested_internal_scope": string | null
}`;

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
              { role: 'user', content: userPrompt }
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`AI error for batch ${batchIndex}:`, response.status, errorText);
          
          // Mark batch items as errored
          for (const row of batch) {
            results.push({
              row_index: row.row_index,
              raw_row_json: limitedRows[row.row_index],
              is_error: true,
              error_message: `AI processing failed: ${response.status}`,
              belongs_to_horizon: false,
              belongs_confidence: 0,
            });
          }
          continue;
        }

        const aiResult = await response.json();
        let content = aiResult.choices?.[0]?.message?.content || '[]';
        
        // Clean JSON response
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let parsedResults: any[];
        try {
          parsedResults = JSON.parse(content);
        } catch (parseError) {
          console.error(`Failed to parse AI response for batch ${batchIndex}:`, content);
          for (const row of batch) {
            results.push({
              row_index: row.row_index,
              raw_row_json: limitedRows[row.row_index],
              is_error: true,
              error_message: 'Failed to parse AI response',
              belongs_to_horizon: false,
              belongs_confidence: 0,
            });
          }
          continue;
        }

        // Merge results with original data
        for (const parsed of parsedResults) {
          const originalRow = limitedRows[parsed.row_index];
          if (parsed.belongs_to_horizon && parsed.belongs_confidence > 0.5) {
            horizonCount++;
          }
          results.push({
            row_index: parsed.row_index,
            raw_row_json: originalRow,
            belongs_to_horizon: parsed.belongs_to_horizon || false,
            belongs_confidence: parsed.belongs_confidence || 0,
            parsed_description: parsed.parsed_description,
            parsed_location: parsed.parsed_location,
            parsed_priority: parsed.parsed_priority,
            parsed_due_date: parsed.parsed_due_date,
            parsed_gc_trade: parsed.parsed_gc_trade,
            suggested_internal_scope: parsed.suggested_internal_scope,
            is_error: false,
          });
        }

        console.log(`Batch ${batchIndex + 1}/${batches.length} complete`);

      } catch (batchError) {
        console.error(`Error processing batch ${batchIndex}:`, batchError);
        for (const row of batch) {
          results.push({
            row_index: row.row_index,
            raw_row_json: limitedRows[row.row_index],
            is_error: true,
            error_message: batchError instanceof Error ? batchError.message : 'Unknown error',
            belongs_to_horizon: false,
            belongs_confidence: 0,
          });
        }
      }
    }

    // Insert all results
    const itemsToInsert = results.map(r => ({
      import_id: importId,
      ...r,
    }));

    const { error: insertError } = await serviceClient
      .from('gc_deficiency_items')
      .insert(itemsToInsert);

    if (insertError) {
      console.error('Error inserting items:', insertError);
      throw new Error('Failed to save parsed items');
    }

    // Update import status
    await serviceClient
      .from('gc_deficiency_imports')
      .update({ 
        status: 'parsed',
        total_rows: limitedRows.length,
        horizon_rows: horizonCount,
      })
      .eq('id', importId);

    // Log the action
    await serviceClient
      .from('gc_import_logs')
      .insert({
        import_id: importId,
        user_id: user.id,
        action: 'parsed',
        details: {
          total_rows: limitedRows.length,
          horizon_rows: horizonCount,
          error_rows: results.filter(r => r.is_error).length,
        },
      });

    console.log(`Import ${importId} parsed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        totalRows: limitedRows.length,
        horizonRows: horizonCount,
        errorRows: results.filter(r => r.is_error).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Parse GC deficiency list error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});