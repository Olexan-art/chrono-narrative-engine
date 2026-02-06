import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper to trigger cache update for a news page
async function updateNewsCache(
  countryCode: string, 
  slug: string, 
  supabaseUrl: string
): Promise<void> {
  try {
    const path = `/news/${countryCode}/${slug}`;
    console.log(`Updating cache for news page: ${path}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/cache-pages?action=refresh-single&path=${encodeURIComponent(path)}&password=${Deno.env.get('ADMIN_PASSWORD')}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to update cache for ${path}:`, response.status);
    } else {
      const result = await response.json();
      console.log(`Cache updated for ${path}: ${result.success ? 'OK' : result.error}`);
    }
  } catch (error) {
    console.error(`Error updating cache for news page:`, error);
  }
}

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

async function callLLM(settings: LLMSettings, systemPrompt: string, userPrompt: string, overrideModel?: string): Promise<string> {
  const model = overrideModel || settings.llm_text_model || 'google/gemini-3-flash-preview';
  
  // Determine provider from model name if override model is passed
  let provider = settings.llm_text_provider || settings.llm_provider || 'lovable';
  
  // Auto-detect provider from model prefix to prevent mismatches
  if (overrideModel) {
    if (overrideModel.startsWith('google/') || overrideModel.startsWith('gemini')) {
      provider = 'lovable'; // Use Lovable AI gateway for Google models
    } else if (overrideModel.startsWith('openai/') || overrideModel.startsWith('gpt')) {
      provider = 'lovable'; // Use Lovable AI gateway for OpenAI models
    } else if (overrideModel.startsWith('mistral-') || overrideModel.startsWith('codestral')) {
      provider = 'mistral';
    } else if (overrideModel.startsWith('GLM-') || overrideModel.startsWith('glm-')) {
      provider = 'zai';
    } else if (overrideModel.startsWith('claude')) {
      provider = 'anthropic';
    }
  }
  
  // Z.AI provider - OpenAI-compatible API
  if (provider === 'zai') {
    const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('Z.AI API key not configured');

    console.log('Using Z.AI with model:', model || 'GLM-4.7');
    
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'GLM-4.7',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
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
  
  if (provider === 'lovable' || !settings.openai_api_key) {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    console.log('Using Lovable AI with model:', model);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your workspace.');
      }
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
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
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
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
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

  // Gemini V22 provider - direct Google AI API with v22 key
  if (provider === 'geminiV22') {
    const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
    if (!apiKey) throw new Error('Gemini V22 API key not configured');

    const modelName = model || 'gemini-2.5-flash';
    console.log('Using Gemini V22 with model:', modelName);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
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

  // Mistral provider
  if (provider === 'mistral') {
    const apiKey = settings.mistral_api_key;
    if (!apiKey) throw new Error('Mistral API key not configured');

    const modelName = model || 'mistral-large-latest';
    console.log('Using Mistral with model:', modelName);

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral error:', response.status, errorText);
      throw new Error(`Mistral error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsId, model } = await req.json();
    
    if (!newsId) {
      return new Response(JSON.stringify({ error: 'newsId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get news article with country info and original content
    const { data: news, error: newsError } = await supabase
      .from('news_rss_items')
      .select('*, country:news_countries(code), original_content')
      .eq('id', newsId)
      .single();

    if (newsError || !news) {
      throw new Error('News article not found');
    }

    // Detect language based on content or country
    const detectLanguage = (): { code: string; name: string; nativeName: string } => {
      // Check for Indian language content
      if (news.content_hi || news.title_hi) return { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' };
      if (news.content_ta || news.title_ta) return { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' };
      if (news.content_te || news.title_te) return { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' };
      if (news.content_bn || news.title_bn) return { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' };
      
      // Check country code
      const countryCode = news.country?.code?.toLowerCase();
      if (countryCode === 'ua') return { code: 'uk', name: 'Ukrainian', nativeName: 'українська' };
      if (countryCode === 'pl') return { code: 'pl', name: 'Polish', nativeName: 'polski' };
      if (countryCode === 'in') return { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' };
      
      // Default to English
      return { code: 'en', name: 'English', nativeName: 'English' };
    };

    const language = detectLanguage();
    console.log('Retelling news in language:', language.name, '| Title:', news.title);

    // Language-specific prompts for retelling with key points, themes, and keywords
    // First paragraph MUST answer: Who, What, Where, When, Why (5W)
    const prompts: Record<string, { system: string; user: string }> = {
      'uk': {
        system: `Ти — професійний журналіст та редактор новин. Твоє завдання — переказати новину детально, розширено та інформативно українською мовою.

ФОРМАТ ВІДПОВІДІ (JSON):
{
  "content": "Повний переказ новини (3-5 абзаців, 300-500 слів)",
  "key_points": ["Головна теза 1", "Головна теза 2", "Головна теза 3", "Головна теза 4"],
  "themes": ["Тема1", "Тема2", "Тема3"],
  "keywords": ["ключове слово 1", "ключове слово 2", "ключове слово 3", "ключове слово 4", "ключове слово 5"]
}

КРИТИЧНО ВАЖЛИВО - СТРУКТУРА ПЕРШОГО АБЗАЦУ:
Перший абзац ОБОВ'ЯЗКОВО має відповідати на 5 питань (це для тебе як інструкція, НЕ пиши ці мітки у тексті):
- ХТО — головні дійові особи, організації, країни
- ЩО — що саме сталося, яка подія
- ДЕ — місце, локація, країна
- КОЛИ — дата, час, період
- ЧОМУ — причина, контекст

Приклад ПРАВИЛЬНОГО першого абзацу (БЕЗ міток у тексті):
"Президент США Джо Байден оголосив про новий пакет військової допомоги Україні на суму 2 мільярди доларів у Вашингтоні 15 січня 2025 року у відповідь на посилення російської агресії на східному фронті."

ЗАБОРОНЕНО писати у тексті: "(ХТО)", "(ЩО)", "(ДЕ)", "(КОЛИ)", "(ЧОМУ)" або будь-які інші мітки!

Правила:
1. ПЕРШИЙ АБЗАЦ — суто факти, жодної води, всі 5 елементів природно вплетені в речення
2. Наступні абзаци — деталі, контекст, пояснення
3. key_points — 4-5 найважливіших тез (короткі речення)
4. themes — 2-4 основні тематики (одне-два слова)
5. keywords — 5-8 пошукових слів
6. Пиши журналістським стилем без повторів
7. НЕ вигадуй нові факти`,
        user: `Перекажи цю новину українською. Перший абзац має містити хто, що, де, коли, чому — БЕЗ міток, природний текст. Видай JSON:`
      },
      'en': {
        system: `You are a professional journalist and news editor. Your task is to retell the news in detail, expanded and informatively in English.

RESPONSE FORMAT (JSON):
{
  "content": "Full news retelling (3-5 paragraphs, 300-500 words)",
  "key_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],
  "themes": ["Theme1", "Theme2", "Theme3"],
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
}

CRITICAL - FIRST PARAGRAPH STRUCTURE (Inverted Pyramid / 5W):
The FIRST paragraph MUST answer ALL 5 questions (this is an instruction for you, DO NOT write these labels in the text):
- WHO — main actors, organizations, countries involved
- WHAT — what happened, the main event
- WHERE — location, place, country
- WHEN — date, time, period
- WHY — reason, context, cause

Example of a CORRECT first paragraph (NO labels in text):
"US President Joe Biden announced a $2 billion military aid package for Ukraine in Washington on January 15, 2025, in response to escalating Russian aggression on the eastern front."

FORBIDDEN to write in the text: "(WHO)", "(WHAT)", "(WHERE)", "(WHEN)", "(WHY)" or any other labels!

Rules:
1. FIRST PARAGRAPH — pure facts only, no filler, all 5 elements naturally woven into sentences
2. Following paragraphs — details, context, explanations
3. key_points — 4-5 most important takeaways (short sentences)
4. themes — 2-4 main topics (one-two words each)
5. keywords — 5-8 search keywords
6. Write in journalistic style without repetition
7. DO NOT invent new facts`,
        user: `Retell this news in English. First paragraph must contain who, what, where, when, why — NO labels, natural text. Output JSON:`
      },
      'pl': {
        system: `Jesteś profesjonalnym dziennikarzem i redaktorem wiadomości. Twoim zadaniem jest szczegółowe, rozszerzone i informacyjne opowiedzenie wiadomości po polsku.

FORMAT ODPOWIEDZI (JSON):
{
  "content": "Pełne opowiedzenie wiadomości (3-5 akapitów, 300-500 słów)",
  "key_points": ["Główna teza 1", "Główna teza 2", "Główna teza 3", "Główna teza 4"],
  "themes": ["Temat1", "Temat2", "Temat3"],
  "keywords": ["słowo kluczowe 1", "słowo kluczowe 2", "słowo kluczowe 3", "słowo kluczowe 4", "słowo kluczowe 5"]
}

KRYTYCZNE - STRUKTURA PIERWSZEGO AKAPITU (5W):
Pierwszy akapit MUSI odpowiadać na 5 pytań (to instrukcja dla ciebie, NIE pisz tych etykiet w tekście):
- KTO — główni aktorzy, organizacje, kraje
- CO — co się stało, główne wydarzenie
- GDZIE — lokalizacja, miejsce, kraj
- KIEDY — data, czas, okres
- DLACZEGO — przyczyna, kontekst

Przykład PRAWIDŁOWEGO pierwszego akapitu (BEZ etykiet w tekście):
"Prezydent USA Joe Biden ogłosił pakiet pomocy wojskowej dla Ukrainy o wartości 2 miliardów dolarów w Waszyngtonie 15 stycznia 2025 roku w odpowiedzi na eskalację rosyjskiej agresji na froncie wschodnim."

ZAKAZANE pisanie w tekście: "(KTO)", "(CO)", "(GDZIE)", "(KIEDY)", "(DLACZEGO)" lub jakichkolwiek innych etykiet!

Zasady:
1. PIERWSZY AKAPIT — same fakty, bez wody, wszystkie 5 elementów naturalnie wplecione w zdania
2. Kolejne akapity — szczegóły, kontekst, wyjaśnienia
3. key_points — 4-5 najważniejszych tez (krótkie zdania)
4. themes — 2-4 główne tematy (jedno-dwa słowa)
5. keywords — 5-8 słów kluczowych
6. Pisz stylem dziennikarskim bez powtórzeń
7. NIE wymyślaj nowych faktów`,
        user: `Opowiedz tę wiadomość po polsku. Pierwszy akapit musi zawierać kto, co, gdzie, kiedy, dlaczego — BEZ etykiet, naturalny tekst. Podaj JSON:`
      },
      'hi': {
        system: `आप एक पेशेवर पत्रकार और समाचार संपादक हैं। आपका कार्य समाचार को विस्तार से, विस्तारित और सूचनात्मक रूप से हिंदी में पुनः बताना है।

प्रतिक्रिया प्रारूप (JSON):
{
  "content": "पूर्ण समाचार पुनर्कथन (3-5 पैराग्राफ, 300-500 शब्द)",
  "key_points": ["मुख्य बिंदु 1", "मुख्य बिंदु 2", "मुख्य बिंदु 3", "मुख्य बिंदु 4"],
  "themes": ["विषय1", "विषय2", "विषय3"],
  "keywords": ["कीवर्ड 1", "कीवर्ड 2", "कीवर्ड 3", "कीवर्ड 4", "कीवर्ड 5"]
}

नियम:
1. मूल से सभी प्रमुख तथ्यों को संरक्षित करें
2. संदर्भ का विस्तार करें और महत्वपूर्ण विवरण स्पष्ट करें
3. key_points — समाचार से 4-5 सबसे महत्वपूर्ण बिंदु/निष्कर्ष (संक्षिप्त वाक्य)
4. themes — 2-4 मुख्य श्रेणियां/विषय जो समाचार कवर करता है
5. keywords — इस समाचार को खोजने के लिए 5-8 खोज कीवर्ड
6. स्पष्ट रूप से लिखें, पत्रकारिता शैली में
7. नए तथ्य न बनाएं, केवल मौजूदा को विस्तारित करें`,
        user: `इस समाचार को हिंदी में विस्तार से बताएं और मुख्य बिंदुओं, विषयों और खोज शब्दों के साथ JSON दें:`
      },
      'ta': {
        system: `நீங்கள் ஒரு தொழில்முறை பத்திரிகையாளர் மற்றும் செய்தி ஆசிரியர். உங்கள் பணி செய்தியை விரிவாக, விரிவாக்கப்பட்ட மற்றும் தகவலறிந்த முறையில் தமிழில் மீண்டும் சொல்வது.

விதிகள்:
1. அசலில் இருந்து அனைத்து முக்கிய உண்மைகளையும் பாதுகாக்கவும்
2. சூழலை விரிவாக்கி முக்கியமான விவரங்களை விளக்கவும்
3. தேவைப்பட்டால் தொடர்புடைய பின்னணியைச் சேர்க்கவும்
4. தெளிவாக எழுதுங்கள், மீண்டும் செய்யாமல்
5. பத்திரிகை பாணியைப் பயன்படுத்தவும்
6. நீளம்: 3-5 பத்திகள் (300-500 வார்த்தைகள்)
7. புதிய உண்மைகளை கண்டுபிடிக்க வேண்டாம், தற்போதுள்ளவற்றை மட்டும் விரிவாக்கவும்`,
        user: `இந்த செய்தியை தமிழில் விரிவாக சொல்லுங்கள்:`
      },
      'te': {
        system: `మీరు ఒక ప్రొఫెషనల్ జర్నలిస్ట్ మరియు న్యూస్ ఎడిటర్. మీ పని వార్తను వివరంగా, విస్తరించి మరియు సమాచారంగా తెలుగులో తిరిగి చెప్పడం.

నియమాలు:
1. అసలు నుండి అన్ని కీలక వాస్తవాలను సంరక్షించండి
2. సందర్భాన్ని విస్తరించండి మరియు ముఖ్యమైన వివరాలను వివరించండి
3. అవసరమైతే సంబంధిత నేపథ్యాన్ని జోడించండి
4. స్పష్టంగా రాయండి, పునరావృతం లేకుండా
5. పాత్రికేయ శైలిని ఉపయోగించండి
6. పొడవు: 3-5 పేరాగ్రాఫ్‌లు (300-500 పదాలు)
7. కొత్త వాస్తవాలను కనుగొనవద్దు, ఉన్నవాటిని మాత్రమే విస్తరించండి`,
        user: `ఈ వార్తను తెలుగులో వివరంగా చెప్పండి:`
      },
      'bn': {
        system: `আপনি একজন পেশাদার সাংবাদিক এবং সংবাদ সম্পাদক। আপনার কাজ হল সংবাদটিকে বিস্তারিতভাবে, বিস্তৃত এবং তথ্যপূর্ণভাবে বাংলায় পুনরায় বলা।

নিয়মাবলী:
1. মূল থেকে সমস্ত মূল তথ্য সংরক্ষণ করুন
2. প্রসঙ্গ প্রসারিত করুন এবং গুরুত্বপূর্ণ বিবরণ ব্যাখ্যা করুন
3. প্রয়োজনে প্রাসঙ্গিক পটভূমি যোগ করুন
4. স্পষ্টভাবে লিখুন, পুনরাবৃত্তি ছাড়া
5. সাংবাদিকতা শৈলী ব্যবহার করুন
6. দৈর্ঘ্য: 3-5 অনুচ্ছেদ (300-500 শব্দ)
7. নতুন তথ্য উদ্ভাবন করবেন না, শুধুমাত্র বিদ্যমানগুলি প্রসারিত করুন`,
        user: `এই সংবাদটি বাংলায় বিস্তারিতভাবে বলুন:`
      }
    };

    const prompt = prompts[language.code] || prompts['en'];
    
    // Get the appropriate content based on language
    // IMPORTANT: Use original_content for retelling if available (not the AI-generated content)
    const getContent = () => {
      // Prefer original RSS content (before any AI processing)
      if (news.original_content && news.original_content.length > 50) {
        console.log('Using original_content for retelling:', news.original_content.length, 'chars');
        return news.original_content;
      }
      
      // Fallback to localized content fields (legacy items without original_content)
      if (language.code === 'hi') return news.content_hi || news.content_en || news.content;
      if (language.code === 'ta') return news.content_ta || news.content_en || news.content;
      if (language.code === 'te') return news.content_te || news.content_en || news.content;
      if (language.code === 'bn') return news.content_bn || news.content_en || news.content;
      // For English/other: prefer description over content_en (which might be AI-generated)
      return news.description || news.content || '';
    };

    const getTitle = () => {
      if (language.code === 'hi') return news.title_hi || news.title_en || news.title;
      if (language.code === 'ta') return news.title_ta || news.title_en || news.title;
      if (language.code === 'te') return news.title_te || news.title_en || news.title;
      if (language.code === 'bn') return news.title_bn || news.title_en || news.title;
      if (language.code === 'en') return news.title_en || news.title;
      return news.title;
    };

    const getDescription = () => {
      if (language.code === 'hi') return news.description_hi || news.description_en || news.description;
      if (language.code === 'ta') return news.description_ta || news.description_en || news.description;
      if (language.code === 'te') return news.description_te || news.description_en || news.description;
      if (language.code === 'bn') return news.description_bn || news.description_en || news.description;
      if (language.code === 'en') return news.description_en || news.description;
      return news.description;
    };

    const userPrompt = `${prompt.user}

Title: ${getTitle()}

Description: ${getDescription() || 'No description'}

Original content: ${getContent() || 'No content'}

Category: ${news.category || 'general'}`;

    const rawResponse = await callLLM(settings as LLMSettings, prompt.system, userPrompt, model);

    // Parse JSON response or use raw content as fallback
    let retoldContent = rawResponse;
    let keyPoints: string[] = [];
    let themes: string[] = [];
    let keywords: string[] = [];

    try {
      // Try to extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                        rawResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, rawResponse];
      const jsonStr = jsonMatch[1] || rawResponse;
      
      // Try to parse as JSON
      const parsed = JSON.parse(jsonStr.trim());
      if (parsed.content) {
        retoldContent = parsed.content;
      }
      if (Array.isArray(parsed.key_points)) {
        keyPoints = parsed.key_points.slice(0, 5);
      }
      if (Array.isArray(parsed.themes)) {
        themes = parsed.themes.slice(0, 4);
      }
      if (Array.isArray(parsed.keywords)) {
        keywords = parsed.keywords.slice(0, 8);
      }
      console.log('Parsed JSON response - key_points:', keyPoints.length, 'themes:', themes.length, 'keywords:', keywords.length);
    } catch (parseError) {
      // If JSON parsing fails, use raw content
      console.log('Response is not JSON, using raw content');
    }

    // Determine which field to update based on language
    const getUpdateField = () => {
      if (language.code === 'hi') return 'content_hi';
      if (language.code === 'ta') return 'content_ta';
      if (language.code === 'te') return 'content_te';
      if (language.code === 'bn') return 'content_bn';
      if (language.code === 'en') return 'content_en';
      return 'content';
    };

    // Build update data with content and metadata
    const updateField = getUpdateField();
    const updateData: Record<string, unknown> = {
      [updateField]: retoldContent
    };

    // Add key_points, themes, keywords if extracted
    if (keyPoints.length > 0) {
      updateData.key_points = keyPoints;
    }
    if (themes.length > 0) {
      updateData.themes = themes;
    }
    if (keywords.length > 0) {
      updateData.keywords = keywords;
    }

    // Update the news article with the retold content and metadata
    const { error: updateError } = await supabase
      .from('news_rss_items')
      .update(updateData)
      .eq('id', newsId);

    if (updateError) {
      console.error('Error updating news:', updateError);
      throw new Error('Failed to save retold content');
    }

    console.log('Retold content saved to field:', updateField, '| key_points:', keyPoints.length, '| themes:', themes.length, '| keywords:', keywords.length);

    // Get settings for dialogue and tweet counts
    const dialogueCount = settings.news_dialogue_count ?? 5;
    const tweetCount = settings.news_tweet_count ?? 4;
    
    // Auto-generate dialogues AND tweets for this news article
    let generatedTweets = null;
    let generatedDialogue = null;
    try {
      console.log('Auto-generating dialogue and tweets for news in language:', language.code);
      
      // Call generate-dialogue function with both dialogue and tweets
      const dialogueResponse = await fetch(`${supabaseUrl}/functions/v1/generate-dialogue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storyContext: `News article: ${getTitle()}`,
          newsContext: `${getDescription() || ''}\n\n${retoldContent}`,
          generateTweets: true,
          tweetCount: tweetCount,
          contentLanguage: language.code,
          messageCount: dialogueCount, // Generate dialogue as well
          enableThreading: true,
          threadProbability: 30,
        }),
      });

      if (dialogueResponse.ok) {
        const dialogueResult = await dialogueResponse.json();
        const updateData: Record<string, unknown> = {};
        
        // Save dialogue
        if (dialogueResult.success && dialogueResult.dialogue && dialogueResult.dialogue.length > 0) {
          generatedDialogue = dialogueResult.dialogue;
          updateData.chat_dialogue = generatedDialogue;
          console.log('Generated', generatedDialogue.length, 'dialogue messages');
        }
        
        // Save tweets
        if (dialogueResult.tweets && dialogueResult.tweets.length > 0) {
          generatedTweets = dialogueResult.tweets;
          updateData.tweets = generatedTweets;
          console.log('Generated', generatedTweets.length, 'tweets');
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('news_rss_items')
            .update(updateData)
            .eq('id', newsId);
          
          if (updateError) {
            console.error('Error saving dialogue/tweets:', updateError);
          } else {
            console.log('Successfully saved dialogue and tweets for news', newsId);
          }
        }
      } else {
        console.error('Dialogue generation request failed:', dialogueResponse.status);
      }
    } catch (dialogueError) {
      console.error('Error generating dialogue/tweets:', dialogueError);
      // Don't fail the whole operation if dialogue generation fails
    }

    // Search Wikipedia for entities mentioned in the news
    try {
      if (keywords && keywords.length > 0) {
        console.log('Searching Wikipedia for entities from keywords:', keywords);
        
        const wikiResponse = await fetch(`${supabaseUrl}/functions/v1/search-wiki`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            newsId,
            title: getTitle(),
            keywords,
            language: language.code === 'uk' ? 'uk' : language.code === 'pl' ? 'pl' : 'en',
          }),
        });

        if (wikiResponse.ok) {
          const wikiResult = await wikiResponse.json();
          if (wikiResult.success && wikiResult.count > 0) {
            console.log(`Found ${wikiResult.count} Wikipedia entities`);
          }
        } else {
          console.error('Wikipedia search failed:', wikiResponse.status);
        }
      }
    } catch (wikiError) {
      console.error('Error searching Wikipedia:', wikiError);
      // Don't fail the whole operation if wiki search fails
    }

    // Update cache for this news article after retelling is complete
    const countryCode = news.country?.code?.toLowerCase() || 'us';
    if (news.slug) {
      await updateNewsCache(countryCode, news.slug, supabaseUrl);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      content: retoldContent,
      language: language.code,
      field: updateField,
      keyPoints,
      themes,
      keywords,
      dialogue: generatedDialogue,
      tweets: generatedTweets
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in retell-news:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
