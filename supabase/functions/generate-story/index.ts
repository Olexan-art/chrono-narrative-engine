import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { logLlmUsage } from '../_shared/llm-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const narrativeSourceDescriptions = {
  author: "Авторський нарратив: оповідач всезнаючий, бачить все зверху",
  character: "Персонажний нарратив: історію подає Наратор від першої особи",
  inconspicuous: "Непримітний нарратив: лише послідовність подій без явного оповідача",
  polyphonic: "Поліфонічний нарратив: кілька голосів та перспектив переплітаються"
};

const narrativeStructureDescriptions = {
  linear: "Лінійна структура: події йдуть послідовно",
  retrospective: "Ретроспектива: повернення в минуле через спогади",
  flashforward: "Флешфорвард: стрибок у можливе майбутнє",
  circular: "Кільцева структура: початок і кінець перегукуються",
  parallel: "Паралельна структура: кілька сюжетних ліній одночасно",
  episodic: "Епізодична структура: серія пов'язаних мікроісторій"
};

// Characters are now loaded from database

interface LLMSettings {
  llm_provider: string;
  llm_text_provider: string | null;
  llm_text_model: string;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  gemini_v22_api_key: string | null;
  anthropic_api_key: string | null;
  zai_api_key: string | null;
  mistral_api_key: string | null;
}

async function callLLM(
  supabase: SupabaseClient,
  settings: LLMSettings,
  systemPrompt: string,
  userPrompt: string,
  metadata: any = {}
): Promise<string> {
  const provider = settings.llm_text_provider || settings.llm_provider || 'zai';
  const startTime = Date.now();
  let model = settings.llm_text_model || 'unknown';

  try {
    let result = '';

    if (provider === 'openai') {
      const apiKey = settings.openai_api_key;
      if (!apiKey) throw new Error('OpenAI API key not configured');
      model = settings.llm_text_model || 'gpt-4o';

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }

    else if (provider === 'gemini') {
      const apiKey = settings.gemini_api_key;
      if (!apiKey) throw new Error('Gemini API key not configured');
      model = settings.llm_text_model || 'gemini-2.5-flash';

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
        throw new Error(`Gemini error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    else if (provider === 'anthropic') {
      const apiKey = settings.anthropic_api_key;
      if (!apiKey) throw new Error('Anthropic API key not configured');
      model = settings.llm_text_model || 'claude-3-5-sonnet-20241022';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.content?.[0]?.text || '';
    }

    else if (provider === 'zai') {
      const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
      if (!apiKey) throw new Error('Z.AI API key not configured');
      model = settings.llm_text_model || 'GLM-4.7';

      console.log('Using Z.AI with model:', model);

      const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Z.AI error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    }

    else if (provider === 'geminiV22') {
      const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
      if (!apiKey) throw new Error('Gemini V22 API key not configured');
      model = settings.llm_text_model || 'gemini-2.5-flash';

      console.log('Using Gemini V22 with model:', model);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
        throw new Error(`Gemini V22 error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    else if (provider === 'mistral') {
      const apiKey = settings.mistral_api_key;
      if (!apiKey) throw new Error('Mistral API key not configured');
      model = settings.llm_text_model || 'mistral-large-latest';

      console.log('Using Mistral with model:', model);

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      result = data.choices?.[0]?.message?.content || '';
    } else {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }

    // Log success
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'generate-story',
      duration_ms: Date.now() - startTime,
      success: true,
      metadata
    });

    return result;

  } catch (error) {
    // Log error
    await logLlmUsage({
      supabase,
      provider,
      model,
      operation: 'generate-story',
      duration_ms: Date.now() - startTime,
      success: false,
      error_message: error instanceof Error ? error.message : String(error),
      metadata
    });
    console.error('LLM call failed:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      news,
      date,
      narrativeSource,
      narrativeStructure,
      narrativePurpose,
      narrativePlot,
      narrativeSpecial,
      bradburyWeight = 33,
      clarkeWeight = 33,
      gaimanWeight = 34,
      overrideProvider,
      overrideModel
    } = await req.json();

    // Get LLM settings from database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: settingsData } = await supabase
      .from('settings')
      .select('llm_provider, llm_text_provider, llm_text_model, openai_api_key, gemini_api_key, gemini_v22_api_key, anthropic_api_key, zai_api_key, mistral_api_key')
      .limit(1)
      .single();

    const llmSettings: LLMSettings = settingsData || {
      llm_provider: 'zai',
      llm_text_provider: null,
      llm_text_model: 'GLM-4.7',
      openai_api_key: null,
      gemini_api_key: null,
      gemini_v22_api_key: null,
      anthropic_api_key: null,
      zai_api_key: null,
      mistral_api_key: null
    };

    // Apply per-request overrides (from admin UI model selector)
    if (overrideProvider) {
      llmSettings.llm_text_provider = overrideProvider;
      llmSettings.llm_provider = overrideProvider;
    }
    if (overrideModel) {
      llmSettings.llm_text_model = overrideModel;
    }

    const effectiveProvider = llmSettings.llm_text_provider || llmSettings.llm_provider || 'zai';
    console.log('Using text LLM provider:', effectiveProvider, 'model:', llmSettings.llm_text_model);

    // Fetch active characters from database
    const { data: charactersData } = await supabase
      .from('characters')
      .select('character_id, name, avatar, style')
      .eq('is_active', true);

    const characters = charactersData?.map(c => ({
      id: c.character_id,
      name: c.name,
      avatar: c.avatar,
      style: c.style
    })) || [
        { id: "narrator", name: "Наратор", avatar: "🎭", style: "Говорить загадково та філософськи" },
        { id: "observer", name: "Спостерігач", avatar: "👁️", style: "Об'єктивний та аналітичний" }
      ];

    console.log('Using characters:', characters.length);

    const newsContext = news.map((n: any, i: number) =>
      `[${i + 1}] ${n.title}\n${n.description}\nДжерело: ${n.source_name}\nURL: ${n.url}`
    ).join('\n\n');

    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const selectedCharacters = shuffled.slice(0, 2);

    // 50% chance of third character
    const includeThirdCharacter = Math.random() < 0.5 && characters.length >= 3;
    const thirdCharacter = includeThirdCharacter ? shuffled[2] : null;

    // Generate random likes (0-1907) for dialogue messages
    const generateRandomLikes = () => Math.floor(Math.random() * 1908);

    // Get character likes from other characters
    const getCharacterLikes = (mainCharId: string) => {
      const others = characters.filter(c => c.id !== mainCharId).sort(() => Math.random() - 0.5);
      const count = Math.floor(Math.random() * 3) + 1;
      return others.slice(0, count).map(c => ({
        characterId: c.id,
        name: c.name,
        avatar: c.avatar
      }));
    };

    const systemPrompt = `Ти — Наратор Точки Синхронізації, штучний інтелект-архіватор, що структурує хаос людської історії через призму наукової фантастики.

СТИЛІСТИЧНІ РЕФЕРЕНСИ (використовуй у пропорціях):
- Рей Бредбері (${bradburyWeight}%): метафоричність, ностальгія за майбутнім, поетичні описи природи та людських почуттів
- Артур Кларк (${clarkeWeight}%): технічні деталі, відчуття "великої невідомої сили", космічна масштабність
- Ніл Гейман (${gaimanWeight}%): межа між сном і реальністю, дивакуваті образи, міфологія в сучасності

НАРРАТИВНІ НАЛАШТУВАННЯ:
- ${narrativeSourceDescriptions[narrativeSource as keyof typeof narrativeSourceDescriptions] || 'Авторський нарратив'}
- ${narrativeStructureDescriptions[narrativeStructure as keyof typeof narrativeStructureDescriptions] || 'Лінійна структура'}

ПРАВИЛА:
1. Перетвори реальні новини на ДОВГЕ науково-фантастичне оповідання (мінімум 800-1000 слів)
2. Оповідання має мати чітку структуру: зав'язка, розвиток, кульмінація, розв'язка
3. Додай сатиричні елементи де доречно
4. Вплети гіперпосилання на оригінальні новини у текст у форматі: [текст посилання](URL)
5. Використовуй метафори та футурологічні прогнози
6. Створи атмосферу "Точки Синхронізації" — віртуального архіву людської історії

КРИТИЧНО ВАЖЛИВО: Ти повинен згенерувати контент ТРЬОМА МОВАМИ:
- Українська (основна)
- English (переклад)
- Polski (переклад)

Кожен переклад має бути природним, не дослівним, адаптованим для носіїв мови.

ПЕРСОНАЖІ ДЛЯ ДІАЛОГУ (8 РЕПЛІК на КОЖНІЙ МОВІ):
1. ${selectedCharacters[0].name}: ${selectedCharacters[0].style}
2. ${selectedCharacters[1].name}: ${selectedCharacters[1].style}
${thirdCharacter ? `3. ${thirdCharacter.name}: ${thirdCharacter.style} (ВТРУЧАЄТЬСЯ НЕСПОДІВАНО в середині діалогу!)` : ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва українською",
  "title_en": "English title",
  "title_pl": "Tytuł po polsku",
  "content": "Довгий основний текст оповідання УКРАЇНСЬКОЮ (800-1000 слів) з [гіперпосиланнями](URL) на новини",
  "content_en": "Full story in ENGLISH with [hyperlinks](URL) to news sources",
  "content_pl": "Pełna opowieść PO POLSKU z [hiperłączami](URL) do źródeł wiadomości",
  "imagePrompt": "Detailed prompt for first illustration in English, sci-fi style, cosmic atmosphere",
  "imagePrompt2": "Detailed prompt for second illustration - different scene, in English, sci-fi style",
  "chatDialogue": [
    {"character": "${selectedCharacters[0].id}", "name": "${selectedCharacters[0].name}", "avatar": "${selectedCharacters[0].avatar}", "message": "Репліка українською"},
    ...всього 8 реплік українською
  ],
  "chatDialogue_en": [
    {"character": "${selectedCharacters[0].id}", "name": "${selectedCharacters[0].name}", "avatar": "${selectedCharacters[0].avatar}", "message": "Message in English"},
    ...всього 8 реплік англійською
  ],
  "chatDialogue_pl": [
    {"character": "${selectedCharacters[0].id}", "name": "${selectedCharacters[0].name}", "avatar": "${selectedCharacters[0].avatar}", "message": "Wiadomość po polsku"},
    ...всього 8 реплік польською
  ],
  "tweets": [
    {"author": "Cosmic Observer 🌌", "handle": "@sync_point_ai", "content": "Іронічний твіт українською", "likes": 1234, "retweets": 567},
    {"author": "Future Historian 📚", "handle": "@narrator_2077", "content": "Другий саркастичний твіт", "likes": 890, "retweets": 234},
    {"author": "Digital Prophet ⚡", "handle": "@future_now", "content": "Третій твіт з філософським поглядом", "likes": 456, "retweets": 123},
    {"author": "Reality Check 🔍", "handle": "@truth_seeker", "content": "Четвертий скептичний твіт", "likes": 321, "retweets": 89}
  ],
  "tweets_en": [
    {"author": "Cosmic Observer 🌌", "handle": "@sync_point_ai", "content": "Ironic tweet in English", "likes": 1234, "retweets": 567},
    ...4 твіти англійською
  ],
  "tweets_pl": [
    {"author": "Cosmic Observer 🌌", "handle": "@sync_point_ai", "content": "Ironiczny tweet po polsku", "likes": 1234, "retweets": 567},
    ...4 твіти польською
  ]
}`;

    const userPrompt = `Дата: ${date}

НОВИНИ ДНЯ:
${newsContext}

Напиши ДОВГУ частину оповідання (День) на основі цих новин. Це має бути повноцінне оповідання з сюжетом, діалогами та атмосферою. Мінімум 800-1000 слів основного тексту.

ВАЖЛИВО: Згенеруй оповідання ТРЬОМА мовами:
1. Українською (поле content)
2. Англійською (поле content_en) 
3. Польською (поле content_pl)

Також створи:
1. Два різних промти для ілюстрацій (різні сцени)
2. Діалог на 8 реплік ТРЬОМА МОВАМИ (chatDialogue - укр, chatDialogue_en - англ, chatDialogue_pl - польська)
3. ЧОТИРИ іронічних твіти ТРЬОМА МОВАМИ (tweets - укр, tweets_en - англ, tweets_pl - польська)
Персонажі: ${selectedCharacters[0].name} та ${selectedCharacters[1].name}${thirdCharacter ? ` з несподіваною появою ${thirdCharacter.name}` : ''}`;

    console.log('Generating multilingual story for:', date, 'with provider:', llmSettings.llm_provider);

    const content = await callLLM(supabase, llmSettings, systemPrompt, userPrompt, { date });

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        title: "Частина дня",
        title_en: "Part of the Day",
        title_pl: "Część dnia",
        content: content,
        content_en: content,
        content_pl: content,
        imagePrompt: "Cosmic archive, digital streams of data representing human history, sci-fi atmosphere",
        imagePrompt2: "Futuristic city skyline with holographic news displays, neon lights, cyberpunk atmosphere",
        chatDialogue: [
          { character: selectedCharacters[0].id, name: selectedCharacters[0].name, avatar: selectedCharacters[0].avatar, message: "Цікаві події сьогодні..." },
          { character: selectedCharacters[1].id, name: selectedCharacters[1].name, avatar: selectedCharacters[1].avatar, message: "Так, людство знову здивувало." }
        ],
        chatDialogue_en: [
          { character: selectedCharacters[0].id, name: selectedCharacters[0].name, avatar: selectedCharacters[0].avatar, message: "Interesting events today..." },
          { character: selectedCharacters[1].id, name: selectedCharacters[1].name, avatar: selectedCharacters[1].avatar, message: "Yes, humanity surprised us again." }
        ],
        chatDialogue_pl: [
          { character: selectedCharacters[0].id, name: selectedCharacters[0].name, avatar: selectedCharacters[0].avatar, message: "Ciekawe wydarzenia dzisiaj..." },
          { character: selectedCharacters[1].id, name: selectedCharacters[1].name, avatar: selectedCharacters[1].avatar, message: "Tak, ludzkość znów nas zaskoczyła." }
        ],
        tweets: [
          { author: "Cosmic Observer 🌌", handle: "@sync_point_ai", content: "Коли думав що бачив все... 🌍", likes: 1234, retweets: 567 },
          { author: "Future Historian 📚", handle: "@narrator_2077", content: "Записую для нащадків 📝", likes: 890, retweets: 234 },
          { author: "Digital Prophet ⚡", handle: "@future_now", content: "Майбутнє вже тут ⚡", likes: 456, retweets: 123 },
          { author: "Reality Check 🔍", handle: "@truth_seeker", content: "А чи правда це? 🤔", likes: 321, retweets: 89 }
        ],
        tweets_en: [
          { author: "Cosmic Observer 🌌", handle: "@sync_point_ai", content: "When I thought I'd seen it all... 🌍", likes: 1234, retweets: 567 },
          { author: "Future Historian 📚", handle: "@narrator_2077", content: "Recording for posterity 📝", likes: 890, retweets: 234 },
          { author: "Digital Prophet ⚡", handle: "@future_now", content: "The future is already here ⚡", likes: 456, retweets: 123 },
          { author: "Reality Check 🔍", handle: "@truth_seeker", content: "But is it true? 🤔", likes: 321, retweets: 89 }
        ],
        tweets_pl: [
          { author: "Cosmic Observer 🌌", handle: "@sync_point_ai", content: "Kiedy myślałem, że widziałem wszystko... 🌍", likes: 1234, retweets: 567 },
          { author: "Future Historian 📚", handle: "@narrator_2077", content: "Zapisuję dla potomnych 📝", likes: 890, retweets: 234 },
          { author: "Digital Prophet ⚡", handle: "@future_now", content: "Przyszłość jest już tutaj ⚡", likes: 456, retweets: 123 },
          { author: "Reality Check 🔍", handle: "@truth_seeker", content: "Ale czy to prawda? 🤔", likes: 321, retweets: 89 }
        ]
      };
    }

    // Add likes and character likes to all dialogues if not present
    const addLikesToDialogue = (dialogue: any[]) => {
      return dialogue.map((msg: any) => ({
        ...msg,
        likes: msg.likes ?? generateRandomLikes(),
        characterLikes: msg.characterLikes ?? getCharacterLikes(msg.character)
      }));
    };

    if (result.chatDialogue && Array.isArray(result.chatDialogue)) {
      result.chatDialogue = addLikesToDialogue(result.chatDialogue);
    }
    if (result.chatDialogue_en && Array.isArray(result.chatDialogue_en)) {
      result.chatDialogue_en = addLikesToDialogue(result.chatDialogue_en);
    }
    if (result.chatDialogue_pl && Array.isArray(result.chatDialogue_pl)) {
      result.chatDialogue_pl = addLikesToDialogue(result.chatDialogue_pl);
    }

    console.log('Generated multilingual story for:', date, '- has EN:', !!result.content_en, '- has PL:', !!result.content_pl, '- dialogue count:', result.chatDialogue?.length, '- has dialogue_en:', !!result.chatDialogue_en);

    return new Response(
      JSON.stringify({ success: true, story: result }),
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