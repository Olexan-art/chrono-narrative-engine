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
  anthropic_api_key: string | null;
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
      threadProbability = 30
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get LLM settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_provider, llm_text_model, openai_api_key, gemini_api_key, anthropic_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'lovable',
      llm_text_provider: null,
      llm_text_model: 'google/gemini-3-flash-preview',
      openai_api_key: null,
      gemini_api_key: null,
      anthropic_api_key: null
    };

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
      threadProbability
    });

    const charactersList = thirdCharacter 
      ? [...mainCharacters, thirdCharacter]
      : mainCharacters;

    const systemPrompt = `Ти генеруєш діалоги персонажів для сатиричного науково-фантастичного проекту "Точка Синхронізації".

ПЕРСОНАЖІ:
${charactersList.map((c, i) => `${i + 1}. ${c.name} (${c.avatar}): ${c.style}`).join('\n')}

${thirdCharacter ? `ВАЖЛИВО: Третій персонаж ${thirdCharacter.name} має втрутитись у розмову несподівано, коли двоє інших вже розмовляють. Це має бути комічний момент.` : ''}

ПРАВИЛА:
1. Згенеруй ${messageCount} повідомлень діалогу ТРЬОМА МОВАМИ (українська, англійська, польська)
2. Кожен персонаж говорить у своєму унікальному стилі
3. Діалог має коментувати події з новин сатирично та філософськи
4. ${thirdCharacter ? `Третій персонаж з'являється приблизно в середині діалогу` : 'Діалог між двома персонажами'}
5. Репліки мають бути влучними та гострими, від 1 до 3 речень

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "dialogue": [
    {"character": "character_id", "name": "Ім'я", "avatar": "емодзі", "message": "Репліка українською"}
  ],
  "dialogue_en": [
    {"character": "character_id", "name": "Ім'я", "avatar": "емодзі", "message": "Message in English"}
  ],
  "dialogue_pl": [
    {"character": "character_id", "name": "Ім'я", "avatar": "емодзі", "message": "Wiadomość po polsku"}
  ]
}`;

    const userPrompt = `КОНТЕКСТ ОПОВІДАННЯ:
${storyContext}

НОВИНИ:
${newsContext}

Згенеруй ${messageCount} реплік діалогу ТРЬОМА МОВАМИ між персонажами${thirdCharacter ? `, включаючи несподівану появу ${thirdCharacter.name}` : ''}.
Українською у "dialogue", англійською у "dialogue_en", польською у "dialogue_pl".`;

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

    return new Response(
      JSON.stringify({ 
        success: true, 
        dialogue: dialogueWithLikes,
        dialogue_en: dialogueEnWithLikes,
        dialogue_pl: dialoguePlWithLikes,
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
