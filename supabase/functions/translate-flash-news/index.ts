import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LOVABLE_API_URL = 'https://api.lovable.dev/v1/chat/completions';

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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Translating content to EN and PL...');

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

    const response = await fetch(LOVABLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM API error:', errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const result = await response.json();
    const llmResponse = result.choices?.[0]?.message?.content || '';

    console.log('Raw LLM response:', llmResponse.slice(0, 200));

    // Parse JSON from response
    let translations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        translations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse translations:', parseError);
      // Return empty translations on parse failure
      translations = {
        title_en: '',
        title_pl: '',
        content_en: '',
        content_pl: ''
      };
    }

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
