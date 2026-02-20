import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  newsId: string;
  newsTitle: string;
  newsContent: string;
  model?: string;
}

interface NewsAnalysis {
  why_it_matters?: string;
  context_background?: string[];
  what_happens_next?: string;
  faq?: Array<{ question: string; answer: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { newsId, newsTitle, newsContent, model = 'gemini-2.0-flash-exp' }: AnalysisRequest = await req.json();

    if (!newsId || !newsTitle || !newsContent) {
      throw new Error('Missing required fields: newsId, newsTitle, newsContent');
    }

    console.log(`Generating news analysis for newsId=${newsId}, model=${model}`);

    // Get LLM settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('llm_settings')
      .select('*')
      .single();

    if (settingsError) {
      console.error('Error fetching LLM settings:', settingsError);
      throw new Error('Failed to load LLM settings');
    }

    // Build analysis prompt
    const systemPrompt = `You are a professional news analyst. Your task is to provide comprehensive analysis of news articles.

You must respond ONLY with valid JSON in the following structure:
{
  "why_it_matters": "3-5 sentences explaining why this news is important and who it affects",
  "context_background": ["fact 1", "fact 2", "fact 3", "etc"] (3-7 bullet points with historical context),
  "what_happens_next": "Forecast of upcoming events, dates, or developments (if applicable)",
  "faq": [
    {"question": "question 1", "answer": "answer in 2-3 sentences"},
    {"question": "question 2", "answer": "answer in 2-3 sentences"}
  ] (3-6 Q&A pairs)
}

IMPORTANT: Your response must be pure JSON, no markdown formatting, no code blocks, no explanations outside JSON.`;

    const userPrompt = `Analyze this news article:

Title: ${newsTitle}

Content:
${newsContent}

Provide comprehensive analysis in JSON format as specified.`;

    // Call LLM
    console.log(`Calling LLM with model: ${model}`);
    const analysisText = await callLLM(
      supabase,
      settingsData,
      systemPrompt,
      userPrompt,
      model
    );
    console.log(`LLM response length: ${analysisText.length} chars`);

    // Parse JSON response
    let analysis: NewsAnalysis;
    try {
      // Try to extract JSON from markdown code block if present
      const jsonMatch = analysisText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : analysisText;
      console.log(`Parsing JSON (${jsonText.length} chars)`);
      analysis = JSON.parse(jsonText.trim());
      console.log('JSON parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', analysisText.substring(0, 500));
      throw new Error(`LLM response is not valid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
    }

    // Validate structure
    if (!analysis.why_it_matters && !analysis.context_background && !analysis.what_happens_next && !analysis.faq) {
      throw new Error('Analysis response missing all required fields');
    }

    // Add timestamp
    const analysisWithMeta = {
      ...analysis,
      generated_at: new Date().toISOString(),
    };

    // Save to database
    const { error: updateError } = await supabase
      .from('news_rss_items')
      .update({ news_analysis: analysisWithMeta })
      .eq('id', newsId);

    if (updateError) {
      console.error('Error saving analysis:', updateError);
      throw new Error('Failed to save analysis');
    }

    console.log(`Analysis generated and saved for newsId=${newsId}`);

    return new Response(
      JSON.stringify({ success: true, analysis: analysisWithMeta }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-news-analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: errorStack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to call LLM (simplified version)
async function callLLM(
  supabase: any,
  settings: any,
  systemPrompt: string,
  userPrompt: string,
  overrideModel?: string
): Promise<string> {
  const model = overrideModel || settings.llm_text_model || 'gemini-2.0-flash-exp';
  
  // Auto-detect provider from model prefix
  let provider = 'gemini';
  let apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
  
  if (model.startsWith('GLM-') || model.startsWith('glm-')) {
    provider = 'zai';
    apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
  } else if (model.startsWith('mistral-') || model.startsWith('codestral')) {
    provider = 'mistral';
    apiKey = settings.mistral_api_key || Deno.env.get('MISTRAL_API_KEY');
  } else if (model.startsWith('claude')) {
    provider = 'anthropic';
    apiKey = settings.anthropic_api_key || Deno.env.get('ANTHROPIC_API_KEY');
  } else if (model.startsWith('gpt-') || model.startsWith('o1-')) {
    provider = 'openai';
    apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
  }

  console.log(`Calling LLM: provider=${provider}, model=${model}`);

  if (!apiKey) {
    throw new Error(`API key not configured for provider: ${provider}. Please configure ${provider.toUpperCase()}_API_KEY in Supabase Edge Function secrets or llm_settings table.`);
  }

  console.log(`API key found for ${provider}: ${apiKey.substring(0, 10)}...`);

  // Gemini v2.2
  if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Z.AI
  if (provider === 'zai') {
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
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Z.AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Mistral
  if (provider === 'mistral') {
    if (!apiKey) throw new Error('Mistral API key not configured');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
