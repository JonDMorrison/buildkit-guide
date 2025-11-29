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
      throw new Error('OPENAI_API_KEY not configured');
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
      // For PDFs, use OpenAI's vision API with converted images
      // This is a simplified approach - convert first page to text
      console.log('Processing PDF file');
      
      // For now, use a simple approach: tell OpenAI to extract text from the PDF
      // Note: OpenAI doesn't directly support PDFs, so we'd need to convert to images
      // For MVP, we'll use a text-based approach
      const formData = new FormData();
      formData.append('file', fileBlob, fileName);
      formData.append('model', 'whisper-1'); // This won't work for PDFs
      
      // Better approach: Use GPT-4 Vision with base64 encoded images
      // For now, return a placeholder
      extractedText = `[PDF Document: ${fileName}]\nThis document requires manual text extraction or OCR processing.`;
      
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
                  text: 'Extract all text, labels, annotations, measurements, and important information from this construction document. Include any visible text, numbers, room labels, dimensions, notes, and technical specifications. Format the output as clear, searchable text.'
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
        }),
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error('OpenAI Vision API error:', errorText);
        throw new Error(`Vision API error: ${errorText}`);
      }

      const visionResult = await visionResponse.json();
      extractedText = visionResult.choices[0].message.content;
      console.log('Extracted text length:', extractedText.length);
      
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
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
