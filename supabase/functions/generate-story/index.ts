import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const characters = [
  {
    id: "darth_vader",
    name: "Дарт Вейдер",
    avatar: "🖤",
    style: "Говорить низьким голосом, використовує темні метафори, часто згадує Силу та долю. Зверхній та владний тон."
  },
  {
    id: "kratos",
    name: "Кратос",
    avatar: "⚔️",
    style: "Лаконічний та суровий. Говорить про богів, помсту та силу. Часто роздратований або філософськи налаштований."
  },
  {
    id: "deadpool",
    name: "Дедпул",
    avatar: "🔴",
    style: "Саркастичний та самоіронічний. Ламає четверту стіну, жартує про все, використовує сучасний сленг та емодзі."
  },
  {
    id: "geralt",
    name: "Геральт із Рівії",
    avatar: "🐺",
    style: "Цинічний реаліст. Говорить 'Хм' та використовує прості, але влучні фрази. Згадує монстрів та контракти."
  },
  {
    id: "jon_snow",
    name: "Джон Сноу",
    avatar: "🐺",
    style: "Благородний та похмурий. Говорить про честь, обов'язок та зиму. Часто не знає, що відповісти."
  },
  {
    id: "cartman",
    name: "Ерік Картман",
    avatar: "🧢",
    style: "Егоїстичний та маніпулятивний. Перебільшує все, скаржиться, використовує дитячий сленг. Любить їжу."
  },
  {
    id: "scorpion",
    name: "Скорпіон",
    avatar: "🦂",
    style: "Говорить про помсту та честь бійця. Часто каже 'Get over here!' та інші бойові фрази. Серйозний."
  }
];

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
      gaimanWeight = 34
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const newsContext = news.map((n: any, i: number) => 
      `[${i + 1}] ${n.title}\n${n.description}\nДжерело: ${n.source_name}\nURL: ${n.url}`
    ).join('\n\n');

    // Select 2 random characters for dialogue
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const selectedCharacters = shuffled.slice(0, 2);

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
6. Пиши українською мовою
7. Створи атмосферу "Точки Синхронізації" — віртуального архіву людської історії

ПЕРСОНАЖІ ДЛЯ ДІАЛОГУ:
1. ${selectedCharacters[0].name}: ${selectedCharacters[0].style}
2. ${selectedCharacters[1].name}: ${selectedCharacters[1].style}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва частини (креативна, інтригуюча)",
  "content": "Довгий основний текст оповідання (800-1000 слів) з [гіперпосиланнями](URL) на новини",
  "imagePrompt": "Детальний промт для генерації першої ілюстрації англійською мовою, sci-fi style, cosmic atmosphere",
  "imagePrompt2": "Детальний промт для другої ілюстрації - інша сцена або аспект оповідання, англійською мовою, sci-fi style",
  "chatDialogue": [
    {"character": "${selectedCharacters[0].id}", "name": "${selectedCharacters[0].name}", "avatar": "${selectedCharacters[0].avatar}", "message": "Перша репліка персонажа про оповідання"},
    {"character": "${selectedCharacters[1].id}", "name": "${selectedCharacters[1].name}", "avatar": "${selectedCharacters[1].avatar}", "message": "Відповідь другого персонажа"},
    {"character": "${selectedCharacters[0].id}", "name": "${selectedCharacters[0].name}", "avatar": "${selectedCharacters[0].avatar}", "message": "Ще одна репліка"},
    {"character": "${selectedCharacters[1].id}", "name": "${selectedCharacters[1].name}", "avatar": "${selectedCharacters[1].avatar}", "message": "Завершальна репліка"}
  ],
  "tweets": [
    {"author": "Cosmic Observer 🌌", "handle": "@sync_point_ai", "content": "Іронічний твіт про головну подію оповідання з емодзі", "likes": 1234, "retweets": 567},
    {"author": "Future Historian 📚", "handle": "@narrator_2077", "content": "Другий саркастичний твіт з іншого кута зору", "likes": 890, "retweets": 234},
    {"author": "Digital Prophet ⚡", "handle": "@future_now", "content": "Третій твіт з філософським поглядом на події", "likes": 456, "retweets": 123},
    {"author": "Reality Check 🔍", "handle": "@truth_seeker", "content": "Четвертий скептичний твіт", "likes": 321, "retweets": 89}
  ]
}`;

    const userPrompt = `Дата: ${date}

НОВИНИ ДНЯ:
${newsContext}

Напиши ДОВГУ частину оповідання (День) на основі цих новин. Це має бути повноцінне оповідання з сюжетом, діалогами та атмосферою. Мінімум 800-1000 слів основного тексту.

Також створи:
1. Два різних промти для ілюстрацій (різні сцени)
2. Діалог між персонажами ${selectedCharacters[0].name} та ${selectedCharacters[1].name}, де вони коментують події оповідання у своєму характерному стилі (3-4 репліки)
3. ЧОТИРИ іронічних твіти про головну подію від різних персонажів`;

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
    const content = data.choices?.[0]?.message?.content;
    
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        title: "Частина дня",
        content: content,
        imagePrompt: "Cosmic archive, digital streams of data representing human history, sci-fi atmosphere, dark space background with glowing cyan accents",
        imagePrompt2: "Futuristic city skyline with holographic news displays, neon lights reflecting off wet streets, cyberpunk atmosphere",
        chatDialogue: [
          { character: selectedCharacters[0].id, name: selectedCharacters[0].name, avatar: selectedCharacters[0].avatar, message: "Цікаві події сьогодні..." },
          { character: selectedCharacters[1].id, name: selectedCharacters[1].name, avatar: selectedCharacters[1].avatar, message: "Так, людство знову здивувало." }
        ],
        tweets: [
          { author: "Cosmic Observer 🌌", handle: "@sync_point_ai", content: "Коли думав що бачив все... 🌍", likes: 1234, retweets: 567 },
          { author: "Future Historian 📚", handle: "@narrator_2077", content: "Записую для нащадків 📝", likes: 890, retweets: 234 },
          { author: "Digital Prophet ⚡", handle: "@future_now", content: "Майбутнє вже тут ⚡", likes: 456, retweets: 123 },
          { author: "Reality Check 🔍", handle: "@truth_seeker", content: "А чи правда це? 🤔", likes: 321, retweets: 89 }
        ]
      };
    }

    console.log('Generated story for:', date);

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
