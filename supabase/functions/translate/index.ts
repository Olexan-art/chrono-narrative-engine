import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    let chatDialogue: any[] | null = null;
    let tweets: any[] | null = null;

    if (partId) {
      const { data: part } = await supabase
        .from('parts')
        .select('title, content, chat_dialogue, tweets')
        .eq('id', partId)
        .single();
      
      if (!part) throw new Error('Part not found');
      textToTranslate = `TITLE:\n${part.title}\n\nCONTENT:\n${part.content}`;
      chatDialogue = part.chat_dialogue as any[] | null;
      tweets = part.tweets as any[] | null;
      entityType = 'part';
      entityId = partId;
    } else if (chapterId) {
      const { data: chapter } = await supabase
        .from('chapters')
        .select('title, description, narrator_monologue, narrator_commentary, chat_dialogue, tweets')
        .eq('id', chapterId)
        .single();
      
      if (!chapter) throw new Error('Chapter not found');
      textToTranslate = `TITLE:\n${chapter.title}\n\nDESCRIPTION:\n${chapter.description || ''}\n\nNARRATOR_MONOLOGUE:\n${chapter.narrator_monologue || ''}\n\nNARRATOR_COMMENTARY:\n${chapter.narrator_commentary || ''}`;
      chatDialogue = chapter.chat_dialogue as any[] | null;
      tweets = chapter.tweets as any[] | null;
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
    
    // Build chat dialogue text for translation
    let chatDialogueText = '';
    if (chatDialogue && chatDialogue.length > 0) {
      chatDialogueText = '\n\nCHAT_DIALOGUE:\n' + chatDialogue.map((msg, i) => 
        `[${i}] ${msg.name}: ${msg.message}`
      ).join('\n');
    }

    // Build tweets text for translation
    let tweetsText = '';
    if (tweets && tweets.length > 0) {
      tweetsText = '\n\nTWEETS:\n' + tweets.map((tweet, i) => 
        `[${i}] @${tweet.handle} (${tweet.author}): ${tweet.content}`
      ).join('\n');
    }

    const fullTextToTranslate = textToTranslate + chatDialogueText + tweetsText;
    
    const systemPrompt = `You are a professional literary translator specializing in science fiction. Translate the following Ukrainian text to ${langName}.

IMPORTANT RULES:
1. Preserve the sci-fi atmosphere and poetic language
2. Keep proper nouns like "Точка Синхронізації" as "Synchronization Point" (EN) or "Punkt Synchronizacji" (PL)
3. Maintain the same tone and literary style
4. Do NOT translate section markers (TITLE:, CONTENT:, DESCRIPTION:, etc.)
5. For CHAT_DIALOGUE, translate only the message text, keep character names
6. For TWEETS, translate only the content, keep author names and handles

RESPONSE FORMAT (JSON):
{
  "title": "translated title",
  "content": "translated content (if present)",
  "description": "translated description (if present)",
  "narrator_monologue": "translated monologue (if present)",
  "narrator_commentary": "translated commentary (if present)",
  "summary": "translated summary (if present)",
  "chat_dialogue": [{"index": 0, "message": "translated message"}, ...],
  "tweets": [{"index": 0, "content": "translated content"}, ...]
}

Only include fields that were present in the input.`;

    console.log(`Translating ${entityType} ${entityId} to ${targetLanguage}`);
    console.log(`Has chat_dialogue: ${chatDialogue?.length || 0} messages`);
    console.log(`Has tweets: ${tweets?.length || 0} tweets`);

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
          { role: 'user', content: fullTextToTranslate }
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
    const updateData: Record<string, any> = {};

    if (translatedContent.title) updateData[`title${langSuffix}`] = translatedContent.title;
    if (translatedContent.content) updateData[`content${langSuffix}`] = translatedContent.content;
    if (translatedContent.description) updateData[`description${langSuffix}`] = translatedContent.description;
    if (translatedContent.narrator_monologue) updateData[`narrator_monologue${langSuffix}`] = translatedContent.narrator_monologue;
    if (translatedContent.narrator_commentary) updateData[`narrator_commentary${langSuffix}`] = translatedContent.narrator_commentary;
    if (translatedContent.summary) updateData[`summary${langSuffix}`] = translatedContent.summary;

    // Process translated chat dialogue
    if (translatedContent.chat_dialogue && chatDialogue) {
      const translatedChatDialogue = chatDialogue.map((msg, i) => {
        const translatedMsg = translatedContent.chat_dialogue.find((t: any) => t.index === i);
        return {
          ...msg,
          message: translatedMsg?.message || msg.message
        };
      });
      updateData[`chat_dialogue${langSuffix}`] = translatedChatDialogue;
    }

    // Process translated tweets
    if (translatedContent.tweets && tweets) {
      const translatedTweets = tweets.map((tweet, i) => {
        const translatedTweet = translatedContent.tweets.find((t: any) => t.index === i);
        return {
          ...tweet,
          content: translatedTweet?.content || tweet.content
        };
      });
      updateData[`tweets${langSuffix}`] = translatedTweets;
    }

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
    console.log(`Updated fields: ${Object.keys(updateData).join(', ')}`);

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
