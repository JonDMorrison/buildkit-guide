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
    const { fileUrl, fileName, projectId, documentType } = await req.json();
    
    if (!fileUrl || !fileName || !projectId) {
      throw new Error('Missing required parameters: fileUrl, fileName, projectId');
    }

    console.log('Processing document:', { fileName, projectId, documentType });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      // Return explicit error - do not process without API key
      return new Response(
        JSON.stringify({ 
          error: 'Document processing is not configured. Please contact your administrator to set up the OPENAI_API_KEY.',
          success: false,
          requires_configuration: true
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the file from storage
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from storage');
    }

    const fileBlob = await fileResponse.blob();
    const fileType = fileName.toLowerCase();
    let extractedText = '';

    // Process based on file type
    if (fileType.endsWith('.pdf')) {
      // PDFs require conversion to images for Vision API processing
      // This is a known limitation - return explicit error with guidance
      console.log('PDF file detected - Vision API cannot directly process PDFs');
      
      return new Response(
        JSON.stringify({ 
          error: 'PDF processing is not yet supported. Please upload the document as images (JPG, PNG) for text extraction, or manually enter the document contents.',
          success: false,
          unsupported_format: true,
          supported_formats: ['jpg', 'jpeg', 'png', 'webp']
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
      
    } else if (fileType.endsWith('.jpg') || fileType.endsWith('.jpeg') || 
               fileType.endsWith('.png') || fileType.endsWith('.webp')) {
      // For images, use OpenAI Vision API
      console.log('Processing image file with Vision API');
      
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = fileType.endsWith('.png') ? 'image/png' : 
                       fileType.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

      const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all information from this construction document image and return it as a JSON object with this exact structure: { "title": "document title or description if visible", "document_type": "drawing" or "spec" or "report" or "schedule" or "other", "dimensions": ["list of any measurements or dimensions found"], "room_labels": ["list of room names, area labels, or zone identifiers"], "notes": ["list of any written notes, annotations, or callouts"], "specifications": ["list of any technical specifications, material specs, or standards referenced"], "page_summary": "brief 1-2 sentence summary of what this document contains" }. Extract every piece of visible text, number, label, and annotation. If a field has no matches, return an empty array or empty string.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
          response_format: { type: "json_object" },
        }),
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('OpenAI Vision API error:', errorText);
        throw new Error(`Vision API error: ${errorText}`);
      }

      const visionResult = await visionResponse.json();
      const rawContent = visionResult.choices[0].message.content;

      // Parse structured JSON and build readable text for storage
      try {
        const parsed = JSON.parse(rawContent);
        const parts: string[] = [];
        if (parsed.title) parts.push(`Title: ${parsed.title}`);
        if (parsed.document_type) parts.push(`Type: ${parsed.document_type}`);
        if (parsed.page_summary) parts.push(`Summary: ${parsed.page_summary}`);
        if (parsed.dimensions?.length) parts.push(`Dimensions: ${parsed.dimensions.join(', ')}`);
        if (parsed.room_labels?.length) parts.push(`Rooms/Areas: ${parsed.room_labels.join(', ')}`);
        if (parsed.notes?.length) parts.push(`Notes:\n${parsed.notes.join('\n')}`);
        if (parsed.specifications?.length) parts.push(`Specifications:\n${parsed.specifications.join('\n')}`);
        extractedText = parts.join('\n\n');
      } catch {
        // Fallback to raw text if JSON parsing fails
        extractedText = rawContent;
      }
      console.log('Extracted text length:', extractedText.length);
      
    } else {
      // Unsupported file type - return explicit error
      return new Response(
        JSON.stringify({ 
          error: `File type "${fileType.split('.').pop()}" is not supported. Please upload images (JPG, PNG, WebP) for text extraction.`,
          success: false,
          unsupported_format: true,
          supported_formats: ['jpg', 'jpeg', 'png', 'webp']
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create attachment record
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error('Not authenticated');

    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .insert({
        project_id: projectId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType.split('.').pop() || 'unknown',
        file_size: fileBlob.size,
        uploaded_by: user.user.id,
        document_type: documentType || 'other',
      })
      .select()
      .single();

    if (attachmentError) {
      console.error('Error creating attachment:', attachmentError);
      throw attachmentError;
    }

    // Save extracted text to document_texts table
    const { error: docTextError } = await supabase
      .from('document_texts')
      .insert({
        project_id: projectId,
        attachment_id: attachment.id,
        title: fileName,
        raw_text: extractedText,
      });

    if (docTextError) {
      console.error('Error saving document text:', docTextError);
      throw docTextError;
    }

    console.log('Document processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        attachmentId: attachment.id,
        extractedLength: extractedText.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing document:', error);
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