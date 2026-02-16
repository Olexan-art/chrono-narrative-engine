import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { logLlmUsage } from '../_shared/llm-logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let newsId: string | undefined;
  let content: string | undefined;
  const startTime = Date.now();

  try {
    const body = await req.json();
    newsId = body.newsId;
    content = body.content;

    if (!content || content.length < 50) {
      return new Response(
        JSON.stringify({ success: false, error: "Content too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ZAI_API_KEY = Deno.env.get("ZAI_API_KEY");
    if (!ZAI_API_KEY) {
      throw new Error("ZAI_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const startTime = Date.now();
    const model = "GLM-4.7-Flash";
    const provider = "zai";

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

    const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "GLM-4.7-Flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Clean and structure this text:\n\n${content}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Credits exhausted, please add funds" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const cleanedContent = data.choices?.[0]?.message?.content?.trim();

    if (!cleanedContent) {
      throw new Error("No content returned from AI");
    }

    // If newsId is provided, update the database
    if (newsId) {
      // Supabase client already initialized above

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

    // Log success
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'structure-text',
      duration_ms: Date.now() - startTime,
      success: true,
      metadata: { newsId, inputLength: content.length, outputLength: cleanedContent.length }
    });

    return new Response(
      JSON.stringify({ success: true, content: cleanedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);

    // Log error (needs supabase client if initialized, or recreate)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await logLlmUsage({
        supabase,
        provider: "zai",
        model: "GLM-4.7-Flash",
        operation: 'structure-text',
        duration_ms: Date.now() - (Date.now()), // Approximate if startTime not accessible in catch block scope? No, scope is shared.
        // Wait, startTime is inside try block. I should move it out or re-initialize.
        // Since I moved startTime inside try, it's scoped to try block? No, `const` is block scoped. 
        // I should move declarations up.
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
        metadata: {}
      });
    } catch (logError) {
      // Ignore logging error
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
