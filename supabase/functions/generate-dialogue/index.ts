import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LLMSettings {
  llm_provider: string;
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
  character: string;
  name: string;
  avatar: string;
  message: string;
  likes: number;
  characterLikes: CharacterLike[];
}

interface CharacterLike {
  characterId: string;
  name: string;
  avatar: string;
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

  const provider = settings.llm_provider || 'lovable';
  
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
      messageCount = 8 // Default 8 messages (was 4, now +4)
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get LLM settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_model, openai_api_key, gemini_api_key, anthropic_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'lovable',
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

    // Select 2 main characters
    const shuffled = [...allCharacters].sort(() => Math.random() - 0.5);
    const mainCharacters = shuffled.slice(0, 2);

    // 50% chance of 3rd character intervention
    const includeThirdCharacter = Math.random() < 0.5 && allCharacters.length >= 3;
    let thirdCharacter: Character | null = null;
    if (includeThirdCharacter) {
      const remaining = shuffled.filter(c => !mainCharacters.includes(c));
      thirdCharacter = remaining[0] || null;
    }

    console.log('Dialogue generation:', {
      mainCharacters: mainCharacters.map(c => c.name),
      thirdCharacter: thirdCharacter?.name || 'none',
      messageCount,
      useOpenAI
    });

    const charactersList = thirdCharacter 
      ? [...mainCharacters, thirdCharacter]
      : mainCharacters;

    const systemPrompt = `Ти генеруєш діалоги персонажів для сатиричного науково-фантастичного проекту "Точка Синхронізації".

ПЕРСОНАЖІ:
${charactersList.map((c, i) => `${i + 1}. ${c.name} (${c.avatar}): ${c.style}`).join('\n')}

${thirdCharacter ? `ВАЖЛИВО: Третій персонаж ${thirdCharacter.name} має втрутитись у розмову несподівано, коли двоє інших вже розмовляють. Це має бути комічний момент.` : ''}

ПРАВИЛА:
1. Згенеруй ${messageCount} повідомлень діалогу
2. Кожен персонаж говорить у своєму унікальному стилі
3. Діалог має коментувати події з новин сатирично та філософськи
4. ${thirdCharacter ? `Третій персонаж з'являється приблизно в середині діалогу` : 'Діалог між двома персонажами'}
5. Репліки мають бути влучними та гострими, від 1 до 3 речень

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "dialogue": [
    {"character": "character_id", "name": "Ім'я", "avatar": "емодзі", "message": "Репліка українською"}
  ]
}`;

    const userPrompt = `КОНТЕКСТ ОПОВІДАННЯ:
${storyContext}

НОВИНИ:
${newsContext}

Згенеруй ${messageCount} реплік діалогу між персонажами${thirdCharacter ? `, включаючи несподівану появу ${thirdCharacter.name}` : ''}.`;

    const content = await callLLM(llmSettings, systemPrompt, userPrompt, useOpenAI);

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Fallback dialogue
      result = {
        dialogue: mainCharacters.flatMap((char, idx) => [
          { character: char.character_id, name: char.name, avatar: char.avatar, message: "Цікаві події сьогодні..." },
          { character: mainCharacters[(idx + 1) % 2].character_id, name: mainCharacters[(idx + 1) % 2].name, avatar: mainCharacters[(idx + 1) % 2].avatar, message: "Так, людство знову здивувало." }
        ]).slice(0, messageCount)
      };
    }

    // Add likes and character likes to each message
    const dialogueWithLikes: DialogueMessage[] = result.dialogue.map((msg: any) => {
      const baseLikes = generateRandomLikes();
      
      // Select 1-3 related characters for character likes
      const likeGiversCount = Math.floor(Math.random() * 3) + 1;
      const likeGivers = selectRelatedCharacters(allCharacters, [mainCharacters.find(c => c.character_id === msg.character)!].filter(Boolean), likeGiversCount);
      
      const characterLikes: CharacterLike[] = likeGivers.map(c => ({
        characterId: c.character_id,
        name: c.name,
        avatar: c.avatar
      }));

      return {
        character: msg.character,
        name: msg.name,
        avatar: msg.avatar,
        message: msg.message,
        likes: baseLikes,
        characterLikes
      };
    });

    console.log('Generated dialogue with', dialogueWithLikes.length, 'messages');

    return new Response(
      JSON.stringify({ 
        success: true, 
        dialogue: dialogueWithLikes,
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
