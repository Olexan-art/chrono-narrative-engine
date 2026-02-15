import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LLMSettings {
  llm_provider: string;
  llm_image_provider: string | null;
  llm_image_model: string;
  openai_api_key: string | null;
  gemini_api_key: string | null;
}

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

async function generateWithOpenAI(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024', // DALL-E 3 standard size
      response_format: 'b64_json'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI image error:', response.status, errorText);
    throw new Error(`OpenAI error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image generated from OpenAI');
  return `data:image/png;base64,${b64}`;
}

async function generateWithGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  // Gemini Imagen API
  // Note: Standard Gemini API might not support 'imagen-3' directly via this endpoint structure in all regions yet, 
  // but keeping it as configured structure. If it fails, it throws.
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'imagen-3'}:generate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: { text: prompt },
      numberOfImages: 1,
      aspectRatio: "16:9"
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini image error:', response.status, errorText);
    throw new Error(`Gemini image error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) {
    throw new Error('No image generated from Gemini');
  }
  return `data:image/png;base64,${b64}`;
}

async function generateImage(settings: LLMSettings, prompt: string): Promise<string> {
  const provider = settings.llm_image_provider || 'gemini'; // Default to Gemini if not specified

  if (provider === 'openai' && settings.openai_api_key) {
    return generateWithOpenAI(prompt, settings.openai_api_key, settings.llm_image_model);
  }

  if (provider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (apiKey) {
      return generateWithGemini(prompt, apiKey, settings.llm_image_model);
    }
  }

  // Final fallback attempt with OpenAI if Gemini failed/missing but OpenAI key exists
  if (settings.openai_api_key) {
    return generateWithOpenAI(prompt, settings.openai_api_key, 'dall-e-3');
  }

  throw new Error(`No valid image provider configured. Provider: ${provider}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, partId, chapterId, volumeId, newsId, imageIndex = 1, originalContent } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get LLM settings from database
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_image_provider, llm_image_model, openai_api_key, gemini_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'gemini',
      llm_image_provider: 'gemini',
      llm_image_model: 'imagen-3',
      openai_api_key: null,
      gemini_api_key: null
    };

    // Use original_content context if provided for better image generation
    const contextHint = originalContent
      ? ` Context from article: ${originalContent.substring(0, 500)}.`
      : '';
    const enhancedPrompt = `${prompt}${contextHint} Ultra high resolution, 16:9 aspect ratio, sci-fi digital art style, cosmic atmosphere with deep space blues and cyan glows, cinematic lighting, detailed futuristic elements.`;

    const effectiveProvider = llmSettings.llm_image_provider || llmSettings.llm_provider || 'gemini';
    console.log('Generating image with provider:', effectiveProvider, 'prompt:', prompt.slice(0, 50));

    const base64ImageUrl = await generateImage(llmSettings, enhancedPrompt);

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
        model_used: llmSettings.llm_image_model || 'imagen-3',
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
        model_used: llmSettings.llm_image_model || 'imagen-3',
        success: true
      });
    } else if (volumeId) {
      storagePath = `volumes/${volumeId}/cover.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);

      await supabase.from('volumes').update({
        cover_image_url: finalImageUrl,
        cover_image_prompt: prompt
      }).eq('id', volumeId);
    } else if (newsId) {
      // News article image
      storagePath = `news/${newsId}/cover.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath);

      console.log('Generated news image for:', newsId);
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