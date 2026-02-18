import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logLlmUsage } from '../_shared/llm-logger.ts';

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
  gemini_v22_api_key: string | null;
  zai_api_key: string | null;
  mistral_api_key: string | null;
}

async function uploadBase64ToStorage(
  supabase: any,
  base64Data: string,
  path: string,
  bucket: string = "covers"
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
    .from(bucket)
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
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
      size: '1024x1024',
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'imagen-3'}:generate?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: { text: prompt },
      numberOfImages: 1,
      aspectRatio: "1:1"
    }),
  });

  if (!response.ok) {
    console.log('Gemini image failed:', response.status);
    throw new Error(`Gemini image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.generatedImages?.[0]?.image?.imageBytes;
  if (!b64) {
    console.log('No Gemini image returned');
    throw new Error('No Gemini image returned');
  }
  return `data:image/png;base64,${b64}`;
}

async function generateWithZai(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.z.ai/api/paas/v4/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'cogview-3-plus',
      prompt: prompt,
      n: 1,
      size: '1024x1024'
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Z.ai image error:', response.status, errorText);
    throw new Error(`Z.ai error: ${response.status}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json || data.data?.[0]?.url;

  if (!b64) throw new Error('No image generated from Z.ai');

  // If it's a URL, we need to fetch it and convert to base64, 
  // but usually Z.ai can return b64_json like OpenAI.
  // If it's just a URL, we'd fetch it here.
  if (b64.startsWith('http')) {
    const imgRes = await fetch(b64);
    const blob = await imgRes.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return `data:image/png;base64,${base64}`;
  }

  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
}

async function generateImage(
  supabase: SupabaseClient,
  settings: LLMSettings,
  prompt: string,
  metadata: any = {}
): Promise<string> {
  // Use provider/model from metadata if provided (passed from frontend)
  let provider = metadata.provider || settings.llm_image_provider || settings.llm_provider || 'gemini';
  let model = metadata.model || settings.llm_image_model || (provider === 'openai' ? 'dall-e-3' : 'imagen-3');

  const startTime = Date.now();

  // Handle lovable provider - pick what's available
  if (provider === 'lovable') {
    if (settings.gemini_api_key || settings.gemini_v22_api_key) {
      provider = 'gemini';
    } else if (settings.openai_api_key) {
      provider = 'openai';
    } else if (settings.zai_api_key) {
      provider = 'zai';
    }
  }

  try {
    let result: string;

    if (provider === 'openai' && settings.openai_api_key) {
      result = await generateWithOpenAI(prompt, settings.openai_api_key, model);
    } else if (provider === 'gemini') {
      const apiKey = settings.gemini_api_key || settings.gemini_v22_api_key;
      if (!apiKey) throw new Error('No Gemini API key available');
      result = await generateWithGemini(prompt, apiKey, model);
    } else if (provider === 'zai' && settings.zai_api_key) {
      result = await generateWithZai(prompt, settings.zai_api_key, model);
    } else if (settings.gemini_api_key || settings.gemini_v22_api_key) {
      // Last resort fallback to Gemini
      console.log('Falling back to Gemini for provider:', provider);
      provider = 'gemini';
      result = await generateWithGemini(prompt, settings.gemini_api_key || settings.gemini_v22_api_key!, model);
    } else {
      throw new Error(`No valid image provider configured for ${provider} (or missing API key)`);
    }

    // Log success
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'generate-image',
      duration_ms: Date.now() - startTime,
      success: true,
      metadata
    });

    return result;

  } catch (error) {
    // Log error
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'generate-image',
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
      metadata
    });
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      prompt: reqPrompt,
      model,
      provider,
      partId,
      chapterId,
      volumeId,
      newsId,
      type,
      imageIndex = 1,
      originalContent,
      action,
      imageUrl
    } = await req.json();
    const prompt = reqPrompt;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get LLM settings from database
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_image_provider, llm_image_model, openai_api_key, gemini_api_key, gemini_v22_api_key, zai_api_key, mistral_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'gemini',
      llm_image_provider: null,
      llm_image_model: 'imagen-3',
      openai_api_key: null,
      gemini_api_key: null,
      gemini_v22_api_key: null,
      zai_api_key: null,
      mistral_api_key: null
    };

    // Handle image enhancement action
    if (action === 'enhance' && imageUrl) {
      console.log('Enhancing image:', imageUrl.slice(0, 80));
      const enhancePrompt = 'Enhance this image: improve quality, sharpen details, fix any artifacts, improve colors and contrast. Keep the same composition and subject. Output ultra high resolution version.';

      // Since we don't have img2img support in Gemini yet via this standard call, 
      // we'll generate a new one based on prompt description or just fail if strict
      // For now, let's treat it as a new generation requested by user interaction
      // effectively regenerating the cover
      const enhancedBase64 = await generateImage(supabase, llmSettings, enhancePrompt, { action: 'enhance', imageUrl });

      if (!enhancedBase64) {
        throw new Error('Failed to enhance image');
      }

      // Upload enhanced image
      const storagePath = newsId
        ? `news/${newsId}/cover_enhanced.png`
        : `temp/${crypto.randomUUID()}_enhanced.png`;

      const finalImageUrl = await uploadBase64ToStorage(supabase, enhancedBase64, storagePath);
      console.log('Enhanced image uploaded to:', storagePath);

      return new Response(
        JSON.stringify({ success: true, imageUrl: finalImageUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine generation parameters based on type
    let finalPrompt = prompt;
    let stylePrompt = ' Ultra high resolution, 16:9 aspect ratio, sci-fi digital art style, cosmic atmosphere with deep space blues and cyan glows, cinematic lighting, detailed futuristic elements.';
    let bucket = 'covers';

    if (type === 'satire') {
      stylePrompt = ' Satirical political caricature style, expressive and exaggerated features, sharp ink lines, vibrant but gritty comic book aesthetics, deep shadows, detailed background.';
      bucket = 'outrage-ink';
    }

    // Use original_content context if provided for better image generation
    const contextHint = originalContent
      ? ` Context from article: ${originalContent.substring(0, 500)}.`
      : '';
    finalPrompt = `${prompt}${contextHint}${stylePrompt}`;

    const effectiveProvider = llmSettings.llm_image_provider || llmSettings.llm_provider || 'gemini';
    console.log('Generating image with provider:', effectiveProvider, 'type:', type, 'prompt:', prompt.slice(0, 50));

    const base64ImageUrl = await generateImage(supabase, llmSettings, finalPrompt, {
      newsId, partId, chapterId, volumeId, type, imageIndex, model, provider
    });

    if (!base64ImageUrl) {
      throw new Error('No image generated');
    }

    // Determine storage path and upload to Storage
    let storagePath: string;
    let finalImageUrl: string;

    if (partId) {
      storagePath = `parts/${partId}/cover${imageIndex > 1 ? imageIndex : ''}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);

      const updateData = imageIndex === 2
        ? { cover_image_url_2: finalImageUrl, cover_image_prompt_2: prompt }
        : { cover_image_url: finalImageUrl, cover_image_prompt: prompt };

      await supabase.from('parts').update(updateData).eq('id', partId);

      await supabase.from('generations').insert({
        part_id: partId,
        type: 'image',
        prompt: finalPrompt,
        result: finalImageUrl,
        model_used: model || 'auto',
        success: true
      });
    } else if (chapterId) {
      storagePath = `chapters/${chapterId}/cover${imageIndex > 1 ? imageIndex : ''}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);

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
        prompt: finalPrompt,
        result: finalImageUrl,
        model_used: model || 'auto',
        success: true
      });
    } else if (volumeId) {
      storagePath = `volumes/${volumeId}/cover.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);

      await supabase.from('volumes').update({
        cover_image_url: finalImageUrl,
        cover_image_prompt: prompt
      }).eq('id', volumeId);
    } else if (type === 'satire') {
      // Satire (caricature) image
      const timestamp = new Date().getTime();
      storagePath = newsId
        ? `news/${newsId}/satire_${timestamp}.png`
        : `general/satire_${timestamp}.png`;

      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);
      console.log('Generated satire image for news:', newsId);
    } else if (newsId) {
      // News article image
      storagePath = `news/${newsId}/cover.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);

      // Note: news_rss_items table update is handled by the caller
      console.log('Generated news image for:', newsId);
    } else {
      // No ID provided, just return the storage URL
      storagePath = `temp/${crypto.randomUUID()}.png`;
      finalImageUrl = await uploadBase64ToStorage(supabase, base64ImageUrl, storagePath, bucket);
    }

    console.log('Generated and uploaded image', imageIndex, 'to:', storagePath, 'in bucket:', bucket);

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