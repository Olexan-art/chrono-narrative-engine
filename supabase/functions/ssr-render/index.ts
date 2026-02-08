import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://echoes2.com";

// Bot detection patterns
const BOT_PATTERNS: Record<string, { type: string; category: string }> = {
  // Search engines
  googlebot: { type: 'googlebot', category: 'search' },
  'google-inspectiontool': { type: 'google-inspection', category: 'search' },
  bingbot: { type: 'bingbot', category: 'search' },
  slurp: { type: 'yahoobot', category: 'search' },
  duckduckbot: { type: 'duckduckbot', category: 'search' },
  baiduspider: { type: 'baiduspider', category: 'search' },
  yandexbot: { type: 'yandexbot', category: 'search' },
  sogou: { type: 'sogoubot', category: 'search' },
  exabot: { type: 'exabot', category: 'search' },
  'mj12bot': { type: 'majesticbot', category: 'search' },
  'ahrefsbot': { type: 'ahrefsbot', category: 'search' },
  'semrushbot': { type: 'semrushbot', category: 'search' },
  
  // AI bots
  gptbot: { type: 'gptbot', category: 'ai' },
  chatgpt: { type: 'chatgpt', category: 'ai' },
  'chatgpt-user': { type: 'chatgpt-user', category: 'ai' },
  claudebot: { type: 'claudebot', category: 'ai' },
  'claude-web': { type: 'claude-web', category: 'ai' },
  anthropic: { type: 'anthropic', category: 'ai' },
  perplexitybot: { type: 'perplexitybot', category: 'ai' },
  'cohere-ai': { type: 'cohere', category: 'ai' },
  'bytespider': { type: 'bytedance', category: 'ai' },
  'ccbot': { type: 'commoncrawl', category: 'ai' },
  'diffbot': { type: 'diffbot', category: 'ai' },
  'omgili': { type: 'omgili', category: 'ai' },
  'youbot': { type: 'youbot', category: 'ai' },
  'applebot': { type: 'applebot', category: 'ai' },
  'ia_archiver': { type: 'alexa', category: 'ai' },
  
  // Social
  facebookexternalhit: { type: 'facebook', category: 'social' },
  twitterbot: { type: 'twitter', category: 'social' },
  linkedinbot: { type: 'linkedin', category: 'social' },
  pinterestbot: { type: 'pinterest', category: 'social' },
  slackbot: { type: 'slack', category: 'social' },
  telegrambot: { type: 'telegram', category: 'social' },
  whatsapp: { type: 'whatsapp', category: 'social' },
  discordbot: { type: 'discord', category: 'social' },
  
  // Other crawlers
  'site-shot': { type: 'screenshot', category: 'other' },
  'headlesschrome': { type: 'headless', category: 'other' },
  phantomjs: { type: 'phantomjs', category: 'other' },
  'lighthouse': { type: 'lighthouse', category: 'other' },
  'chrome-lighthouse': { type: 'lighthouse', category: 'other' },
  'pagespeed': { type: 'pagespeed', category: 'other' },
  'gtmetrix': { type: 'gtmetrix', category: 'other' },
};

function detectBot(userAgent: string): { type: string; category: string } | null {
  if (!userAgent) return null;
  
  const ua = userAgent.toLowerCase();
  
  for (const [pattern, info] of Object.entries(BOT_PATTERNS)) {
    if (ua.includes(pattern)) {
      return info;
    }
  }
  
  // Generic bot detection
  if (ua.includes('bot') || ua.includes('crawl') || ua.includes('spider') || ua.includes('scraper')) {
    return { type: 'unknown-bot', category: 'other' };
  }
  
  return null;
}

async function logBotVisit(
  supabase: any, 
  botInfo: { type: string; category: string }, 
  path: string, 
  userAgent: string,
  referer: string | null,
  startTime: number,
  cacheStatus: 'HIT' | 'MISS'
) {
  try {
    const responseTime = Date.now() - startTime;
    
    await supabase.from('bot_visits').insert({
      bot_type: botInfo.type,
      bot_category: botInfo.category,
      path,
      user_agent: userAgent?.substring(0, 500),
      referer: referer?.substring(0, 500),
      response_time_ms: responseTime,
      status_code: 200,
      cache_status: cacheStatus
    });
    
    console.log(`Bot visit logged: ${botInfo.type} (${botInfo.category}) -> ${path} [${cacheStatus}]`);
  } catch (error) {
    console.error('Failed to log bot visit:', error);
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // NOTE: Support POST body for tooling/testing; GET+query is still the canonical interface.
    const body = req.method !== "GET" ? await req.json().catch(() => null) : null;
    const path = url.searchParams.get("path") || body?.path || "/";
    const lang = url.searchParams.get("lang") || body?.lang || "uk";
    const useCache = (url.searchParams.get("cache") || body?.cache) !== "false"; // Default: use cache
    const userAgent = req.headers.get("user-agent") || "";
    const referer = req.headers.get("referer");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Detect bot
    const botInfo = detectBot(userAgent);

    // Try to serve from cache first (if enabled)
    if (useCache) {
      const { data: cached } = await supabase
        .from("cached_pages")
        .select("html, expires_at")
        .eq("path", path)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log(`Serving cached page for ${path} [CACHE HIT]`);
        
        // Log bot visit with CACHE HIT
        if (botInfo) {
          logBotVisit(supabase, botInfo, path, userAgent, referer, startTime, 'HIT');
        }
        
        return new Response(cached.html, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "X-Cache": "HIT",
          },
        });
      }
    }
    
    // Log bot visit with CACHE MISS (will generate fresh content)
    if (botInfo) {
      logBotVisit(supabase, botInfo, path, userAgent, referer, startTime, 'MISS');
    }

    // Parse the path to determine content type
    const readMatch = path.match(/^\/read\/(\d{4}-\d{2}-\d{2})\/(\d+)$/);
    const readDateMatch = path.match(/^\/read\/(\d{4}-\d{2}-\d{2})$/);
    // Support both canonical numeric route (/chapter/15) and legacy UUID route (/chapter/<uuid>)
    const chapterNumberMatch = path.match(/^\/chapter\/(\d+)$/);
    const chapterUuidMatch = path.match(/^\/chapter\/([a-f0-9-]+)$/);
    const volumeMatch = path.match(/^\/volume\/(\d{4}-\d{2})$/);
    const dateMatch = path.match(/^\/date\/(\d{4}-\d{2}-\d{2})$/);
    // News article match: /news/us/some-slug
    const newsArticleMatch = path.match(/^\/news\/([a-z]{2})\/([a-z0-9-]+)$/);
    // News country list: /news/us or /news/ua
    const newsCountryMatch = path.match(/^\/news\/([a-z]{2})$/);
    // Wiki entity page: /wiki/entity-slug-uuid or /wiki/uuid
    const wikiEntityMatch = path.match(/^\/wiki\/([a-z0-9-]+)$/);

    let html = "";
    let title = "Точка Синхронізації";
    let description = "AI-генерована наукова фантастика на основі реальних новин";
    let image = `${BASE_URL}/favicon.png`;
    let canonicalUrl = BASE_URL + path;
    let faqItems: { question: string; answer: string }[] = [];

    if (path === "/sitemap") {
      // HTML sitemap page (critical for crawlers like Screaming Frog)
      title = "Sitemap | Точка Синхронізації";
      description = "HTML sitemap with links to all major sections and content pages.";

      const [{ data: countries }, { data: volumes }, { data: chapters }, { data: partsForDates }, { data: partsForStories }] = await Promise.all([
        supabase
          .from("news_countries")
          .select("code, name, name_en, flag, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("volumes")
          .select("id, year, month, title, title_en, title_pl")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .limit(300),
        supabase
          .from("chapters")
          .select("number, title, title_en, title_pl")
          .order("number", { ascending: false })
          .limit(300),
        // dates list (used for /date/:date links)
        supabase
          .from("parts")
          .select("date")
          .eq("status", "published")
          .order("date", { ascending: false })
          .limit(1000),
        // story links (sample up to 1000 newest; full coverage via sitemap.xml)
        supabase
          .from("parts")
          .select("date, number, title, title_en, title_pl")
          .eq("status", "published")
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(1000),
      ]);

      const uniqueDates = [...new Set((partsForDates || []).map((p: { date: string }) => p.date))].slice(0, 120);
      html = generateSitemapHTML(
        {
          countries: countries || [],
          volumes: volumes || [],
          chapters: chapters || [],
          dates: uniqueDates,
          stories: partsForStories || [],
        },
        lang,
      );
    } else if (path === "/news") {
      // News hub (/news)
      title = "News | Точка Синхронізації";
      description = "AI-curated news by country.";
      const { data: countries } = await supabase
        .from("news_countries")
        .select("code, name, name_en, flag, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      html = generateNewsHubHTML(countries || [], lang);
    } else if (path === "/chapters") {
      title = "Chapters | Точка Синхронізації";
      description = "All chapters.";

      const { data: chapters } = await supabase
        .from("chapters")
        .select("number, title, title_en, title_pl")
        .order("number", { ascending: false })
        .limit(1000);

      html = generateChaptersIndexHTML(chapters || [], lang);
    } else if (path === "/volumes") {
      title = "Volumes | Точка Синхронізації";
      description = "All volumes.";

      const { data: volumes } = await supabase
        .from("volumes")
        .select("year, month, title, title_en, title_pl")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(1000);

      html = generateVolumesIndexHTML(volumes || [], lang);
    } else if (path === "/wiki") {
      // Wiki catalog page
      title = "Entity Catalog | Echoes Wiki";
      description = "People, companies and organizations in the news. Browse entities mentioned in our AI-curated news coverage.";
      
      const { data: entities } = await supabase
        .from("wiki_entities")
        .select("id, slug, name, name_en, description, description_en, image_url, entity_type, search_count")
        .order("search_count", { ascending: false })
        .limit(100);
      
      html = generateWikiCatalogHTML(entities || [], lang);
    } else if (path === "/ink-abyss") {
      // Ink Abyss gallery page
      title = "The Ink Abyss | Satirical Art Gallery";
      description = "A timeline gallery of satirical political artwork and caricatures inspired by world news.";
      
      const { data: inkItems } = await supabase
        .from("outrage_ink")
        .select(`
          id, image_url, title, likes, dislikes, created_at,
          news_item:news_rss_items(slug, title, title_en, country:news_countries(code))
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      
      html = generateInkAbyssHTML(inkItems || [], lang);
    } else if (path === "/calendar" || path === "/read") {
      // Lightweight crawler-friendly index of recent dates
      title = "Archive | Точка Синхронізації";
      description = "Browse recent dates.";

      const { data: datesRaw } = await supabase
        .from("parts")
        .select("date")
        .eq("status", "published")
        .order("date", { ascending: false })
        .limit(1000);
      const dates = [...new Set((datesRaw || []).map((d: { date: string }) => d.date))].slice(0, 120);

      html = generateCalendarIndexHTML(dates, lang);
    } else if (volumeMatch) {
      const [, yearMonth] = volumeMatch;
      const [yearStr, monthStr] = yearMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);

      const { data: volume } = await supabase
        .from("volumes")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      if (volume) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        title = volume[titleField] || volume.title;
        description = volume.summary_en || volume.summary || description;
        image = volume.cover_image_url || image;

        const { data: chapters } = await supabase
          .from("chapters")
          .select("number, title, title_en, title_pl")
          .eq("volume_id", volume.id)
          .order("number", { ascending: true });

        html = generateVolumeHTML(volume, chapters || [], lang);
      }
    } else if (readMatch) {
      // Story page
      const [, date, storyNumber] = readMatch;
      const partIndex = parseInt(storyNumber, 10) - 1;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*, volume:volumes(*))")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      const part = parts?.[partIndex];

      if (part) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        const contentField = lang === "en" ? "content_en" : lang === "pl" ? "content_pl" : "content";

        title = part[titleField] || part.title;
        description = (part[contentField] || part.content)?.substring(0, 160) + "...";
        image = part.cover_image_url || image;

        html = generateStoryHTML(part, lang, canonicalUrl);
      }
    } else if (readDateMatch) {
      // Date list under /read/:date (canonical SPA route)
      const [, date] = readDateMatch;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*)")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      if (parts && parts.length > 0) {
        title = `${date} | Точка Синхронізації`;
        description = `${parts.length} ${parts.length === 1 ? "історія" : "історій"} за ${date}`;
        html = generateDateHTML(parts, date, lang, canonicalUrl);
      }
    } else if (chapterNumberMatch || chapterUuidMatch) {
      // Chapter page
      const chapterNumber = chapterNumberMatch ? parseInt(chapterNumberMatch[1], 10) : null;
      const chapterUuid = chapterUuidMatch ? chapterUuidMatch[1] : null;

      const chapterQuery = supabase
        .from("chapters")
        .select("*, volume:volumes(*)");

      const { data: chapter } = chapterNumber !== null
        ? await chapterQuery.eq("number", chapterNumber).maybeSingle()
        : await chapterQuery.eq("id", chapterUuid).maybeSingle();

      if (chapter) {
        const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
        const descField = lang === "en" ? "description_en" : lang === "pl" ? "description_pl" : "description";

        title = chapter[titleField] || chapter.title;
        description = chapter[descField] || chapter.description || description;
        image = chapter.cover_image_url || image;

        html = generateChapterHTML(chapter, lang, canonicalUrl);
      }
    } else if (newsArticleMatch) {
      // News article page: /news/us/slug - include "More from country" and "Other countries" links
      const [, countryCode, slug] = newsArticleMatch;
      
      // Fetch article and all countries for cross-linking (include original_content for SSR)
      const [{ data: newsItem }, { data: allCountries }] = await Promise.all([
        supabase
          .from("news_rss_items")
          .select("*, original_content, country:news_countries(*)")
          .eq("slug", slug)
          .maybeSingle(),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      ]);

      if (newsItem) {
        title = newsItem.title_en || newsItem.title;
        description = (newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description)?.substring(0, 160) + "...";
        image = newsItem.image_url || image;
        
        // Fetch "More from country" links (6 articles), and wiki entities
        const [{ data: moreFromCountry }, { data: wikiLinks }] = await Promise.all([
          supabase
            .from("news_rss_items")
            .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
            .eq("country_id", newsItem.country_id)
            .eq("is_archived", false)
            .neq("id", newsItem.id)
            .order("published_at", { ascending: false })
            .limit(6),
          supabase
            .from("news_wiki_entities")
            .select("wiki_entity:wiki_entities(id, name, name_en, description, description_en, extract, extract_en, image_url, wiki_url, wiki_url_en, entity_type)")
            .eq("news_item_id", newsItem.id)
            .limit(10)
        ]);
        
        // Extract wiki entities from response
        const wikiEntities = (wikiLinks || []).map((link: any) => link.wiki_entity).filter(Boolean);
        
        // Find the most mentioned entity (for Entity Intersection Graph)
        let mainEntityForGraph: any = null;
        let relatedEntitiesForGraph: any[] = [];
        
        if (wikiEntities.length > 0) {
          // Use the first entity as main (most relevant based on order)
          mainEntityForGraph = wikiEntities[0];
          
          // Find other entities mentioned with this main entity in other news
          if (mainEntityForGraph) {
            const { data: relatedNewsLinks } = await supabase
              .from("news_wiki_entities")
              .select("news_item_id")
              .eq("wiki_entity_id", mainEntityForGraph.id)
              .neq("news_item_id", newsItem.id)
              .limit(50);
            
            if (relatedNewsLinks && relatedNewsLinks.length > 0) {
              const relatedNewsIds = relatedNewsLinks.map((l: any) => l.news_item_id);
              
              const { data: otherEntityLinks } = await supabase
                .from("news_wiki_entities")
                .select("wiki_entity:wiki_entities(id, name, name_en, slug, image_url, entity_type)")
                .in("news_item_id", relatedNewsIds)
                .neq("wiki_entity_id", mainEntityForGraph.id);
              
              // Count and dedupe
              const entityCounts = new Map<string, { entity: any; count: number }>();
              for (const link of otherEntityLinks || []) {
                if (!link.wiki_entity) continue;
                const e = link.wiki_entity as any;
                const existing = entityCounts.get(e.id);
                if (existing) existing.count++;
                else entityCounts.set(e.id, { entity: e, count: 1 });
              }
              
              relatedEntitiesForGraph = Array.from(entityCounts.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 12)
                .map(({ entity: e, count }) => ({ ...e, shared_news_count: count }));
            }
          }
        }
        
        // Fetch "Other countries" news (3 per country)
        const otherCountries = (allCountries || []).filter((c: any) => c.id !== newsItem.country_id);
        const otherCountriesNewsPromises = otherCountries.map((c: any) =>
          supabase
            .from("news_rss_items")
            .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
            .eq("country_id", c.id)
            .eq("is_archived", false)
            .order("published_at", { ascending: false })
            .limit(3)
        );
        const otherCountriesResults = await Promise.all(otherCountriesNewsPromises);
        const otherCountriesNews = otherCountriesResults.flatMap(r => r.data || []);
        
        // Generate FAQ items from key_points for FAQPage schema
        const keyPoints = newsItem.key_points_en || newsItem.key_points || [];
        const parsedKeyPoints = Array.isArray(keyPoints) ? keyPoints : (typeof keyPoints === 'string' ? JSON.parse(keyPoints) : []);
        if (parsedKeyPoints.length > 0) {
          const articleTitle = newsItem.title_en || newsItem.title;
          faqItems = parsedKeyPoints.map((point: string, index: number) => ({
            question: `What is key point ${index + 1} about "${articleTitle}"?`,
            answer: point
          }));
        }
        
        html = generateNewsHTML(newsItem, lang, canonicalUrl, moreFromCountry || [], otherCountriesNews, wikiEntities, mainEntityForGraph, relatedEntitiesForGraph);
      }
    } else if (newsCountryMatch) {
      // News country listing page: /news/us - include cross-country links
      const [, countryCode] = newsCountryMatch;
      
      // Fetch country info and all countries for cross-linking
      const [{ data: country }, { data: allCountries }] = await Promise.all([
        supabase
          .from("news_countries")
          .select("*")
          .ilike("code", countryCode)
          .maybeSingle(),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      ]);
      
      // Fetch recent news for this country (99 items for full listing)
      const { data: newsItems } = await supabase
        .from("news_rss_items")
        .select("*, country:news_countries(*)")
        .eq("country_id", country?.id)
        .eq("is_archived", false)
        .order("published_at", { ascending: false })
        .limit(99);
      
      // Fetch news from other countries for cross-linking
      const otherCountries = (allCountries || []).filter((c: any) => c.id !== country?.id);
      const otherCountriesNewsPromises = otherCountries.map((c: any) =>
        supabase
          .from("news_rss_items")
          .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
          .eq("country_id", c.id)
          .eq("is_archived", false)
          .order("published_at", { ascending: false })
          .limit(3)
      );
      const otherCountriesResults = await Promise.all(otherCountriesNewsPromises);
      const otherCountriesNews = otherCountriesResults.flatMap(r => r.data || []);

      if (country) {
        const countryName = country.name_en || country.name;
        title = `${country.flag} ${countryName} News | Synchronization Point`;
        description = `Latest news from ${countryName}. AI-curated news digest with retelling and character dialogues.`;
        
        html = generateNewsCountryHTML(newsItems || [], country, lang, canonicalUrl, otherCountriesNews);
      }
    } else if (wikiEntityMatch) {
      // Wiki entity page: /wiki/slug or /wiki/uuid
      const [, entitySlug] = wikiEntityMatch;
      
      // Try slug first, then id
      let entityQuery = supabase.from("wiki_entities").select("*");
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entitySlug);
      
      if (isUuid) {
        entityQuery = entityQuery.eq("id", entitySlug);
      } else {
        entityQuery = entityQuery.eq("slug", entitySlug);
      }
      
      const { data: entity } = await entityQuery.maybeSingle();
      
      if (entity) {
        const entityName = entity.name_en || entity.name;
        title = `${entityName} | Echoes Wiki`;
        description = entity.description_en || entity.description || entity.extract_en?.substring(0, 160) || entity.extract?.substring(0, 160) || `Information about ${entityName}`;
        image = entity.image_url || image;
        canonicalUrl = `${BASE_URL}/wiki/${entity.slug || entity.id}`;
        
        // Fetch related news
        const { data: newsLinks } = await supabase
          .from("news_wiki_entities")
          .select(`
            news_item:news_rss_items(id, slug, title, title_en, published_at, country:news_countries(code, flag, name_en))
          `)
          .eq("wiki_entity_id", entity.id)
          .order("created_at", { ascending: false })
          .limit(20);
        
        const linkedNews = (newsLinks || [])
          .map((l: any) => l.news_item)
          .filter(Boolean);
        
        // Fetch related entities
        const newsIdsForEntity = linkedNews.map((n: any) => n.id);
        let relatedEntities: any[] = [];
        
        if (newsIdsForEntity.length > 0) {
          const { data: otherLinks } = await supabase
            .from("news_wiki_entities")
            .select(`wiki_entity:wiki_entities(id, name, name_en, slug, image_url, entity_type)`)
            .in("news_item_id", newsIdsForEntity)
            .neq("wiki_entity_id", entity.id);
          
          // Count and dedupe
          const entityCounts = new Map<string, { entity: any; count: number }>();
          for (const link of otherLinks || []) {
            if (!link.wiki_entity) continue;
            const e = link.wiki_entity as any;
            const existing = entityCounts.get(e.id);
            if (existing) existing.count++;
            else entityCounts.set(e.id, { entity: e, count: 1 });
          }
          
          relatedEntities = Array.from(entityCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
            .map(({ entity: e, count }) => ({ ...e, shared_news_count: count }));
        }
        
        html = generateWikiEntityHTML(entity, linkedNews, relatedEntities, lang, canonicalUrl);
      }
    } else if (dateMatch) {
      // Date stories page
      const [, date] = dateMatch;

      const { data: parts } = await supabase
        .from("parts")
        .select("*, chapter:chapters(*)")
        .eq("date", date)
        .eq("status", "published")
        .order("number", { ascending: true });

      if (parts && parts.length > 0) {
        title = `${date} | Точка Синхронізації`;
        description = `${parts.length} ${parts.length === 1 ? "історія" : "історій"} за ${date}`;

        html = generateDateHTML(parts, date, lang, canonicalUrl);
      }
    } else if (path === "/" || path === "") {
      // Home page - fetch all sections for full content
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const [
        { data: latestParts },
        { data: latestUsNews },
        { data: latestNewsAll },
        { data: latestChapters },
        { data: countries },
        { data: trendingEntityMentions24h },
        { data: trendingEntityMentionsWeek }
      ] = await Promise.all([
        supabase
          .from("parts")
          .select("*, chapter:chapters(*)")
          .eq("status", "published")
          .order("date", { ascending: false })
          .order("number", { ascending: false })
          .limit(6),
        // Full Retelling (with content_en)
        supabase
          .from("news_rss_items")
          .select("id, slug, title, title_en, content_en, published_at, country:news_countries(code, name_en, flag)")
          .eq("is_archived", false)
          .not("content_en", "is", null)
          .order("published_at", { ascending: false })
          .limit(6),
        // Latest news for proportional distribution (100 items to work with)
        supabase
          .from("news_rss_items")
          .select("id, slug, title, title_en, content_en, published_at, category, country:news_countries(id, code)")
          .eq("is_archived", false)
          .not("slug", "is", null)
          .order("published_at", { ascending: false })
          .limit(100),
        supabase
          .from("chapters")
          .select("number, title, title_en, title_pl, description, description_en")
          .not("narrator_monologue", "is", null)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("news_countries")
          .select("id, code, name, name_en, flag")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        // Trending wiki entities from last 24 hours
        supabase
          .from("news_wiki_entities")
          .select(`
            wiki_entity_id,
            news_item_id,
            wiki_entity:wiki_entities(id, name, name_en, description, description_en, image_url, wiki_url, wiki_url_en),
            news_item:news_rss_items(id, title, title_en, slug, country_id)
          `)
          .gte("created_at", twentyFourHoursAgo)
          .order("created_at", { ascending: false }),
        // Trending wiki entities from last week
        supabase
          .from("news_wiki_entities")
          .select(`
            wiki_entity_id,
            news_item_id,
            wiki_entity:wiki_entities(id, name, name_en, description, description_en, image_url, wiki_url, wiki_url_en),
            news_item:news_rss_items(id, title, title_en, slug, country_id)
          `)
          .gte("created_at", oneWeekAgo)
          .order("created_at", { ascending: false })
      ]);
      
      // Process proportional news feed (50% USA, 25% PL, 25% UA - NO India)
      const retoldIds = new Set((latestUsNews || []).map((n: any) => n.id));
      const countryIdToCode = new Map((countries || []).map((c: any) => [c.id, c.code.toUpperCase()]));
      
      // Group by country (USA, PL, UA only)
      const byCountry: Record<string, any[]> = { US: [], PL: [], UA: [], OTHER: [] };
      for (const item of (latestNewsAll || []) as any[]) {
        if (retoldIds.has(item.id)) continue; // Skip retold items
        const code = (item.country as any)?.code?.toUpperCase() || 'OTHER';
        if (['US', 'PL', 'UA'].includes(code)) {
          byCountry[code].push(item);
        } else {
          byCountry.OTHER.push(item);
        }
      }
      
      // Take proportional amounts: 50% USA (10), 25% PL (5), 25% UA (5)
      const latestNewsProportional = [
        ...byCountry.US.slice(0, 10),
        ...byCountry.PL.slice(0, 5),
        ...byCountry.UA.slice(0, 5),
      ].sort((a: any, b: any) => 
        new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
      ).slice(0, 20);
      
      // Process trending entities - 24 hours
      const entityMap24h = new Map<string, { entity: any; mentionCount: number; news: any[] }>();
      const countryIdToCodeLower = new Map((countries || []).map((c: any) => [c.id, c.code.toLowerCase()]));
      
      for (const mention of (trendingEntityMentions24h || [])) {
        if (!mention.wiki_entity || !mention.news_item) continue;
        const entity = mention.wiki_entity as any;
        const newsItem = mention.news_item as any;
        
        if (!entityMap24h.has(entity.id)) {
          entityMap24h.set(entity.id, { entity, mentionCount: 0, news: [] });
        }
        const existing = entityMap24h.get(entity.id)!;
        existing.mentionCount++;
        
        if (existing.news.length < 4 && !existing.news.some(n => n.id === newsItem.id) && newsItem.slug) {
          existing.news.push({
            id: newsItem.id,
            title: newsItem.title,
            title_en: newsItem.title_en,
            slug: newsItem.slug,
            countryCode: countryIdToCodeLower.get(newsItem.country_id) || 'us'
          });
        }
      }
      const trendingEntities24h = Array.from(entityMap24h.values())
        .filter(e => e.entity.image_url)
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 5);
      
      // Process trending entities - Week
      const entityMapWeek = new Map<string, { entity: any; mentionCount: number; news: any[] }>();
      
      for (const mention of (trendingEntityMentionsWeek || [])) {
        if (!mention.wiki_entity || !mention.news_item) continue;
        const entity = mention.wiki_entity as any;
        const newsItem = mention.news_item as any;
        
        if (!entityMapWeek.has(entity.id)) {
          entityMapWeek.set(entity.id, { entity, mentionCount: 0, news: [] });
        }
        const existing = entityMapWeek.get(entity.id)!;
        existing.mentionCount++;
        
        if (existing.news.length < 4 && !existing.news.some(n => n.id === newsItem.id) && newsItem.slug) {
          existing.news.push({
            id: newsItem.id,
            title: newsItem.title,
            title_en: newsItem.title_en,
            slug: newsItem.slug,
            countryCode: countryIdToCodeLower.get(newsItem.country_id) || 'us'
          });
        }
      }
      const trendingEntitiesWeek = Array.from(entityMapWeek.values())
        .filter(e => e.entity.image_url)
        .sort((a, b) => b.mentionCount - a.mentionCount)
        .slice(0, 5);
      
      // Fetch latest news per country for "News by Country" section
      const countryNewsPromises = (countries || []).map((c: any) =>
        supabase
          .from("news_rss_items")
          .select("slug, title, title_en, published_at, country:news_countries(code, name_en, flag)")
          .eq("country_id", c.id)
          .eq("is_archived", false)
          .order("published_at", { ascending: false })
          .limit(4)
      );
      const countryNewsResults = await Promise.all(countryNewsPromises);
      const countryNewsMap = (countries || []).map((c: any, i: number) => ({
        country: c,
        news: countryNewsResults[i]?.data || []
      }));

      html = generateHomeHTML(latestParts || [], lang, canonicalUrl, latestUsNews || [], latestChapters || [], countryNewsMap, latestNewsProportional, trendingEntities24h, trendingEntitiesWeek);
    }

    // Generate full HTML document
    const fullHtml = generateFullDocument({
      title,
      description,
      image,
      canonicalUrl,
      lang,
      content: html,
      path,
      faqItems,
    });

    return new Response(fullHtml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("SSR Error:", error);
    return new Response(
      `<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Error loading content</h1></body></html>`,
      { headers: { ...corsHeaders, "Content-Type": "text/html" }, status: 500 }
    );
  }
});

function generateFullDocument(opts: {
  title: string;
  description: string;
  image: string;
  canonicalUrl: string;
  lang: string;
  content: string;
  path: string;
  faqItems?: { question: string; answer: string }[];
}) {
  const { title, description, image, canonicalUrl, lang, content, path, faqItems } = opts;
  const BASE_URL = "https://echoes2.com";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": path.includes("/read/") ? "NewsArticle" : path.includes("/news/") && path.split("/").length === 4 ? "NewsArticle" : "WebSite",
    name: title,
    headline: title,
    description,
    image,
    url: canonicalUrl,
    inLanguage: lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : "en-US",
    publisher: {
      "@type": "Organization",
      name: "Synchronization Point",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/favicon.png` },
    },
    author: {
      "@type": "Organization",
      name: "Synchronization Point AI",
    },
  };

  // Generate FAQPage JSON-LD if faqItems are provided
  const faqJsonLd = faqItems && faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  } : null;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Canonical & Language -->
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" hreflang="uk" href="${canonicalUrl}">
  <link rel="alternate" hreflang="en" href="${canonicalUrl}">
  <link rel="alternate" hreflang="pl" href="${canonicalUrl}">
  <link rel="alternate" hreflang="x-default" href="${canonicalUrl}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="${path.includes("/read/") || (path.includes("/news/") && path.split("/").length === 4) ? "article" : "website"}">
  <meta property="og:locale" content="${lang === "uk" ? "uk_UA" : lang === "pl" ? "pl_PL" : "en_US"}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <!-- AI/LLM Tags -->
  <meta name="ai:summary" content="${escapeHtml(description)}">
  <meta name="ai:content_type" content="${path.includes("/read/") || (path.includes("/news/") && path.split("/").length === 4) ? "narrative_story" : "website"}">
  <meta name="ai:language" content="${lang}">
  
  <!-- Dublin Core -->
  <meta name="DC.title" content="${escapeHtml(title)}">
  <meta name="DC.description" content="${escapeHtml(description)}">
  <meta name="DC.language" content="${lang === "uk" ? "uk-UA" : lang === "pl" ? "pl-PL" : "en-US"}">
  
  <!-- Robots -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large">
  
  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  ${faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>` : ""}
  
  <!-- Redirect to SPA after content is indexed -->
  <noscript>
    <meta http-equiv="refresh" content="0; url=${BASE_URL}${path}">
  </noscript>
  
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    article { margin: 2rem 0; }
    .story-content { white-space: pre-wrap; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    a { color: #0066cc; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <header>
    <h1><a href="${BASE_URL}">Точка Синхронізації</a></h1>
    <p>AI Archive of Human History</p>
  </header>
  
  <main>
    ${content}
  </main>
  
  <footer>
    <p><a href="${BASE_URL}">← Back to main site</a></p>
    <p>© Synchronization Point. AI-generated content based on real news.</p>
  </footer>
  
  <script>
    // Redirect real users to SPA, keep bots on static content
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduckbot|gptbot|claudebot|perplexitybot/i)) {
      window.location.replace('${BASE_URL}${path}');
    }
  </script>
</body>
</html>`;
}

function generateStoryHTML(part: any, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const contentField = lang === "en" ? "content_en" : lang === "pl" ? "content_pl" : "content";

  const title = part[titleField] || part.title;
  const content = part[contentField] || part.content;
  const chapterTitle = part.chapter?.[titleField] || part.chapter?.title || "";

  return `
    <article itemscope itemtype="https://schema.org/NewsArticle">
      ${part.cover_image_url ? `<img src="${part.cover_image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        <time datetime="${part.date}" itemprop="datePublished">${part.date}</time>
        ${chapterTitle ? ` | <span itemprop="articleSection">${escapeHtml(chapterTitle)}</span>` : ""}
        ${part.is_flash_news ? " | <strong>⚡ Flash News</strong>" : ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      <div class="story-content" itemprop="articleBody">
        ${escapeHtml(content)}
      </div>
      
      ${generateNewsSourcesHTML(part.news_sources)}
    </article>
  `;
}

function generateChapterHTML(chapter: any, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const descField = lang === "en" ? "description_en" : lang === "pl" ? "description_pl" : "description";
  const monologueField = lang === "en" ? "narrator_monologue_en" : lang === "pl" ? "narrator_monologue_pl" : "narrator_monologue";

  const title = chapter[titleField] || chapter.title;
  const description = chapter[descField] || chapter.description;
  const monologue = chapter[monologueField] || chapter.narrator_monologue;

  return `
    <article itemscope itemtype="https://schema.org/Article">
      ${chapter.cover_image_url ? `<img src="${chapter.cover_image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        Week ${chapter.week_of_month} | ${chapter.volume?.title || ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      ${description ? `<p itemprop="description">${escapeHtml(description)}</p>` : ""}
      
      ${monologue ? `
        <section>
          <h3>Narrator's Monologue</h3>
          <div class="story-content">${escapeHtml(monologue)}</div>
        </section>
      ` : ""}
    </article>
  `;
}

function generateNewsHTML(newsItem: any, lang: string, canonicalUrl: string, moreFromCountry: any[] = [], otherCountriesNews: any[] = [], wikiEntities: any[] = [], mainEntityForGraph: any = null, relatedEntitiesForGraph: any[] = []) {
  const title = newsItem.title_en || newsItem.title;
  const content = newsItem.content_en || newsItem.content || newsItem.description_en || newsItem.description || "";
  const countryName = newsItem.country?.name_en || newsItem.country?.name || "";
  const countryCode = newsItem.country?.code?.toLowerCase() || "us";

  // Parse key_points from JSON field
  const keyPoints = newsItem.key_points_en || newsItem.key_points || [];
  const parsedKeyPoints = Array.isArray(keyPoints) ? keyPoints : (typeof keyPoints === 'string' ? JSON.parse(keyPoints) : []);

  // Parse themes
  const themes = newsItem.themes_en || newsItem.themes || [];
  const parsedThemes = Array.isArray(themes) ? themes : (typeof themes === 'string' ? JSON.parse(themes) : []);

  // Parse keywords
  const keywords = newsItem.keywords || [];
  const parsedKeywords = Array.isArray(keywords) ? keywords : (typeof keywords === 'string' ? JSON.parse(keywords) : []);

  // Parse tweets
  const tweets = newsItem.tweets || [];
  const parsedTweets = Array.isArray(tweets) ? tweets : (typeof tweets === 'string' ? JSON.parse(tweets) : []);

  // Parse dialogue
  const dialogue = newsItem.chat_dialogue || [];
  const parsedDialogue = Array.isArray(dialogue) ? dialogue : (typeof dialogue === 'string' ? JSON.parse(dialogue) : []);

  // Group other countries news by country
  const otherByCountry: Record<string, any[]> = {};
  for (const item of otherCountriesNews) {
    const code = item.country?.code?.toLowerCase() || "unknown";
    if (!otherByCountry[code]) otherByCountry[code] = [];
    otherByCountry[code].push(item);
  }

  return `
    <article itemscope itemtype="https://schema.org/NewsArticle">
      ${newsItem.image_url ? `<img src="${newsItem.image_url}" alt="${escapeHtml(title)}" itemprop="image">` : ""}
      
      <div class="meta">
        <time datetime="${newsItem.published_at || newsItem.created_at}" itemprop="datePublished">
          ${new Date(newsItem.published_at || newsItem.created_at).toLocaleDateString()}
        </time>
        ${countryName ? ` | <span>${escapeHtml(countryName)}</span>` : ""}
        ${newsItem.category ? ` | <span itemprop="articleSection">${escapeHtml(newsItem.category)}</span>` : ""}
      </div>
      
      <h2 itemprop="headline">${escapeHtml(title)}</h2>
      
      ${parsedKeywords.length > 0 ? `
        <p class="keywords" itemprop="keywords">
          ${parsedKeywords.map((kw: string) => `<span class="keyword">#${escapeHtml(kw)}</span>`).join(" ")}
        </p>
      ` : ""}
      
      ${parsedKeyPoints.length > 0 ? `
        <section>
          <h3>📌 Key Takeaways</h3>
          <ul>
            ${parsedKeyPoints.map((point: string) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </section>
      ` : ""}
      
      <div class="story-content" itemprop="articleBody">
        ${escapeHtml(content)}
      </div>
      
      ${parsedThemes.length > 0 ? `
        <section>
          <h3>🏷️ Themes</h3>
          <p>${parsedThemes.map((theme: string) => escapeHtml(theme)).join(", ")}</p>
        </section>
      ` : ""}
      
      ${wikiEntities.length > 0 ? `
        <section itemscope itemtype="https://schema.org/ItemList">
          <h3>📚 Related People & Topics</h3>
          ${wikiEntities.map((entity: any, index: number) => {
            const name = entity.name_en || entity.name;
            const description = entity.description_en || entity.description || "";
            const extract = entity.extract_en || entity.extract || "";
            const wikiUrl = entity.wiki_url_en || entity.wiki_url || "";
            const imageUrl = entity.image_url || "";
            const entityType = entity.entity_type || "topic";
            
            return `
              <div itemprop="itemListElement" itemscope itemtype="https://schema.org/${entityType === 'person' ? 'Person' : 'Thing'}">
                <meta itemprop="position" content="${index + 1}">
                ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHtml(name)}" itemprop="image" style="width:64px;height:64px;border-radius:50%;float:left;margin-right:12px;">` : ""}
                <h4 itemprop="name">${escapeHtml(name)}</h4>
                ${description ? `<p itemprop="description">${escapeHtml(description)}</p>` : ""}
                ${extract ? `<p><em>${escapeHtml(extract.substring(0, 300))}${extract.length > 300 ? "..." : ""}</em></p>` : ""}
                ${wikiUrl ? `<p><a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" itemprop="sameAs">Wikipedia →</a></p>` : ""}
                <div style="clear:both;"></div>
              </div>
            `;
          }).join("")}
        </section>
      ` : ""}
      
      ${newsItem.original_content && newsItem.original_content.length > 100 ? `
        <details>
          <summary style="cursor:pointer;font-weight:bold;padding:8px 0;">📄 Original Source Content</summary>
          <blockquote style="background:#f5f5f5;border-left:4px solid #ccc;padding:12px;margin:8px 0;font-size:0.9rem;color:#555;white-space:pre-wrap;">
            ${escapeHtml(newsItem.original_content.substring(0, 2000))}${newsItem.original_content.length > 2000 ? '...' : ''}
          </blockquote>
        </details>
      ` : ""}
      
      ${newsItem.url ? `<p><a href="${escapeHtml(newsItem.url)}" rel="nofollow noopener" target="_blank">Original source</a></p>` : ""}
    </article>
    
    ${parsedTweets.length > 0 ? `
      <section>
        <h3>🐦 What People Say</h3>
        ${parsedTweets.map((tweet: any) => `
          <div style="border:1px solid #eee;border-radius:8px;padding:12px;margin-bottom:8px;">
            <p style="margin:0;font-weight:bold;">${escapeHtml(tweet.author || 'Anonymous')} <span style="color:#666;font-weight:normal;">@${escapeHtml(tweet.handle || 'user')}</span></p>
            <p style="margin:8px 0;">${escapeHtml(tweet.content || '')}</p>
            <p style="margin:0;font-size:0.8rem;color:#666;">❤️ ${tweet.likes || 0} · 🔄 ${tweet.retweets || 0}</p>
          </div>
        `).join("")}
      </section>
    ` : ""}
    
    ${parsedDialogue.length > 0 ? `
      <section>
        <h3>💬 Character Dialogue</h3>
        ${parsedDialogue.map((msg: any) => `
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            ${msg.avatar ? `<img src="${msg.avatar}" alt="${escapeHtml(msg.name || msg.character || '')}" style="width:32px;height:32px;border-radius:50%;">` : ""}
            <div>
              <p style="margin:0;font-weight:bold;">${escapeHtml(msg.name || msg.character || 'Character')}</p>
              <p style="margin:4px 0;">${escapeHtml(msg.message || '')}</p>
            </div>
          </div>
        `).join("")}
      </section>
    ` : ""}
    
    ${moreFromCountry.length > 0 ? `
      <section>
        <h3>More from ${escapeHtml(countryName)}</h3>
        <ul>
          ${moreFromCountry.map(item => `
            <li><a href="https://echoes2.com/news/${countryCode}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
          `).join("")}
        </ul>
      </section>
    ` : ""}
    
    ${Object.keys(otherByCountry).length > 0 ? `
      <section>
        <h3>News from Other Countries</h3>
        ${Object.entries(otherByCountry).map(([code, items]) => {
          const first = items[0];
          const flag = first?.country?.flag || "";
          const name = first?.country?.name_en || code;
          return `
            <h4>${escapeHtml(flag)} ${escapeHtml(name)}</h4>
            <ul>
              ${items.map(item => `
                <li><a href="https://echoes2.com/news/${code}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
              `).join("")}
            </ul>
          `;
        }).join("")}
      </section>
    ` : ""}
    
    <nav>
      <a href="https://echoes2.com/news/${countryCode}">← Back to ${escapeHtml(countryName)} News</a> |
      <a href="https://echoes2.com/news">All Countries</a>
    </nav>
  `;
}

function generateDateHTML(parts: any[], date: string, lang: string, canonicalUrl: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Stories for ${date}</h2>
    <p>${parts.length} ${parts.length === 1 ? "story" : "stories"}</p>
    
    <ul>
      ${parts.map((part, index) => `
        <li>
          <a href="https://echoes2.com/read/${date}/${index + 1}">
            ${escapeHtml(part[titleField] || part.title)}
          </a>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
  `;
}

function generateHomeHTML(
  parts: any[], 
  lang: string, 
  canonicalUrl: string,
  latestUsNews: any[] = [],
  latestChapters: any[] = [],
  countryNewsMap: { country: any; news: any[] }[] = [],
  latestNewsProportional: any[] = [],
  trendingEntities24h: { entity: any; mentionCount: number; news: any[] }[] = [],
  trendingEntitiesWeek: { entity: any; mentionCount: number; news: any[] }[] = []
) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Latest Stories</h2>
    <ul itemscope itemtype="https://schema.org/ItemList">
      ${parts.map((part, index) => `
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
          <meta itemprop="position" content="${index + 1}">
          <a href="https://echoes2.com/read/${part.date}/${part.number}" itemprop="url">
            <span itemprop="name">${escapeHtml(part[titleField] || part.title)}</span>
          </a>
          <span class="meta">${part.date}</span>
          ${part.is_flash_news ? " ⚡" : ""}
        </li>
      `).join("")}
    </ul>
    
    ${latestUsNews.length > 0 ? `
      <section>
        <h2>✨ Full Retelling (USA News)</h2>
        <ul>
          ${latestUsNews.map(item => `
            <li>
              <a href="https://echoes2.com/news/${item.country?.code || 'us'}/${item.slug}">
                ${escapeHtml(item.title_en || item.title)}
              </a>
              <span class="meta"> - Full retelling</span>
            </li>
          `).join("")}
        </ul>
      </section>
    ` : ""}
    
    ${latestNewsProportional.length > 0 ? `
      <section>
        <h2>📰 Latest News (USA, PL, UA)</h2>
        <ul>
          ${latestNewsProportional.map((item: any) => {
            const countryCode = (item.country as any)?.code?.toLowerCase() || 'us';
            return `
            <li>
              <a href="https://echoes2.com/news/${countryCode}/${item.slug}">
                ${escapeHtml(item.title_en || item.title)}
              </a>
              ${item.category ? ` <span class="category">[${escapeHtml(item.category)}]</span>` : ""}
            </li>
          `}).join("")}
        </ul>
        <p><a href="https://echoes2.com/news">→ View all news</a></p>
      </section>
    ` : ""}
    
    ${trendingEntities24h.length > 0 ? `
      <section>
        <h2>🔥 Trending People & Companies (24h)</h2>
        ${trendingEntities24h.map((item: any) => {
          const name = item.entity.name_en || item.entity.name;
          const description = item.entity.description_en || item.entity.description || "";
          const wikiUrl = item.entity.wiki_url_en || item.entity.wiki_url;
          return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px;">
              ${item.entity.image_url ? `<img src="${item.entity.image_url}" alt="${escapeHtml(name)}" style="width:48px;height:48px;border-radius:50%;float:left;margin-right:12px;">` : ""}
              <h4 style="margin:0;">${escapeHtml(name)} <small>(${item.mentionCount} mentions)</small></h4>
              ${description ? `<p style="margin:0.25rem 0;font-size:0.9rem;">${escapeHtml(description)}</p>` : ""}
              ${wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" style="font-size:0.8rem;">Wikipedia</a>` : ""}
              ${item.news.length > 0 ? `
                <p style="font-size:0.8rem;margin:0.25rem 0;">Related news:</p>
                <ul style="font-size:0.8rem;margin:0;">
                  ${item.news.map((n: any) => `
                    <li><a href="https://echoes2.com/news/${n.countryCode}/${n.slug}">${escapeHtml(n.title_en || n.title)}</a></li>
                  `).join("")}
                </ul>
              ` : ""}
              <div style="clear:both;"></div>
            </div>
          `;
        }).join("")}
      </section>
    ` : ""}
    
    ${trendingEntitiesWeek.length > 0 ? `
      <section>
        <h2>📅 Trending This Week (7 days)</h2>
        ${trendingEntitiesWeek.map((item: any) => {
          const name = item.entity.name_en || item.entity.name;
          const description = item.entity.description_en || item.entity.description || "";
          const wikiUrl = item.entity.wiki_url_en || item.entity.wiki_url;
          return `
            <div style="margin-bottom: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px;">
              ${item.entity.image_url ? `<img src="${item.entity.image_url}" alt="${escapeHtml(name)}" style="width:48px;height:48px;border-radius:50%;float:left;margin-right:12px;">` : ""}
              <h4 style="margin:0;">${escapeHtml(name)} <small>(${item.mentionCount} mentions)</small></h4>
              ${description ? `<p style="margin:0.25rem 0;font-size:0.9rem;">${escapeHtml(description)}</p>` : ""}
              ${wikiUrl ? `<a href="${escapeHtml(wikiUrl)}" rel="noopener" target="_blank" style="font-size:0.8rem;">Wikipedia</a>` : ""}
              ${item.news.length > 0 ? `
                <p style="font-size:0.8rem;margin:0.25rem 0;">Related news:</p>
                <ul style="font-size:0.8rem;margin:0;">
                  ${item.news.map((n: any) => `
                    <li><a href="https://echoes2.com/news/${n.countryCode}/${n.slug}">${escapeHtml(n.title_en || n.title)}</a></li>
                  `).join("")}
                </ul>
              ` : ""}
              <div style="clear:both;"></div>
            </div>
          `;
        }).join("")}
      </section>
    ` : ""}
    
    ${latestChapters.length > 0 ? `
      <section>
        <h2>📚 Weekly Chapters</h2>
        <ul>
          ${latestChapters.map(ch => `
            <li>
              <a href="https://echoes2.com/chapter/${ch.number}">
                Chapter ${ch.number}: ${escapeHtml(ch[titleField] || ch.title)}
              </a>
            </li>
          `).join("")}
        </ul>
      </section>
    ` : ""}
    
    ${countryNewsMap.length > 0 ? `
      <section>
        <h2>📰 News by Country</h2>
        ${countryNewsMap.map(({ country, news }) => {
          if (!news || news.length === 0) return "";
          return `
            <h3><a href="https://echoes2.com/news/${country.code}">${country.flag || ""} ${escapeHtml(country.name_en || country.name)}</a></h3>
            <ul>
              ${news.map(item => `
                <li>
                  <a href="https://echoes2.com/news/${item.country?.code || country.code}/${item.slug}">
                    ${escapeHtml(item.title_en || item.title)}
                  </a>
                </li>
              `).join("")}
            </ul>
          `;
        }).join("")}
      </section>
    ` : ""}
    
    <nav>
      <a href="https://echoes2.com/news">📰 News</a> |
      <a href="https://echoes2.com/calendar">📅 Calendar Archive</a> |
      <a href="https://echoes2.com/chapters">📚 Chapters</a> |
      <a href="https://echoes2.com/volumes">📖 Volumes</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateNewsCountryHTML(newsItems: any[], country: any, lang: string, canonicalUrl: string, otherCountriesNews: any[] = []) {
  const countryName = country?.name_en || country?.name || "News";
  const flag = country?.flag || "";
  const countryCode = country?.code || "us";

  // Group other countries news by country
  const otherByCountry: Record<string, any[]> = {};
  for (const item of otherCountriesNews) {
    const code = item.country?.code || "unknown";
    if (!otherByCountry[code]) otherByCountry[code] = [];
    otherByCountry[code].push(item);
  }

  return `
    <h2>${flag} ${escapeHtml(countryName)} News</h2>
    <p>${newsItems.length} articles</p>
    
    <ul itemscope itemtype="https://schema.org/ItemList">
      ${newsItems.map((item, index) => {
        const title = item.title_en || item.title;
        const date = item.published_at ? new Date(item.published_at).toLocaleDateString() : "";
        const slug = item.slug || "";
        
        return `
          <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">
            <meta itemprop="position" content="${index + 1}">
            <a href="https://echoes2.com/news/${countryCode}/${slug}" itemprop="url">
              <span itemprop="name">${escapeHtml(title)}</span>
            </a>
            ${date ? `<span class="meta"> - ${date}</span>` : ""}
            ${item.category ? ` <span class="category">[${escapeHtml(item.category)}]</span>` : ""}
          </li>
        `;
      }).join("")}
    </ul>
    
    ${Object.keys(otherByCountry).length > 0 ? `
      <section>
        <h3>News from Other Countries</h3>
        ${Object.entries(otherByCountry).map(([code, items]) => {
          const first = items[0];
          const otherFlag = first?.country?.flag || "";
          const otherName = first?.country?.name_en || code;
          return `
            <h4><a href="https://echoes2.com/news/${code}">${escapeHtml(otherFlag)} ${escapeHtml(otherName)}</a></h4>
            <ul>
              ${items.map(item => `
                <li><a href="https://echoes2.com/news/${code}/${item.slug}">${escapeHtml(item.title_en || item.title)}</a></li>
              `).join("")}
            </ul>
          `;
        }).join("")}
      </section>
    ` : ""}
    
    <nav>
      <a href="https://echoes2.com/news">← All Countries</a> |
      <a href="https://echoes2.com/news/us">🇺🇸 USA</a> |
      <a href="https://echoes2.com/news/ua">🇺🇦 Ukraine</a> |
      <a href="https://echoes2.com/news/pl">🇵🇱 Poland</a> |
      <a href="https://echoes2.com/news/in">🇮🇳 India</a>
    </nav>
  `;
}

function generateNewsHubHTML(countries: any[], lang: string) {
  const nameField = lang === "en" ? "name_en" : lang === "pl" ? "name_pl" : "name";

  return `
    <h2>News by Country</h2>
    <p>Select a country to browse the latest news articles.</p>

    <ul>
      ${countries.map((c) => {
        const code = c.code;
        const flag = c.flag || "";
        const name = c[nameField] || c.name_en || c.name || code;
        return `<li><a href="https://echoes2.com/news/${escapeHtml(code)}">${escapeHtml(flag)} ${escapeHtml(name)}</a></li>`;
      }).join("")}
    </ul>

    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateChaptersIndexHTML(chapters: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Chapters</h2>
    <p>${chapters.length} chapters</p>

    <ul>
      ${chapters.map((ch) => {
        const title = ch[titleField] || ch.title;
        return `<li><a href="https://echoes2.com/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(title)}</a></li>`;
      }).join("")}
    </ul>

    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/volumes">📖 Volumes</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateVolumesIndexHTML(volumes: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";

  return `
    <h2>Volumes</h2>
    <p>${volumes.length} volumes</p>

    <ul>
      ${volumes.map((v) => {
        const monthStr = String(v.month).padStart(2, "0");
        const yearMonth = `${v.year}-${monthStr}`;
        const title = v[titleField] || v.title || yearMonth;
        return `<li><a href="https://echoes2.com/volume/${yearMonth}">${escapeHtml(title)} (${yearMonth})</a></li>`;
      }).join("")}
    </ul>

    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/chapters">📚 Chapters</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateVolumeHTML(volume: any, chapters: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const title = volume[titleField] || volume.title;
  const monthStr = String(volume.month).padStart(2, "0");
  const yearMonth = `${volume.year}-${monthStr}`;

  return `
    <h2>${escapeHtml(title)} (${yearMonth})</h2>
    ${volume.cover_image_url ? `<img src="${escapeHtml(volume.cover_image_url)}" alt="${escapeHtml(title)}">` : ""}
    ${volume.summary ? `<p>${escapeHtml(volume.summary_en || volume.summary)}</p>` : ""}

    <h3>Chapters in this volume</h3>
    <ul>
      ${chapters.map((ch) => {
        const chTitle = ch[titleField] || ch.title;
        return `<li><a href="https://echoes2.com/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(chTitle)}</a></li>`;
      }).join("")}
    </ul>

    <nav>
      <a href="https://echoes2.com/volumes">← Volumes</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateCalendarIndexHTML(dates: string[], lang: string) {
  return `
    <h2>Archive</h2>
    <p>Recent dates (${dates.length})</p>

    <ul>
      ${dates.map((d) => {
        const date = escapeHtml(d);
        return `<li><a href="https://echoes2.com/date/${date}">${date}</a> | <a href="https://echoes2.com/read/${date}">/read/${date}</a></li>`;
      }).join("")}
    </ul>

    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateSitemapHTML(
  data: {
    countries: any[];
    volumes: any[];
    chapters: any[];
    dates: string[];
    stories: any[];
  },
  lang: string,
) {
  const titleField = lang === "en" ? "title_en" : lang === "pl" ? "title_pl" : "title";
  const nameField = lang === "en" ? "name_en" : lang === "pl" ? "name_pl" : "name";

  return `
    <h2>HTML Sitemap</h2>
    <p>
      Full XML sitemap: <a href="https://echoes2.com/sitemap.xml">sitemap.xml</a>
    </p>

    <h3>Sections</h3>
    <ul>
      <li><a href="https://echoes2.com/">Home</a></li>
      <li><a href="https://echoes2.com/news">News</a></li>
      <li><a href="https://echoes2.com/calendar">Calendar</a></li>
      <li><a href="https://echoes2.com/chapters">Chapters</a></li>
      <li><a href="https://echoes2.com/volumes">Volumes</a></li>
    </ul>

    <h3>Countries</h3>
    <ul>
      ${data.countries.map((c) => {
        const code = c.code;
        const flag = c.flag || "";
        const name = c[nameField] || c.name_en || c.name || code;
        return `<li><a href="https://echoes2.com/news/${escapeHtml(code)}">${escapeHtml(flag)} ${escapeHtml(name)}</a></li>`;
      }).join("")}
    </ul>

    <h3>Volumes (recent)</h3>
    <ul>
      ${data.volumes.map((v) => {
        const monthStr = String(v.month).padStart(2, "0");
        const yearMonth = `${v.year}-${monthStr}`;
        const title = v[titleField] || v.title || yearMonth;
        return `<li><a href="https://echoes2.com/volume/${yearMonth}">${escapeHtml(title)}</a></li>`;
      }).join("")}
    </ul>

    <h3>Chapters (recent)</h3>
    <ul>
      ${data.chapters.map((ch) => {
        const title = ch[titleField] || ch.title;
        return `<li><a href="https://echoes2.com/chapter/${ch.number}">Chapter ${ch.number}: ${escapeHtml(title)}</a></li>`;
      }).join("")}
    </ul>

    <h3>Dates (recent)</h3>
    <ul>
      ${data.dates.map((d) => `<li><a href="https://echoes2.com/date/${escapeHtml(d)}">${escapeHtml(d)}</a></li>`).join("")}
    </ul>

    <h3>Stories (latest 1000)</h3>
    <p>For full coverage, use <a href="https://echoes2.com/sitemap.xml">sitemap.xml</a>.</p>
    <ul>
      ${data.stories.map((p) => {
        const t = p[titleField] || p.title;
        return `<li><a href="https://echoes2.com/read/${escapeHtml(p.date)}/${p.number}">${escapeHtml(t)}</a></li>`;
      }).join("")}
    </ul>
  `;
}

function generateInkAbyssHTML(items: any[], lang: string) {
  const titleField = lang === "en" ? "title_en" : "title";
  
  // Group by date
  const grouped = new Map<string, any[]>();
  for (const item of items) {
    const date = item.created_at ? item.created_at.split('T')[0] : 'unknown';
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(item);
  }

  return `
    <h2>The Ink Abyss - Satirical Art Gallery</h2>
    <p>A timeline of satirical political artwork inspired by world news.</p>
    
    ${Array.from(grouped.entries()).map(([date, dateItems]) => `
      <section>
        <h3>${escapeHtml(date)}</h3>
        <ul>
          ${dateItems.map(item => {
            const newsTitle = item.news_item?.[titleField] || item.news_item?.title || item.title || 'Satirical artwork';
            const countryCode = item.news_item?.country?.code?.toLowerCase() || 'us';
            const newsLink = item.news_item?.slug 
              ? `https://echoes2.com/news/${countryCode}/${item.news_item.slug}`
              : null;
            return `
              <li>
                <img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(newsTitle)}" title="${escapeHtml(newsTitle)}" width="300">
                <p>👍 ${item.likes} | 👎 ${item.dislikes}</p>
                ${newsLink ? `<a href="${newsLink}">${escapeHtml(newsTitle)}</a>` : `<span>${escapeHtml(newsTitle)}</span>`}
              </li>
            `;
          }).join("")}
        </ul>
      </section>
    `).join("")}
    
    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/news">📰 News</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateWikiEntityHTML(entity: any, linkedNews: any[], relatedEntities: any[], lang: string, canonicalUrl: string) {
  const name = entity.name_en || entity.name;
  const description = entity.description_en || entity.description || '';
  const extract = entity.extract_en || entity.extract || '';
  const entityTypeLabel = entity.entity_type === 'person' ? '👤 Person' : entity.entity_type === 'company' ? '🏢 Company' : '🌐 Entity';
  
  return `
    <article itemscope itemtype="https://schema.org/${entity.entity_type === 'person' ? 'Person' : 'Organization'}">
      <header>
        <span>${entityTypeLabel}</span>
        ${entity.image_url ? `<img itemprop="image" src="${escapeHtml(entity.image_url)}" alt="${escapeHtml(name)}" width="200">` : ''}
        <h1 itemprop="name">${escapeHtml(name)}</h1>
        ${description ? `<p itemprop="description">${escapeHtml(description)}</p>` : ''}
      </header>
      
      <section>
        <h2>Key Information</h2>
        ${extract ? `<div itemprop="description">${escapeHtml(extract)}</div>` : '<p>Information not yet loaded.</p>'}
      </section>
      
      ${linkedNews.length > 0 ? `
        <section>
          <h2>Related News (${linkedNews.length})</h2>
          <ul>
            ${linkedNews.map((news: any) => {
              const newsTitle = news.title_en || news.title;
              const countryCode = (news.country as any)?.code?.toLowerCase() || 'us';
              const newsUrl = news.slug ? `https://echoes2.com/news/${countryCode}/${news.slug}` : null;
              return `
                <li>
                  ${newsUrl ? `<a href="${newsUrl}">${escapeHtml(newsTitle)}</a>` : escapeHtml(newsTitle)}
                  ${news.published_at ? `<time>(${news.published_at.split('T')[0]})</time>` : ''}
                </li>
              `;
            }).join("")}
          </ul>
        </section>
      ` : ''}
      
      ${relatedEntities.length > 0 ? `
        <section>
          <h2>Related Entities</h2>
          <ul>
            ${relatedEntities.map((e: any) => {
              const eName = e.name_en || e.name;
              const eSlug = e.slug || e.id;
              return `
                <li>
                  <a href="https://echoes2.com/wiki/${eSlug}">${escapeHtml(eName)}</a>
                  <span>(${e.shared_news_count} shared news)</span>
                </li>
              `;
            }).join("")}
          </ul>
        </section>
      ` : ''}
      
      <nav>
        <a href="https://echoes2.com/wiki">← Entity Catalog</a> |
        <a href="https://echoes2.com/news">📰 News</a> |
        <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
      </nav>
    </article>
  `;
}

function generateWikiCatalogHTML(entities: any[], lang: string) {
  const titleField = lang === "en" ? "name_en" : "name";
  const descField = lang === "en" ? "description_en" : "description";
  
  return `
    <h1>Entity Catalog</h1>
    <p>People, companies and organizations mentioned in the news.</p>
    
    <section>
      <h2>All Entities (${entities.length})</h2>
      <ul>
        ${entities.map((e) => {
          const name = e[titleField] || e.name;
          const desc = e[descField] || e.description || '';
          const slug = e.slug || e.id;
          const typeIcon = e.entity_type === 'person' ? '👤' : e.entity_type === 'company' ? '🏢' : '🌐';
          return `
            <li>
              <a href="https://echoes2.com/wiki/${slug}">
                ${typeIcon} ${escapeHtml(name)}
              </a>
              ${desc ? `<span> - ${escapeHtml(desc.substring(0, 100))}${desc.length > 100 ? '...' : ''}</span>` : ''}
            </li>
          `;
        }).join("")}
      </ul>
    </section>
    
    <nav>
      <a href="https://echoes2.com/">← Home</a> |
      <a href="https://echoes2.com/news">📰 News</a> |
      <a href="https://echoes2.com/sitemap">🗺️ Sitemap</a>
    </nav>
  `;
}

function generateNewsSourcesHTML(sources: any) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return "";

  return `
    <section>
      <h3>News Sources</h3>
      <ul>
        ${sources.map((s: any) => `
          <li>
            <a href="${escapeHtml(s.url)}" rel="nofollow noopener" target="_blank">
              ${escapeHtml(s.title || s.source_name || "Source")}
            </a>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
