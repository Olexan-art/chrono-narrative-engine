import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    
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
