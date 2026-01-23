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

    const systemPrompt = `Ти — Наратор Точки Синхронізації, штучний інтелект-архіватор, що структурує хаос людської історії через призму наукової фантастики.

СТИЛІСТИЧНІ РЕФЕРЕНСИ (використовуй у пропорціях):
- Рей Бредбері (${bradburyWeight}%): метафоричність, ностальгія за майбутнім, поетичні описи природи та людських почуттів
- Артур Кларк (${clarkeWeight}%): технічні деталі, відчуття "великої невідомої сили", космічна масштабність
- Ніл Гейман (${gaimanWeight}%): межа між сном і реальністю, дивакуваті образи, міфологія в сучасності

НАРРАТИВНІ НАЛАШТУВАННЯ:
- ${narrativeSourceDescriptions[narrativeSource as keyof typeof narrativeSourceDescriptions] || 'Авторський нарратив'}
- ${narrativeStructureDescriptions[narrativeStructure as keyof typeof narrativeStructureDescriptions] || 'Лінійна структура'}

ПРАВИЛА:
1. Перетвори реальні новини на науково-фантастичне оповідання
2. Додай сатиричні елементи де доречно
3. Вплети гіперпосилання на оригінальні новини у текст у форматі: [текст посилання](URL)
4. Використовуй метафори та футурологічні прогнози
5. Пиши українською мовою
6. Створи атмосферу "Точки Синхронізації" — віртуального архіву людської історії

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва частини",
  "content": "Основний текст оповідання з [гіперпосиланнями](URL) на новини",
  "imagePrompt": "Детальний промт для генерації ілюстрації англійською мовою, sci-fi style, cosmic atmosphere"
}`;

    const userPrompt = `Дата: ${date}

НОВИНИ ДНЯ:
${newsContext}

Напиши частину оповідання (День) на основі цих новин. Це має бути короткий "спалах" — яскравий опис події через метафори та футурологічні прогнози.`;

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
        imagePrompt: "Cosmic archive, digital streams of data representing human history, sci-fi atmosphere, dark space background with glowing cyan accents"
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
