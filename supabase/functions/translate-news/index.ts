import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface LLMSettings {
  llm_provider: string;
  llm_text_provider: string | null;
  llm_text_model: string;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  gemini_v22_api_key: string | null;
  anthropic_api_key: string | null;
  zai_api_key: string | null;
  mistral_api_key: string | null;
}

async function callLLM(settings: LLMSettings, systemPrompt: string, userPrompt: string, overrideModel?: string): Promise<string> {
  const model = overrideModel || settings.llm_text_model || 'google/gemini-3-flash-preview';

  // Determine provider from model name if override model is passed
  let provider = settings.llm_text_provider || settings.llm_provider || 'zai';

  // Auto-detect provider from model prefix to prevent mismatches
  if (overrideModel) {
    if (overrideModel.startsWith('google/') || overrideModel.startsWith('gemini')) {
      provider = 'geminiV22'; // Use Gemini V22 for Google models directly
    } else if (overrideModel.startsWith('openai/') || overrideModel.startsWith('gpt')) {
      provider = 'openai'; // Use OpenAI directly
    } else if (overrideModel.startsWith('mistral-') || overrideModel.startsWith('codestral')) {
      provider = 'mistral';
    } else if (overrideModel.startsWith('GLM-') || overrideModel.startsWith('glm-')) {
      provider = 'zai';
    } else if (overrideModel.startsWith('claude')) {
      provider = 'anthropic';
    }
  }

  // Z.AI provider - OpenAI-compatible API
  if (provider === 'zai') {
    const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('Z.AI API key not configured');

    console.log('Using Z.AI with model:', model || 'GLM-4.7');

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'GLM-4.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Z.AI error:', response.status, errorText);
      throw new Error(`Z.AI error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini error:', response.status, errorText);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Gemini V22 provider - direct Google AI API with v22 key
  if (provider === 'geminiV22') {
    const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
    if (!apiKey) throw new Error('Gemini V22 API key not configured');

    const modelName = model || 'gemini-2.5-flash';
    console.log('Using Gemini V22 with model:', modelName);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini V22 error:', response.status, errorText);
      throw new Error(`Gemini V22 error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Mistral provider
  if (provider === 'mistral') {
    const apiKey = settings.mistral_api_key;
    if (!apiKey) throw new Error('Mistral API key not configured');

    const modelName = model || 'mistral-large-latest';
    console.log('Using Mistral with model:', modelName);

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral error:', response.status, errorText);
      throw new Error(`Mistral error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, targetLanguage = 'en' } = await req.json();

    if (!newsId) {
      return new Response(JSON.stringify({ error: 'newsId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Settings not configured in database');
    }

    // Get news article
    const { data: news, error: newsError } = await supabase
      .from('news_rss_items')
      .select('*')
      .eq('id', newsId)
      .single();

    if (newsError || !news) {
      throw new Error('News article not found');
    }

    // Get content to translate
    const title = news.title || '';
    const description = news.description || '';
    const content = news.content || '';
    const keyPoints = Array.isArray(news.key_points) ? news.key_points : [];
    const themes = Array.isArray(news.themes) ? news.themes : [];

    if (!title && !content) {
      throw new Error('No content to translate');
    }

    const langName = targetLanguage === 'en' ? 'English' : 'Polish';

    const systemPrompt = `You are a professional translator. Translate the following Ukrainian news article to ${langName}.

IMPORTANT RULES:
1. Preserve the journalistic style and tone
2. Keep proper nouns and names as appropriate for the target language
3. Maintain the same structure and paragraph breaks
4. Do NOT add commentary or interpretation
5. Translate key_points array items as an array of strings
6. Translate themes array items as an array of strings

RESPONSE FORMAT (JSON):
{
  "title": "translated title",
  "description": "translated description",
  "content": "translated content",
  "key_points": ["translated point 1", "translated point 2", ...],
  "themes": ["translated theme 1", "translated theme 2", ...]
}

Only include fields that have content in the original.`;

    const userPrompt = `Translate this Ukrainian news article to ${langName}:

TITLE:
${title}

DESCRIPTION:
${description}

CONTENT:
${content}

KEY POINTS:
${JSON.stringify(keyPoints)}

THEMES:
${JSON.stringify(themes)}`;

    console.log(`Translating news ${newsId} to ${targetLanguage}`);

    // Call LLM using generic handler
    const rawContent = await callLLM(settings as LLMSettings, systemPrompt, userPrompt);

    // Parse JSON response
    let translated;
    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawContent.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, rawContent];
      const jsonStr = jsonMatch[1] || rawContent;
      translated = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse translation response:', parseError);
      throw new Error('Failed to parse translation');
    }

    // Build update data
    const langSuffix = `_${targetLanguage}`;
    const updateData: Record<string, any> = {};

    if (translated.title) {
      updateData[`title${langSuffix}`] = translated.title;
    }
    if (translated.description) {
      updateData[`description${langSuffix}`] = translated.description;
    }
    if (translated.content) {
      updateData[`content${langSuffix}`] = translated.content;
    }
    if (translated.key_points && Array.isArray(translated.key_points) && translated.key_points.length > 0) {
      updateData[`key_points${langSuffix}`] = translated.key_points;
    }
    if (translated.themes && Array.isArray(translated.themes) && translated.themes.length > 0) {
      updateData[`themes${langSuffix}`] = translated.themes;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No translated content to save');
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('news_rss_items')
      .update(updateData)
      .eq('id', newsId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to save translation: ${updateError.message}`);
    }

    console.log(`Successfully translated news to ${targetLanguage}:`, Object.keys(updateData).join(', '));

    return new Response(
      JSON.stringify({ success: true, translated: updateData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
