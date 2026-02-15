import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  anthropic_api_key: string | null;
  zai_api_key: string | null;
  mistral_api_key: string | null;
}

async function translateWithLLM(settings: LLMSettings, title: string, content: string): Promise<any> {
  const provider = settings.llm_text_provider || settings.llm_provider || 'zai';
  const model = settings.llm_text_model || 'google/gemini-3-flash-preview';

  const prompt = `Translate the following news content to English and Polish. 
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "title_en": "English title",
  "title_pl": "Polish title",
  "content_en": "English content",
  "content_pl": "Polish content"
}

Original title (Ukrainian): ${title}

Original content (Ukrainian): ${content}

Important:
- Maintain the journalistic style
- Keep the translations accurate and natural
- Return ONLY the JSON object, nothing else`;

  // Auto-detect provider from model prefix
  let effectiveProvider = provider;
  if (model.startsWith('google/') || model.startsWith('gemini')) {
    effectiveProvider = 'gemini';
  } else if (model.startsWith('openai/') || model.startsWith('gpt')) {
    effectiveProvider = 'openai';
  } else if (model.startsWith('mistral-')) {
    effectiveProvider = 'mistral';
  } else if (model.startsWith('GLM-') || model.startsWith('glm-')) {
    effectiveProvider = 'zai';
  } else if (model.startsWith('claude')) {
    effectiveProvider = 'anthropic';
  }

  let llmResponse = '';

  if (effectiveProvider === 'zai') {
    const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('Z.AI API key not configured');

    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'GLM-4.7',
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`Z.AI error: ${response.status}`);
    const data = await response.json();
    llmResponse = data.choices?.[0]?.message?.content || '';
  }
  else if (effectiveProvider === 'openai') {
    const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    llmResponse = data.choices?.[0]?.message?.content || '';
  }
  else if (effectiveProvider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const modelName = model.replace('google/', '');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    llmResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  else {
    throw new Error(`Provider ${effectiveProvider} not implemented in translate-flash-news`);
  }

  // Parse JSON from response
  try {
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse translations:', parseError);
    return {
      title_en: '',
      title_pl: '',
      content_en: '',
      content_pl: ''
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, content } = await req.json();

    if (!title && !content) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title or content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_provider, llm_text_model, openai_api_key, gemini_api_key, zai_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'zai',
      llm_text_provider: null,
      llm_text_model: 'GLM-4.7',
      openai_api_key: null,
      gemini_api_key: null,
      anthropic_api_key: null,
      zai_api_key: null,
      mistral_api_key: null
    };

    console.log('Translating content to EN and PL...');

    const translations = await translateWithLLM(llmSettings, title, content);

    console.log('Translation successful');

    return new Response(
      JSON.stringify({
        success: true,
        translations: {
          title_en: translations.title_en || '',
          title_pl: translations.title_pl || '',
          content_en: translations.content_en || '',
          content_pl: translations.content_pl || ''
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error translating:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to translate'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
