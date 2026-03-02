import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logLlmUsage } from '../_shared/llm-logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function callLLM(
  supabase: SupabaseClient,
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  overrideModel?: string,
  metadata: any = {}
): Promise<string> {
  const model = overrideModel || settings.llm_text_model || 'google/gemini-3-flash-preview';
  const startTime = Date.now();

  let provider = settings.llm_text_provider || settings.llm_provider || 'zai';

  if (overrideModel) {
    if (overrideModel.startsWith('google/') || overrideModel.startsWith('gemini')) {
      provider = settings.gemini_api_key ? 'gemini' : 'lovable';
    } else if (overrideModel.startsWith('openai/') || overrideModel.startsWith('gpt')) {
      provider = settings.openai_api_key ? 'openai' : 'lovable';
    } else if (overrideModel.startsWith('mistral-') || overrideModel.startsWith('codestral')) {
      provider = 'mistral';
    } else if (overrideModel.startsWith('GLM-') || overrideModel.startsWith('glm-')) {
      provider = 'zai';
    } else if (overrideModel.startsWith('claude')) {
      provider = 'anthropic';
    }
  }

  try {
    let result = '';

    if (provider === 'zai') {
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
    else if (provider === 'lovable') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lovable AI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }
    else if (provider === 'openai') {
      const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) throw new Error('OpenAI API key not configured');

      // Strip "openai/" prefix if present to get the actual model name
      const modelName = model ? model.replace('openai/', '') : 'gpt-4o';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        throw new Error(`OpenAI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }
    else if (provider === 'gemini') {
      const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('Gemini API key not configured');

      // Strip "google/" prefix if present
      const modelName = model ? model.replace('google/', '') : 'gemini-1.5-pro';

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    else if (provider === 'geminiV22') {
      const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
      if (!apiKey) throw new Error('Gemini V22 API key not configured');

      const modelName = model || 'gemini-2.5-flash';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini V22 error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    else if (provider === 'mistral') {
      const apiKey = settings.mistral_api_key;
      if (!apiKey) throw new Error('Mistral API key not configured');

      const modelName = model || 'mistral-large-latest';
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
        throw new Error(`Mistral error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'score-news-source',
      duration_ms: Date.now() - startTime,
      success: true,
      metadata
    });

    return result;

  } catch (error) {
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'score-news-source',
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
      metadata
    });
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { newsId, news_item_id, model } = await req.json();

    const actualNewsId = newsId || news_item_id;

    if (!actualNewsId) {
      return new Response(JSON.stringify({ error: "newsId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) throw new Error('Settings not found');

    const { data: newsItem, error: fetchError } = await supabase
      .from("news_rss_items")
      .select("id, url, title, original_content, content, description")
      .eq("id", actualNewsId)
      .single();

    if (fetchError || !newsItem) {
      return new Response(JSON.stringify({ error: "News item not found", details: fetchError }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textToAnalyze = newsItem.original_content || newsItem.content || newsItem.description;

    const systemPrompt = `Ти — News Scoring Engine. Оціни новину (англійською мовою).
Завдання: (1) витягни ключові claims (цифри/імена/дати/події), (2) підтверди кожен claim мінімум 2 незалежними джерелами або 1 первинним, (3) порахуй скоринг 0–100, (4) згенеруй HTML+CSS віджет (без JS) з діаграмами.

Скоринг:
- reliability: якість джерела + узгодженість + конкретика.
- importance: масштаб/вплив (суспільство/ринок/закони/великі суми/відомі особи).
- volatility_risk (менше = краще): ризик “плаваючих” даних/методології.
overall = round(reliability*0.45 + importance*0.30 + corroboration*0.15 + scope_clarity*0.10)
Пороги decision: <70 Low, 70–79 Normal, 80–89 Highlight, 90–94 Highlight+, 95+ Push.
Статус: Verified / Partially Verified / Unverified. Confidence ≈ reliability.

Вивід СТРОГО 2 частини (Спочатку JSON, потім HTML код відділені маркерами).
Використовуй такий формат відповіді:
---JSON_START---
{
 "url":"", "title":"", "claimed_source":"", "published_at":null,
 "verification_status":"", "confidence":0,
 "scores":{"overall":0,"reliability":0,"importance":0,"corroboration":0,"scope_clarity":0,"volatility_risk":0},
 "key_claims":[{"claim":"","verdict":"confirmed|partial|unclear|contradicted","notes":""}],
 "evidence":[{"source_name":"","url":"","strength":"primary|high|medium|low"}],
 "caveats":[]
}
---JSON_END---
---HTML_START---
<!-- Твій HTML+CSS (без JS):
- кільце Overall (conic-gradient + --value)
- bar’и Reliability, Importance + 4–5 підметрик
- decision meter з 4 сегментами (Low/Normal/Highlight/Push) + needle (позиція від --value)
- бейджі: verification_status, confidence, last_updated (сьогоднішня дата), claimed_source
Важливо: Використовуй темну тему (dark mode), яка підходить для сайту з фоном #0c1222. Текст має бути світлим, картки - напівпрозорими темними з тонкими рамками (border: 1px solid rgba(255,255,255,0.1)).
Без зовнішніх бібліотек, тільки інлайн стилі або внутрішній <style>.
-->
---HTML_END---`;

    const userPrompt = `URL: ${newsItem.url}
Title: ${newsItem.title}

Content to evaluate:
${textToAnalyze ? textToAnalyze.substring(0, 10000) : "No content provided."}`;

    const rawResponse = await callLLM(
      supabase,
      settings,
      systemPrompt,
      userPrompt,
      model,
      { newsId: actualNewsId, url: newsItem.url }
    );

    let jsonResult = {};
    let htmlResult = "";

    try {
      const jsonMatch = rawResponse.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
      if (jsonMatch && jsonMatch[1]) {
        jsonResult = JSON.parse(jsonMatch[1].trim());
      }

      const htmlMatch = rawResponse.match(/---HTML_START---([\s\S]*?)---HTML_END---/);
      if (htmlMatch && htmlMatch[1]) {
        htmlResult = htmlMatch[1].trim();
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response format", parseError);
      return new Response(JSON.stringify({ error: "Failed to parse LLM response", raw: rawResponse }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceScoring = {
      json: jsonResult,
      html: htmlResult
    };

    const { error: updateError } = await supabase
      .from("news_rss_items")
      .update({ source_scoring: sourceScoring })
      .eq("id", actualNewsId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, scoring: sourceScoring }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in score-news-source:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
