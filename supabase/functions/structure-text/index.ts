import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function callLLM(settings: LLMSettings, systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = settings.llm_text_provider || settings.llm_provider || 'zai';
  const model = settings.llm_text_model || 'google/gemini-3-flash-preview';

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

  if (effectiveProvider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');

    // Use Gemini 1.5 or 2.0 Flash endpoint structure
    // If model name contains 'google/', strip it or use as is if supported
    const modelName = model.replace('google/', '');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
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

  if (effectiveProvider === 'openai') {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Provider ${effectiveProvider} not implemented in structure-text`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, content } = await req.json();

    if (!content || content.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: "Content too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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

    const systemPrompt = `You are a text cleaning and structuring assistant. Your task is to:
1. Remove any code snippets, JavaScript, JSON, HTML tags, or technical artifacts
2. Remove advertising text, navigation elements, social media prompts
3. Remove duplicate content or repeated phrases
4. Structure the text into clear paragraphs
5. Keep only the actual news article content
6. Preserve the original language of the text
7. Fix any encoding issues or garbled characters
8. Remove "Read more", "Subscribe", "Share" type prompts
9. Remove author bios that appear at the end

Return ONLY the cleaned and structured article text. Do not add any comments or explanations.`;

    const cleanedContent = await callLLM(llmSettings, systemPrompt, `Clean and structure this text:\n\n${content}`);

    if (!cleanedContent) {
      throw new Error("No content returned from AI");
    }

    // If newsId is provided, update the database
    if (newsId) {
      const { error } = await supabase
        .from("news_rss_items")
        .update({ original_content: cleanedContent })
        .eq("id", newsId);

      if (error) {
        console.error("Database error:", error);
        throw error;
      }
    }

    console.log(`Structured text: ${content.length} -> ${cleanedContent.length} chars`);

    return new Response(
      JSON.stringify({ success: true, content: cleanedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
