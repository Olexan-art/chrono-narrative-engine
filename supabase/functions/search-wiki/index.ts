import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

interface WikiSearchResult {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
  description?: string;
  pageprops?: { wikibase_item?: string };
}

interface WikiEntity {
  wiki_id: string;
  entity_type: string;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  image_url?: string;
  wiki_url: string;
  wiki_url_en?: string;
  extract?: string;
  extract_en?: string;
  raw_data: Record<string, unknown>;
}

// Detect entity type based on Wikipedia categories and description
function detectEntityType(result: WikiSearchResult): string {
  const desc = (result.description || '').toLowerCase();
  const title = result.title.toLowerCase();

  const personKeywords = ['born', 'politician', 'actor', 'actress', 'singer', 'musician', 'athlete',
    'president', 'minister', 'ceo', 'founder', 'author', 'writer', 'director', 'businessman',
    'businesswoman', 'entrepreneur', 'journalist', 'scientist', 'professor', 'footballer',
    'basketball', 'tennis', 'celebrity', 'artist', 'comedian', 'politician'];

  const companyKeywords = ['company', 'corporation', 'inc.', 'ltd', 'llc', 'enterprise', 'group',
    'organization', 'organisation', 'foundation', 'institute', 'association', 'agency',
    'firm', 'brand', 'manufacturer', 'tech company', 'technology company', 'bank', 'airline',
    'automotive', 'multinational', 'conglomerate'];

  const countryKeywords = ['country', 'sovereign state', 'republic', 'kingdom', 'nation', 'island country', 'federal'];
  const placeKeywords = ['city', 'borough', 'district', 'province', 'state', 'region', 'capital', 'town', 'village', 'municipality', 'county'];

  if (personKeywords.some(kw => desc.includes(kw))) return 'person';
  if (companyKeywords.some(kw => desc.includes(kw) || title.includes(kw))) return 'company';
  if (countryKeywords.some(kw => desc.includes(kw))) return 'country';
  if (placeKeywords.some(kw => desc.includes(kw))) return 'place';

  if (result.title.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/)) return 'person';

  return 'organization';
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

  let provider = settings.llm_text_provider || settings.llm_provider || 'zai';

  if (overrideModel) {
    if (overrideModel.startsWith('google/') || overrideModel.startsWith('gemini')) provider = 'lovable';
    else if (overrideModel.startsWith('openai/') || overrideModel.startsWith('gpt')) provider = 'lovable';
    else if (overrideModel.startsWith('mistral-') || overrideModel.startsWith('codestral')) provider = 'mistral';
    else if (overrideModel.startsWith('GLM-') || overrideModel.startsWith('glm-')) provider = 'zai';
    else if (overrideModel.startsWith('claude')) provider = 'anthropic';
  }

  if (provider === 'zai') {
    const apiKey = settings.zai_api_key || Deno.env.get('ZAI_API_KEY');
    if (!apiKey) throw new Error('Z.AI API key not configured');
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'GLM-4.7', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
    });
    if (!response.ok) throw new Error(`Z.AI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'lovable') {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
    });
    if (!response.ok) throw new Error(`Lovable AI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'openai') {
    const apiKey = settings.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key not configured');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
    });
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const apiKey = settings.gemini_api_key || Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('Gemini API key not configured');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }] }),
    });
    if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'geminiV22') {
    const apiKey = settings.gemini_v22_api_key || Deno.env.get('GEMINI_V22_API_KEY');
    if (!apiKey) throw new Error('Gemini V22 API key not configured');
    const modelName = model || 'gemini-2.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }] }),
    });
    if (!response.ok) throw new Error(`Gemini V22 error: ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'mistral') {
    const apiKey = settings.mistral_api_key;
    if (!apiKey) throw new Error('Mistral API key not configured');
    const modelName = model || 'mistral-large-latest';
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] }),
    });
    if (!response.ok) throw new Error(`Mistral error: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// Search Wikipedia API
async function searchWikipedia(term: string, language: string = 'en'): Promise<WikiSearchResult | null> {
  const baseUrl = language === 'en'
    ? 'https://en.wikipedia.org/w/api.php'
    : `https://${language}.wikipedia.org/w/api.php`;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts|pageimages|description|pageprops',
    exintro: 'true',
    explaintext: 'true',
    exsentences: '3',
    piprop: 'thumbnail',
    pithumbsize: '300',
    titles: term,
    redirects: '1',
  });

  try {
    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();

    const pages = data.query?.pages;
    if (!pages) return null;

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') return null;

    return { ...pages[pageId], pageid: parseInt(pageId) };
  } catch (error) {
    console.error(`Error searching Wikipedia for "${term}":`, error);
    return null;
  }
}

// Search Wikipedia with opensearch (returns multiple results)
async function searchWikipediaMultiple(term: string, language: string = 'en', limit: number = 10): Promise<WikiSearchResult[]> {
  const baseUrl = language === 'en'
    ? 'https://en.wikipedia.org/w/api.php'
    : `https://${language}.wikipedia.org/w/api.php`;

  // First get suggestions via opensearch
  const openSearchParams = new URLSearchParams({
    action: 'opensearch',
    format: 'json',
    search: term,
    limit: String(limit),
    namespace: '0',
  });

  try {
    const osResponse = await fetch(`${baseUrl}?${openSearchParams}`);
    const osData = await osResponse.json();
    const titles: string[] = osData[1] || [];

    if (titles.length === 0) return [];

    // Now fetch details for all found titles
    const detailParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'extracts|pageimages|description|pageprops',
      exintro: 'true',
      explaintext: 'true',
      exsentences: '3',
      piprop: 'thumbnail',
      pithumbsize: '300',
      titles: titles.join('|'),
      redirects: '1',
    });

    const detailResponse = await fetch(`${baseUrl}?${detailParams}`);
    const detailData = await detailResponse.json();

    const pages = detailData.query?.pages;
    if (!pages) return [];

    return Object.values(pages)
      .filter((p: any) => p.pageid && p.pageid > 0)
      .map((p: any) => ({ ...p, pageid: p.pageid })) as WikiSearchResult[];
  } catch (error) {
    console.error(`Error searching Wikipedia multiple for "${term}":`, error);
    return [];
  }
}

// Convert Wikipedia result to our entity format
function wikiResultToEntity(result: WikiSearchResult, language: string): WikiEntity {
  const wikiId = result.pageprops?.wikibase_item || `wiki_${language}_${result.pageid}`;
  const entityType = detectEntityType(result);
  const wikiUrl = language === 'en'
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`
    : `https://${language}.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;

  return {
    wiki_id: wikiId,
    entity_type: entityType,
    name: result.title,
    name_en: language === 'en' ? result.title : undefined,
    description: result.description,
    description_en: language === 'en' ? result.description : undefined,
    image_url: result.thumbnail?.source,
    wiki_url: wikiUrl,
    wiki_url_en: language === 'en' ? wikiUrl : undefined,
    extract: result.extract,
    extract_en: language === 'en' ? result.extract : undefined,
    raw_data: result as unknown as Record<string, unknown>,
  };
}

// Extract potential entity names from title and keywords
function extractSearchTerms(title: string, keywords: string[]): string[] {
  const terms = new Set<string>();

  keywords.forEach(kw => {
    const cleaned = kw.trim();
    if (cleaned.match(/^[A-Z][a-zA-Z]+(\s+[A-Z]?[a-zA-Z]+)*$/)) {
      terms.add(cleaned);
    }
    if (cleaned.match(/^[A-Z]{2,}$/)) {
      terms.add(cleaned);
    }
  });

  const titleMatches = title.match(/[A-Z][a-z]+(\s+[A-Z][a-z]+)+/g) || [];
  titleMatches.forEach(match => {
    if (match.length > 3) terms.add(match);
  });

  const quotedMatches = title.match(/"([^"]+)"/g) || [];
  quotedMatches.forEach(match => {
    terms.add(match.replace(/"/g, ''));
  });

  return Array.from(terms).slice(0, 5);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, newsId, terms, title, keywords, language = 'en', wikiUrl } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle add entity by Wikipedia URL
    if (wikiUrl && newsId) {
      try {
        const urlMatch = wikiUrl.match(/\/wiki\/(.+)$/);
        if (!urlMatch) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid Wikipedia URL' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const pageTitle = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));
        const lang = wikiUrl.includes('en.wikipedia.org') ? 'en'
          : wikiUrl.includes('uk.wikipedia.org') ? 'uk'
            : wikiUrl.includes('pl.wikipedia.org') ? 'pl' : 'en';

        const result = await searchWikipedia(pageTitle, lang);
        if (!result) {
          return new Response(JSON.stringify({ success: false, error: 'Wikipedia page not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const entity = wikiResultToEntity(result, lang);

        // Check if entity already exists
        const { data: existing } = await supabase
          .from('wiki_entities')
          .select('id')
          .eq('wiki_id', entity.wiki_id)
          .maybeSingle();

        let entityId: string;

        if (existing) {
          entityId = existing.id;
        } else {
          const { data: inserted, error } = await supabase
            .from('wiki_entities')
            .insert(entity)
            .select('id')
            .single();

          if (error) {
            console.error('Error inserting entity:', error);
            return new Response(JSON.stringify({ success: false, error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          entityId = inserted.id;
        }

        // Link to news
        const { error: linkError } = await supabase
          .from('news_wiki_entities')
          .upsert({
            news_item_id: newsId,
            wiki_entity_id: entityId,
            match_source: 'manual',
            match_term: entity.name,
          }, { onConflict: 'news_item_id,wiki_entity_id' });

        if (linkError) {
          console.error('Error linking entity to news:', linkError);
          return new Response(JSON.stringify({ success: false, error: linkError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, entity: { ...entity, id: entityId } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Error adding entity by URL:', err);
        return new Response(JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to add entity'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle AI format extract action
    if (action === 'format_extract') {
      const { entityId, currentExtract, entityName, language: lang = 'en', model } = body;

      // Get settings for LLM configuration
      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (!settings) {
        return new Response(JSON.stringify({ success: false, error: 'Settings not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const systemPrompt = lang === 'uk'
        ? `Ти експерт з форматування біографічних та енциклопедичних текстів. Твоє завдання - покращити та відформатувати текст про сутність, зберігаючи факти. Додай структуру, виправ стиль. Не додавай вигаданих фактів. Відповідай тільки відформатованим текстом без пояснень.`
        : `You are an expert in formatting biographical and encyclopedic texts. Your task is to improve and format text about an entity while preserving facts. Add structure, improve style. Do not add fictional facts. Respond only with formatted text without explanations.`;

      const userPrompt = lang === 'uk'
        ? `Відформатуй цей текст про "${entityName}":\n\n${currentExtract}`
        : `Format this text about "${entityName}":\n\n${currentExtract}`;

      try {
        const formatted = await callLLM(settings as LLMSettings, systemPrompt, userPrompt, model);
        return new Response(JSON.stringify({ success: true, formatted }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.error('AI format error:', err);
        return new Response(JSON.stringify({ success: false, error: err.message || 'AI formatting failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle Information Card generation
    if (action === 'generate_info_card') {
      const { entityName, entityExtract, entityDescription, entityType, wikiUrl, wikiUrlEn, language: lang = 'uk', model } = body;

      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (!settings) {
        return new Response(JSON.stringify({ success: false, error: 'Settings not found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const systemPrompt = `Ти аналітик-енциклопедист. Отримуєш дані про сутність і генеруєш структурований інформаційний блок у форматі Markdown. Відповідай тільки Markdown-текстом без пояснень і без зайвих вступів.`;

      const userPrompt = `Створи інформаційну картку для сутності "${entityName}" (тип: ${entityType}).

Доступні дані:
- Опис: ${entityDescription || 'немає'}
- Текст Wikipedia: ${entityExtract ? entityExtract.slice(0, 3000) : 'немає'}
- Тип: ${entityType}

Структура відповіді (обов'язково Markdown, дотримуйся саме такого порядку):

## Хто / що це
(1–2 речення — коротко і чітко)

## Чим відоме / навіщо користувачу
(2–3 речення — практична цінність, роль, вплив)

## Чому згадується в новинах зараз
(1 абзац — "why in news": контекст поточних подій навколо цієї сутності)

## Альтернативні назви / синоніми
(варіанти написання, транслітерація, скорочення — через кому або список)

## Категорія / тип
(одне з: Person / Organization / Place / Event / Drug / Policy / Technology / Other — та уточнення)

## Ключові дати
(заснування / народження / запуск / розпуск / перша згадка — у форматі "подія: рік")

## Географія
(штаб-квартира, країна, місто — якщо релевантно)

## Ідентифікатори та посилання
(Wikipedia, Wikidata, Crunchbase, ISIN, ticker, ORCID, IMDb — тільки релевантні)

---
> ℹ️ Інформація взята з відкритих джерел.

Посилання для перевірки:
${wikiUrl ? `- [Wikipedia (UK)](${wikiUrl})` : ''}
${wikiUrlEn ? `- [Wikipedia (EN)](${wikiUrlEn})` : ''}
`;

      try {
        const content = await callLLM(settings as LLMSettings, systemPrompt, userPrompt, model);
        const sources: { title: string; url: string }[] = [];
        if (wikiUrl) sources.push({ title: 'Wikipedia', url: wikiUrl });
        if (wikiUrlEn && wikiUrlEn !== wikiUrl) sources.push({ title: 'Wikipedia (EN)', url: wikiUrlEn });

        return new Response(JSON.stringify({ success: true, content, sources }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.error('Info card generation error:', err);
        return new Response(JSON.stringify({ success: false, error: err.message || 'Generation failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle extended Wikipedia parsing
    if (action === 'extended_parse') {
      const { wikiUrl, language: lang = 'en' } = body;

      if (!wikiUrl) {
        return new Response(JSON.stringify({ success: false, error: 'wikiUrl required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const urlMatch = wikiUrl.match(/\/wiki\/(.+)$/);
        if (!urlMatch) {
          throw new Error('Invalid Wikipedia URL');
        }
        const pageTitle = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));

        const langMatch = wikiUrl.match(/https?:\/\/([a-z]+)\.wikipedia\.org/);
        const wikiLang = langMatch ? langMatch[1] : 'en';

        const baseUrl = `https://${wikiLang}.wikipedia.org/w/api.php`;

        const params = new URLSearchParams({
          action: 'query',
          format: 'json',
          prop: 'extracts|pageimages|categories|description',
          exintro: 'false',
          explaintext: 'true',
          exsectionformat: 'plain',
          piprop: 'original',
          cllimit: '20',
          titles: pageTitle,
          redirects: '1',
        });

        const response = await fetch(`${baseUrl}?${params}`);
        const data = await response.json();

        const pages = data.query?.pages;
        if (!pages) {
          throw new Error('No pages found');
        }

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') {
          throw new Error('Page not found');
        }

        const page = pages[pageId];

        const categories = page.categories?.map((c: any) =>
          c.title.replace(/^Category:/, '').replace(/^Категорія:/, '')
        ) || [];

        const extendedData = {
          title: page.title,
          extract: page.extract?.slice(0, 5000) || '',
          description: page.description || '',
          image: page.original?.source || null,
          categories,
        };

        return new Response(JSON.stringify({ success: true, data: extendedData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('Extended parse error:', err);
        return new Response(JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Parse failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Handle multi-result Wikipedia search (for admin add entity)
    if (action === 'search_multiple') {
      const { query, language: lang = 'en', limit = 10 } = body;

      if (!query) {
        return new Response(JSON.stringify({ success: true, results: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = await searchWikipediaMultiple(query, lang, limit);
      const entities = results.map(r => wikiResultToEntity(r, lang));

      return new Response(JSON.stringify({ success: true, results: entities }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle save entity (from admin)
    if (action === 'save_entity') {
      const { entity, newsId: linkNewsId, sourceEntityId, matchTerm } = body;

      if (!entity || !entity.wiki_id) {
        return new Response(JSON.stringify({ success: false, error: 'entity required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if exists
      const { data: existing } = await supabase
        .from('wiki_entities')
        .select('id')
        .eq('wiki_id', entity.wiki_id)
        .maybeSingle();

      let entityId: string;

      if (existing) {
        entityId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from('wiki_entities')
          .insert({
            wiki_id: entity.wiki_id,
            entity_type: entity.entity_type || 'unknown',
            name: entity.name,
            name_en: entity.name_en,
            description: entity.description,
            description_en: entity.description_en,
            image_url: entity.image_url,
            wiki_url: entity.wiki_url,
            wiki_url_en: entity.wiki_url_en,
            extract: entity.extract,
            extract_en: entity.extract_en,
            raw_data: entity.raw_data || {},
          })
          .select('id')
          .single();

        if (error) {
          console.error('Error saving entity:', error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        entityId = inserted.id;
      }

      // Link to news if newsId provided
      if (linkNewsId && entityId) {
        const { error: linkError } = await supabase
          .from('news_wiki_entities')
          .upsert({
            news_item_id: linkNewsId,
            wiki_entity_id: entityId,
            match_term: matchTerm || entity.name,
            match_source: 'manual',
          }, { onConflict: 'news_item_id,wiki_entity_id' });
        if (linkError) {
          console.error('Error linking entity to news:', linkError);
        }
      }

      // Link to source entity if sourceEntityId provided (entity-to-entity link)
      if (sourceEntityId && entityId && sourceEntityId !== entityId) {
        const { error: linkError } = await supabase
          .from('wiki_entity_links')
          .upsert({
            source_entity_id: sourceEntityId,
            target_entity_id: entityId,
            link_type: 'manual',
          }, { onConflict: 'source_entity_id,target_entity_id' });
        if (linkError) {
          console.error('Error linking entities:', linkError);
        }
      }

      return new Response(JSON.stringify({ success: true, id: entityId, existed: !!existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle find related entities via shared news
    if (action === 'find_related_news') {
      const { entityId } = body;

      if (!entityId) {
        return new Response(JSON.stringify({ success: false, error: 'entityId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all news IDs linked to this entity
      const { data: entityNews, error: enError } = await supabase
        .from('news_wiki_entities')
        .select('news_item_id')
        .eq('wiki_entity_id', entityId);

      if (enError) throw enError;
      if (!entityNews || entityNews.length === 0) {
        return new Response(JSON.stringify({ success: true, related: [], message: 'No news links found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newsIds = entityNews.map(n => n.news_item_id);

      // Find other entities linked to same news
      const { data: relatedLinks, error: rlError } = await supabase
        .from('news_wiki_entities')
        .select('wiki_entity_id')
        .in('news_item_id', newsIds)
        .neq('wiki_entity_id', entityId);

      if (rlError) throw rlError;

      // Count occurrences
      const counts: Record<string, number> = {};
      for (const link of relatedLinks || []) {
        counts[link.wiki_entity_id] = (counts[link.wiki_entity_id] || 0) + 1;
      }

      // Get top related entities
      const topIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);

      if (topIds.length === 0) {
        return new Response(JSON.stringify({ success: true, related: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: relatedEntities } = await supabase
        .from('wiki_entities')
        .select('id, name, name_en, entity_type, image_url, slug')
        .in('id', topIds);

      const related = (relatedEntities || []).map(e => ({
        ...e,
        sharedNewsCount: counts[e.id] || 0,
      })).sort((a, b) => b.sharedNewsCount - a.sharedNewsCount);

      return new Response(JSON.stringify({ success: true, related }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle find related from Wikipedia links
    if (action === 'find_related_wiki') {
      const { entityName, language: lang = 'en' } = body;

      if (!entityName) {
        return new Response(JSON.stringify({ success: false, error: 'entityName required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const baseUrl = lang === 'en'
        ? 'https://en.wikipedia.org/w/api.php'
        : `https://${lang}.wikipedia.org/w/api.php`;

      // Get Wikipedia links from the entity's page
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'links',
        pllimit: '50',
        plnamespace: '0',
        titles: entityName,
        redirects: '1',
      });

      const response = await fetch(`${baseUrl}?${params}`);
      const data = await response.json();
      const pages = data.query?.pages;
      if (!pages) {
        return new Response(JSON.stringify({ success: true, wikiLinks: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pageId = Object.keys(pages)[0];
      const links = pages[pageId]?.links || [];
      const linkTitles = links.map((l: any) => l.title).slice(0, 30);

      // Check which of these already exist in our DB
      const { data: existingEntities } = await supabase
        .from('wiki_entities')
        .select('name, name_en, id, slug')
        .or(linkTitles.map((t: string) => `name.eq.${t},name_en.eq.${t}`).join(','));

      const existingNames = new Set((existingEntities || []).flatMap(e => [e.name, e.name_en].filter(Boolean)));

      const wikiLinks = linkTitles.map((t: string) => ({
        title: t,
        existsInDb: existingNames.has(t),
        entityId: existingEntities?.find(e => e.name === t || e.name_en === t)?.id || null,
        slug: existingEntities?.find(e => e.name === t || e.name_en === t)?.slug || null,
      }));

      return new Response(JSON.stringify({ success: true, wikiLinks }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Original search flow
    let searchTerms: string[] = terms || [];
    if (searchTerms.length === 0 && (title || keywords)) {
      searchTerms = extractSearchTerms(title || '', keywords || []);
    }

    if (searchTerms.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        entities: [],
        message: 'No entity terms to search'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Searching Wikipedia for terms:`, searchTerms);

    const foundEntities: Array<{ entity: WikiEntity; matchTerm: string }> = [];

    for (const term of searchTerms) {
      let result = await searchWikipedia(term, 'en');

      if (!result && language !== 'en') {
        result = await searchWikipedia(term, language);
      }

      if (result) {
        const entity = wikiResultToEntity(result, result.extract ? 'en' : language);
        foundEntities.push({ entity, matchTerm: term });
        console.log(`Found entity: ${entity.name} (${entity.entity_type})`);
      }
    }

    if (foundEntities.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        entities: [],
        message: 'No Wikipedia entities found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const savedEntities = [];
    for (const { entity, matchTerm } of foundEntities) {
      const { data: existing } = await supabase
        .from('wiki_entities')
        .select('id')
        .eq('wiki_id', entity.wiki_id)
        .maybeSingle();

      let entityId: string;

      if (existing) {
        await supabase
          .from('wiki_entities')
          .update({
            search_count: supabase.rpc('increment', { row_id: existing.id }),
            last_searched_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        entityId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from('wiki_entities')
          .insert(entity)
          .select('id')
          .single();

        if (error) {
          console.error('Error inserting entity:', error);
          continue;
        }
        entityId = inserted.id;
      }

      if (newsId) {
        const { error: linkError } = await supabase
          .from('news_wiki_entities')
          .upsert({
            news_item_id: newsId,
            wiki_entity_id: entityId,
            match_source: 'keyword',
            match_term: matchTerm,
          }, { onConflict: 'news_item_id,wiki_entity_id' });

        if (linkError) {
          console.error('Error linking entity to news:', linkError);
        }
      }

      savedEntities.push({ ...entity, id: entityId, matchTerm });
    }

    return new Response(JSON.stringify({
      success: true,
      entities: savedEntities,
      count: savedEntities.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-wiki:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
