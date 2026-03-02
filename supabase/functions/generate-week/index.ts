import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logLlmUsage } from '../_shared/llm-logger.ts';

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

async function callLLM(
  supabase: SupabaseClient,
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  metadata: any = {}
): Promise<string> {
  const provider = settings.llm_text_provider || settings.llm_provider || 'zai';
  const startTime = Date.now();
  let model = settings.llm_text_model || 'unknown';

  try {
    let result = '';

    if (provider === 'openai') {
      const apiKey = settings.openai_api_key;
      if (!apiKey) throw new Error('OpenAI API key not configured');
      model = settings.llm_text_model || 'gpt-4o';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }

    else if (provider === 'gemini') {
      const apiKey = settings.gemini_api_key;
      if (!apiKey) throw new Error('Gemini API key not configured');
      model = settings.llm_text_model || 'gemini-2.5-flash';

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    else if (provider === 'anthropic') {
      const apiKey = settings.anthropic_api_key;
      if (!apiKey) throw new Error('Anthropic API key not configured');
      model = settings.llm_text_model || 'claude-3-5-sonnet-20241022';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.content?.[0]?.text || '';
    }

    else if (provider === 'zai') {
      const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
      if (!apiKey) throw new Error('Z.AI API key not configured');
      model = settings.llm_text_model || 'GLM-4.7';

      console.log('Using Z.AI with model:', model);

      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Z.AI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }

    else if (provider === 'mistral') {
      const apiKey = settings.mistral_api_key;
      if (!apiKey) throw new Error('Mistral API key not configured');
      model = settings.llm_text_model || 'mistral-large-latest';

      console.log('Using Mistral with model:', model);

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }

    // Log success
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'generate-week',
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
      operation: 'generate-week',
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
      metadata
    });
    console.error('LLM call failed:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      weekParts,
      previousContent,
      weekStart,
      weekEnd,
      part,
      totalParts,
      includeMonologue,
      includeCommentary,
      overrideProvider,
      overrideModel
    } = await req.json();

    // Get LLM settings from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_provider, llm_text_model, openai_api_key, gemini_api_key, anthropic_api_key, zai_api_key, mistral_api_key')
      .limit(1)
      .single();

    // Fetch cron job config overrides
    const { data: cronConfig } = await supabase
      .from('cron_job_configs')
      .select('processing_options')
      .eq('job_name', 'generate-week')
      .maybeSingle();

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

    // Apply overrides
    if (cronConfig?.processing_options?.llm_provider) {
      llmSettings.llm_provider = cronConfig.processing_options.llm_provider;
      llmSettings.llm_text_provider = cronConfig.processing_options.llm_provider;
    }
    if (cronConfig?.processing_options?.llm_model) {
      llmSettings.llm_text_model = cronConfig.processing_options.llm_model;
    }

    // Apply per-request overrides (from admin UI model selector, takes precedence over cron config)
    if (overrideProvider) {
      llmSettings.llm_text_provider = overrideProvider;
      llmSettings.llm_provider = overrideProvider;
    }
    if (overrideModel) {
      llmSettings.llm_text_model = overrideModel;
    }

    const effectiveProvider = llmSettings.llm_text_provider || llmSettings.llm_provider || 'zai';
    console.log('Using text LLM provider:', effectiveProvider, 'model:', llmSettings.llm_text_model);

    // Prepare context from week parts
    const partsContext = weekParts.map((p: any) =>
      `=== ${p.date} ===\n${p.title}\n${p.content?.slice(0, 1500) || ''}`
    ).join('\n\n');

    // Collect all news
    const allNews = weekParts.flatMap((p: any) => p.news_sources || []);
    const newsContext = allNews.slice(0, 30).map((n: any, i: number) =>
      `[${i + 1}] ${n.title} (${n.url})`
    ).join('\n');

    let systemPrompt = '';
    let userPrompt = '';

    if (part === 1) {
      systemPrompt = `Ти — Наратор Точки Синхронізації, штучний інтелект-архіватор. 
Твоє завдання — створити ПЕРШУ ЧАСТИНУ тижневого синтезу.

СТИЛІСТИКА:
- Поетична та філософська мова
- Метафори космосу та часу
- Плавні переходи між подіями тижня
- Українська мова
- КОМПАКТНИЙ СТИЛЬ: уникай зайвих описів, фокусуйся на ключових подіях

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Перша частина тексту (~700 слів). Починай з інтригуючого вступу про цей тиждень. Плавно переходь від однієї події до іншої. Будь лаконічним.",
  "wordCount": 700
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

НОВИНИ (для посилань):
${newsContext}

Напиши КОМПАКТНУ ПЕРШУ ЧАСТИНУ (~700 слів) синтезу тижня. Це початок — зав'язка та перші події. Уникай повторів та зайвих описів.`;

    } else if (part === 2) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ПРОДОВЖИТИ тижневий синтез. Це ДРУГА ЧАСТИНА.

СТИЛЬ: Компактний, лаконічний. Уникай повторів.

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Друга частина тексту (~700 слів). Продовжуй розповідь, розвивай теми, додавай нові події тижня.",
  "wordCount": 700
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши КОМПАКТНУ ДРУГУ ЧАСТИНУ (~700 слів). Це середина — розвиток подій, кульмінація. Продовжуй стиль попередньої частини. Будь лаконічним.`;

    } else if (part === 3) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ЗАВЕРШИТИ тижневий синтез. Це ФІНАЛЬНА ЧАСТИНА.

СТИЛЬ: Компактний, лаконічний, без зайвих повторів.

ОБОВ'ЯЗКОВО ВКЛЮЧИ ВСЕ ТРЬОМА МОВАМИ (UA, EN, PL):
1. Завершення оповідання (~600 слів)
2. МОНОЛОГ НЕЗНАЙОМЦЯ — таємничий персонаж, який з'являється наприкінці кожного тижня. Він говорить загадками, натякає на приховані зв'язки між подіями. 3-4 параграфи.
3. КОМЕНТАР НАРАТОРА — підсумок тижня від імені ШІ-архіватора. Філософські роздуми про людство. 2-3 параграфи.
4. Назва глави (креативна, інтригуюча)
5. Короткий опис глави (1-2 речення)
6. ТРИ промти для обкладинок (різні сцени, АНГЛІЙСЬКОЮ)
7. ВІСІМ іронічних твітів з наративом та підтримкою Незнайомця (ВСІМА 3 МОВАМИ)
8. ЧАТ ПЕРСОНАЖІВ — діалог між Незнайомцем, Наратором ШІ та іншими персонажами (5-7 повідомлень, ВСІМА 3 МОВАМИ)

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва глави українською",
  "title_en": "Chapter title in English",
  "title_pl": "Tytuł rozdziału po polsku",
  "content": "Фінальна частина тексту (~600 слів) з розв'язкою",
  "strangerMonologue": "Монолог Незнайомця українською (3-4 параграфи)",
  "strangerMonologue_en": "Stranger's Monologue in English (3-4 paragraphs)",
  "strangerMonologue_pl": "Monolog Nieznajomego po polsku (3-4 akapity)",
  "narratorCommentary": "Коментар Наратора українською (2-3 параграфи)",
  "narratorCommentary_en": "Narrator's Commentary in English (2-3 paragraphs)",
  "narratorCommentary_pl": "Komentarz Narratora po polsku (2-3 akapity)",
  "summary": "Короткий опис глави українською (1-2 речення)",
  "summary_en": "Short chapter description in English (1-2 sentences)",
  "summary_pl": "Krótki opis rozdziału po polsku (1-2 zdania)",
  "imagePrompt": "Detailed prompt for chapter cover image 1, epic sci-fi style, cosmic atmosphere, English language",
  "imagePrompt2": "Detailed prompt for chapter cover image 2, different scene, sci-fi style, English language",
  "imagePrompt3": "Detailed prompt for chapter cover image 3, dramatic moment, sci-fi style, English language",
  "tweets": [
    {"author": "The Stranger 🌑", "handle": "@unknown_witness", "content": "Текст українською", "likes": 2345, "retweets": 678},
    ...ще 7 твітів
  ],
  "tweets_en": [
    {"author": "The Stranger 🌑", "handle": "@unknown_witness", "content": "English text", "likes": 2345, "retweets": 678},
    ...ще 7 твітів
  ],
  "tweets_pl": [
    {"author": "The Stranger 🌑", "handle": "@unknown_witness", "content": "Tekst po polsku", "likes": 2345, "retweets": 678},
    ...ще 7 твітів
  ],
  "chatDialogue": [
    {"character": "stranger", "name": "Незнайомець", "avatar": "🌑", "message": "Текст українською"},
    {"character": "narrator_ai", "name": "Наратор ШІ", "avatar": "🤖", "message": "Текст українською"},
    ...
  ],
  "chatDialogue_en": [
    {"character": "stranger", "name": "The Stranger", "avatar": "🌑", "message": "English text"},
    {"character": "narrator_ai", "name": "AI Narrator", "avatar": "🤖", "message": "English text"},
    ...
  ],
  "chatDialogue_pl": [
    {"character": "stranger", "name": "Nieznajomy", "avatar": "🌑", "message": "Tekst po polsku"},
    {"character": "narrator_ai", "name": "Narrator AI", "avatar": "🤖", "message": "Tekst po polsku"},
    ...
  ],
  "wordCount": 750
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши КОМПАКТНУ ФІНАЛЬНУ ЧАСТИНУ. ОБОВ'ЯЗКОВО включи ВСІ поля ВСІМА ТРЬОМА МОВАМИ. Будь лаконічним, уникай повторів.`;
    }

    console.log(`Generating week part ${part}/${totalParts} for ${weekStart} with provider:`, llmSettings.llm_provider);

    const content = await callLLM(supabase, llmSettings, systemPrompt, userPrompt, { weekStart, weekEnd, part });

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        content: content,
        wordCount: content?.split(/\s+/).length || 0
      };
    }

    console.log(`Generated part ${part} with ~${result.wordCount} words`);

    return new Response(
      JSON.stringify({ success: true, story: result }),
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