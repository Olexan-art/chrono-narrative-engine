import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
}

interface Character {
  id: string;
  character_id: string;
  name: string;
  avatar: string;
  style: string;
  is_active: boolean;
}

interface DialogueMessage {
  id: string;
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes: number;
  characterLikes: CharacterLike[];
  replyTo?: string;
  threadId?: string;
}

interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function callLLM(settings: LLMSettings, systemPrompt: string, userPrompt: string, useOpenAI: boolean = false): Promise<string> {
  // If explicitly requested OpenAI for dialogue
  if (useOpenAI) {
    const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (apiKey) {
      console.log('Using OpenAI for dialogue generation');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
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
  }

  const provider = settings.llm_text_provider || settings.llm_provider || 'lovable';
  
  // Z.AI provider - OpenAI-compatible API
  if (provider === 'zai') {
    const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('Z.AI API key not configured');

    console.log('Using Z.AI with model:', settings.llm_text_model || 'GLM-4.7');
    
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.llm_text_model || 'GLM-4.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
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
    const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
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
        max_tokens: 4096,
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

  // Gemini V22 provider - direct Google AI API with v22 key
  if (provider === 'geminiV22') {
    const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
    if (!apiKey) throw new Error('Gemini V22 API key not configured');

    const modelName = settings.llm_text_model || 'gemini-2.5-flash';
    console.log('Using Gemini V22 with model:', modelName);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
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
      console.error('Gemini V22 error:', response.status, errorText);
      throw new Error(`Gemini V22 error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

function generateRandomLikes(): number {
  return Math.floor(Math.random() * 1908); // 0 to 1907
}

function selectRelatedCharacters(allCharacters: Character[], mainCharacters: Character[], count: number): Character[] {
  const otherCharacters = allCharacters.filter(c => !mainCharacters.some(m => m.character_id === c.character_id));
  const shuffled = [...otherCharacters].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      storyContext,
      newsContext,
      narrativeSource,
      narrativeStructure,
      useOpenAI = false,
      messageCount = 8,
      characters: selectedCharactersParam,
      enableThreading = false,
      threadProbability = 30,
      chapterId,
      generateTweets = false,
      tweetCount = 4,
      contentLanguage = 'uk', // Language of the news content: 'uk', 'en', 'hi', 'ta', 'te', 'bn', etc.
      model, // Override model for generation
      isHypeTweet = false // Generate viral/hype style tweets
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get LLM settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_provider, llm_text_model, openai_api_key, gemini_api_key, gemini_v22_api_key, anthropic_api_key, zai_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = {
      llm_provider: settingsData?.llm_provider || 'lovable',
      llm_text_provider: settingsData?.llm_text_provider || null,
      llm_text_model: model || settingsData?.llm_text_model || 'google/gemini-3-flash-preview',
      openai_api_key: settingsData?.openai_api_key || null,
      gemini_api_key: settingsData?.gemini_api_key || null,
      gemini_v22_api_key: settingsData?.gemini_v22_api_key || null,
      anthropic_api_key: settingsData?.anthropic_api_key || null,
      zai_api_key: settingsData?.zai_api_key || null
    };

    // Determine provider from model if specified
    if (model) {
      if (model.startsWith('GLM-')) {
        llmSettings.llm_text_provider = 'zai';
      } else if (model.startsWith('google/') || model.startsWith('openai/')) {
        llmSettings.llm_text_provider = 'lovable';
      } else if (model.startsWith('gpt-')) {
        llmSettings.llm_text_provider = 'openai';
      } else if (model.startsWith('gemini-')) {
        llmSettings.llm_text_provider = 'gemini';
      } else if (model.startsWith('claude-')) {
        llmSettings.llm_text_provider = 'anthropic';
      }
    }

    // Fetch all active characters
    const { data: charactersData } = await supabase
      .from('characters')
      .select('*')
      .eq('is_active', true);

    const allCharacters: Character[] = charactersData || [];

    if (allCharacters.length < 2) {
      throw new Error('Need at least 2 active characters for dialogue');
    }

    let mainCharacters: Character[];
    let thirdCharacter: Character | null = null;
    let includeThirdCharacter = false;

    // If specific characters are provided, use them
    if (selectedCharactersParam && typeof selectedCharactersParam === 'string' && selectedCharactersParam.trim()) {
      // Parse selected characters info - format: "Name (avatar) - style, Name2 (avatar2) - style2"
      const selectedNames = selectedCharactersParam.split(',').map(s => s.trim().split(' ')[0]);
      const filteredChars = allCharacters.filter(c => 
        selectedNames.some(name => c.name.toLowerCase().includes(name.toLowerCase()))
      );
      
      if (filteredChars.length >= 2) {
        mainCharacters = filteredChars.slice(0, 2);
        if (filteredChars.length >= 3) {
          thirdCharacter = filteredChars[2];
          includeThirdCharacter = true;
        }
      } else {
        // Fallback to random selection if not enough matches
        const shuffled = [...allCharacters].sort(() => Math.random() - 0.5);
        mainCharacters = shuffled.slice(0, 2);
      }
    } else {
      // Random selection when no specific characters specified
      const shuffled = [...allCharacters].sort(() => Math.random() - 0.5);
      mainCharacters = shuffled.slice(0, 2);

      // 50% chance of 3rd character intervention
      includeThirdCharacter = Math.random() < 0.5 && allCharacters.length >= 3;
      if (includeThirdCharacter) {
        const remaining = shuffled.filter(c => !mainCharacters.includes(c));
        thirdCharacter = remaining[0] || null;
      }
    }

    console.log('Dialogue generation:', {
      mainCharacters: mainCharacters.map(c => c.name),
      thirdCharacter: thirdCharacter?.name || 'none',
      messageCount,
      useOpenAI,
      selectedCharactersParam: selectedCharactersParam || 'auto',
      enableThreading,
      threadProbability,
      chapterId: chapterId || 'none',
      generateTweets,
      contentLanguage
    });

    // Language names for prompts
    const languageNames: Record<string, string> = {
      'uk': 'українська',
      'en': 'English',
      'pl': 'polski',
      'hi': 'हिन्दी (Hindi)',
      'ta': 'தமிழ் (Tamil)',
      'te': 'తెలుగు (Telugu)',
      'bn': 'বাংলা (Bengali)'
    };
    
    const primaryLanguageName = languageNames[contentLanguage] || 'українська';

    const charactersList = thirdCharacter 
      ? [...mainCharacters, thirdCharacter]
      : mainCharacters;

    // Build language-aware system prompt
    const isIndianLanguage = ['hi', 'ta', 'te', 'bn'].includes(contentLanguage);
    const primaryFieldName = contentLanguage === 'uk' ? 'dialogue' : `dialogue_${contentLanguage}`;
    
    const systemPrompt = `You are generating character dialogues for the satirical sci-fi project "Synchronization Point".

CHARACTERS:
${charactersList.map((c, i) => `${i + 1}. ${c.name} (${c.avatar}): ${c.style}`).join('\n')}

${thirdCharacter ? `IMPORTANT: The third character ${thirdCharacter.name} should intervene unexpectedly when the other two are already talking. This should be a comedic moment.` : ''}

RULES:
1. Generate ${messageCount} dialogue messages
2. CRITICAL: The PRIMARY language for "dialogue" field must be ${primaryLanguageName} - this is the language of the news article!
3. Each character speaks in their unique style
4. The dialogue should comment on news events satirically and philosophically
5. ${thirdCharacter ? `The third character appears approximately in the middle of the dialogue` : 'Dialogue between two characters'}
6. Lines should be sharp and witty, 1-3 sentences each
${isIndianLanguage ? `7. For Indian languages, use native script (Devanagari for Hindi, Tamil script for Tamil, Telugu script for Telugu, Bengali script for Bengali)` : ''}

RESPONSE FORMAT (JSON):
{
  "dialogue": [
    {"character": "character_id", "name": "Name", "avatar": "emoji", "message": "Message in ${primaryLanguageName}"}
  ],
  "dialogue_en": [
    {"character": "character_id", "name": "Name", "avatar": "emoji", "message": "Message in English"}
  ],
  "dialogue_pl": [
    {"character": "character_id", "name": "Name", "avatar": "emoji", "message": "Wiadomość po polsku"}
  ]
}`;

    const userPrompt = `STORY CONTEXT:
${storyContext}

NEWS (in ${primaryLanguageName}):
${newsContext}

Generate ${messageCount} dialogue lines. The "dialogue" field MUST be in ${primaryLanguageName} (the language of the news).
Also provide English translation in "dialogue_en" and Polish in "dialogue_pl".
${thirdCharacter ? `Include the unexpected appearance of ${thirdCharacter.name}.` : ''}`;

    const content = await callLLM(llmSettings, systemPrompt, userPrompt, useOpenAI);

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Fallback dialogue
      const fallbackDialogue = mainCharacters.flatMap((char, idx) => [
        { character: char.character_id, name: char.name, avatar: char.avatar, message: "Цікаві події сьогодні..." },
        { character: mainCharacters[(idx + 1) % 2].character_id, name: mainCharacters[(idx + 1) % 2].name, avatar: mainCharacters[(idx + 1) % 2].avatar, message: "Так, людство знову здивувало." }
      ]).slice(0, messageCount);
      
      result = {
        dialogue: fallbackDialogue,
        dialogue_en: mainCharacters.flatMap((char, idx) => [
          { character: char.character_id, name: char.name, avatar: char.avatar, message: "Interesting events today..." },
          { character: mainCharacters[(idx + 1) % 2].character_id, name: mainCharacters[(idx + 1) % 2].name, avatar: mainCharacters[(idx + 1) % 2].avatar, message: "Yes, humanity surprised us again." }
        ]).slice(0, messageCount),
        dialogue_pl: mainCharacters.flatMap((char, idx) => [
          { character: char.character_id, name: char.name, avatar: char.avatar, message: "Ciekawe wydarzenia dzisiaj..." },
          { character: mainCharacters[(idx + 1) % 2].character_id, name: mainCharacters[(idx + 1) % 2].name, avatar: mainCharacters[(idx + 1) % 2].avatar, message: "Tak, ludzkość znów nas zaskoczyła." }
        ]).slice(0, messageCount)
      };
    }

    // Add IDs, likes, character likes, and threading to each message
    const addEnhancementsToDialogue = (dialogue: any[], dialogueIds: string[]) => {
      return dialogue.map((msg: any, idx: number) => {
        const baseLikes = generateRandomLikes();
        const likeGiversCount = Math.floor(Math.random() * 3) + 1;
        const likeGivers = selectRelatedCharacters(allCharacters, [mainCharacters.find(c => c.character_id === msg.character)!].filter(Boolean), likeGiversCount);
        
        const characterLikes: CharacterLike[] = likeGivers.map(c => ({
          characterId: c.character_id,
          name: c.name,
          avatar: c.avatar
        }));

        const enhanced: DialogueMessage = {
          id: dialogueIds[idx],
          character: msg.character,
          name: msg.name,
          avatar: msg.avatar,
          message: msg.message,
          likes: baseLikes,
          characterLikes
        };

        // Add threading if enabled and not the first message
        if (enableThreading && idx > 0) {
          // Random chance to make this a reply to a previous message
          if (Math.random() * 100 < threadProbability) {
            // Reply to a random previous message (preferring recent ones)
            const possibleParents = dialogueIds.slice(0, idx);
            const weightedIdx = Math.floor(Math.pow(Math.random(), 0.5) * possibleParents.length);
            const parentIdx = possibleParents.length - 1 - weightedIdx;
            enhanced.replyTo = dialogueIds[parentIdx];
            enhanced.threadId = dialogueIds[0]; // Root of the thread
          }
        }

        return enhanced;
      });
    };

    // Generate shared IDs for all languages
    const dialogueLength = (result.dialogue || []).length;
    const sharedDialogueIds = Array.from({ length: dialogueLength }, () => generateMessageId());

    const dialogueWithLikes = addEnhancementsToDialogue(result.dialogue || [], sharedDialogueIds);
    const dialogueEnWithLikes = addEnhancementsToDialogue(result.dialogue_en || [], sharedDialogueIds);
    const dialoguePlWithLikes = addEnhancementsToDialogue(result.dialogue_pl || [], sharedDialogueIds);

    // Update character statistics
    const characterStats: Record<string, { dialogueCount: number; totalLikes: number }> = {};
    
    // Count dialogues and sum likes per character
    for (const msg of dialogueWithLikes) {
      if (!characterStats[msg.character]) {
        characterStats[msg.character] = { dialogueCount: 0, totalLikes: 0 };
      }
      characterStats[msg.character].dialogueCount++;
      characterStats[msg.character].totalLikes += msg.likes || 0;
    }

    // Update each character's stats in the database
    const now = new Date().toISOString();
    for (const [characterId, stats] of Object.entries(characterStats)) {
      const char = allCharacters.find(c => c.character_id === characterId);
      if (char) {
        try {
          // Direct update - increment dialogue count and likes
          const { data: currentChar } = await supabase
            .from('characters')
            .select('dialogue_count, total_likes')
            .eq('id', char.id)
            .single();
          
          if (currentChar) {
            await supabase
              .from('characters')
              .update({
                dialogue_count: (currentChar.dialogue_count || 0) + stats.dialogueCount,
                total_likes: (currentChar.total_likes || 0) + stats.totalLikes,
                last_dialogue_at: now
              })
              .eq('id', char.id);
            
            console.log(`Updated stats for ${characterId}: +${stats.dialogueCount} dialogues, +${stats.totalLikes} likes`);
          }
        } catch (err) {
          console.error(`Failed to update stats for ${characterId}:`, err);
        }
      }
    }

    console.log('Generated multilingual dialogue with', dialogueWithLikes.length, 'messages per language');

    // Generate tweets if requested (for chapters or news)
    let tweets = null;
    let tweets_en = null;
    let tweets_pl = null;
    
    if (generateTweets && tweetCount > 0) {
      console.log('Generating tweets in language:', contentLanguage, 'hype mode:', isHypeTweet);
      
      // Hype tweet style additions
      const hypeStyleUk = isHypeTweet ? `
5. Твіти мають бути ВІРУСНИМИ - провокативними, емоційними, з hook на початку
6. Використовуй смайли 🔥💀🚨😱 для привернення уваги
7. Короткі речення, максимум впливу
8. Стиль Twitter/X хайпу - наче це може стати вірусним` : '';
      
      const hypeStyleEn = isHypeTweet ? `
5. Tweets must be VIRAL - provocative, emotional, with a hook at the start
6. Use emojis 🔥💀🚨😱 for attention
7. Short punchy sentences, maximum impact
8. Twitter/X hype style - like it could go viral` : '';
      
      const hypeStylePl = isHypeTweet ? `
5. Tweety muszą być WIRALOWE - prowokacyjne, emocjonalne, z haczykiem na początku
6. Używaj emoji 🔥💀🚨😱 dla przyciągnięcia uwagi
7. Krótkie zdania, maksymalny wpływ
8. Styl hype'u Twitter/X - jakby mogło stać się wiralowe` : '';

      // Language-specific tweet prompts
      const tweetPrompts: Record<string, { system: string; user: string }> = {
        'uk': {
          system: `Ти генеруєш ${isHypeTweet ? 'ХАЙПОВІ вірусні ' : ''}твіти для сатиричного науково-фантастичного проекту "Точка Синхронізації".

ПРАВИЛА:
1. Згенеруй ${tweetCount} твітів УКРАЇНСЬКОЮ мовою
2. Твіти мають бути дотепними, сатиричними коментарями про події
3. Кожен твіт має унікального автора з креативним ніком
4. Формат handle: @творчий_нік (латиницею)${hypeStyleUk}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "tweets": [
    {"author": "Ім'я Автора", "handle": "@нік", "content": "Твіт українською", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `Згенеруй ${tweetCount} унікальних ${isHypeTweet ? 'ХАЙПОВИХ вірусних ' : ''}твітів УКРАЇНСЬКОЮ з дотепними коментарями про ці новини.`
        },
        'en': {
          system: `You are generating ${isHypeTweet ? 'VIRAL HYPE ' : ''}tweets for the satirical sci-fi project "Synchronization Point".

RULES:
1. Generate ${tweetCount} tweets in ENGLISH
2. Tweets should be witty, satirical comments about the events
3. Each tweet has a unique author with a creative handle
4. Handle format: @creative_handle${hypeStyleEn}

RESPONSE FORMAT (JSON):
{
  "tweets": [
    {"author": "Author Name", "handle": "@handle", "content": "Tweet in English", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `Generate ${tweetCount} unique ${isHypeTweet ? 'VIRAL HYPE ' : ''}ENGLISH tweets with witty comments about this news.`
        },
        'pl': {
          system: `Generujesz ${isHypeTweet ? 'WIRALOWE ' : ''}tweety dla satyrycznego projektu science fiction "Punkt Synchronizacji".

ZASADY:
1. Wygeneruj ${tweetCount} tweetów po POLSKU
2. Tweety powinny być dowcipne, satyryczne komentarze o wydarzeniach
3. Każdy tweet ma unikalnego autora z kreatywnym nickiem
4. Format handle: @kreatywny_nick${hypeStylePl}

FORMAT ODPOWIEDZI (JSON):
{
  "tweets": [
    {"author": "Imię Autora", "handle": "@nick", "content": "Tweet po polsku", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `Wygeneruj ${tweetCount} unikalnych ${isHypeTweet ? 'WIRALOWYCH ' : ''}tweetów PO POLSKU z dowcipnymi komentarzami o tych wiadomościach.`
        },
        'hi': {
          system: `आप व्यंग्यपूर्ण साइंस-फ़िक्शन प्रोजेक्ट "सिंक्रनाइज़ेशन पॉइंट" के लिए ट्वीट्स बना रहे हैं।

नियम:
1. ${tweetCount} ट्वीट्स हिंदी में जनरेट करें
2. ट्वीट्स में घटनाओं पर मज़ेदार, व्यंग्यपूर्ण टिप्पणियाँ होनी चाहिए
3. प्रत्येक ट्वीट का एक अद्वितीय लेखक हो जिसका रचनात्मक हैंडल हो
4. हैंडल फॉर्मेट: @creative_handle

JSON फॉर्मेट में जवाब दें:
{
  "tweets": [
    {"author": "लेखक का नाम", "handle": "@handle", "content": "हिंदी में ट्वीट", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `इस समाचार के बारे में ${tweetCount} अद्वितीय हिंदी ट्वीट्स जनरेट करें।`
        },
        'ta': {
          system: `நீங்கள் "ஒத்திசைவு புள்ளி" என்ற நையாண்டி அறிவியல் புனைகதை திட்டத்திற்கான ட்வீட்களை உருவாக்குகிறீர்கள்.

விதிகள்:
1. ${tweetCount} ட்வீட்களை தமிழில் உருவாக்கவும்
2. ட்வீட்கள் நிகழ்வுகளைப் பற்றி நகைச்சுவையான, நையாண்டியான கருத்துகளாக இருக்க வேண்டும்
3. ஒவ்வொரு ட்வீட்டிற்கும் ஒரு தனித்துவமான ஆசிரியர் இருக்க வேண்டும்

JSON வடிவத்தில் பதில்:
{
  "tweets": [
    {"author": "ஆசிரியர் பெயர்", "handle": "@handle", "content": "தமிழில் ட்வீட்", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `இந்த செய்திகள் பற்றி ${tweetCount} தனித்துவமான தமிழ் ட்வீட்களை உருவாக்கவும்.`
        },
        'te': {
          system: `మీరు "సింక్రనైజేషన్ పాయింట్" అనే వ్యంగ్య సైన్స్-ఫిక్షన్ ప్రాజెక్ట్ కోసం ట్వీట్‌లను రూపొందిస్తున్నారు.

నియమాలు:
1. ${tweetCount} ట్వీట్‌లను తెలుగులో రూపొందించండి
2. ట్వీట్‌లు సంఘటనలపై తెలివైన, వ్యంగ్య వ్యాఖ్యలుగా ఉండాలి
3. ప్రతి ట్వీట్‌కు ప్రత్యేక రచయిత ఉండాలి

JSON ఆకృతిలో ప్రతిస్పందన:
{
  "tweets": [
    {"author": "రచయిత పేరు", "handle": "@handle", "content": "తెలుగులో ట్వీట్", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `ఈ వార్తల గురించి ${tweetCount} ప్రత్యేక తెలుగు ట్వీట్‌లను రూపొందించండి.`
        },
        'bn': {
          system: `আপনি "সিঙ্ক্রোনাইজেশন পয়েন্ট" নামক ব্যঙ্গাত্মক সাই-ফাই প্রকল্পের জন্য টুইট তৈরি করছেন।

নিয়ম:
1. ${tweetCount} টুইট বাংলায় তৈরি করুন
2. টুইটগুলি ঘটনা সম্পর্কে মজার, ব্যঙ্গাত্মক মন্তব্য হওয়া উচিত
3. প্রতিটি টুইটের একজন অনন্য লেখক থাকা উচিত

JSON ফর্ম্যাটে উত্তর:
{
  "tweets": [
    {"author": "লেখকের নাম", "handle": "@handle", "content": "বাংলায় টুইট", "likes": 1234, "retweets": 567}
  ]
}`,
          user: `এই সংবাদ সম্পর্কে ${tweetCount} অনন্য বাংলা টুইট তৈরি করুন।`
        }
      };
      
      const tweetPrompt = tweetPrompts[contentLanguage] || tweetPrompts['uk'];

      const tweetUserPrompt = `CONTEXT:
${storyContext}

NEWS:
${newsContext}

${tweetPrompt.user}`;

      try {
        const tweetContent = await callLLM(llmSettings, tweetPrompt.system, tweetUserPrompt, useOpenAI);
        const tweetResult = JSON.parse(tweetContent);
        
        tweets = (tweetResult.tweets || []).map((t: any) => ({
          ...t,
          likes: t.likes || Math.floor(Math.random() * 2000) + 100,
          retweets: t.retweets || Math.floor(Math.random() * 500) + 50
        }));
        
        // For news, we don't need multilingual tweets - just the language of the news
        // For chapters, we generate all three languages
        if (chapterId) {
          tweets_en = (tweetResult.tweets_en || []).map((t: any) => ({
            ...t,
            likes: t.likes || Math.floor(Math.random() * 2000) + 100,
            retweets: t.retweets || Math.floor(Math.random() * 500) + 50
          }));
          tweets_pl = (tweetResult.tweets_pl || []).map((t: any) => ({
            ...t,
            likes: t.likes || Math.floor(Math.random() * 2000) + 100,
            retweets: t.retweets || Math.floor(Math.random() * 500) + 50
          }));
        }
        
        console.log('Generated', tweets.length, 'tweets in', contentLanguage);
      } catch (tweetError) {
        console.error('Tweet generation failed:', tweetError);
      }
    }

    // Save to chapter if chapterId provided
    if (chapterId) {
      console.log('Saving dialogue to chapter:', chapterId);
      
      const updateData: Record<string, any> = {
        chat_dialogue: dialogueWithLikes,
        chat_dialogue_en: dialogueEnWithLikes,
        chat_dialogue_pl: dialoguePlWithLikes
      };
      
      if (tweets) {
        updateData.tweets = tweets;
        updateData.tweets_en = tweets_en;
        updateData.tweets_pl = tweets_pl;
      }
      
      const { error: updateError } = await supabase
        .from('chapters')
        .update(updateData)
        .eq('id', chapterId);
      
      if (updateError) {
        console.error('Failed to save dialogue to chapter:', updateError);
      } else {
        console.log('Dialogue saved to chapter successfully');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        dialogue: dialogueWithLikes,
        dialogue_en: dialogueEnWithLikes,
        dialogue_pl: dialoguePlWithLikes,
        tweets,
        tweets_en,
        tweets_pl,
        thirdCharacterIncluded: !!thirdCharacter
      }),
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
