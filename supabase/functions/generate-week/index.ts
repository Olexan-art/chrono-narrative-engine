import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      weekParts,
      previousContent,
      weekStart,
      weekEnd,
      part,
      totalParts,
      includeMonologue,
      includeCommentary
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Prepare context from week parts
    const partsContext = weekParts.map((p: any) => 
      `=== ${p.date} ===\n${p.title}\n${p.content?.slice(0, 1500) || ''}`
    ).join('\n\n');

    // Collect all news
    const allNews = weekParts.flatMap((p: any) => p.news_sources || []);
    const newsContext = allNews.slice(0, 30).map((n: any, i: number) => 
      `[${i + 1}] ${n.title} (${n.url})`
    ).join('\n');

    let systemPrompt = '';
    let userPrompt = '';

    if (part === 1) {
      systemPrompt = `Ти — Наратор Точки Синхронізації, штучний інтелект-архіватор. 
Твоє завдання — створити ПЕРШУ ЧАСТИНУ великого тижневого синтезу.

СТИЛІСТИКА:
- Поетична та філософська мова
- Метафори космосу та часу
- Плавні переходи між подіями тижня
- Українська мова

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Перша частина тексту (~1000 слів). Починай з інтригуючого вступу про цей тиждень. Плавно переходь від однієї події до іншої.",
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

НОВИНИ (для посилань):
${newsContext}

Напиши ПЕРШУ ЧАСТИНУ (~1000 слів) великого синтезу тижня. Це початок — зав'язка та перші події. Пиши так, ніби це перший акт великої п'єси.`;

    } else if (part === 2) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ПРОДОВЖИТИ тижневий синтез. Це ДРУГА ЧАСТИНА.

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Друга частина тексту (~1000 слів). Продовжуй розповідь, розвивай теми, додавай нові події тижня.",
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши ДРУГУ ЧАСТИНУ (~1000 слів). Це середина — розвиток подій, кульмінація. Продовжуй стиль попередньої частини.`;

    } else if (part === 3) {
      systemPrompt = `Ти — Наратор Точки Синхронізації. 
Твоє завдання — ЗАВЕРШИТИ тижневий синтез. Це ФІНАЛЬНА ЧАСТИНА.

ОБОВ'ЯЗКОВО ВКЛЮЧИ:
1. Завершення оповідання (~800 слів)
2. МОНОЛОГ НЕЗНАЙОМЦЯ — таємничий персонаж, який з'являється наприкінці кожного тижня. Він говорить загадками, натякає на приховані зв'язки між подіями. 3-4 параграфи.
3. КОМЕНТАР НАРАТОРА — підсумок тижня від імені ШІ-архіватора. Філософські роздуми про людство. 2-3 параграфи.
4. Назва глави (креативна, інтригуюча)
5. Промт для обкладинки

Ти вже написав:
${previousContent?.slice(-2000) || ''}

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "title": "Назва глави",
  "content": "Фінальна частина тексту (~800 слів) з розв'язкою",
  "strangerMonologue": "Монолог Незнайомця (3-4 параграфи). Він говорить від першої особи, загадково, з натяками.",
  "narratorCommentary": "Коментар Наратора (2-3 параграфи). Від імені ШІ-архіватора, філософський підсумок.",
  "summary": "Короткий опис глави (1-2 речення)",
  "imagePrompt": "Detailed prompt for chapter cover image, epic sci-fi style, cosmic atmosphere, English language",
  "wordCount": 1000
}`;

      userPrompt = `ТИЖДЕНЬ: ${weekStart} — ${weekEnd}

ОПОВІДАННЯ ТИЖНЯ:
${partsContext}

Напиши ФІНАЛЬНУ ЧАСТИНУ. Заверши оповідання, додай Монолог Незнайомця та Коментар Наратора.`;
    }

    console.log(`Generating week part ${part}/${totalParts} for ${weekStart}`);

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
        content: content,
        wordCount: content?.split(/\s+/).length || 0
      };
    }

    console.log(`Generated part ${part} with ~${result.wordCount} words`);

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
