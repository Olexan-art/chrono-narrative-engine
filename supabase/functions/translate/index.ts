import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { partId, chapterId, volumeId, targetLanguage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let textToTranslate = '';
    let entityType = '';
    let entityId = '';

    if (partId) {
      const { data: part } = await supabase
        .from('parts')
        .select('title, content')
        .eq('id', partId)
        .single();
      
      if (!part) throw new Error('Part not found');
      textToTranslate = `TITLE:\n${part.title}\n\nCONTENT:\n${part.content}`;
      entityType = 'part';
      entityId = partId;
    } else if (chapterId) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('title, description, narrator_monologue, narrator_commentary')
        .eq('id', chapterId)
        .single();
      
      if (!chapter) throw new Error('Chapter not found');
      textToTranslate = `TITLE:\n${chapter.title}\n\nDESCRIPTION:\n${chapter.description || ''}\n\nNARRATOR_MONOLOGUE:\n${chapter.narrator_monologue || ''}\n\nNARRATOR_COMMENTARY:\n${chapter.narrator_commentary || ''}`;
      entityType = 'chapter';
      entityId = chapterId;
    } else if (volumeId) {
      const { data: volume } = await supabase
        .from('volumes')
        .select('title, description, summary')
        .eq('id', volumeId)
        .single();
      
      if (!volume) throw new Error('Volume not found');
      textToTranslate = `TITLE:\n${volume.title}\n\nDESCRIPTION:\n${volume.description || ''}\n\nSUMMARY:\n${volume.summary || ''}`;
      entityType = 'volume';
      entityId = volumeId;
    } else {
      throw new Error('No entity ID provided');
    }

    const langName = targetLanguage === 'en' ? 'English' : 'Polish';
    
    const systemPrompt = `You are a professional literary translator specializing in science fiction. Translate the following Ukrainian text to ${langName}.

IMPORTANT RULES:
1. Preserve the sci-fi atmosphere and poetic language
2. Keep proper nouns like "Точка Синхронізації" as "Synchronization Point" (EN) or "Punkt Synchronizacji" (PL)
3. Maintain the same tone and literary style
4. Do NOT translate section markers (TITLE:, CONTENT:, DESCRIPTION:, etc.)
5. Return the translated text with the same section markers

RESPONSE FORMAT (JSON):
{
  "title": "translated title",
  "content": "translated content (if present)",
  "description": "translated description (if present)",
  "narrator_monologue": "translated monologue (if present)",
  "narrator_commentary": "translated commentary (if present)",
  "summary": "translated summary (if present)"
}

Only include fields that were present in the input.`;

    console.log(`Translating ${entityType} ${entityId} to ${targetLanguage}`);

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
          { role: 'user', content: textToTranslate }
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
    const translatedContent = JSON.parse(data.choices?.[0]?.message?.content || '{}');

    // Update database with translations
    const langSuffix = `_${targetLanguage}`;
    const updateData: Record<string, string> = {};

    if (translatedContent.title) updateData[`title${langSuffix}`] = translatedContent.title;
    if (translatedContent.content) updateData[`content${langSuffix}`] = translatedContent.content;
    if (translatedContent.description) updateData[`description${langSuffix}`] = translatedContent.description;
    if (translatedContent.narrator_monologue) updateData[`narrator_monologue${langSuffix}`] = translatedContent.narrator_monologue;
    if (translatedContent.narrator_commentary) updateData[`narrator_commentary${langSuffix}`] = translatedContent.narrator_commentary;
    if (translatedContent.summary) updateData[`summary${langSuffix}`] = translatedContent.summary;

    let table = '';
    if (entityType === 'part') table = 'parts';
    else if (entityType === 'chapter') table = 'chapters';
    else if (entityType === 'volume') table = 'volumes';

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', entityId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error(`Failed to save translation: ${updateError.message}`);
    }

    console.log(`Successfully translated ${entityType} to ${targetLanguage}`);

    return new Response(
      JSON.stringify({ success: true, translated: translatedContent }),
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
