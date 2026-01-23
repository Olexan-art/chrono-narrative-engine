import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function uploadBase64ToStorage(
  supabase: any,
  base64Data: string,
  path: string
): Promise<string> {
  const matches = base64Data.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid base64 format");

  const mimeType = matches[1];
  const base64Content = matches[2];
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from("covers")
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("covers").getPublicUrl(path);
  return urlData.publicUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, partId, chapterId, volumeId, imageIndex = 1 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const enhancedPrompt = `${prompt}. Ultra high resolution, 16:9 aspect ratio, sci-fi digital art style, cosmic atmosphere with deep space blues and cyan glows, cinematic lighting, detailed futuristic elements.`;

    console.log('Generating image for prompt:', prompt.slice(0, 50));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          { role: 'user', content: enhancedPrompt }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Credits exhausted, please add funds' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const base64ImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64ImageUrl) {
      throw new Error('No image generated');
    }

    // Determine storage path and upload to Storage
    let storagePath: string;
    let finalImageUrl: string;

    if (partId) {
      storagePath = `parts/${partId}/cover${imageIndex > 1 ? imageIndex : ''}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);
      
      const updateData = imageIndex === 2 
        ? { cover_image_url_2: finalImageUrl, cover_image_prompt_2: prompt }
        : { cover_image_url: finalImageUrl, cover_image_prompt: prompt };

      await supabase.from('parts').update(updateData).eq('id', partId);

      await supabase.from('generations').insert({
        part_id: partId,
        type: 'image',
        prompt: enhancedPrompt,
        result: finalImageUrl,
        model_used: 'google/gemini-2.5-flash-image-preview',
        success: true
      });
    } else if (chapterId) {
      storagePath = `chapters/${chapterId}/cover${imageIndex > 1 ? imageIndex : ''}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);
      
      let updateData: Record<string, string> = {};
      if (imageIndex === 1) {
        updateData = { cover_image_url: finalImageUrl, cover_image_prompt: prompt };
      } else if (imageIndex === 2) {
        updateData = { cover_image_url_2: finalImageUrl, cover_image_prompt_2: prompt };
      } else if (imageIndex === 3) {
        updateData = { cover_image_url_3: finalImageUrl, cover_image_prompt_3: prompt };
      }

      await supabase.from('chapters').update(updateData).eq('id', chapterId);

      await supabase.from('generations').insert({
        type: 'image',
        prompt: enhancedPrompt,
        result: finalImageUrl,
        model_used: 'google/gemini-2.5-flash-image-preview',
        success: true
      });
    } else if (volumeId) {
      storagePath = `volumes/${volumeId}/cover.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);
      
      await supabase.from('volumes').update({ 
        cover_image_url: finalImageUrl, 
        cover_image_prompt: prompt 
      }).eq('id', volumeId);
    } else {
      // No ID provided, just return the storage URL
      storagePath = `temp/${crypto.randomUUID()}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);
    }

    console.log('Generated and uploaded image', imageIndex, 'to:', storagePath);

    return new Response(
      JSON.stringify({ success: true, imageUrl: finalImageUrl, imageIndex }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
