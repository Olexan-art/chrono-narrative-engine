import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface TranslationResult {
  title_hi: string;
  title_ta: string;
  title_te: string;
  title_bn: string;
  description_hi: string;
  description_ta: string;
  description_te: string;
  description_bn: string;
  content_hi?: string;
  content_ta?: string;
  content_te?: string;
  content_bn?: string;
}

async function translateWithLLM(settings: LLMSettings, text: string, targetLanguages: string[]): Promise<Record<string, string>> {
  const provider = settings.llm_text_provider || settings.llm_provider || 'zai';
  const model = settings.llm_text_model || 'google/gemini-3-flash-preview';

  const languageNames: Record<string, string> = {
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    bn: 'Bengali'
  };

  const prompt = `Translate the following English text into these Indian languages: ${targetLanguages.map(l => languageNames[l]).join(', ')}.

Text to translate:
"${text}"

Provide ONLY the translations in this exact JSON format, no explanation:
{
${targetLanguages.map(l => `  "${l}": "translated text in ${languageNames[l]}"`).join(',\n')}
}`;

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

  let content = '';

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
          { role: 'system', content: 'You are a professional translator specializing in Indian languages. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`Z.AI error: ${response.status}`);
    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '';
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
          { role: 'system', content: 'You are a professional translator specializing in Indian languages. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '';
  }
  else if (effectiveProvider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const modelName = model.replace('google/', '');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are a professional translator specializing in Indian languages. Always respond with valid JSON only.\n\n${prompt}` }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  else {
    throw new Error(`Provider ${effectiveProvider} not implemented in translate-indian-news`);
  }

  // Extract JSON from response if needed (redundant if response_format worked, but safe)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON found in response:', content);
    throw new Error('Invalid translation response');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse translation JSON:', jsonMatch[0]);
    throw new Error('Failed to parse translation');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const { action, newsItemId, countryCode } = await req.json();

    // Action: translate a specific news item
    if (action === 'translate_item' && newsItemId) {
      const { data: item, error } = await supabase
        .from('news_rss_items')
        .select('id, title, description, content')
        .eq('id', newsItemId)
        .single();

      if (error || !item) {
        return new Response(
          JSON.stringify({ success: false, error: 'News item not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const targetLanguages = ['hi', 'ta', 'te', 'bn'];
      const translations: Partial<TranslationResult> = {};

      // Translate title
      if (item.title) {
        console.log('Translating title:', item.title.slice(0, 50));
        const titleTranslations = await translateWithLLM(llmSettings, item.title, targetLanguages);
        for (const lang of targetLanguages) {
          (translations as any)[`title_${lang}`] = titleTranslations[lang];
        }
      }

      // Translate description
      if (item.description) {
        console.log('Translating description');
        const descTranslations = await translateWithLLM(llmSettings, item.description, targetLanguages);
        for (const lang of targetLanguages) {
          (translations as any)[`description_${lang}`] = descTranslations[lang];
        }
      }

      // Translate content (if short enough)
      if (item.content && item.content.length < 2000) {
        console.log('Translating content');
        const contentTranslations = await translateWithLLM(llmSettings, item.content, targetLanguages);
        for (const lang of targetLanguages) {
          (translations as any)[`content_${lang}`] = contentTranslations[lang];
        }
      }

      // Save translations
      const { error: updateError } = await supabase
        .from('news_rss_items')
        .update(translations)
        .eq('id', newsItemId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, translations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: translate all news for a country (India)
    if (action === 'translate_country') {
      // Find India country
      const code = (countryCode || 'in').toUpperCase();
      const { data: indiaCountry } = await supabase
        .from('news_countries')
        .select('id')
        .eq('code', code)
        .single();

      if (!indiaCountry) {
        return new Response(
          JSON.stringify({ success: false, error: 'Country not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Get untranslated news items
      const { data: items } = await supabase
        .from('news_rss_items')
        .select('id, title, description, content')
        .eq('country_id', indiaCountry.id)
        .is('title_hi', null)
        .limit(10);

      if (!items || items.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No items to translate', translated: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let translatedCount = 0;
      const targetLanguages = ['hi', 'ta', 'te', 'bn'];

      for (const item of items) {
        try {
          const translations: Record<string, string> = {};

          if (item.title) {
            const titleTranslations = await translateWithLLM(llmSettings, item.title, targetLanguages);
            for (const lang of targetLanguages) {
              translations[`title_${lang}`] = titleTranslations[lang];
            }
          }

          if (item.description) {
            const descTranslations = await translateWithLLM(llmSettings, item.description, targetLanguages);
            for (const lang of targetLanguages) {
              translations[`description_${lang}`] = descTranslations[lang];
            }
          }

          await supabase
            .from('news_rss_items')
            .update(translations)
            .eq('id', item.id);

          translatedCount++;
          console.log(`Translated item ${translatedCount}/${items.length}`);
        } catch (e) {
          console.error('Error translating item:', item.id, e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, translated: translatedCount, total: items.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
