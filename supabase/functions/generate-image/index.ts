import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, partId, chapterId, imageIndex = 1 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const enhancedPrompt = `${prompt}. Ultra high resolution, 16:9 aspect ratio, sci-fi digital art style, cosmic atmosphere with deep space blues and cyan glows, cinematic lighting, detailed futuristic elements.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
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
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    // If partId provided, save to database (for parts)
    if (partId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Update the appropriate image field based on imageIndex
      const updateData = imageIndex === 2 
        ? { cover_image_url_2: imageUrl, cover_image_prompt_2: prompt }
        : { cover_image_url: imageUrl, cover_image_prompt: prompt };

      await supabase
        .from('parts')
        .update(updateData)
        .eq('id', partId);

      await supabase
        .from('generations')
        .insert({
          part_id: partId,
          type: 'image',
          prompt: enhancedPrompt,
          result: imageUrl,
          model_used: 'google/gemini-3-pro-image-preview',
          success: true
        });
    }

    // If chapterId provided, save to database (for chapters)
    if (chapterId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Update the appropriate image field based on imageIndex
      let updateData: Record<string, string> = {};
      if (imageIndex === 1) {
        updateData = { cover_image_url: imageUrl, cover_image_prompt: prompt };
      } else if (imageIndex === 2) {
        updateData = { cover_image_url_2: imageUrl, cover_image_prompt_2: prompt };
      } else if (imageIndex === 3) {
        updateData = { cover_image_url_3: imageUrl, cover_image_prompt_3: prompt };
      }

      await supabase
        .from('chapters')
        .update(updateData)
        .eq('id', chapterId);

      await supabase
        .from('generations')
        .insert({
          type: 'image',
          prompt: enhancedPrompt,
          result: imageUrl,
          model_used: 'google/gemini-3-pro-image-preview',
          success: true
        });
    }

    console.log('Generated image', imageIndex, 'for prompt:', prompt.slice(0, 50));

    return new Response(
      JSON.stringify({ success: true, imageUrl, imageIndex }),
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
