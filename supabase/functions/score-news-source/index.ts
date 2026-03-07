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
  metadata: any = {},
  overrideProvider?: string
): Promise<string> {
  const model = overrideModel || settings.llm_text_model || 'google/gemini-3-flash-preview';
  const startTime = Date.now();

  let provider = overrideProvider || settings.llm_text_provider || settings.llm_provider || 'zai';

  if (!overrideProvider && overrideModel) {
    const m = overrideModel.toLowerCase();
    if (m.includes('deepseek'))                                        provider = 'deepseek';
    else if (m.startsWith('google/') || m.startsWith('gemini'))        provider = 'gemini';
    else if (m.startsWith('openai/') || m.startsWith('gpt'))           provider = 'openai';
    else if (m.startsWith('mistral-') || m.startsWith('codestral'))    provider = 'mistral';
    else if (m.startsWith('glm-'))                                      provider = 'zai';
    else if (m.startsWith('claude'))                                    provider = 'anthropic';
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
      throw new Error('Lovable AI is not supported for this operation. Please configure OpenAI or Gemini.');
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
    else if (provider === 'deepseek') {
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!apiKey) throw new Error('DeepSeek API key not configured');

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
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
    const { newsId, news_item_id, model, provider: explicitProvider, auto_select } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) throw new Error('Settings not found');

    // Check if source scoring is enabled globally
    if (settings.source_scoring_enabled === false) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Source scoring is disabled in settings',
        skipped: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine provider and check if it's enabled
    const requestedProvider = explicitProvider || (model ? (
      model.toLowerCase().includes('glm') ? 'zai' :
      model.toLowerCase().includes('gemini') ? 'gemini' :
      model.toLowerCase().includes('deepseek') ? 'deepseek' :
      model.toLowerCase().includes('gpt') ? 'openai' :
      null
    ) : null);

    if (requestedProvider) {
      const providerEnabledField = `source_scoring_${requestedProvider}_enabled`;
      if (settings[providerEnabledField] === false) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Source scoring with ${requestedProvider.toUpperCase()} is disabled in settings`,
          skipped: true 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let newsItem: any;
    let fetchError: any;
    let actualNewsId = newsId || news_item_id;

    // Auto-select mode: find latest news with full retelling and analysis
    if (!actualNewsId && auto_select) {
      // First, check how many scorings were created in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count } = await supabase
        .from("news_rss_items")
        .select("id", { count: 'exact', head: true })
        .not('source_scoring', 'is', null)
        .gte('source_scoring_at', oneDayAgo);
      
      console.log(`Scorings in last 24h: ${count}/20`);
      
      // If we already scored 20 news items today, skip
      if (count !== null && count >= 20) {
        return new Response(JSON.stringify({ 
          message: "Daily limit reached",
          scorings_today: count,
          limit: 20
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Select the freshest news items successfully processed by deep-analyst cron:
      // 1. Has Ukrainian retelling (content IS NOT NULL)
      // 2. Has deep analysis from deep-analyst (news_analysis IS NOT NULL)
      // 3. Hasn't been scored yet (source_scoring IS NULL)
      // 4. Published in last 24 hours (fresh news only)
      // 5. Ordered by llm_processed_at to get the most recently analyzed news
      // 6. Daily limit: max 20 scorings per 24h
      
      const { data, error } = await supabase
        .from("news_rss_items")
        .select("id, url, title, original_content, content, description, slug, country:news_countries(code)")
        .not('content', 'is', null) // has Ukrainian retelling
        .not('news_analysis', 'is', null) // has analysis
        .is('source_scoring', null) // hasn't been scored yet
        .gte('published_at', oneDayAgo) // only news from last 24 hours
        .order('llm_processed_at', { ascending: false })
        .limit(1)
        .single();
      
      newsItem = data;
      fetchError = error;
      if (data) actualNewsId = data.id; // Update actualNewsId with selected news
    } else {
      // Manual mode: fetch by ID
      if (!actualNewsId) {
        return new Response(JSON.stringify({ error: "newsId is required when auto_select is not enabled" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("news_rss_items")
        .select("id, url, title, original_content, content, description, slug, country:news_countries(code)")
        .eq("id", actualNewsId)
        .single();
      
      newsItem = data;
      fetchError = error;
    }

    if (fetchError || !newsItem) {
      return new Response(JSON.stringify({ error: "News item not found", details: fetchError }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const textToAnalyze = newsItem.original_content || newsItem.content || newsItem.description;

    const systemPrompt = `Ти — News Scoring Engine. Оціни новину (англійською мовою).
Завдання: (1) витягни ключові claims (цифри/імена/дати/події), (2) підтверди кожен claim мінімум 2 незалежними джерелами або 1 первинним, (3) порахуй скоринг 0–100.

Скоринг:
- reliability: якість джерела + узгодженість + конкретика.
- importance: масштаб/вплив (суспільство/ринок/закони/великі суми/відомі особи).
- volatility_risk (менше = краще): ризик “плаваючих” даних/методології.
overall = round(reliability*0.45 + importance*0.30 + corroboration*0.15 + scope_clarity*0.10)
Пороги decision: <70 Low, 70–79 Normal, 80–89 Highlight, 90–94 Highlight+, 95+ Push.
Статус: Verified / Partially Verified / Unverified. Confidence ≈ reliability.

Вивід СТРОГО 1 частина (Тільки JSON відділений маркерами).
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
---JSON_END---`;

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
      { newsId: actualNewsId, url: newsItem.url },
      explicitProvider ? String(explicitProvider).trim() : undefined
    );

    let jsonResult: any = {};
    let htmlResult = "";

    try {
      const jsonMatch = rawResponse.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
      if (jsonMatch && jsonMatch[1]) {
        jsonResult = JSON.parse(jsonMatch[1].trim());
        htmlResult = generateScoringHTML(jsonResult);
      } else {
        // Fallback: try to find a JSON block if markers were missing
        const fallbackMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/);
        if (fallbackMatch && fallbackMatch[1]) {
          jsonResult = JSON.parse(fallbackMatch[1].trim());
          htmlResult = generateScoringHTML(jsonResult);
        } else {
          // Last resort: try to parse the entire response as JSON
          jsonResult = JSON.parse(rawResponse.trim());
          htmlResult = generateScoringHTML(jsonResult);
        }
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
      .update({ 
        source_scoring: sourceScoring,
        source_scoring_at: new Date().toISOString()
      })
      .eq("id", actualNewsId);

    if (updateError) {
      throw updateError;
    }

    // Refresh cache for search bots to make scoring visible
    try {
      const itemSlug = (newsItem as any).slug;
      const itemCountry = ((newsItem as any).country?.code || 'us').toLowerCase();
      if (itemSlug) {
        const adminPass = Deno.env.get('ADMIN_PASSWORD');
        const cacheUrl = `${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(`/news/${itemCountry}/${itemSlug}`)}&password=${adminPass}`;
        
        console.log(`Refreshing cache for: /news/${itemCountry}/${itemSlug}`);
        const cacheResponse = await fetch(cacheUrl, { 
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}` } 
        });
        
        if (cacheResponse.ok) {
          const cacheResult = await cacheResponse.json();
          console.log('Cache refresh successful:', cacheResult);
        } else {
          console.error('Cache refresh failed:', cacheResponse.status, await cacheResponse.text());
        }
      }
    } catch (cacheError) {
      // Non-critical - don't fail the whole operation if cache refresh fails
      console.error('Cache refresh error:', cacheError);
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

function generateScoringHTML(data: any): string {
  if (!data || !data.scores) return "<div class='p-4 border rounded'>Data format error</div>";

  const scores = data.scores || {};
  const overall = scores.overall || parseInt(scores.overall_score) || 0;

  const getDecision = (score: number) => {
    if (score < 70) return "Low";
    if (score < 80) return "Normal";
    if (score < 90) return "Highlight";
    if (score < 95) return "Highlight+";
    return "Push";
  };

  const decisionColor = overall < 70 ? "hsl(var(--destructive))" : overall < 80 ? "hsl(var(--chart-3))" : overall < 90 ? "hsl(var(--chart-4))" : overall < 95 ? "hsl(var(--chart-2))" : "hsl(var(--primary))";

  const getVerdictBadge = (verdict: string) => {
    switch (verdict?.toLowerCase()) {
      case 'confirmed': return `<span style="background:hsl(var(--chart-2)/0.2);color:hsl(var(--chart-2));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Confirmed</span>`;
      case 'partial': return `<span style="background:hsl(var(--chart-4)/0.2);color:hsl(var(--chart-4));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Partial</span>`;
      case 'contradicted': return `<span style="background:hsl(var(--destructive)/0.2);color:hsl(var(--destructive));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Contradicted</span>`;
      default: return `<span style="background:hsl(var(--muted));color:hsl(var(--muted-foreground));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Unclear</span>`;
    }
  };

  const getStrengthBadge = (strength: string) => {
    switch (strength?.toLowerCase()) {
      case 'primary': return `<span style="background:hsl(var(--chart-2)/0.2);color:hsl(var(--chart-2));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Primary</span>`;
      case 'high': return `<span style="background:hsl(var(--chart-4)/0.2);color:hsl(var(--chart-4));padding:2px 6px;border-radius:4px;font-size:0.75rem;">High</span>`;
      case 'low': return `<span style="background:hsl(var(--destructive)/0.2);color:hsl(var(--destructive));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Low</span>`;
      default: return `<span style="background:hsl(var(--muted));color:hsl(var(--muted-foreground));padding:2px 6px;border-radius:4px;font-size:0.75rem;">Medium</span>`;
    }
  };

  const renderBar = (label: string, value: number, isInverse: boolean = false) => {
    const val = value || 0;
    const color = isInverse ? (val < 30 ? "hsl(var(--chart-2))" : val < 70 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))")
      : (val >= 70 ? "hsl(var(--chart-2))" : val >= 50 ? "hsl(var(--chart-4))" : "hsl(var(--destructive))");
    return `
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 4px;">
          <span>${label}</span>
          <span style="font-weight: bold;">${val}/100</span>
        </div>
        <div style="width: 100%; height: 8px; background: hsl(var(--muted)/0.3); border-radius: 4px; overflow: hidden; border: 1px solid hsl(var(--border));">
          <div style="width: ${val}%; height: 100%; background: ${color};"></div>
        </div>
      </div>
    `;
  };

  const claimsHtml = (data.key_claims || []).map((c: any) => `
    <div style="margin-bottom: 8px; padding: 12px; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)/0.1); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
        <strong style="font-size: 0.9rem;">${escapeHtml(c.claim || '')}</strong>
        ${getVerdictBadge(c.verdict || 'unclear')}
      </div>
      ${c.notes ? `<p style="font-size: 0.8rem; color: hsl(var(--muted-foreground)); margin: 0;">${escapeHtml(c.notes)}</p>` : ''}
    </div>
  `).join('');

  const evidenceHtml = (data.evidence || []).map((e: any) => `
    <li style="font-size: 0.85rem; margin-bottom: 6px; padding: 8px; border: 1px solid hsl(var(--border)); border-radius: 6px; list-style-type: none; background: hsl(var(--background));">
      ${getStrengthBadge(e.strength || 'medium')} 
      <strong style="margin: 0 4px;">${escapeHtml(e.source_name || 'Unknown source')}</strong>
      ${e.url ? `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener noreferrer" style="color: hsl(var(--primary)); text-decoration: none; font-size: 0.8rem;">[Link]</a>` : ''}
    </li>
  `).join('');

  return `
    <div style="font-family: inherit; color: inherit; padding: 20px; border: 1px solid hsl(var(--border)); border-radius: 12px; background: linear-gradient(to bottom right, hsl(var(--card)), hsl(var(--muted)/0.1)); min-width: 300px; width: 100%;">
      
      <!-- Header / Badges -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid hsl(var(--border)); padding-bottom: 16px;">
        <div style="background: hsl(var(--primary)/0.1); color: hsl(var(--primary)); padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; font-weight: 600; border: 1px solid hsl(var(--primary)/0.2);">
          Status: ${escapeHtml(data.verification_status || 'Unknown')}
        </div>
        <div style="background: hsl(var(--accent)/0.1); color: hsl(var(--accent-foreground)); padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; font-weight: 500; border: 1px solid hsl(var(--border));">
          Confidence: ${data.confidence || 0}%
        </div>
        ${data.claimed_source ? `
        <div style="background: hsl(var(--muted)/0.5); color: hsl(var(--muted-foreground)); padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; font-weight: 500; border: 1px solid hsl(var(--border));">
          Source: ${escapeHtml(data.claimed_source)}
        </div>
        ` : ''}
      </div>

      <!-- Grid for Scores & Decision -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <!-- Overall Score Ring & Decision -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: 12px; box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.02);">
          <h3 style="font-size: 1rem; font-weight: 600; margin: 0 0 16px 0; color: hsl(var(--foreground));">Source Scoring</h3>
          
          <div style="position: relative; width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(${decisionColor} ${overall}%, hsl(var(--muted)) 0); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="width: 104px; height: 104px; border-radius: 50%; background: hsl(var(--card)); display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <span style="font-size: 2.25rem; font-weight: 800; line-height: 1; color: hsl(var(--foreground));">${overall}</span>
              <span style="font-size: 0.75rem; color: hsl(var(--muted-foreground)); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">Overall</span>
            </div>
          </div>
          
          <div style="text-align: center; width: 100%;">
            <div style="font-size: 0.875rem; color: hsl(var(--muted-foreground)); margin-bottom: 4px;">Decision</div>
            <div style="font-size: 1.25rem; font-weight: 700; color: ${decisionColor};">${getDecision(overall)}</div>
          </div>

          <!-- Small Decision Meter line -->
          <div style="position: relative; width: 100%; max-width: 200px; height: 6px; background: linear-gradient(to right, hsl(var(--destructive)) 0%, hsl(var(--chart-3)) 50%, hsl(var(--chart-2)) 75%, hsl(var(--primary)) 100%); border-radius: 3px; margin-top: 16px;">
            <!-- Needle -->
            <div style="position: absolute; top: -4px; left: ${Math.max(0, Math.min(overall, 100))}%; width: 4px; height: 14px; background: hsl(var(--foreground)); transform: translateX(-50%); border-radius: 2px; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; width: 100%; max-width: 200px; font-size: 0.65rem; color: hsl(var(--muted-foreground)); margin-top: 6px;">
            <span>Low</span>
            <span>Norm</span>
            <span>High</span>
            <span>Push</span>
          </div>
        </div>

        <!-- Metric Bars -->
        <div style="display: flex; flex-direction: column; justify-content: center;">
          <h3 style="font-size: 1rem; font-weight: 600; margin: 0 0 16px 0; border-bottom: 1px solid hsl(var(--border)); padding-bottom: 8px;">Detailed Metrics</h3>
          ${renderBar('Reliability', scores.reliability)}
          ${renderBar('Importance', scores.importance)}
          ${renderBar('Corroboration', scores.corroboration)}
          ${renderBar('Scope Clarity', scores.scope_clarity)}
          ${renderBar('Volatility Risk (Low is better)', scores.volatility_risk, true)}
        </div>
      </div>

      <!-- Claims & Evidence -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
        ${(data.key_claims && data.key_claims.length > 0) ? `
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px;">
            <svg style="width:16px;height:16px;color:hsl(var(--primary));" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Key Claims Verified
          </h3>
          <div>${claimsHtml}</div>
        </div>` : ''}

        ${(data.evidence && data.evidence.length > 0) ? `
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 600; margin: 0 0 12px 0; display: flex; align-items: center; gap: 6px;">
            <svg style="width:16px;height:16px;color:hsl(var(--chart-4));" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Supporting Evidence
          </h3>
          <ul style="padding: 0; margin: 0;">${evidenceHtml}</ul>
        </div>` : ''}
      </div>
      
      ${(data.caveats && data.caveats.length > 0) ? `
      <div style="margin-top: 24px; padding: 16px; border-left: 4px solid hsl(var(--chart-4)); background: hsl(var(--chart-4)/0.1); border-radius: 4px;">
        <h4 style="font-size: 0.95rem; font-weight: 600; color: hsl(var(--chart-4)); margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
          <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          Caveats / Notes
        </h4>
        <ul style="padding-left: 20px; font-size: 0.85rem; margin: 0;">
          ${data.caveats.map((c: string) => `<li style="margin-bottom: 4px; color: hsl(var(--foreground));">${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>` : ''}
      
    </div>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
