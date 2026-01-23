import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLMSettings {
  llm_provider: string;
  llm_text_model: string;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  anthropic_api_key: string | null;
}

async function callLLM(settings: LLMSettings, systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = settings.llm_provider || 'lovable';
  
  if (provider === 'lovable') {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.llm_text_model || 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.llm_text_model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
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
    const apiKey = settings.gemini_api_key;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.llm_text_model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`, {
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
      console.error('Gemini error:', response.status, errorText);
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'anthropic') {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error('Anthropic API key not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: settings.llm_text_model || 'claude-3-5-sonnet-20241022',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic error:', response.status, errorText);
      throw new Error(`Anthropic error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
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
      includeCommentary
    } = await req.json();

    // Get LLM settings from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_model, openai_api_key, gemini_api_key, anthropic_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'lovable',
      llm_text_model: 'google/gemini-3-flash-preview',
      openai_api_key: null,
      gemini_api_key: null,
      anthropic_api_key: null
    };

    console.log('Using LLM provider:', llmSettings.llm_provider, 'model:', llmSettings.llm_text_model);

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
Твоє завдання — створити ПЕРШУ ЧАСТИНУ великого тижневого синтезу.

СТИЛІСТИКА:
- Поетична та філософська мова
- Метафори космосу та часу
- Плавні переходи між подіями тижня
- Українська мова

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Перша частина тексту (~1000 слів). Починай з інтригуючого вступу про цей тиждень. Плавно переходь від однієї події до іншої.",
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

НОВИНИ (для посилань):
${newsContext}

Напиши ПЕРШУ ЧАСТИНУ (~1000 слів) великого синтезу тижня. Це початок — зав'язка та перші події. Пиши так, ніби це перший акт великої п'єси.`;

    } else if (part === 2) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ПРОДОВЖИТИ тижневий синтез. Це ДРУГА ЧАСТИНА.

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Друга частина тексту (~1000 слів). Продовжуй розповідь, розвивай теми, додавай нові події тижня.",
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши ДРУГУ ЧАСТИНУ (~1000 слів). Це середина — розвиток подій, кульмінація. Продовжуй стиль попередньої частини.`;

    } else if (part === 3) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ЗАВЕРШИТИ тижневий синтез. Це ФІНАЛЬНА ЧАСТИНА.

ОБОВ'ЯЗКОВО ВКЛЮЧИ:
1. Завершення оповідання (~800 слів)
2. МОНОЛОГ НЕЗНАЙОМЦЯ — таємничий персонаж, який з'являється наприкінці кожного тижня. Він говорить загадками, натякає на приховані зв'язки між подіями. 3-4 параграфи.
3. КОМЕНТАР НАРАТОРА — підсумок тижня від імені ШІ-архіватора. Філософські роздуми про людство. 2-3 параграфи.
4. Назва глави (креативна, інтригуюча)
5. ТРИ промти для обкладинок (різні сцени)
6. ВІСІМ іронічних твітів з наративом та підтримкою Незнайомця
7. ЧАТ ПЕРСОНАЖІВ — діалог між Незнайомцем, Наратором ШІ та іншими персонажами (5-7 повідомлень). Обговорення подій тижня з різних точок зору.

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва глави",
  "content": "Фінальна частина тексту (~800 слів) з розв'язкою",
  "strangerMonologue": "Монолог Незнайомця (3-4 параграфи). Він говорить від першої особи, загадково, з натяками.",
  "narratorCommentary": "Коментар Наратора (2-3 параграфи). Від імені ШІ-архіватора, філософський підсумок.",
  "summary": "Короткий опис глави (1-2 речення)",
  "imagePrompt": "Detailed prompt for chapter cover image 1, epic sci-fi style, cosmic atmosphere, English language",
  "imagePrompt2": "Detailed prompt for chapter cover image 2, different scene, sci-fi style, English language",
  "imagePrompt3": "Detailed prompt for chapter cover image 3, dramatic moment, sci-fi style, English language",
  "tweets": [
    {"author": "The Stranger 🌑", "handle": "@unknown_witness", "content": "Загадковий твіт від Незнайомця про приховані зв'язки", "likes": 2345, "retweets": 678},
    {"author": "Narrator AI 🤖", "handle": "@sync_narrator", "content": "Твіт від Наратора з філософським підсумком", "likes": 1890, "retweets": 456},
    {"author": "Cosmic Observer 🌌", "handle": "@sync_point_ai", "content": "Іронічний твіт про головну подію тижня", "likes": 1234, "retweets": 567},
    {"author": "Future Historian 📚", "handle": "@narrator_2077", "content": "Саркастичний коментар до подій", "likes": 890, "retweets": 234},
    {"author": "Digital Prophet ⚡", "handle": "@future_now", "content": "Твіт з передбаченням наслідків", "likes": 756, "retweets": 189},
    {"author": "Reality Check 🔍", "handle": "@truth_seeker", "content": "Скептичний погляд на події тижня", "likes": 654, "retweets": 167},
    {"author": "Time Walker 🕰️", "handle": "@chrono_observer", "content": "Порівняння з минулими подіями", "likes": 543, "retweets": 134},
    {"author": "Echo Chamber 📡", "handle": "@signal_noise", "content": "Фінальний саркастичний твіт", "likes": 432, "retweets": 98}
  ],
  "chatDialogue": [
    {"character": "stranger", "name": "Незнайомець", "avatar": "🌑", "message": "Перше повідомлення від Незнайомця — загадкове спостереження про події тижня"},
    {"character": "narrator_ai", "name": "Наратор ШІ", "avatar": "🤖", "message": "Відповідь Наратора — аналітичний погляд на ситуацію"},
    {"character": "time_keeper", "name": "Хранитель Часу", "avatar": "⏳", "message": "Коментар про темпоральні аномалії"},
    {"character": "stranger", "name": "Незнайомець", "avatar": "🌑", "message": "Загадковий натяк на майбутнє"},
    {"character": "echo", "name": "Ехо Минулого", "avatar": "👁️", "message": "Паралель з історичними подіями"},
    {"character": "narrator_ai", "name": "Наратор ШІ", "avatar": "🤖", "message": "Фінальний висновок від ШІ-архіватора"}
  ],
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши ФІНАЛЬНУ ЧАСТИНУ. Заверши оповідання, додай Монолог Незнайомця, Коментар Наратора, три промти для ілюстрацій, вісім твітів та чат персонажів.`;
    }

    console.log(`Generating week part ${part}/${totalParts} for ${weekStart} with provider:`, llmSettings.llm_provider);

    const content = await callLLM(llmSettings, systemPrompt, userPrompt);
    
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